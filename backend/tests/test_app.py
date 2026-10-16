import os
import tempfile

_TMP = tempfile.mkdtemp(prefix='krishi-pytest-')
os.environ['KRISHI_DB'] = os.path.join(_TMP, 'krishi-pytest.sqlite3')
os.environ['KRISHI_TEST_OTP'] = '123456'

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
client.__enter__()


def test_health_and_crop_catalogue():
    assert client.get('/api/health').json()['status'] == 'ok'
    response = client.get('/api/crops')
    assert response.status_code == 200
    assert len(response.json()) == 13


def test_every_crop_carries_rotation_water_and_calendar_metadata():
    for crop in client.get('/api/crops').json():
        assert crop['family'] in {'legume', 'cereal', 'oilseed', 'fiber', 'vegetable', 'sugar'}
        assert crop['root_depth'] in {'shallow', 'medium', 'deep'}
        assert isinstance(crop['nitrogen_fixing'], bool)
        assert len(crop['water_mm']) == 2 and crop['water_mm'][0] < crop['water_mm'][1]
        assert len(crop['calendar']) >= 5
        stages = crop['calendar']
        assert stages[0]['start'] == 0
        assert stages[-1]['end'] * 7 >= crop['duration_days'][0] * 0.8


def test_district_changes_explainable_crop_rankings():
    base = {'season': 'kharif', 'soil': 'black', 'water': 'moderate', 'area': 2, 'budget': 30000, 'goal': 'balanced'}
    sangli = client.post('/api/recommendations', json={**base, 'district': 'Sangli'}).json()
    shimla = client.post('/api/recommendations', json={**base, 'district': 'Shimla'}).json()
    sangli_sugarcane = next(item for item in sangli if item['crop']['id'] == 'sugarcane')
    shimla_sugarcane = next(item for item in shimla if item['crop']['id'] == 'sugarcane')
    assert sangli_sugarcane['score'] != shimla_sugarcane['score']
    assert any('district' in reason.lower() for reason in sangli_sugarcane['reasons'])


def test_save_and_list_plan():
    plan = {'district': 'Pune', 'season': 'rabi', 'soil': 'black', 'water': 'low', 'area': 1, 'budget': 10000, 'goal': 'water'}
    created = client.post('/api/plans', json=plan)
    assert created.status_code == 201
    assert created.json()['owner'] is False
    assert client.get('/api/plans').json()[0]['district'] == 'Pune'


def test_profit_scenarios_have_ordered_uncertainty_bounds():
    response = client.post('/api/simulator', json={'crop_id': 'soybean', 'area': 2, 'price_per_quintal': 4500, 'yield_quintals_per_acre': 8})
    scenarios = response.json()['scenarios']
    assert len(scenarios) == 3
    assert scenarios[0]['profit'] >= scenarios[1]['profit'] >= scenarios[2]['profit']


def test_weather_returns_live_data_or_explicit_unavailable_status():
    response = client.get('/api/weather?district=Pune')
    assert response.status_code == 200
    assert response.json()['status'] in {'live', 'unavailable'}


def test_rotation_recommends_legume_after_cereal_and_excludes_long_duration():
    payload = {'crop_id': 'wheat', 'district': 'Pune', 'season': 'rabi', 'soil': 'loamy',
               'water': 'moderate', 'area': 2, 'budget': 30000}
    data = client.post('/api/rotation', json=payload).json()
    assert data['next_season'] == 'summer'
    ids = [c['crop']['id'] for c in data['candidates']]
    assert 'wheat' not in ids or data['candidates'][0]['crop']['id'] != 'wheat'
    excluded_ids = [e['crop']['id'] for e in data['excluded']]
    assert 'sugarcane' in excluded_ids
    top = data['candidates'][0]
    assert top['rotation_reasons'] and top['fit_reasons']
    wheat_entry = next((c for c in data['candidates'] if c['crop']['id'] == 'wheat'), None)
    if wheat_entry:
        assert any('Repeating the same crop' in r for r in wheat_entry['rotation_reasons'])


def test_rotation_legume_to_cereal_gets_nitrogen_credit_reason():
    payload = {'crop_id': 'chickpea', 'district': 'Indore', 'season': 'rabi', 'soil': 'black',
               'water': 'low', 'area': 1, 'budget': 15000}
    data = client.post('/api/rotation', json=payload).json()
    all_reasons = [r for c in data['candidates'] for r in c['rotation_reasons']]
    assert any('legume' in r.lower() and 'cereal' in r.lower() for r in all_reasons)


def test_timeline_generates_dated_stages():
    response = client.get('/api/crops/wheat/timeline?sowing_date=2026-11-01&area=2')
    assert response.status_code == 200
    data = response.json()
    assert data['sowing_date'] == '2026-11-01'
    assert len(data['stages']) >= 5
    assert data['stages'][0]['start_date'] == '2026-11-01'
    dates = [s['start_date'] for s in data['stages']]
    assert dates == sorted(dates)
    assert data['expected_harvest_window']['end'] > data['expected_harvest_window']['start']


def test_advisory_returns_live_flags_or_explicit_unavailable():
    response = client.get('/api/advisory?district=Pune&crop_id=wheat')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] in {'live', 'unavailable'}
    if data['status'] == 'live':
        assert isinstance(data['flags'], list)
        for flag in data['flags']:
            assert flag['level'] in {'info', 'watch', 'alert'}
    else:
        assert data['fallback']


def test_water_plan_arithmetic_is_transparent_and_ordered():
    response = client.get('/api/water-plan?crop_id=paddy&area=2&season=rabi')
    assert response.status_code == 200
    data = response.json()
    assert data['crop_water_need_mm'][0] < data['crop_water_need_mm'][1]
    assert data['net_irrigation_need_litres'][0] <= data['gross_water_need_litres'][0]
    assert data['tanker_loads_5000L'][0] > 0
    assert data['assumed_effective_rainfall_share'] == 0.10
    kharif = client.get('/api/water-plan?crop_id=paddy&area=2&season=kharif').json()
    assert kharif['net_irrigation_need_litres'][0] < data['net_irrigation_need_litres'][0]


def test_scheme_eligibility_navigator_ranks_matches():
    data = client.post('/api/schemes/eligibility', json={
        'land_bucket': 'marginal', 'owns_land': True, 'has_soil_card': False,
        'wants_insurance': True, 'wants_credit': True, 'has_irrigation': False,
        'sells_in_mandi': True, 'gender': 'female'}).json()
    strengths = [m['strength'] for m in data['matches']]
    assert strengths[0] == 'strong'
    assert strengths == sorted(strengths, key={'strong': 0, 'check': 1, 'done': 2, 'skip': 3}.get)
    mahila = next(m for m in data['matches'] if m['id'] == 'mahila-kisan')
    assert mahila['strength'] == 'strong'
    kusum = next(m for m in data['matches'] if m['id'] == 'pm-kusum')
    assert kusum['strength'] == 'strong'
    assert all(m['docs'] and m['url'] for m in data['matches'])


def test_assistant_answers_without_llm_key():
    os.environ.pop('LLM_API_KEY', None)
    response = client.post('/api/assistant', json={'question': 'Which crops need less water?', 'lang': 'en'})
    assert response.status_code == 200
    data = response.json()
    assert data['mode'] == 'rules'
    assert 'water' in data['answer'].lower()


def test_auth_flow_issues_session_and_owns_plans():
    assert client.post('/api/auth/request-otp', json={'phone': '9876543210'}).status_code == 200
    verified = client.post('/api/auth/verify-otp', json={'phone': '9876543210', 'code': '123456'})
    assert verified.status_code == 200
    token = verified.json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    me = client.get('/api/auth/me', headers=headers)
    assert me.status_code == 200 and me.json()['user']['phone'] == '9876543210'

    created = client.post('/api/plans', json={'district': 'Nashik', 'season': 'kharif', 'soil': 'black',
                                              'water': 'moderate', 'area': 3, 'budget': 40000}, headers=headers)
    assert created.status_code == 201 and created.json()['owner'] is True
    plan_id = created.json()['id']

    user_plans = client.get('/api/plans', headers=headers).json()
    assert {p['id'] for p in user_plans} == {plan_id}

    anonymous_plans = client.get('/api/plans').json()
    assert plan_id not in {p['id'] for p in anonymous_plans}

    forbidden = client.delete(f'/api/plans/{plan_id}')
    assert forbidden.status_code == 403
    owned = client.delete(f'/api/plans/{plan_id}', headers=headers)
    assert owned.status_code == 204

    assert client.post('/api/auth/logout', headers=headers).status_code == 200
    assert client.get('/api/auth/me', headers=headers).status_code == 401


def test_frontend_is_served_by_the_api():
    response = client.get('/')
    assert response.status_code == 200
    assert '<html' in response.text.lower()
