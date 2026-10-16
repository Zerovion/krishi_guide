"""End-to-end browser test: real FastAPI server + real Chromium driving the PWA.

Skipped automatically when Playwright/Chromium isn't installed:
    pip install playwright && python -m playwright install chromium
"""
import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

pytest.importorskip('playwright.sync_api')
import requests  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


@pytest.fixture(scope='module')
def server(tmp_path_factory):
    tmp = tmp_path_factory.mktemp('e2e')
    port, log = free_port(), tmp / 'server.log'
    env = {**os.environ, 'KRISHI_DB': str(tmp / 'e2e.sqlite3'), 'PYTHONUNBUFFERED': '1'}
    env.pop('KRISHI_TEST_OTP', None)
    with open(log, 'w') as fh:
        proc = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', str(port)],
                                cwd=ROOT / 'backend', env=env, stdout=fh, stderr=subprocess.STDOUT)
    base = f'http://127.0.0.1:{port}'
    for _ in range(60):
        try:
            if requests.get(base + '/api/health', timeout=1).ok:
                break
        except requests.RequestException:
            time.sleep(0.25)
    else:
        proc.kill()
        pytest.fail('server did not start: ' + log.read_text())
    yield {'base': base, 'log': log}
    proc.terminate()
    proc.wait(timeout=10)


@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture()
def page(browser, server):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.on('console', lambda m: pg.errors.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.goto(server['base'] + '/')
    try:
        pg.wait_for_selector('.crop-card', timeout=15000)
    except Exception:
        raise AssertionError(f'planner never rendered; browser errors={pg.errors}; body={pg.inner_text("body")[:400]!r}; server log tail={server["log"].read_text()[-600:]}')
    yield pg
    ctx.close()


def go(pg, view):
    pg.click(f'.side-link[data-view={view}]')
    pg.wait_for_selector(f'#view-{view}.active')


def test_planner_loads_with_labelled_forms_and_ranked_cards(page):
    assert 'API connected' in page.inner_text('#healthStatus')
    labels = page.eval_on_selector_all('#season option', 'els => els.map(e => e.textContent.trim())')
    assert all(labels), labels                      # regression: options were blank
    assert page.locator('.crop-card').count() == 6
    assert page.locator('.crop-card.best').count() == 1
    assert page.errors == []


def test_profile_persists_across_views_and_reloads(page):
    page.fill('#district', 'Sangli, Maharashtra')
    page.select_option('#season', 'rabi')
    page.select_option('#soil', 'red')
    page.fill('#area', '3')
    page.click('#farmForm button[type=submit]')
    page.wait_for_timeout(600)
    go(page, 'rotation')
    page.wait_for_selector('#rotationResults .crop-card')
    assert page.input_value('#season') == 'rabi' and page.input_value('#soil') == 'red'
    assert page.input_value('#district').startswith('Sangli')
    page.reload()
    page.wait_for_selector('.crop-card')
    assert page.input_value('#season') == 'rabi' and page.input_value('#area') == '3'


def test_language_switch_translates_ui_and_options(page):
    page.select_option('#language', 'hi')
    page.wait_for_timeout(500)
    assert 'फसल' in page.inner_text('.side-link[data-view=planner]')
    assert 'खरीफ' in page.eval_on_selector('#season', 'el => el.selectedOptions[0].textContent')
    page.select_option('#language', 'mr')
    page.wait_for_timeout(500)
    assert 'पीक' in page.inner_text('#view-planner h1') or 'पीक' in page.inner_text('.side-link[data-view=planner]')


def test_plan_journey_opens_calendar_and_tasks_persist(page):
    page.click('[data-plan]')
    page.wait_for_selector('#view-calendar.active .tl-item')
    box = page.locator('[data-task]').first
    box.check()
    assert page.inner_text('#progressPct') != '0%'
    pct = page.inner_text('#progressPct')
    page.click('#genTimeline')
    page.wait_for_selector('.tl-item')
    assert page.inner_text('#progressPct') == pct   # progress restored from localStorage


def test_rotation_ranks_candidates_with_reasons(page):
    go(page, 'rotation')
    page.wait_for_selector('#rotationResults .crop-card')
    assert page.locator('#rotationResults .crop-card').count() >= 3
    assert 'rotation logic' in page.inner_text('#rotationResults').lower()


def test_water_plan_and_simulator_and_schemes(page):
    go(page, 'calendar')
    page.click('#runWater')
    page.wait_for_selector('.water-figure')
    go(page, 'simulator')
    page.wait_for_selector('.scenario')
    assert page.locator('.scenario').count() == 3
    go(page, 'schemes')
    page.wait_for_selector('.sch-card')
    assert 'PM-KISAN' in page.inner_text('#view-schemes')


def test_assistant_answers_and_voice_is_opt_in(page):
    go(page, 'assistant')
    assert not page.is_checked('#speakToggle')
    page.fill('#chatInput', 'How do I plan crop rotation?')
    page.press('#chatInput', 'Enter')
    page.wait_for_function("document.querySelectorAll('.bubble').length >= 3 && !document.body.innerText.includes('…')")
    assert 'rotation' in page.inner_text('#chatMessages').lower()


def test_save_plan_then_sign_in_with_otp_and_own_plans(page, server):
    page.click('#savePlanBtn')
    page.wait_for_selector('.toast.show')
    go(page, 'plans')
    page.wait_for_selector('.plan-row')
    page.fill('#phoneInput', '9876543210')
    page.click('#requestOtpBtn')
    page.wait_for_selector('#otpStep.visible')
    deadline = time.time() + 5
    code = None
    while time.time() < deadline and not code:
        m = re.findall(r'\[DEV OTP\] phone=9876543210 code=(\d{6})', server['log'].read_text())
        code = m[-1] if m else None
        time.sleep(0.2)
    assert code, 'OTP not found in server log'
    page.fill('#otpInput', code)
    page.click('#verifyBtn')
    page.wait_for_selector('#signOutBtn')
    assert '9876543210' in page.inner_text('#mePhone') or page.wait_for_function("document.getElementById('mePhone').textContent.includes('9876543210')")
    go(page, 'planner')
    page.click('#savePlanBtn')
    page.wait_for_function("document.querySelector('.toast').textContent.includes('your account')")
    go(page, 'plans')
    page.wait_for_selector('.plan-row')
    assert '🔒 account' in page.inner_text('#plansList')
    page.click('#signOutBtn')
    page.wait_for_selector('#requestOtpBtn')


def test_brand_link_and_account_chip_navigate(page):
    page.click('.side-user')
    page.wait_for_selector('#view-plans.active')
    page.click('a.brand')
    page.wait_for_selector('#view-planner.active')


def test_works_offline_after_first_visit(browser, server):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    pg.goto(server['base'] + '/')
    pg.wait_for_selector('.crop-card')
    pg.evaluate('navigator.serviceWorker.ready.then(() => true)')
    pg.reload()                                      # now controlled by the service worker
    pg.wait_for_selector('.crop-card')
    ctx.set_offline(True)
    pg.reload()
    pg.wait_for_selector('.crop-card', timeout=10000)
    assert 'Offline mode' in pg.inner_text('#cropList')
    assert pg.locator('.crop-card').count() == 6
    ctx.close()


def test_mobile_layout_has_no_horizontal_overflow(browser, server):
    ctx = browser.new_context(viewport={'width': 375, 'height': 800}, is_mobile=True)
    pg = ctx.new_page()
    pg.goto(server['base'] + '/')
    pg.wait_for_selector('.crop-card')
    for view in ['planner', 'rotation', 'calendar', 'simulator', 'schemes', 'assistant', 'plans']:
        pg.click(f'.side-link[data-view={view}]')
        pg.wait_for_timeout(700)
        overflow = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert overflow <= 1, f'{view} overflows by {overflow}px on mobile'
    ctx.close()
