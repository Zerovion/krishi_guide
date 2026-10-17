"""Buyer offers: buyer accounts, offers with auto-expiry, price reality check, trust tools.

All SQL lives in this file and uses plain `?` placeholders, so moving from SQLite to a hosted
Postgres (Neon / Supabase) later means changing `db()` in main.py plus a few type names here.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
import re
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from .data_adapters import get_mandi_prices

DATA = Path(__file__).resolve().parents[1] / 'data'
CROPS = {c['id']: c for c in json.loads((DATA / 'crops.json').read_text(encoding='utf-8'))}
MSP = json.loads((DATA / 'msp.json').read_text(encoding='utf-8'))['crops']
_DIST = json.loads((DATA / 'districts.json').read_text(encoding='utf-8'))
DISTRICTS: dict[str, list[float]] = _DIST['districts']
STATE = _DIST['state']

# Agmarknet (data.gov.in) commodity names for our crops. Sugarcane is not traded in mandis.
MANDI_NAMES = {
    'soybean': 'Soyabean', 'bajra': 'Bajra(Pearl Millet/Cumbu)', 'jowar': 'Jowar(Sorghum)',
    'groundnut': 'Groundnut', 'maize': 'Maize', 'paddy': 'Paddy(Dhan)(Common)', 'cotton': 'Cotton',
    'chickpea': 'Bengal Gram(Gram)(Whole)', 'wheat': 'Wheat', 'mustard': 'Mustard', 'onion': 'Onion',
    'moong': 'Green Gram (Moong)(Whole)',
}

SESSION_TTL = 30 * 24 * 3600
REPORTS_TO_HIDE = 3          # open reports from different people that hide an offer for review
MAX_VALID_DAYS = 90
SUSPICIOUS_FACTOR = 1.4      # an offer this far above the best reference looks too good to be true
MANDI_TTL = 30 * 60

_mandi_cache: dict[str, tuple[float, float | None, str | None]] = {}


def admin_key() -> str:
    return os.environ.get('ADMIN_KEY', 'krishi-admin')


# ------------------------------------------------------------------ schema / seed

SCHEMA = '''
CREATE TABLE IF NOT EXISTS buyers(id INTEGER PRIMARY KEY, name TEXT, business TEXT, phone TEXT UNIQUE,
  district TEXT, pw_salt TEXT, pw_hash TEXT, verified INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS buyer_sessions(token_hash TEXT PRIMARY KEY, buyer_id INTEGER, expires_at REAL);
CREATE TABLE IF NOT EXISTS offers(id INTEGER PRIMARY KEY, buyer_id INTEGER, crop_id TEXT, price REAL,
  quantity REAL, district TEXT, pickup TEXT, note TEXT, valid_until TEXT,
  status TEXT DEFAULT 'active', created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS offer_reports(id INTEGER PRIMARY KEY, offer_id INTEGER, reporter TEXT, reason TEXT,
  status TEXT DEFAULT 'open', created_at TEXT, UNIQUE(offer_id, reporter));
'''


def hash_pw(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 120_000).hex()


def today() -> date:
    return date.today()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def init(conn) -> None:
    conn.executescript(SCHEMA)
    if os.environ.get('KRISHI_SEED_DEMO', '1') != '0':
        seed_demo(conn)


# Demo data so the feature is always showable, even after Render wipes the disk.
# Prices are illustrative and deliberately include a below-MSP and a too-good-to-be-true offer.
DEMO_PASSWORD = 'demo123'
DEMO_BUYERS = [
    ('Patil Agro Traders', 'Patil Agro Traders, Kolhapur', '9000000001', 'Kolhapur', 1),
    ('Sahyadri Oil Mills', 'Sahyadri Oil Mills Pvt Ltd', '9000000002', 'Sangli', 1),
    ('Deshmukh Grain Co.', 'Deshmukh Grain Co., Pune', '9000000003', 'Pune', 1),
    ('Quick Cash Kisan Mart', 'New buyer (pending approval)', '9000000004', 'Satara', 0),
]
DEMO_OFFERS = [  # (buyer phone, crop, price, qty, district, pickup, note, days valid)
    ('9000000001', 'soybean', 5650, 200, 'Kolhapur', 'farm_gate', 'Moisture below 12%. Payment within 3 days.', 12),
    ('9000000002', 'soybean', 6050, 500, 'Sangli', 'buyer_location', 'Oil mill. Bring to our yard, same-day weighing.', 20),
    ('9000000003', 'soybean', 5900, 300, 'Pune', 'farm_gate', 'We send a truck for 50+ quintal lots.', 30),
    ('9000000001', 'wheat', 2700, 150, 'Kolhapur', 'farm_gate', 'Clean, dry grain only.', 25),
    ('9000000003', 'wheat', 2640, 400, 'Pune', 'buyer_location', '', 15),
    ('9000000002', 'chickpea', 6100, 100, 'Sangli', 'farm_gate', 'Bold grain preferred.', 18),
    ('9000000001', 'onion', 2100, 250, 'Kolhapur', 'farm_gate', 'Graded 45mm+. Weekly pickup.', 10),
    ('9000000003', 'cotton', 8400, 120, 'Pune', 'buyer_location', 'Medium staple, moisture under 8%.', 40),
    ('9000000004', 'wheat', 4200, 1000, 'Satara', 'farm_gate', 'Advance booking fee required.', 30),
]


def seed_demo(conn) -> None:
    if conn.execute('SELECT 1 FROM buyers LIMIT 1').fetchone():
        return
    ids = {}
    for name, business, phone, district, verified in DEMO_BUYERS:
        salt = secrets.token_hex(16)
        cur = conn.execute(
            'INSERT INTO buyers(name,business,phone,district,pw_salt,pw_hash,verified,created_at) VALUES(?,?,?,?,?,?,?,?)',
            (name, business, phone, district, salt, hash_pw(DEMO_PASSWORD, salt), verified, now_iso()))
        ids[phone] = cur.lastrowid
    for phone, crop, price, qty, district, pickup, note, days in DEMO_OFFERS:
        conn.execute(
            'INSERT INTO offers(buyer_id,crop_id,price,quantity,district,pickup,note,valid_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
            (ids[phone], crop, price, qty, district, pickup, note, (today() + timedelta(days=days)).isoformat(), now_iso(), now_iso()))


# ------------------------------------------------------------------ price reality check

def mandi_modal(crop_id: str, district: str | None = None) -> tuple[float | None, str | None]:
    """Latest modal mandi price (Rs/quintal) from data.gov.in, cached. (None, None) if unavailable."""
    name = MANDI_NAMES.get(crop_id)
    if not name:
        return None, None
    hit = _mandi_cache.get(crop_id)
    if hit and hit[0] > time.time():
        return hit[1], hit[2]
    price, as_of = None, None
    try:
        data = get_mandi_prices(name, STATE)
        rows = [r for r in data.get('records', []) if _num(r.get('modal_price'))]
        if rows:
            def key(r):
                d = str(r.get('arrival_date', ''))
                try:
                    return datetime.strptime(d, '%d/%m/%Y').date()
                except ValueError:
                    return date.min
            newest = max(key(r) for r in rows)
            latest = [r for r in rows if key(r) == newest]
            price = round(sum(_num(r['modal_price']) for r in latest) / len(latest))
            as_of = newest.isoformat() if newest != date.min else None
    except Exception:  # never let a market-data hiccup break the offers page
        price, as_of = None, None
    _mandi_cache[crop_id] = (time.time() + (MANDI_TTL if price else 300), price, as_of)
    return price, as_of


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def reference(crop_id: str) -> dict:
    msp = MSP.get(crop_id)
    mandi, as_of = mandi_modal(crop_id)
    return {'crop_id': crop_id,
            'msp': msp['price'] if msp else None, 'msp_season': msp['season'] if msp else None,
            'mandi': mandi, 'mandi_date': as_of}


def assess(price: float, ref: dict) -> dict:
    """Is this offer good? Compare with the live mandi price first, else with the MSP."""
    msp, mandi = ref.get('msp'), ref.get('mandi')
    basis = mandi or msp
    out = {'vs_msp_pct': None, 'vs_mandi_pct': None, 'below_msp': False, 'suspicious': False, 'verdict': 'unknown'}
    if msp:
        out['vs_msp_pct'] = round((price - msp) / msp * 100, 1)
        out['below_msp'] = price < msp
    if mandi:
        out['vs_mandi_pct'] = round((price - mandi) / mandi * 100, 1)
    if basis:
        pct = (price - basis) / basis
        out['verdict'] = 'good' if pct >= 0.03 else 'fair' if pct > -0.03 else 'low'
        if out['below_msp']:
            out['verdict'] = 'low'
        top = max(x for x in (msp, mandi) if x)
        out['suspicious'] = price > top * SUSPICIOUS_FACTOR
    return out


def haversine_km(a: list[float], b: list[float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def distance_km(d1: str | None, d2: str | None) -> int | None:
    if d1 in DISTRICTS and d2 in DISTRICTS:
        # straight-line distance x1.3 approximates road distance
        return round(haversine_km(DISTRICTS[d1], DISTRICTS[d2]) * 1.3)
    return None


# ------------------------------------------------------------------ request models

class RegisterReq(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    business: str = Field(default='', max_length=120)
    phone: str
    district: str
    password: str = Field(min_length=6, max_length=72)

    @field_validator('phone')
    @classmethod
    def _phone(cls, v):
        v = re.sub(r'\D', '', v)[-10:]
        if not re.fullmatch(r'[6-9]\d{9}', v):
            raise ValueError('Enter a valid 10-digit Indian mobile number')
        return v

    @field_validator('district')
    @classmethod
    def _district(cls, v):
        if v not in DISTRICTS:
            raise ValueError('Choose a Maharashtra district from the list')
        return v


class LoginReq(BaseModel):
    phone: str
    password: str


class OfferReq(BaseModel):
    crop_id: str
    price: float = Field(gt=0, le=200000, description='Rs per quintal')
    quantity: float = Field(gt=0, le=100000, description='quintals wanted')
    district: str
    pickup: Literal['farm_gate', 'buyer_location'] = 'farm_gate'
    note: str = Field(default='', max_length=200)
    valid_until: date

    @field_validator('crop_id')
    @classmethod
    def _crop(cls, v):
        if v not in CROPS:
            raise ValueError('Unknown crop')
        return v

    @field_validator('district')
    @classmethod
    def _district(cls, v):
        if v not in DISTRICTS:
            raise ValueError('Choose a Maharashtra district from the list')
        return v

    @field_validator('valid_until')
    @classmethod
    def _valid(cls, v):
        if v < today():
            raise ValueError('Valid-until date cannot be in the past')
        if v > today() + timedelta(days=MAX_VALID_DAYS):
            raise ValueError(f'Offers can run at most {MAX_VALID_DAYS} days')
        return v


class ReportReq(BaseModel):
    reason: Literal['fake_price', 'unreachable', 'asked_advance', 'other'] = 'fake_price'


class VerifyReq(BaseModel):
    verified: bool


class ResolveReq(BaseModel):
    action: Literal['remove', 'dismiss']


# ------------------------------------------------------------------ router

def build_router(db) -> APIRouter:
    r = APIRouter()

    def buyer_from(token: str | None):
        if not token:
            raise HTTPException(401, 'Please log in as a buyer')
        th = hashlib.sha256(token.encode()).hexdigest()
        with db() as c:
            row = c.execute('SELECT b.* FROM buyer_sessions s JOIN buyers b ON b.id=s.buyer_id WHERE s.token_hash=? AND s.expires_at>?',
                            (th, time.time())).fetchone()
        if not row:
            raise HTTPException(401, 'Session expired, please log in again')
        return row

    def require_admin(key: str | None):
        if not key or not hmac.compare_digest(key, admin_key()):
            raise HTTPException(403, 'Admin key required')

    def public_buyer(b) -> dict:
        return {'id': b['id'], 'name': b['name'], 'business': b['business'], 'phone': b['phone'],
                'district': b['district'], 'verified': bool(b['verified'])}

    def new_session(c, buyer_id: int) -> str:
        token = secrets.token_urlsafe(32)
        c.execute('INSERT INTO buyer_sessions(token_hash,buyer_id,expires_at) VALUES(?,?,?)',
                  (hashlib.sha256(token.encode()).hexdigest(), buyer_id, time.time() + SESSION_TTL))
        return token

    def offer_dict(o, refs: dict, from_district: str | None) -> dict:
        ref = refs.get(o['crop_id']) or reference(o['crop_id'])
        crop = CROPS[o['crop_id']]
        expired = o['valid_until'] < today().isoformat()
        return {
            'id': o['id'], 'crop_id': o['crop_id'], 'crop_name': crop['name'], 'emoji': crop['emoji'],
            'price': o['price'], 'quantity': o['quantity'], 'district': o['district'], 'pickup': o['pickup'],
            'note': o['note'], 'valid_until': o['valid_until'],
            'days_left': (date.fromisoformat(o['valid_until']) - today()).days,
            'status': 'expired' if (expired and o['status'] == 'active') else o['status'],
            'buyer': {'name': o['b_name'], 'business': o['b_business'], 'phone': o['b_phone'], 'verified': bool(o['b_verified'])},
            'distance_km': distance_km(from_district, o['district']),
            'reference': ref, 'check': assess(o['price'], ref), 'best': False,
        }

    def refs_for(crop_ids) -> dict:
        ids = sorted(set(crop_ids))
        with ThreadPoolExecutor(max_workers=6) as pool:
            return dict(zip(ids, pool.map(reference, ids)))

    JOIN = ('SELECT o.*, b.name b_name, b.business b_business, b.phone b_phone, b.verified b_verified '
            'FROM offers o JOIN buyers b ON b.id=o.buyer_id ')

    # ---- buyer accounts
    @r.post('/api/buyers/register', status_code=201)
    def register(req: RegisterReq):
        salt = secrets.token_hex(16)
        with db() as c:
            if c.execute('SELECT 1 FROM buyers WHERE phone=?', (req.phone,)).fetchone():
                raise HTTPException(409, 'This phone number is already registered. Please log in.')
            cur = c.execute('INSERT INTO buyers(name,business,phone,district,pw_salt,pw_hash,verified,created_at) VALUES(?,?,?,?,?,?,0,?)',
                            (req.name.strip(), req.business.strip(), req.phone, req.district, salt, hash_pw(req.password, salt), now_iso()))
            token = new_session(c, cur.lastrowid)
            b = c.execute('SELECT * FROM buyers WHERE id=?', (cur.lastrowid,)).fetchone()
        return {'token': token, 'buyer': public_buyer(b)}

    @r.post('/api/buyers/login')
    def login(req: LoginReq):
        phone = re.sub(r'\D', '', req.phone)[-10:]
        with db() as c:
            b = c.execute('SELECT * FROM buyers WHERE phone=?', (phone,)).fetchone()
            if not b or not hmac.compare_digest(hash_pw(req.password, b['pw_salt']), b['pw_hash']):
                raise HTTPException(401, 'Wrong phone number or password')
            token = new_session(c, b['id'])
        return {'token': token, 'buyer': public_buyer(b)}

    @r.get('/api/buyers/me')
    def me(x_buyer_token: str | None = Header(default=None)):
        return public_buyer(buyer_from(x_buyer_token))

    # ---- buyer's own offers
    @r.get('/api/buyer/offers')
    def my_offers(x_buyer_token: str | None = Header(default=None)):
        b = buyer_from(x_buyer_token)
        with db() as c:
            rows = c.execute(JOIN + "WHERE o.buyer_id=? AND o.status!='withdrawn' ORDER BY o.id DESC", (b['id'],)).fetchall()
        refs = refs_for(o['crop_id'] for o in rows)
        return {'buyer': public_buyer(b), 'offers': [offer_dict(o, refs, None) for o in rows]}

    @r.post('/api/buyer/offers', status_code=201)
    def create_offer(req: OfferReq, x_buyer_token: str | None = Header(default=None)):
        b = buyer_from(x_buyer_token)
        with db() as c:
            cur = c.execute('INSERT INTO offers(buyer_id,crop_id,price,quantity,district,pickup,note,valid_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                            (b['id'], req.crop_id, req.price, req.quantity, req.district, req.pickup, req.note.strip(),
                             req.valid_until.isoformat(), now_iso(), now_iso()))
            o = c.execute(JOIN + 'WHERE o.id=?', (cur.lastrowid,)).fetchone()
        return offer_dict(o, refs_for([o['crop_id']]), None)

    @r.put('/api/buyer/offers/{offer_id}')
    def edit_offer(offer_id: int, req: OfferReq, x_buyer_token: str | None = Header(default=None)):
        b = buyer_from(x_buyer_token)
        with db() as c:
            own = c.execute("SELECT status FROM offers WHERE id=? AND buyer_id=? AND status!='withdrawn'", (offer_id, b['id'])).fetchone()
            if not own:
                raise HTTPException(404, 'Offer not found')
            if own['status'] in ('removed', 'under_review'):
                raise HTTPException(409, 'This offer is under review or removed and cannot be edited')
            c.execute('UPDATE offers SET crop_id=?,price=?,quantity=?,district=?,pickup=?,note=?,valid_until=?,updated_at=? WHERE id=?',
                      (req.crop_id, req.price, req.quantity, req.district, req.pickup, req.note.strip(),
                       req.valid_until.isoformat(), now_iso(), offer_id))
            o = c.execute(JOIN + 'WHERE o.id=?', (offer_id,)).fetchone()
        return offer_dict(o, refs_for([o['crop_id']]), None)

    @r.delete('/api/buyer/offers/{offer_id}', status_code=204)
    def withdraw_offer(offer_id: int, x_buyer_token: str | None = Header(default=None)):
        b = buyer_from(x_buyer_token)
        with db() as c:
            cur = c.execute("UPDATE offers SET status='withdrawn', updated_at=? WHERE id=? AND buyer_id=?", (now_iso(), offer_id, b['id']))
            if cur.rowcount == 0:
                raise HTTPException(404, 'Offer not found')

    # ---- farmer side
    @r.get('/api/reference/{crop_id}')
    def crop_reference(crop_id: str):
        if crop_id not in CROPS:
            raise HTTPException(404, 'Unknown crop')
        return reference(crop_id)

    @r.get('/api/districts')
    def districts():
        return {'state': STATE, 'districts': sorted(DISTRICTS)}

    @r.get('/api/offers')
    def list_offers(crop: str | None = None, district: str | None = None, from_district: str | None = None,
                    max_km: int | None = None, include_unverified: bool = False):
        sql = JOIN + "WHERE o.status='active' AND o.valid_until>=?"
        args: list = [today().isoformat()]
        if not include_unverified:
            sql += ' AND b.verified=1'
        if crop:
            sql += ' AND o.crop_id=?'; args.append(crop)
        if district:
            sql += ' AND o.district=?'; args.append(district)
        with db() as c:
            rows = c.execute(sql + ' ORDER BY o.price DESC', args).fetchall()
        refs = refs_for(o['crop_id'] for o in rows)
        offers = [offer_dict(o, refs, from_district) for o in rows]
        if max_km is not None and from_district:
            offers = [o for o in offers if o['distance_km'] is not None and o['distance_km'] <= max_km]
        best = {}
        for o in offers:  # already sorted by price desc, so the first per crop is the best
            if o['crop_id'] not in best and not o['check']['suspicious']:
                best[o['crop_id']] = o['id']
                o['best'] = True
        return {'offers': offers, 'as_of': now_iso(), 'unverified_included': include_unverified}

    @r.post('/api/offers/{offer_id}/report', status_code=201)
    def report_offer(offer_id: int, req: ReportReq, request: Request):
        who = hashlib.sha256(f"{request.client.host if request.client else ''}|{request.headers.get('user-agent', '')}".encode()).hexdigest()[:24]
        with db() as c:
            o = c.execute('SELECT id,status FROM offers WHERE id=?', (offer_id,)).fetchone()
            if not o:
                raise HTTPException(404, 'Offer not found')
            try:
                c.execute('INSERT INTO offer_reports(offer_id,reporter,reason,created_at) VALUES(?,?,?,?)', (offer_id, who, req.reason, now_iso()))
            except Exception:
                raise HTTPException(409, 'You have already reported this offer')
            n = c.execute("SELECT COUNT(*) FROM offer_reports WHERE offer_id=? AND status='open'", (offer_id,)).fetchone()[0]
            hidden = False
            if n >= REPORTS_TO_HIDE and o['status'] == 'active':
                c.execute("UPDATE offers SET status='under_review' WHERE id=?", (offer_id,))
                hidden = True
        return {'ok': True, 'reports': n, 'hidden_for_review': hidden}

    # ---- admin (header X-Admin-Key)
    @r.get('/api/admin/buyers')
    def admin_buyers(x_admin_key: str | None = Header(default=None)):
        require_admin(x_admin_key)
        with db() as c:
            rows = c.execute('SELECT b.*, (SELECT COUNT(*) FROM offers o WHERE o.buyer_id=b.id) n_offers FROM buyers b ORDER BY b.verified, b.id DESC').fetchall()
        return {'buyers': [{**public_buyer(b), 'offers': b['n_offers'], 'created_at': b['created_at']} for b in rows]}

    @r.post('/api/admin/buyers/{buyer_id}/verify')
    def admin_verify(buyer_id: int, req: VerifyReq, x_admin_key: str | None = Header(default=None)):
        require_admin(x_admin_key)
        with db() as c:
            if c.execute('UPDATE buyers SET verified=? WHERE id=?', (int(req.verified), buyer_id)).rowcount == 0:
                raise HTTPException(404, 'Buyer not found')
        return {'ok': True, 'verified': req.verified}

    @r.get('/api/admin/reports')
    def admin_reports(x_admin_key: str | None = Header(default=None)):
        require_admin(x_admin_key)
        with db() as c:
            rows = c.execute(JOIN.replace('SELECT o.*,', 'SELECT o.*, (SELECT COUNT(*) FROM offer_reports x WHERE x.offer_id=o.id AND x.status=\'open\') n_reports,')
                             + 'WHERE o.id IN (SELECT offer_id FROM offer_reports WHERE status=\'open\') ORDER BY n_reports DESC').fetchall()
        refs = refs_for(o['crop_id'] for o in rows)
        return {'offers': [{**offer_dict(o, refs, None), 'reports': o['n_reports']} for o in rows]}

    @r.post('/api/admin/offers/{offer_id}/resolve')
    def admin_resolve(offer_id: int, req: ResolveReq, x_admin_key: str | None = Header(default=None)):
        require_admin(x_admin_key)
        with db() as c:
            if not c.execute('SELECT 1 FROM offers WHERE id=?', (offer_id,)).fetchone():
                raise HTTPException(404, 'Offer not found')
            c.execute("UPDATE offer_reports SET status=? WHERE offer_id=? AND status='open'", ('upheld' if req.action == 'remove' else 'dismissed', offer_id))
            c.execute('UPDATE offers SET status=? WHERE id=? AND status IN (\'under_review\',\'active\')',
                      ('removed' if req.action == 'remove' else 'active', offer_id))
        return {'ok': True}

    return r
