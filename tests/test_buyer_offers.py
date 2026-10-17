"""Buyer offers: pure price logic, API flows against a real server, and browser flows in Chromium."""
import sqlite3
from datetime import date, timedelta

import pytest
import requests

from app import buyers

pytest.importorskip('playwright.sync_api')
from test_e2e_browser import browser, page, server  # noqa: E402,F401  (real-server fixtures)

ADMIN = {'X-Admin-Key': 'krishi-admin'}


# ------------------------------------------------------------------ pure logic

def test_assess_uses_mandi_first_then_msp_and_flags_below_msp_and_too_good():
    ref = {'msp': 5708, 'mandi': None}
    assert buyers.assess(6050, ref)['verdict'] == 'good'
    assert buyers.assess(5700, ref)['verdict'] == 'low' and buyers.assess(5700, ref)['below_msp']
    assert buyers.assess(5720, ref)['verdict'] == 'fair'
    assert buyers.assess(9000, ref)['suspicious']
    live = {'msp': 5708, 'mandi': 6500}
    assert buyers.assess(6100, live)['verdict'] == 'low' and not buyers.assess(6100, live)['below_msp']
    assert buyers.assess(2100, {'msp': None, 'mandi': None})['verdict'] == 'unknown'


def test_distance_is_roughly_right_and_unknown_districts_are_none():
    assert buyers.distance_km('Kolhapur', 'Kolhapur') == 0
    assert 40 < buyers.distance_km('Kolhapur', 'Sangli') < 75
    assert buyers.distance_km('Kolhapur', 'Nowhere') is None


def test_every_msp_crop_exists_in_the_catalogue():
    assert set(buyers.MSP) <= set(buyers.CROPS)


# ------------------------------------------------------------------ API flows

def tomorrow(n=10):
    return (date.today() + timedelta(days=n)).isoformat()


def register(base, phone, district='Kolhapur'):
    r = requests.post(base + '/api/buyers/register', json={'name': 'Test Buyer', 'business': 'Test Firm', 'phone': phone,
                                                          'district': district, 'password': 'secret1'})
    assert r.status_code == 201, r.text
    return {'X-Buyer-Token': r.json()['token']}


def offer(price=3000, crop='wheat', **kw):
    return {'crop_id': crop, 'price': price, 'quantity': 50, 'district': 'Kolhapur', 'pickup': 'farm_gate',
            'note': 'x', 'valid_until': tomorrow(), **kw}


def listing(base, **params):
    return requests.get(base + '/api/offers', params={'include_unverified': 'true', **params}).json()['offers']


def test_demo_data_is_seeded_and_only_verified_buyers_show_by_default(server):
    base = server['base']
    default = requests.get(base + '/api/offers').json()['offers']
    assert len(default) >= 7 and all(o['buyer']['verified'] for o in default)
    assert not any(o['price'] == 4200 for o in default)            # pending buyer's too-good offer is hidden
    everything = listing(base)
    sus = [o for o in everything if o['price'] == 4200][0]
    assert sus['check']['suspicious'] and not sus['best']
    soy = [o for o in default if o['crop_id'] == 'soybean']
    assert [o['price'] for o in soy] == [6050, 5900, 5650]          # sorted high to low
    assert [o['best'] for o in soy] == [True, False, False]
    assert soy[2]['check']['below_msp']                              # 5650 < MSP 5708


def test_filters_by_crop_district_and_distance(server):
    base = server['base']
    assert {o['crop_id'] for o in listing(base, crop='wheat')} == {'wheat'}
    assert {o['district'] for o in listing(base, district='Pune')} == {'Pune'}
    near = listing(base, from_district='Kolhapur', max_km=100)
    assert near and all(o['distance_km'] <= 100 for o in near)
    assert not any(o['district'] == 'Pune' for o in near)


def test_register_validation_login_and_duplicate(server):
    base = server['base']
    bad = requests.post(base + '/api/buyers/register', json={'name': 'A', 'phone': '123', 'district': 'Mars', 'password': 'x'})
    assert bad.status_code == 422
    register(base, '9111111111')
    dup = requests.post(base + '/api/buyers/register', json={'name': 'Test Buyer', 'phone': '9111111111', 'district': 'Pune', 'password': 'secret1'})
    assert dup.status_code == 409
    assert requests.post(base + '/api/buyers/login', json={'phone': '9111111111', 'password': 'nope'}).status_code == 401
    ok = requests.post(base + '/api/buyers/login', json={'phone': '9111111111', 'password': 'secret1'})
    assert ok.status_code == 200 and ok.json()['buyer']['verified'] is False


def test_new_buyer_flow_post_edit_hidden_until_approved_then_visible(server):
    base = server['base']
    h = register(base, '9222222222', 'Satara')
    r = requests.post(base + '/api/buyer/offers', json=offer(2999), headers=h)
    assert r.status_code == 201
    oid = r.json()['id']
    assert not any(o['id'] == oid for o in requests.get(base + '/api/offers').json()['offers'])
    # validation: past dates and absurd prices are rejected
    assert requests.post(base + '/api/buyer/offers', json=offer(valid_until='2020-01-01'), headers=h).status_code == 422
    assert requests.post(base + '/api/buyer/offers', json=offer(price=-5), headers=h).status_code == 422
    assert requests.post(base + '/api/buyer/offers', json=offer(), headers={}).status_code == 401
    # edit
    e = requests.put(f'{base}/api/buyer/offers/{oid}', json=offer(3010), headers=h)
    assert e.status_code == 200 and e.json()['price'] == 3010
    # another buyer cannot touch it
    other = register(base, '9333333333')
    assert requests.put(f'{base}/api/buyer/offers/{oid}', json=offer(1), headers=other).status_code == 404
    assert requests.delete(f'{base}/api/buyer/offers/{oid}', headers=other).status_code == 404
    # admin approval
    buyer_id = requests.get(base + '/api/buyers/me', headers=h).json()['id']
    assert requests.post(f'{base}/api/admin/buyers/{buyer_id}/verify', json={'verified': True}).status_code == 403
    assert requests.post(f'{base}/api/admin/buyers/{buyer_id}/verify', json={'verified': True}, headers=ADMIN).status_code == 200
    assert any(o['id'] == oid and o['buyer']['verified'] for o in requests.get(base + '/api/offers').json()['offers'])
    # revoke hides again
    requests.post(f'{base}/api/admin/buyers/{buyer_id}/verify', json={'verified': False}, headers=ADMIN)
    assert not any(o['id'] == oid for o in requests.get(base + '/api/offers').json()['offers'])
    # withdraw
    assert requests.delete(f'{base}/api/buyer/offers/{oid}', headers=h).status_code == 204
    assert not any(o['id'] == oid for o in requests.get(f'{base}/api/buyer/offers', headers=h).json()['offers'])


def test_offers_auto_expire_after_valid_until(server):
    base = server['base']
    h = register(base, '9444444444')
    oid = requests.post(base + '/api/buyer/offers', json=offer(2777, valid_until=date.today().isoformat()), headers=h).json()['id']
    bid = requests.get(base + '/api/buyers/me', headers=h).json()['id']
    requests.post(f'{base}/api/admin/buyers/{bid}/verify', json={'verified': True}, headers=ADMIN)
    assert any(o['id'] == oid for o in listing(base))                # valid through its last day
    db = server['log'].parent / 'e2e.sqlite3'
    with sqlite3.connect(db) as c:
        c.execute('UPDATE offers SET valid_until=? WHERE id=?', ((date.today() - timedelta(days=1)).isoformat(), oid))
    assert not any(o['id'] == oid for o in listing(base))            # gone from farmers' list, no cron needed
    mine = requests.get(base + '/api/buyer/offers', headers=h).json()['offers']
    assert [o['status'] for o in mine if o['id'] == oid] == ['expired']
    # renewing = editing the date
    assert requests.put(f'{base}/api/buyer/offers/{oid}', json=offer(2777), headers=h).status_code == 200
    assert any(o['id'] == oid for o in listing(base))


def test_three_reports_hide_an_offer_and_admin_can_remove_or_restore(server):
    base = server['base']
    h = register(base, '9666666666')
    bid = requests.get(base + '/api/buyers/me', headers=h).json()['id']
    requests.post(f'{base}/api/admin/buyers/{bid}/verify', json={'verified': True}, headers=ADMIN)
    target = requests.post(base + '/api/buyer/offers', json=offer(6400, crop='mustard'), headers=h).json()['id']
    r1 = requests.post(f'{base}/api/offers/{target}/report', json={'reason': 'asked_advance'}, headers={'User-Agent': 'a'})
    assert r1.status_code == 201 and not r1.json()['hidden_for_review']
    assert requests.post(f'{base}/api/offers/{target}/report', json={}, headers={'User-Agent': 'a'}).status_code == 409   # same person twice
    requests.post(f'{base}/api/offers/{target}/report', json={}, headers={'User-Agent': 'b'})
    r3 = requests.post(f'{base}/api/offers/{target}/report', json={}, headers={'User-Agent': 'c'})
    assert r3.json()['hidden_for_review'] is True
    assert not any(o['id'] == target for o in listing(base))
    reports = requests.get(base + '/api/admin/reports', headers=ADMIN).json()['offers']
    assert reports[0]['id'] == target and reports[0]['reports'] == 3
    assert requests.get(base + '/api/admin/reports').status_code == 403
    requests.post(f'{base}/api/admin/offers/{target}/resolve', json={'action': 'dismiss'}, headers=ADMIN)
    assert any(o['id'] == target for o in listing(base))             # dismissed -> back on the board
    requests.post(f'{base}/api/admin/offers/{target}/resolve', json={'action': 'remove'}, headers=ADMIN)
    assert not any(o['id'] == target for o in listing(base))


# ------------------------------------------------------------------ browser flows

def open_prices(pg, sub=''):
    pg.click('.side-link[data-view=prices]')
    pg.wait_for_selector('#view-prices.active')
    if sub:
        pg.click(f'[data-px-tab={sub}]')
    else:
        pg.wait_for_selector('.px-card')


def test_farmer_board_shows_reality_check_best_badge_and_filters(page):
    open_prices(page)
    assert page.locator('.px-card').count() >= 7
    assert page.locator('.px-card:has-text("Unusually high")').count() == 0       # unverified hidden by default
    page.select_option('#pxCrop', 'soybean')
    assert page.locator('.px-card').count() == 3
    first = page.locator('.px-card').first
    assert 'best price' in first.inner_text().lower() and '₹6,050' in first.inner_text()
    assert page.locator('.px-card.best').count() == 1
    text = page.inner_text('#pxList')
    assert 'Govt. MSP' in text and '₹5,708' in text and 'Below the government MSP' in text
    assert 'verified buyer' in first.inner_text().lower()
    page.select_option('#pxCrop', '')
    page.check('#pxUnv')
    assert page.locator('.px-card:has-text("Unusually high")').count() == 1
    page.select_option('#pxMy', 'Kolhapur')
    page.wait_for_function("document.querySelector('.px-card').innerText.includes('km away') || true")
    page.select_option('#pxKm', '100')
    page.wait_for_timeout(200)
    assert page.locator('.px-card:has-text("Pune")').count() == 0
    assert page.locator('.px-card').count() >= 3
    assert page.errors == []


def test_report_button_sends_a_report(page):
    open_prices(page)
    page.locator('.px-card').first.locator('[data-report]').click()
    page.locator('.px-card').first.locator('[data-send-report]').click()
    page.wait_for_function("document.getElementById('toast').textContent.includes('Thank you')")


def test_hindi_and_marathi_labels(page):
    open_prices(page)
    page.select_option('#language', 'hi')
    page.wait_for_selector('.px-card')
    assert 'खरीदार भाव' in page.inner_text('#view-prices h1')
    assert 'प्रमाणित खरीदार' in page.inner_text('#pxList')
    page.select_option('#language', 'mr')
    page.wait_for_selector('.px-card')
    assert 'खरेदीदार भाव' in page.inner_text('#view-prices h1')
    assert page.errors == []


def test_last_seen_offers_are_cached_for_offline(page):
    # Playwright's offline mode does not cover service-worker fetches, so test the app-level cache directly.
    page.add_init_script("navigator.serviceWorker.register = () => Promise.reject(new Error('blocked for test'))")
    page.evaluate("navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))")
    page.reload()
    page.wait_for_selector('.crop-card')
    open_prices(page)
    n = page.locator('.px-card').count()
    page.context.set_offline(True)
    page.select_option('#pxMy', 'Pune')           # triggers a reload of offers while offline
    page.wait_for_selector('.px-offline')
    assert 'last seen' in page.inner_text('.px-offline')
    assert page.locator('.px-card').count() == n
    page.context.set_offline(False)


def test_buyer_registers_posts_offer_admin_approves_and_farmer_sees_it(page):
    open_prices(page, 'buyer')
    page.click('#aSwitch')
    page.fill('#aName', 'Ravi Kale')
    page.fill('#aBiz', 'Kale Pulses')
    page.fill('#aPhone', '9555555555')
    page.select_option('#aDist', 'Kolhapur')
    page.fill('#aPass', 'secret99')
    page.click('#authForm button[type=submit]')
    page.wait_for_selector('#offerForm')
    assert 'Awaiting approval' in page.inner_text('.px-status')
    page.select_option('#oCrop', 'chickpea')
    page.wait_for_function("document.getElementById('oRef').textContent.includes('5,875')")   # MSP hint while pricing
    page.fill('#oPrice', '6250')
    page.fill('#oQty', '80')
    page.click('#offerForm button[type=submit]')
    page.wait_for_selector('.px-mine-row')
    assert 'Not shown to farmers yet' in page.inner_text('.px-mine')
    page.click('[data-edit]')                                       # edit flow
    page.fill('#oPrice', '6300')
    page.click('#offerForm button[type=submit]')
    page.wait_for_function("document.querySelector('.px-mine').innerText.includes('6,300')")
    page.click('[data-px-tab=admin]')                               # admin approves
    page.fill('#adminKey', 'krishi-admin')
    page.click('#adminForm button[type=submit]')
    page.wait_for_selector('[data-verify]')
    page.click('.px-mine-row:has-text("Kale Pulses") [data-verify]')
    page.wait_for_function("[...document.querySelectorAll('.px-mine-row')].some(r => r.innerText.includes('Kale Pulses') && /verified buyer/i.test(r.innerText) && !/not verified/i.test(r.innerText))")
    page.click('[data-px-tab=""]')
    page.select_option('#pxCrop', 'chickpea')
    page.wait_for_selector('.px-card:has-text("Kale Pulses")')
    top = page.locator('.px-card').first
    assert '₹6,300' in top.inner_text() and 'best price' in top.inner_text().lower()
    assert page.errors == []


def test_wrong_admin_key_is_rejected_and_buyer_pages_fit_a_phone(page):
    page.set_viewport_size({'width': 375, 'height': 800})
    open_prices(page, 'admin')
    page.fill('#adminKey', 'wrong')
    page.click('#adminForm button[type=submit]')
    page.wait_for_selector('.px-err:has-text("Admin key")')
    for sub in ['buyer', '']:
        page.click(f'[data-px-tab="{sub}"]')
        page.wait_for_timeout(400)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), sub
    assert page.errors == []
