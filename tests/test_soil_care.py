"""Soil care hub: pure-logic checks (Node) + real-browser flows (Chromium via Playwright)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FRONT = ROOT / 'frontend'


def test_soil_files_are_wired_into_the_app_shell():
    html = (FRONT / 'index.html').read_text(encoding='utf-8')
    assert 'id="view-soil"' in html and 'data-view="soil"' in html
    sw = (FRONT / 'service-worker.js').read_text(encoding='utf-8')
    assert './js/soil-data.js' in sw and './js/views/soil.js' in sw
    for f in ['js/soil-data.js', 'js/views/soil.js']:
        assert (FRONT / f).exists()


@pytest.mark.skipif(shutil.which('node') is None, reason='node not installed')
def test_soil_logic_ratings_quiz_and_translations():
    script = f"""
      import * as d from '{(FRONT / 'js' / 'soil-data.js').as_posix()}';
      const out = {{}};
      const r = d.rateParam;
      out.ratings = [r('ph',5.4), r('ph',6.5), r('ph',7.6), r('ph',8.6), r('ec',0.99), r('ec',3.01),
        r('oc',0.49), r('n',280), r('p',10.9), r('k',281), r('s',9), r('zn',0.59), r('b',0.5)];
      const q = (a) => d.scoreSoil(a);
      out.quiz = [q([0,2,0,0,4]).soil, q([1,1,2,2,3]).soil, q([3,0,2,2,0]).soil, q([2,1,1,1,1]).soil, q([4,2,1,0,2]).soil];
      out.empty = q([]);
      out.blackAlso = q([0,2,0,0,2]).also;
      const missing = [];
      const walk = (o, p) => {{ if (o && typeof o === 'object') {{
        if (typeof o.en === 'string') {{ for (const l of ['en','hi','mr']) if (!o[l] || !o[l].trim()) missing.push(p + '.' + l); }}
        else for (const [k, v] of Object.entries(o)) walk(v, p + '.' + k); }} }};
      for (const [n, v] of Object.entries({{UI: d.SOIL_UI, PARAMS: d.PARAMS, LABEL: d.STATUS_LABEL, MEANING: d.MEANING,
        ADVICE: d.ADVICE, TIPS: d.SOIL_TIPS, QUIZ: d.QUIZ, HIGH: d.HIGH_ADVICE}})) walk(v, n);
      out.missing = missing;
      // every non-good status must have advice; advice text must not contain dose-like numbers
      const noAdvice = [];
      const probes = {{ph:[5,6,8,9], ec:[2,5], oc:[.2], n:[100], p:[5], k:[50], s:[5], zn:[.1], fe:[1], cu:[.1], mn:[1], b:[.1]}};
      for (const [id, vals] of Object.entries(probes)) for (const v of vals) {{
        const s = r(id, v); if (d.TONE[s] !== 'good' && !d.adviceFor(id, s)) noAdvice.push(id + ':' + s); }}
      out.noAdvice = noAdvice;
      const doseLike = /\\b\\d+(\\.\\d+)?\\s?(kg|g|quintal|per acre|\\/acre|\\/ha)\\b/i;
      const allEn = JSON.stringify([d.ADVICE, d.SOIL_TIPS, d.HIGH_ADVICE]);
      out.doseLike = doseLike.test(allEn);
      console.log(JSON.stringify(out));
    """
    res = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True, check=True)
    out = json.loads(res.stdout)
    assert out['ratings'] == ['strong_acid', 'neutral', 'alkaline', 'strong_alkaline', 'normal', 'very_high',
                              'low', 'medium', 'low', 'high', 'low', 'deficient', 'enough']
    assert out['quiz'] == ['black', 'red', 'sandy', 'loamy', 'clayey']
    assert out['empty'] is None
    assert out['blackAlso'] == 'clayey'          # black soils are clay-rich: say so instead of pretending certainty
    assert out['missing'] == [], out['missing']
    assert out['noAdvice'] == [], out['noAdvice']
    assert out['doseLike'] is False              # advice stays general: doses come from the card / KVK


# ---------------------------------------------------------------- browser flows
pytest.importorskip('playwright.sync_api')
from test_e2e_browser import browser, page, server  # noqa: E402,F401  (reuse the real-server fixtures)


def open_soil(pg):
    pg.click('.side-link[data-view=soil]')
    pg.wait_for_selector('#view-soil.active .soil-tile')


def test_hub_offers_three_tools_and_cards_open_each(page):
    open_soil(page)
    assert page.locator('.soil-tile').count() == 3
    assert page.url.endswith('#/soil')
    for sub, field in [('card', '#sp-ph'), ('finder', '.soil-opt'), ('advice', '.soil-advice, .empty-state')]:
        page.click(f'.soil-tile[data-soil-go={sub}]')
        page.wait_for_selector(f'#view-soil .soil-tab.active[data-soil-tab={sub}]')
        assert page.url.endswith(f'#/soil/{sub}')
        assert page.locator(field).count() >= 1
        page.click('.soil-back')                                 # on-screen back -> hub
        page.wait_for_selector('.soil-tile')
        assert page.url.endswith('#/soil')
    assert page.errors == []


def test_browser_back_returns_to_hub_even_after_switching_tabs(page):
    open_soil(page)
    page.click('.soil-tile[data-soil-go=card]')
    page.wait_for_selector('#sp-ph')
    page.click('.soil-tab[data-soil-tab=finder]')                # lateral move replaces the entry
    page.wait_for_selector('.soil-opt')
    page.click('.soil-tab[data-soil-tab=advice]')
    page.wait_for_selector('#view-soil .soil-tab.active[data-soil-tab=advice]')
    page.go_back()
    page.wait_for_selector('.soil-tile')                         # one Back press lands on the hub
    assert page.url.endswith('#/soil')


def test_health_card_explains_values_saves_and_drives_advice(page):
    open_soil(page)
    page.click('.soil-tile[data-soil-go=card]')
    page.fill('#sp-ph', '5.0')
    page.fill('#sp-oc', '0.3')
    page.fill('#sp-p', '30')
    assert 'Strongly acidic' in page.inner_text('#sh-ph')
    results = page.inner_text('#soilResults')
    assert 'Too acidic' in results and 'Low' in results and 'High' in results
    page.fill('#sp-ph', '15')                                    # impossible pH is rejected, not rated
    assert page.locator('#sp-ph.invalid').count() == 1
    page.click('#soilSave')
    assert 'Fix the highlighted' in page.inner_text('#toast')
    page.fill('#sp-ph', '5.0')
    page.click('#soilSave')
    page.wait_for_function("document.getElementById('toast').textContent.includes('saved')")
    page.click('#soilResults [data-soil-next=advice]')
    page.wait_for_selector('.soil-advice')
    text = page.inner_text('#view-soil')
    assert 'lime' in text.lower() and 'compost' in text.lower()
    assert 'Already plenty' in text                              # phosphorus 30 is high
    assert 'KVK' in text
    page.reload()
    page.wait_for_selector('#view-soil .soil-advice')            # deep link + persisted card survive a reload
    assert page.errors == []


def test_soil_type_finder_sets_farm_profile_for_planner(page):
    page.select_option('#soil', 'red')                           # start from a different soil than the quiz will find
    page.click('#farmForm button[type=submit]')
    page.wait_for_timeout(500)
    open_soil(page)
    page.click('.soil-tile[data-soil-go=finder]')
    picks = [0, 2, 0, 0, 2]                                      # black, sticky, deep cracks, waterlogs, clay layer
    for i, pick in enumerate(picks):
        page.wait_for_selector(f'.progress-line:has-text("{i + 1} of 5")')
        assert page.locator('[data-q-next][disabled]').count() == 1   # Next waits for an answer
        page.click(f'[data-q-opt="{pick}"]')
        page.click('[data-q-next]')
    page.wait_for_selector('.soil-result')
    assert 'Black' in page.inner_text('.soil-result h2')
    assert 'clayey' in page.inner_text('.soil-result').lower() or 'Clayey' in page.inner_text('.soil-result')
    page.click('[data-use-soil]')
    page.wait_for_selector('[data-use-soil][disabled]')
    page.click('.side-link[data-view=planner]')
    page.wait_for_selector('#view-planner.active #soil')
    assert page.input_value('#soil') == 'black'
    # quiz result is remembered on the hub
    open_soil(page)
    assert 'Black' in page.inner_text('.soil-tile[data-soil-go=finder]')


def test_previous_button_keeps_answers(page):
    open_soil(page)
    page.click('.soil-tile[data-soil-go=finder]')
    page.click('[data-q-opt="1"]')
    page.click('[data-q-next]')
    page.click('[data-q-prev]')
    assert page.locator('.soil-opt.selected').count() == 1


def test_language_switch_keeps_the_current_soil_screen(page):
    page.goto(page.url.split('#')[0] + '#/soil/card')           # deep link
    page.wait_for_selector('#sp-ph')
    page.select_option('#language', 'mr')
    page.wait_for_selector('.soil-tab.active')
    assert page.url.endswith('#/soil/card')                      # stayed on the card screen
    assert 'मृदा आरोग्य पत्रिका' in page.inner_text('#view-soil h1')
    page.fill('#sp-ph', '9')
    assert 'क्षारयुक्त' in page.inner_text('#sh-ph')
    page.select_option('#language', 'hi')
    page.wait_for_selector('.soil-tab.active')
    assert page.input_value('#sp-ph') == '9'                    # typed value survives re-render
    assert 'मृदा स्वास्थ्य कार्ड' in page.inner_text('#view-soil h1')


def test_soil_screens_do_not_overflow_on_a_phone(browser, server):
    ctx = browser.new_context(viewport={'width': 375, 'height': 800}, is_mobile=True)
    pg = ctx.new_page()
    pg.goto(server['base'] + '/')
    pg.wait_for_selector('.crop-card', timeout=15000)
    for sub in ['', 'card', 'finder', 'advice']:
        pg.goto(server['base'] + '/#/soil' + (f'/{sub}' if sub else ''))
        pg.wait_for_selector('#view-soil.active .soil-screen')
        pg.fill('#sp-ph', '7') if sub == 'card' else None
        overflow = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert overflow <= 1, f'soil/{sub} overflows by {overflow}px on mobile'
    ctx.close()
