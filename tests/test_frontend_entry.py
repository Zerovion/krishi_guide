from pathlib import Path


def test_frontend_folder_contains_ui_entry_and_local_pwa_assets():
    root = Path(__file__).resolve().parents[1]
    frontend = root / 'frontend'
    html = (frontend / 'index.html').read_text(encoding='utf-8')
    assert '<title>KrishiGuide' in html
    assert 'href="./manifest.webmanifest"' in html
    assert "register('./service-worker.js')" in html
    assert (frontend / 'manifest.webmanifest').exists()
    assert (frontend / 'service-worker.js').exists()
    assert (frontend / 'css' / 'app.css').exists()


def test_frontend_is_a_modular_es_app_with_all_views():
    root = Path(__file__).resolve().parents[1]
    js = root / 'frontend' / 'js'
    for module in ['main.js', 'api.js', 'i18n.js', 'views/planner.js', 'views/rotation.js',
                   'views/calendar.js', 'views/signals.js', 'views/simulator.js',
                   'views/schemes.js', 'views/assistant.js', 'views/plans.js']:
        assert (js / module).exists(), f'missing module: {module}'
    html = (root / 'frontend' / 'index.html').read_text(encoding='utf-8')
    assert 'type="module"' in html
    for view in ['planner', 'rotation', 'calendar', 'signals', 'simulator', 'schemes', 'assistant', 'plans']:
        assert f'id="view-{view}"' in html
    assert 'id="healthStatus"' in html
    assert 'id="refreshData"' in html


def test_frontend_supports_three_languages_and_voice():
    i18n = (Path(__file__).resolve().parents[1] / 'frontend' / 'js' / 'i18n.js').read_text(encoding='utf-8')
    for lang_block in ['en: {', 'hi: {', 'mr: {']:
        assert lang_block in i18n
    assistant = (Path(__file__).resolve().parents[1] / 'frontend' / 'js' / 'views' / 'assistant.js').read_text(encoding='utf-8')
    assert 'SpeechRecognition' in assistant
    assert 'speechSynthesis' in assistant
