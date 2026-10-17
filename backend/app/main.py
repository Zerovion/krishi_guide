from __future__ import annotations

import hashlib
import hmac
import json
import os
import random
import re
import secrets
import sqlite3
import time
from collections import deque
from contextlib import asynccontextmanager, contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import buyers
from .data_adapters import get_mandi_prices, get_weather
from .llm import ask_llm, llm_config

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get('KRISHI_DB', ROOT / 'data' / 'krishiguide.sqlite3'))
CROPS = json.loads((ROOT / 'data' / 'crops.json').read_text(encoding='utf-8'))
BY_ID = {c['id']: c for c in CROPS}
FRONTEND_DIR = ROOT.parent / 'frontend'

SEASON_SEQUENCE = {'kharif': 'rabi', 'rabi': 'summer', 'summer': 'kharif'}
SEASON_RAIN_SHARE = {'kharif': 0.45, 'rabi': 0.10, 'summer': 0.0}
LONG_DURATION_DAYS = 200  # crops needing their own multi-year plan (e.g. sugarcane)
ROOT_DEPTH_RANK = {'shallow': 0, 'medium': 1, 'deep': 2}

OTP_REQUEST_LOG = []            # (phone, timestamp) ring for rate limiting
OTP_RATE_LIMIT = 3              # requests per 10 minutes per phone
OTP_TTL_SECONDS = 300
SESSION_TTL_SECONDS = 30 * 24 * 3600


@asynccontextmanager
async def lifespan(_app):
    with db() as conn:
        conn.executescript('''CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY, district TEXT, season TEXT, soil TEXT, water TEXT, area REAL, budget REAL, goal TEXT, recommendations TEXT, created_at TEXT); CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, phone TEXT UNIQUE, created_at TEXT); CREATE TABLE IF NOT EXISTS otp_codes(phone TEXT PRIMARY KEY, code_hash TEXT, expires_at REAL, attempts INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER, expires_at REAL, created_at TEXT);''')
        columns = {row[1] for row in conn.execute('PRAGMA table_info(plans)')}
        if 'user_id' not in columns:
            conn.execute('ALTER TABLE plans ADD COLUMN user_id INTEGER')
        buyers.init(conn)
    yield


app = FastAPI(title='KrishiGuide API', version='2.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])


@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


class FarmProfile(BaseModel):
    district: str = Field(min_length=1, max_length=100)
    season: Literal['kharif', 'rabi', 'summer']
    soil: Literal['black', 'loamy', 'sandy', 'red', 'clayey']
    water: Literal['low', 'moderate', 'high']
    area: float = Field(gt=0, le=10000)
    budget: float = Field(ge=0)
    goal: Literal['balanced', 'lowcost', 'water', 'short'] = 'balanced'


class SimulatorRequest(BaseModel):
    crop_id: str
    area: float = Field(gt=0, le=10000)
    price_per_quintal: float = Field(gt=0)
    yield_quintals_per_acre: float = Field(gt=0)


class OtpRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    code: str


class RotationRequest(BaseModel):
    crop_id: str
    district: str = Field(min_length=1, max_length=100)
    season: Literal['kharif', 'rabi', 'summer']
    soil: Literal['black', 'loamy', 'sandy', 'red', 'clayey']
    water: Literal['low', 'moderate', 'high']
    area: float = Field(gt=0, le=10000)
    budget: float = Field(ge=0)
    goal: Literal['balanced', 'lowcost', 'water', 'short'] = 'balanced'


class AssistantRequest(BaseModel):
    question: str = Field(min_length=2, max_length=600)
    lang: Literal['en', 'hi', 'mr'] = 'en'
    profile: FarmProfile | None = None


class EligibilityAnswers(BaseModel):
    land_bucket: Literal['marginal', 'small', 'medium', 'large'] = 'small'
    owns_land: bool = True
    has_soil_card: bool = False
    wants_insurance: bool = True
    wants_credit: bool = True
    has_irrigation: bool = False
    sells_in_mandi: bool = True
    gender: Literal['male', 'female', 'other'] = 'male'


# ---------------------------------------------------------------- auth helpers

def bearer_user(request: Request) -> sqlite3.Row | None:
    header = request.headers.get('authorization', '')
    if not header.lower().startswith('bearer '):
        return None
    token = header[7:].strip()
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db() as conn:
        row = conn.execute(
            'SELECT u.id, u.phone FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
            (token_hash, time.time()),
        ).fetchone()
    return row


def otp_rate_limited(phone: str) -> bool:
    now = time.time()
    global OTP_REQUEST_LOG
    OTP_REQUEST_LOG = [(p, ts) for p, ts in OTP_REQUEST_LOG if ts > now - 600]
    hits = sum(1 for p, _ts in OTP_REQUEST_LOG if p == phone)
    if hits >= OTP_RATE_LIMIT:
        return True
    OTP_REQUEST_LOG.append((phone, now))
    return False


# ------------------------------------------------------------------- scoring

def score_crop(crop: dict, p: FarmProfile) -> dict:
    score, reasons = crop['base'] - 22, []
    if crop['seasons'] and p.season in crop['seasons']:
        score += 13; reasons.append('Season matches the crop catalogue.')
    else:
        score -= 28; reasons.append('Season does not match the crop catalogue.')
    if p.soil in crop['soils']:
        score += 12; reasons.append('Soil category matches the crop catalogue.')
    else:
        score -= 13; reasons.append('Soil category is not a listed match.')
    if p.water == crop['water']:
        score += 10; reasons.append('Water availability aligns with the crop category.')
    elif p.water == 'low' and crop['water'] == 'high':
        score -= 22; reasons.append('High water demand conflicts with limited water.')
    elif p.water == 'low' and crop['water'] == 'moderate':
        score -= 9; reasons.append('Crop may need more water than is available.')
    elif p.water == 'moderate' and crop['water'] == 'high':
        score -= 10; reasons.append('Water availability may be a concern.')
    else:
        score += 4; reasons.append('Available water may support this crop; confirm locally.')
    if crop['cost'][0] * p.area > p.budget:
        score -= 17; reasons.append('Illustrative starting cost exceeds the stated budget.')
    elif crop['cost'][1] * p.area <= p.budget:
        score += 8; reasons.append('Illustrative cost range fits within the stated budget.')
    if p.goal == 'lowcost': score += max(0, 12 - crop['cost'][0] / 1000)
    if p.goal == 'water': score += 12 if crop['water'] == 'low' else (1 if crop['water'] == 'moderate' else -13)
    if p.goal == 'short': score += 12 if int(re.search(r'\d+', crop['duration']).group()) <= 80 else 5
    district = p.district.casefold()
    # Transparent coarse state/district associations, not agronomic certification.
    associations = {'sugarcane': ('maharashtra', 'sangli', 'kolhapur', 'satara', 'pune', 'solapur', 'karnataka', 'uttar pradesh'), 'soybean': ('madhya pradesh', 'vidarbha', 'amravati', 'akola', 'indore', 'ujjain'), 'paddy': ('assam', 'kerala', 'west bengal', 'odisha', 'chhattisgarh'), 'mustard': ('rajasthan', 'bharatpur', 'alwar', 'jaipur'), 'apple': ('shimla', 'kullu', 'himachal pradesh'), 'chia': ('maharashtra', 'karnataka', 'telangana', 'solapur', 'sangli', 'kolhapur'), 'quinoa': ('odisha', 'gujarat', 'rajasthan', 'maharashtra'), 'amaranth': ('uttarakhand', 'himachal pradesh', 'jammu'), 'buckwheat': ('himachal pradesh', 'uttarakhand', 'sikkim', 'kullu'), 'moringa': ('maharashtra', 'karnataka', 'tamil nadu', 'andhra pradesh', 'telangana'), 'dragon_fruit': ('maharashtra', 'gujarat', 'karnataka', 'solapur', 'sangli'), 'avocado': ('kerala', 'tamil nadu', 'karnataka', 'kodagu', 'nilgiri', 'meghalaya', 'sikkim'), 'passion_fruit': ('assam', 'meghalaya', 'nagaland', 'manipur', 'mizoram', 'kerala', 'karnataka'), 'cape_gooseberry': ('maharashtra', 'karnataka', 'himachal pradesh', 'uttarakhand'), 'saffron': ('kashmir', 'pulwama', 'jammu'), 'lavender': ('jammu', 'kashmir', 'uttarakhand', 'himachal pradesh'), 'rosemary': ('maharashtra', 'gujarat', 'karnataka', 'tamil nadu')}
    matched = next((crop_id for crop_id, terms in associations.items() if any(term in district for term in terms) and crop_id == crop['id']), None)
    if matched:
        score += 15; reasons.append(f'District context ({p.district}) has a coarse catalogue association with this crop; validate with local experts.')
    elif any(any(term in district for term in terms) for terms in associations.values()):
        score -= 3; reasons.append(f'District context ({p.district}) used as a small ranking adjustment, not a suitability guarantee.')
    return {'score': max(12, min(97, round(score))), 'reasons': reasons}


def rotation_bonus(current: dict, candidate: dict) -> tuple[int, list[str]]:
    """Explainable agronomic rotation rules between two crops."""
    bonus, reasons = 0, []
    if candidate['id'] == current['id']:
        return -25, ['Repeating the same crop in consecutive seasons builds pest, disease and nutrient problems; choose a different crop.']
    if candidate['family'] == current['family']:
        bonus -= 14
        reasons.append(f'Same crop family as {current["name"]} ({current["family"]}); shared pests and nutrient needs make succession risky.')
    if current.get('heavy_feeder') and candidate.get('nitrogen_fixing'):
        bonus += 14
        reasons.append(f'After a heavy-feeding crop, a nitrogen-fixing {candidate["family"]} like this restores soil nitrogen naturally.')
    if current.get('nitrogen_fixing') and candidate['family'] == 'cereal':
        bonus += 10
        reasons.append('A legume before a cereal is a classic rotation — the cereal can use nitrogen the legume added to the soil.')
    if candidate.get('nitrogen_fixing'):
        bonus += 4
        reasons.append('Legumes generally improve soil structure and leave nitrogen behind for the next crop.')
    depth_gap = abs(ROOT_DEPTH_RANK[candidate['root_depth']] - ROOT_DEPTH_RANK[current['root_depth']])
    if depth_gap == 2:
        bonus += 8
        reasons.append('Root depth alternates strongly with the previous crop, using water and nutrients from a different soil layer.')
    elif depth_gap == 1:
        bonus += 4
        reasons.append('Root depth differs from the previous crop, spreading soil resource use across layers.')
    if current['water'] == 'high' and candidate['water'] == 'low':
        bonus += 8
        reasons.append('A low-water crop after a high-water one lets the soil water budget recover.')
    if current['water'] == 'high' and candidate['water'] == 'high':
        bonus -= 8
        reasons.append('Two high-water crops back to back strain wells and pumps; check your water budget first.')
    if current.get('heavy_feeder') and candidate.get('heavy_feeder'):
        bonus -= 6
        reasons.append('Both crops are heavy feeders; soil nutrients need rebuilding between them.')
    return bonus, reasons


def weather_flags(daily: dict, crop: dict | None) -> list[dict]:
    """Deterministic, explainable advisory flags from a 7-day Open-Meteo forecast."""
    flags: list[dict] = []
    times = daily.get('time', [])
    tmax = daily.get('temperature_2m_max', [])
    tmin = daily.get('temperature_2m_min', [])
    rain = daily.get('precipitation_probability_max', [])
    if not times:
        return flags

    def day(n):
        return times[n] if n < len(times) else times[-1]

    rain3 = rain[:3]
    hot = max(tmax[:7]) if tmax else None
    cold = min(tmin[:7]) if tmin else None
    rain3_max = max(rain3) if rain3 else 0
    rain5_max = max(rain[:5]) if rain[:5] else 0

    if rain3_max >= 60:
        flags.append({'level': 'watch', 'icon': '🌧️', 'title': 'Rain likely in the next 3 days',
                      'detail': f'Rain probability reaches {rain3_max}% around {day(rain3.index(rain3_max))}. Consider postponing irrigation and check soil moisture by hand before watering.'})
    elif rain3_max <= 20:
        flags.append({'level': 'info', 'icon': '💧', 'title': 'No significant rain expected for 3 days',
                      'detail': 'If your crop is irrigated, plan the next irrigation. On rain-fed fields, mulching and early weeding help soil hold moisture.'})
    if hot is not None and hot >= 38:
        flags.append({'level': 'alert', 'icon': '🔥', 'title': f'Very hot days ahead (up to {hot}°C)',
                      'detail': 'Heat stress risk for standing crops: irrigate in the evening, mulch root zones, avoid urea top dressing on hot afternoons.'})
    elif hot is not None and hot >= 35 and crop and crop['id'] in {'wheat', 'maize'}:
        flags.append({'level': 'watch', 'icon': '🌡️', 'title': f'Warm spell (up to {hot}°C)',
                      'detail': 'Cereals near flowering or grain filling lose yield in heat. Keep moisture even and follow the district advisory.'})
    if cold is not None and cold <= 8:
        flags.append({'level': 'alert', 'icon': '❄️', 'title': f'Frost risk (min {cold}°C)',
                      'detail': 'Light evening irrigation and windbreaks reduce frost damage. Most critical for potato, tomato, gram and young wheat.'})
    if rain5_max >= 70 and crop:
        flags.append({'level': 'watch', 'icon': '🌾', 'title': 'Heavy rain chance within 5 days',
                      'detail': f'Up to {rain5_max}% probability. If your {crop["name"]} is near harvest, plan cutting, drying space and protection for harvested produce.'})
    return flags


def rule_based_answer(question: str, lang: str, profile: FarmProfile | None) -> str:
    """Transparent keyword assistant used when no LLM key is configured."""
    s = question.lower()
    if any(k in s for k in ('rotation', 'next season', 'after ', 'अगला', 'फेरबदल', 'पुढच्या')):
        return ('A good rotation changes the crop family each season: legumes (soybean, chickpea, moong, groundnut) add nitrogen '
                'for the cereals that follow, and deep/shallow roots alternate. Open the Rotation planner to see ranked '
                'next-season options for your last crop, with the reason for each. Verify the final choice locally.')
    if any(k in s for k in ('water', 'irrigat', 'पानी', 'सिंच', 'पाणी')):
        return ('Low-water catalogue categories are bajra, jowar, chickpea, mustard and moong when season and soil suit. '
                'The Water planner estimates the seasonal irrigation volume for a crop and area — open it, then confirm '
                'with your local agriculture officer.')
    if any(k in s for k in ('weather', 'rain', 'मौसम', 'बारिश', 'हवामान', 'पावसाळा')):
        return ('Open Farm signals to load the live 7-day district forecast and the advisories generated from it '
                '(irrigation timing, heat, frost, harvest protection). Verify with the IMD district bulletin before critical operations.')
    if any(k in s for k in ('scheme', 'yojana', 'योजना', 'सबसिडी', ' subsidy', 'सब्सिडी')):
        return ('Open the Schemes page and answer the short checklist — it ranks PM-KISAN, PMFBY crop insurance, KCC credit, '
                'PM-KUSUM solar pumps and others for your situation, with official links. Eligibility is always confirmed on the official portal.')
    if any(k in s for k in ('budget', 'cost', 'लागत', 'बजट', 'खर्च')):
        return ('Start from seed, fertilizer or soil amendment, labour, irrigation, crop protection, harvesting and transport. '
                'The crop cards show an illustrative input-cost band for your acreage; keep a contingency reserve and compare with current local quotes.')
    if any(k in s for k in ('soil', 'मिट्टी', 'माती', 'black', 'काली')):
        return ('A soil label alone is not enough. Get a Soil Health Card test for pH, nutrients and organic carbon, then follow '
                'the crop recommendations on the report. Drainage and local climate also matter.')
    if any(k in s for k in ('price', 'mandi', 'market', 'भाव', 'बाजार', 'बाजारभाव')):
        return ('Live mandi prices need the official data.gov.in key configured. Meanwhile check AGMARKNET/e-NAM for current rates, '
                'and include transport, grading and storage costs in your sale decision.')
    if any(k in s for k in ('pest', 'disease', 'कीट', 'रोग', 'किड')):
        return ('Pest management must follow your district advisory and label doses — this app deliberately does not recommend '
                'chemicals. Scout twice a week, act only when counts cross the local threshold, and consult the KVK plant clinic.')
    if profile:
        ranked = sorted([{'crop': c, **score_crop(c, profile)} for c in CROPS], key=lambda x: x['score'], reverse=True)[:4]
        names = ', '.join(f"{item['crop']['name']} ({item['score']}%)" for item in ranked)
        return (f'Based on the profile you entered, the top catalogue matches are {names}. These are rule-based planning scores, '
                'not a yield or profit guarantee — verify locally.')
    return ('I can help with crop choice, rotation, water planning, weather-aware advisories, budget planning and government '
            'scheme pointers. Ask one of those, and verify location-specific decisions with your local KVK or agriculture officer.')


def assistant_context(profile: FarmProfile | None) -> str:
    lines = ['Catalogue crops (id, name, seasons, water need, duration, soils, illustrative cost/acre, notes):']
    for c in CROPS:
        lines.append(f"- {c['id']}: {c['name']}; seasons={c['seasons']}; water={c['water']}; duration={c['duration']}; "
                     f"soils={c['soils']}; cost_per_acre_INR={c['cost']}; risk={c['risks']}")
    if profile:
        ranked = sorted([{'crop': c, **score_crop(c, profile)} for c in CROPS], key=lambda x: x['score'], reverse=True)[:4]
        lines.append(f"Farmer profile: district={profile.district}, season={profile.season}, soil={profile.soil}, "
                     f"water={profile.water}, area={profile.area} acres, budget_INR={profile.budget}, priority={profile.goal}")
        lines.append('Top matches for this profile: ' + '; '.join(f"{i['crop']['name']} score {i['score']}" for i in ranked))
    return '\n'.join(lines)


# --------------------------------------------------------------------- routes

@app.get('/api/health')
def health():
    return {'status': 'ok', 'database': 'sqlite', 'crop_count': len(CROPS),
            'features': ['recommendations', 'rotation', 'advisory', 'timeline', 'water-plan', 'simulator', 'schemes-eligibility', 'assistant', 'buyer-offers'],
            'assistant_mode': 'llm' if llm_config()['enabled'] else 'rules'}


@app.get('/api/crops')
def crops():
    return CROPS


@app.post('/api/recommendations')
def recommendations(profile: FarmProfile):
    return sorted([{'crop': c, **score_crop(c, profile)} for c in CROPS], key=lambda x: x['score'], reverse=True)


@app.post('/api/rotation')
def rotation(req: RotationRequest):
    """Explainable next-season rotation planner built on transparent agronomic rules."""
    current = BY_ID.get(req.crop_id)
    if not current:
        raise HTTPException(404, 'Unknown crop')
    next_season = SEASON_SEQUENCE[req.season]
    next_profile = FarmProfile(district=req.district, season=next_season, soil=req.soil, water=req.water,
                               area=req.area, budget=req.budget, goal=req.goal)
    candidates = []
    for crop in CROPS:
        bonus, reasons = rotation_bonus(current, crop)
        scored = score_crop(crop, next_profile)
        candidates.append({'crop': crop, 'score': max(5, min(97, scored['score'] + bonus)),
                           'rotation_reasons': reasons, 'fit_reasons': scored['reasons'],
                           'next_season': next_season})
    candidates.sort(key=lambda x: x['score'], reverse=True)
    kept = [c for c in candidates if c['crop']['duration_days'][1] <= LONG_DURATION_DAYS]
    excluded = [{'crop': c['crop'],
                 'reason': f'{c["crop"]["duration"]} is a long-duration crop; it needs its own multi-year water and market plan, not a quick next-season switch.'}
                for c in candidates if c not in kept]
    return {'current_crop': current, 'current_season': req.season, 'next_season': next_season,
            'note': 'Rotation scores combine transparent agronomic rules with the same farm-fit scoring as the planner. Verify the final choice with a local KVK.',
            'candidates': kept, 'excluded': excluded}


@app.get('/api/advisory')
def advisory(district: str = Query(min_length=2, max_length=100), crop_id: str | None = None):
    """Weather-aware field advisory: deterministic flags computed from the live forecast."""
    weather = get_weather(district)
    crop = BY_ID.get(crop_id) if crop_id else None
    if crop_id and not crop:
        raise HTTPException(404, 'Unknown crop')
    base = {'district': district, 'crop': crop, 'generated_at': datetime.now(timezone.utc).isoformat(),
            'source': 'Open-Meteo', 'verify_note': 'Cross-check with the IMD district agromet bulletin before critical operations.'}
    if weather.get('status') != 'live':
        return {**base, 'status': 'unavailable', 'message': weather.get('message', 'Weather service unavailable.'),
                'flags': [], 'fallback': 'Generic care: walk the field, check soil moisture by hand, and follow the IMD district bulletin.'}
    return {**base, 'status': 'live', 'matched_location': weather.get('matched_location'), 'admin1': weather.get('admin1'),
            'daily': weather.get('daily'), 'flags': weather_flags(weather.get('daily') or {}, crop)}


@app.get('/api/crops/{crop_id}/timeline')
def crop_timeline(crop_id: str, sowing_date: str | None = None, area: float = Query(gt=0, le=10000, default=1)):
    """Auto-generated week-by-week crop journey anchored to a sowing date."""
    crop = BY_ID.get(crop_id)
    if not crop:
        raise HTTPException(404, 'Unknown crop')
    try:
        anchor = date.fromisoformat(sowing_date) if sowing_date else date.today()
    except ValueError:
        raise HTTPException(422, 'sowing_date must be YYYY-MM-DD')
    stages = []
    for stage in crop.get('calendar', []):
        start = anchor + timedelta(weeks=stage['start'])
        end = anchor + timedelta(weeks=max(stage['end'], stage['start']))
        stages.append({'stage': stage['stage'], 'week_start': stage['start'], 'week_end': stage['end'],
                       'start_date': start.isoformat(), 'end_date': end.isoformat(),
                       'tasks': stage['tasks']})
    return {'crop': crop, 'sowing_date': anchor.isoformat(), 'area_acres': area,
            'expected_harvest_window': {'start': (anchor + timedelta(days=crop['duration_days'][0])).isoformat(),
                                        'end': (anchor + timedelta(days=crop['duration_days'][1])).isoformat()},
            'stages': stages,
            'note': 'Generic, illustrative field schedule. Local variety, climate and advisory always override the default week numbers.'}


@app.get('/api/water-plan')
def water_plan(crop_id: str, area: float = Query(gt=0, le=10000), season: Literal['kharif', 'rabi', 'summer'] | None = None):
    """Seasonal water budget in farmer-friendly units, from transparent arithmetic."""
    crop = BY_ID.get(crop_id)
    if not crop:
        raise HTTPException(404, 'Unknown crop')
    season = season or (crop['seasons'][0] if crop['seasons'] else 'kharif')
    mm_low, mm_high = crop['water_mm']
    litres_per_mm_per_acre = 4046.86  # 1 mm over 1 acre = 4.04686 m³
    gross_low = mm_low * litres_per_mm_per_acre * area
    gross_high = mm_high * litres_per_mm_per_acre * area
    rain_share = SEASON_RAIN_SHARE[season]
    net_low = gross_low * (1 - rain_share)
    net_high = gross_high * (1 - rain_share)
    weeks_low = crop['duration_days'][0] / 7
    return {'crop': crop, 'area_acres': area, 'season': season,
            'crop_water_need_mm': [mm_low, mm_high],
            'gross_water_need_litres': [round(gross_low), round(gross_high)],
            'assumed_effective_rainfall_share': rain_share,
            'net_irrigation_need_litres': [round(net_low), round(net_high)],
            'tanker_loads_5000L': [round(net_low / 5000), round(net_high / 5000)],
            'per_week_irrigation_litres': [round(net_low / max(1, weeks_low)), round(net_high / max(1, weeks_low))],
            'formula': 'gross litres = crop water need (mm) × 4046.86 × acres; net irrigation = gross × (1 − assumed effective rainfall share)',
            'note': 'Assumed rainfall share is an illustration (kharif 45%, rabi 10%, summer 0%), not a local rainfall measurement. '
                    'Drip or mulch can cut these numbers substantially; check actual soil moisture before each irrigation.'}


@app.post('/api/simulator')
def simulate(req: SimulatorRequest):
    crop = BY_ID.get(req.crop_id)
    if not crop:
        raise HTTPException(404, 'Unknown crop')
    cost_mid = sum(crop['cost']) / 2
    gross = req.price_per_quintal * req.yield_quintals_per_acre * req.area
    entries = []
    for name, price_factor, yield_factor, cost_factor in [('Best', 1.2, 1.2, 0.9), ('Expected', 1, 1, 1), ('Worst', 0.8, 0.65, 1.2)]:
        revenue = gross * price_factor * yield_factor
        cost = cost_mid * req.area * cost_factor
        entries.append({'scenario': name, 'revenue': round(revenue), 'cost': round(cost), 'profit': round(revenue - cost),
                        'assumptions': {'price_factor': price_factor, 'yield_factor': yield_factor, 'cost_factor': cost_factor}})
    return {'crop': crop['name'], 'currency': 'INR',
            'note': 'Illustrative what-if estimates only; yields, prices and costs are not verified forecasts.',
            'scenarios': entries}


@app.get('/api/weather')
def weather(district: str = Query(min_length=2, max_length=100)):
    return get_weather(district)


@app.get('/api/mandi/prices')
def mandi_prices(commodity: str, state: str, district: str | None = None):
    return get_mandi_prices(commodity, state, district)


@app.post('/api/auth/request-otp')
def request_otp(req: OtpRequest):
    phone = re.sub(r'\D', '', req.phone)
    if not re.fullmatch(r'[6-9]\d{9}', phone):
        raise HTTPException(422, 'Enter a valid 10-digit Indian mobile number')
    if otp_rate_limited(phone):
        raise HTTPException(429, 'Too many OTP requests. Try again in 10 minutes.')
    test_code = os.getenv('KRISHI_TEST_OTP', '').strip()
    code = test_code if (test_code and os.getenv('KRISHI_DB') and 'pytest' in os.getenv('KRISHI_DB', '')) else f'{random.SystemRandom().randint(0, 999999):06d}'
    # Development-only delivery: console output, never expose OTP in the HTTP response.
    print(f'[DEV OTP] phone={phone} code={code}; expires in 5 minutes')
    with db() as conn:
        conn.execute('INSERT OR REPLACE INTO otp_codes(phone,code_hash,expires_at,attempts) VALUES(?,?,?,0)',
                     (phone, hashlib.sha256(code.encode()).hexdigest(), time.time() + OTP_TTL_SECONDS))
    return {'status': 'queued', 'message': 'OTP requested. SMS delivery must be configured for production.'}


@app.post('/api/auth/verify-otp')
def verify_otp(req: VerifyRequest):
    phone = re.sub(r'\D', '', req.phone)
    with db() as conn:
        row = conn.execute('SELECT * FROM otp_codes WHERE phone=?', (phone,)).fetchone()
        expected = hashlib.sha256(req.code.strip().encode()).hexdigest()
        if (not row or row['expires_at'] < time.time() or row['attempts'] >= 5
                or not hmac.compare_digest(row['code_hash'], expected)):
            if row:
                conn.execute('UPDATE otp_codes SET attempts=attempts+1 WHERE phone=?', (phone,))
            raise HTTPException(401, 'Invalid or expired OTP')
        conn.execute('DELETE FROM otp_codes WHERE phone=?', (phone,))
        conn.execute('INSERT OR IGNORE INTO users(phone,created_at) VALUES(?,?)', (phone, datetime.now(timezone.utc).isoformat()))
        user = conn.execute('SELECT * FROM users WHERE phone=?', (phone,)).fetchone()
        token = secrets.token_urlsafe(24)
        conn.execute('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
                     (hashlib.sha256(token.encode()).hexdigest(), user['id'], time.time() + SESSION_TTL_SECONDS,
                      datetime.now(timezone.utc).isoformat()))
    return {'status': 'verified', 'token': token, 'expires_in_days': 30,
            'user': {'id': user['id'], 'phone': user['phone']},
            'message': 'Signed in. Plans you save now belong to this account.'}


@app.get('/api/auth/me')
def auth_me(request: Request):
    user = bearer_user(request)
    if not user:
        raise HTTPException(401, 'Not signed in')
    return {'user': {'id': user['id'], 'phone': user['phone']}}


@app.post('/api/auth/logout')
def auth_logout(request: Request):
    header = request.headers.get('authorization', '')
    if header.lower().startswith('bearer '):
        token_hash = hashlib.sha256(header[7:].strip().encode()).hexdigest()
        with db() as conn:
            conn.execute('DELETE FROM sessions WHERE token_hash=?', (token_hash,))
    return {'status': 'signed-out'}


@app.post('/api/plans', status_code=201)
def save_plan(request: Request, profile: FarmProfile):
    ranked = recommendations(profile)
    user = bearer_user(request)
    created = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        cur = conn.execute(
            'INSERT INTO plans(user_id,district,season,soil,water,area,budget,goal,recommendations,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
            (user['id'] if user else None, profile.district, profile.season, profile.soil, profile.water,
             profile.area, profile.budget, profile.goal, json.dumps(ranked[:3]), created))
        plan_id = cur.lastrowid
    return {'id': plan_id, **profile.model_dump(), 'owner': bool(user), 'recommendations': ranked[:3], 'created_at': created}


@app.get('/api/plans')
def list_plans(request: Request):
    user = bearer_user(request)
    with db() as conn:
        if user:
            rows = conn.execute('SELECT * FROM plans WHERE user_id=? ORDER BY id DESC', (user['id'],)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM plans WHERE user_id IS NULL ORDER BY id DESC').fetchall()
    return [{**dict(r), 'recommendations': json.loads(r['recommendations'])} for r in rows]


@app.delete('/api/plans/{plan_id}', status_code=204)
def delete_plan(request: Request, plan_id: int):
    user = bearer_user(request)
    with db() as conn:
        row = conn.execute('SELECT * FROM plans WHERE id=?', (plan_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Plan not found')
        if row['user_id'] is not None and (user is None or user['id'] != row['user_id']):
            raise HTTPException(403, 'This plan belongs to another account')
        conn.execute('DELETE FROM plans WHERE id=?', (plan_id,))
    return None


@app.get('/api/schemes')
def schemes(state: str | None = None, crop: str | None = None):
    return [
      {'id': 'pm-kisan', 'name': 'PM-KISAN', 'summary': 'Income support scheme for eligible landholding farmer families. Check official eligibility and current status.', 'url': 'https://pmkisan.gov.in/', 'match': 'All profiles; eligibility must be checked on official portal.'},
      {'id': 'pmfby', 'name': 'Pradhan Mantri Fasal Bima Yojana (PMFBY)', 'summary': 'Crop insurance; notified crops, areas, enrolment windows and terms vary by season and state.', 'url': 'https://pmfby.gov.in/', 'match': f'Check current notified crop/area for {state or "your state"} and {crop or "your crop"}.'},
      {'id': 'msp', 'name': 'Minimum Support Prices (MSP)', 'summary': 'Government MSP announcements cover notified commodities; procurement availability depends on crop and location.', 'url': 'https://agricoop.gov.in/en/MinimumSupportPrices', 'match': f'Check commodity coverage and procurement access for {crop or "your crop"}.'},
      {'id': 'subsidies', 'name': 'State agriculture subsidies', 'summary': 'Input and equipment subsidy programmes are state- and application-window-specific.', 'url': 'https://agrimachinery.nic.in/', 'match': f'Check official programmes for {state or "your state"}.'}
    ]


@app.post('/api/schemes/eligibility')
def schemes_eligibility(answers: EligibilityAnswers):
    """Interactive scheme navigator: deterministic matching of a short questionnaire."""
    matches = [
      {'id': 'pm-kisan', 'name': 'PM-KISAN', 'strength': 'strong' if answers.owns_land else 'check',
       'why': '₹6,000/year income support for landholding farmer families' + ('' if answers.owns_land else ' — land ownership records will be needed'),
       'docs': ['Aadhaar', 'Land records (7/12 or equivalent)', 'Bank account linked to Aadhaar'],
       'url': 'https://pmkisan.gov.in/'},
      {'id': 'pmfby', 'name': 'PMFBY crop insurance', 'strength': 'strong' if (answers.wants_insurance or not answers.has_irrigation) else 'check',
       'why': 'Protects against crop loss; especially valuable for rain-fed fields',
       'docs': ['Land record', 'Sowing certificate', 'Bank account; premium per notified crop'],
       'url': 'https://pmfby.gov.in/'},
      {'id': 'kcc', 'name': 'Kisan Credit Card (KCC)', 'strength': 'strong' if answers.wants_credit else 'check',
       'why': 'Short-term crop loan with interest subvention on timely repayment',
       'docs': ['Land documents / tenancy proof', 'Identity proof', 'Crop plan'],
       'url': 'https://www.myscheme.gov.in/schemes/kcc'},
      {'id': 'shc', 'name': 'Soil Health Card', 'strength': 'strong' if not answers.has_soil_card else 'done',
       'why': 'Free soil testing guides fertilizer use and raises the value of every other decision',
       'docs': ['Contact your village agriculture assistant / KVK'],
       'url': 'https://soilhealth.dac.gov.in'},
      {'id': 'pm-kusum', 'name': 'PM-KUSUM solar pump', 'strength': 'strong' if not answers.has_irrigation else 'check',
       'why': 'Subsidised solar irrigation pumps for farms without reliable grid/water access',
       'docs': ['Land documents', 'Water source proof', 'State DISCOM application'],
       'url': 'https://pmkusum.mnre.gov.in/'},
      {'id': 'enam', 'name': 'e-NAM registration', 'strength': 'strong' if answers.sells_in_mandi else 'check',
       'why': 'Sell in more mandis with transparent online price discovery',
       'docs': ['Bank account', 'Aadhaar', 'Local mandi registration'],
       'url': 'https://www.enam.gov.in/'},
      {'id': 'smam', 'name': 'SMAM machinery subsidy', 'strength': 'check',
       'why': 'Subsidy on tractors, implements and custom-hiring centres; scales with landholding',
       'docs': ['Land record', 'Bank details', 'Quotation of machinery'],
       'url': 'https://agrimachinery.nic.in/'},
      {'id': 'mahila-kisan', 'name': 'Mahila Kisan (DAY-NRLM)', 'strength': 'strong' if answers.gender == 'female' else 'skip',
       'why': 'Support for women farmers through self-help groups: training, credit links, agro-ecology grants',
       'docs': ['SHG membership', 'Aadhaar'],
       'url': 'https://aajeevika.gov.in/'},
    ]
    rank = {'strong': 0, 'check': 1, 'done': 2, 'skip': 3}
    matches.sort(key=lambda m: rank[m['strength']])
    return {'answers': answers.model_dump(),
            'note': 'This navigator only organises official starting points and document checklists. Eligibility is always decided by the official portal or office.',
            'matches': matches}


@app.post('/api/assistant')
def assistant(req: AssistantRequest):
    """Grounded farming assistant. LLM-backed when configured; transparent rules otherwise."""
    context_text = assistant_context(req.profile)
    llm_result = ask_llm(req.question, context_text, req.lang)
    if llm_result:
        return {'mode': 'llm', 'model': llm_result['model'], 'answer': llm_result['answer'],
                'sources': ['KrishiGuide crop catalogue', 'Your farm profile'] if req.profile else ['KrishiGuide crop catalogue'],
                'disclaimer': 'Verify all recommendations with your local KVK or agriculture officer.'}
    return {'mode': 'rules', 'answer': rule_based_answer(req.question, req.lang, req.profile),
            'sources': ['KrishiGuide crop catalogue'],
            'disclaimer': 'Rule-based starter assistant (no LLM key configured). Verify locally with a KVK or agriculture officer.'}


app.include_router(buyers.build_router(db))


# Static frontend must be mounted LAST so /api and /docs routes match first.
if FRONTEND_DIR.exists():
    app.mount('/', StaticFiles(directory=str(FRONTEND_DIR), html=True), name='frontend')
