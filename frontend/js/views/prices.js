// Buyer prices: farmer offer board, buyer portal (register / login / post offers) and a small admin panel.
import { apiRequest } from '../api.js';
import { $, esc, money, state, toast, showView } from '../main.js';
import { PT, fmt, filterOffers, verdictBasis } from '../prices-data.js';

const pt = (k, v) => fmt((PT[k] && (PT[k][state.lang] || PT[k].en)) || k, v);
const CACHE_KEY = 'krishi_offers_cache';
const BUYER_KEY = 'krishi_buyer_token';
const filters = { crop: '', district: '', maxKm: '', unverified: false };
let districts = [];
let editing = null;       // offer being edited in the buyer form
let authMode = 'login';

const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } },
};
const adminKey = {
  get() { try { return sessionStorage.getItem('krishi_admin_key') || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem('krishi_admin_key', v) : sessionStorage.removeItem('krishi_admin_key'); } catch { /* ignore */ } },
};
const buyerHeaders = () => ({ 'X-Buyer-Token': store.get(BUYER_KEY) });
const locale = () => ({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[state.lang] || 'en-IN');
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
const matchDistrict = (name) => districts.find((d) => d.toLowerCase() === String(name || '').trim().toLowerCase()) || '';

export async function renderPrices() {
  const sub = $('view-prices').dataset.sub || '';
  if (!districts.length) {
    try { districts = (await apiRequest('/districts')).districts; } catch { districts = JSON.parse(store.get('krishi_districts') || '[]'); }
    if (districts.length) store.set('krishi_districts', JSON.stringify(districts));
  }
  $('view-prices').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(pt('eyebrow'))}</div>
      <h1>${esc(pt('title'))}</h1>
      <p>${esc(pt('desc'))}</p>
    </div>
    <div class="px-tabs" role="tablist">
      ${[['', 'tabFarmer'], ['buyer', 'tabBuyer'], ['admin', 'tabAdmin']].map(([s, k]) =>
        `<button class="px-tab ${s === sub ? 'on' : ''}" role="tab" aria-selected="${s === sub}" data-px-tab="${s}" type="button">${esc(pt(k))}</button>`).join('')}
    </div>
    <div id="pxBody"></div>
    <p class="muted-note">${esc(pt('disclaimer'))}</p>`;
  $('view-prices').querySelectorAll('[data-px-tab]').forEach((b) =>
    b.addEventListener('click', () => showView('prices', b.dataset.pxTab)));
  if (sub === 'buyer') return renderBuyer();
  if (sub === 'admin') return renderAdmin();
  return renderFarmer();
}

// ============================================================ farmer board

function selectHtml(id, label, options, value) {
  return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}">${options
    .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}

async function renderFarmer() {
  if (!filters.myDistrict) filters.myDistrict = matchDistrict(state.profile.district);
  const crops = state.crops.filter((c) => c.id !== 'sugarcane');
  $('pxBody').innerHTML = `
    <section class="panel px-filters">
      ${selectHtml('pxCrop', pt('fCrop'), [['', pt('fAnyCrop')], ...crops.map((c) => [c.id, `${c.emoji} ${c.name}`])], filters.crop)}
      ${selectHtml('pxDistrict', pt('fDistrict'), [['', pt('fAnyDistrict')], ...districts.map((d) => [d, d])], filters.district)}
      ${selectHtml('pxMy', pt('fMyDistrict'), [['', pt('fChoose')], ...districts.map((d) => [d, d])], filters.myDistrict)}
      ${selectHtml('pxKm', pt('fWithin'), [['', pt('fAnyDist')], ...[25, 50, 100, 200].map((n) => [n, `${n} km`])], filters.maxKm)}
      <label class="toggle px-unv"><span>${esc(pt('fUnverified'))}</span><input id="pxUnv" type="checkbox" ${filters.unverified ? 'checked' : ''} /></label>
    </section>
    <div id="pxBanner"></div>
    <div id="pxCount" class="px-count"></div>
    <div id="pxList" class="px-list"><p class="muted-note">${esc(pt('loading'))}</p></div>`;

  const redraw = () => drawOffers();
  $('pxCrop').addEventListener('change', (e) => { filters.crop = e.target.value; redraw(); });
  $('pxDistrict').addEventListener('change', (e) => { filters.district = e.target.value; redraw(); });
  $('pxKm').addEventListener('change', (e) => { filters.maxKm = e.target.value; redraw(); });
  $('pxUnv').addEventListener('change', (e) => { filters.unverified = e.target.checked; redraw(); });
  $('pxMy').addEventListener('change', async (e) => { filters.myDistrict = e.target.value; await loadOffers(); drawOffers(); });

  $('pxList').addEventListener('click', onListClick);
  await loadOffers();
  drawOffers();
}

let allOffers = [];
let offlineAt = null;

async function loadOffers() {
  const q = new URLSearchParams({ include_unverified: 'true' });
  if (filters.myDistrict) q.set('from_district', filters.myDistrict);
  try {
    const data = await apiRequest(`/offers?${q}`);
    allOffers = data.offers;
    offlineAt = null;
    store.set(CACHE_KEY, JSON.stringify({ ts: data.as_of, offers: data.offers }));
  } catch {
    try {
      const c = JSON.parse(store.get(CACHE_KEY) || 'null');
      allOffers = c ? c.offers.filter((o) => o.days_left >= 0) : [];
      offlineAt = c ? c.ts : 'none';
    } catch { allOffers = []; offlineAt = 'none'; }
  }
}

function drawOffers() {
  if (!$('pxList')) return;
  const rows = filterOffers(allOffers, filters);
  $('pxBanner').innerHTML = offlineAt
    ? `<div class="px-offline">📴 ${esc(offlineAt === 'none' ? pt('offlineNone') : pt('offlineBanner', { time: new Date(offlineAt).toLocaleString(locale()) }))}</div>` : '';
  $('pxCount').textContent = pt('count', { n: rows.length });
  $('pxList').innerHTML = rows.length ? rows.map(offerCard).join('') : `<p class="muted-note">${esc(pt('none'))}</p>`;
}

function referenceBlock(o) {
  const r = o.reference, c = o.check;
  const basisKey = verdictBasis(o);
  const refName = basisKey === 'mandi' ? pt('mandi') : pt('msp');
  const pct = basisKey === 'mandi' ? c.vs_mandi_pct : c.vs_msp_pct;
  const verdictText = c.verdict === 'unknown' ? pt('vUnknown')
    : pt({ good: 'vGood', fair: 'vFair', low: 'vLow' }[c.verdict], { p: Math.abs(pct ?? 0), ref: refName });
  const cell = (label, val, sub) => `<div class="px-ref"><small>${esc(label)}</small><b>${val ? money(val) : '—'}</b><small>${esc(sub)}</small></div>`;
  return `
    <div class="px-check ${c.suspicious ? 'sus' : c.verdict}">
      <div class="px-check-head">${esc(pt('rcTitle'))}</div>
      <div class="px-refs">
        ${cell(pt('msp'), r.msp, r.msp ? r.msp_season : pt('noMsp'))}
        ${cell(pt('mandi'), r.mandi, r.mandi ? (r.mandi_date ? pt('asOf', { d: fmtDate(r.mandi_date) }) : '') : pt('noMandi'))}
        ${cell(pt('offer'), o.price, '')}
      </div>
      <div class="px-verdict">${esc(verdictText)}</div>
      ${c.below_msp ? `<div class="px-flag">⚠ ${esc(pt('belowMsp'))}</div>` : ''}
      ${c.suspicious ? `<div class="px-flag">⚠ ${esc(pt('suspicious'))}</div>` : ''}
    </div>`;
}

function offerCard(o) {
  const validText = o.days_left <= 0 ? pt('today', { d: fmtDate(o.valid_until) }) : pt('validTill', { d: fmtDate(o.valid_until), n: o.days_left });
  const dist = o.distance_km === null ? '' : (o.distance_km === 0 ? '' : ` · ${pt('away', { n: o.distance_km })}`);
  return `
    <article class="panel px-card ${o.best && filters.crop ? 'best' : ''}" data-offer="${o.id}">
      <div class="px-top">
        <div class="px-crop">${esc(o.emoji)} <b>${esc(o.crop_name)}</b></div>
        <div class="px-badges">
          ${o.best ? `<span class="badge strong">★ ${esc(pt('best'))}</span>` : ''}
          <span class="badge ${o.buyer.verified ? 'done' : 'skip'}">${o.buyer.verified ? '✔ ' + esc(pt('verified')) : esc(pt('notVerified'))}</span>
        </div>
      </div>
      <div class="px-price">${money(o.price)} <small>${esc(pt('perQtl'))}</small></div>
      ${referenceBlock(o)}
      <ul class="px-meta">
        <li>📦 ${esc(pt('qty'))}: <b>${Number(o.quantity).toLocaleString(locale())} ${esc(pt('qtl'))}</b></li>
        <li>📍 ${esc(o.district)}${esc(dist)}</li>
        <li>🚚 ${esc(o.pickup === 'farm_gate' ? pt('farmGate') : pt('buyerLoc'))}</li>
        <li>⏳ ${esc(validText)}</li>
        <li>🏢 ${esc(o.buyer.business || o.buyer.name)}</li>
        ${o.note ? `<li>📝 ${esc(o.note)}</li>` : ''}
      </ul>
      <div class="px-actions">
        <a class="btn btn-primary btn-sm" href="tel:+91${esc(o.buyer.phone)}">📞 ${esc(pt('call'))}</a>
        <button class="btn btn-ghost" type="button" data-report="${o.id}">⚑ ${esc(pt('report'))}</button>
      </div>
      <div class="px-report" id="rep-${o.id}" hidden>
        <select aria-label="${esc(pt('report'))}">
          <option value="fake_price">${esc(pt('rFake'))}</option>
          <option value="unreachable">${esc(pt('rUnreach'))}</option>
          <option value="asked_advance">${esc(pt('rAdvance'))}</option>
          <option value="other">${esc(pt('rOther'))}</option>
        </select>
        <button class="btn btn-secondary btn-sm" type="button" data-send-report="${o.id}">${esc(pt('send'))}</button>
      </div>
    </article>`;
}

async function onListClick(e) {
  const rb = e.target.closest('[data-report]');
  if (rb) { const box = $(`rep-${rb.dataset.report}`); box.hidden = !box.hidden; return; }
  const sb = e.target.closest('[data-send-report]');
  if (!sb) return;
  const id = sb.dataset.sendReport;
  const reason = $(`rep-${id}`).querySelector('select').value;
  try {
    await apiRequest(`/offers/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
    toast(pt('reported'));
    $(`rep-${id}`).hidden = true;
  } catch (err) { toast(err.message); }
}

// ============================================================ buyer portal

async function renderBuyer() {
  const token = store.get(BUYER_KEY);
  if (!token) return renderBuyerAuth();
  let data;
  try { data = await apiRequest('/buyer/offers', { headers: buyerHeaders() }); } catch (err) {
    store.set(BUYER_KEY, '');
    return renderBuyerAuth(err.message);
  }
  const b = data.buyer;
  const crops = state.crops.filter((c) => c.id !== 'sugarcane');
  const e = editing && data.offers.find((o) => o.id === editing);
  const v = e || { crop_id: crops[0]?.id, price: '', quantity: '', district: b.district, pickup: 'farm_gate', note: '', valid_until: addDays(14) };
  $('pxBody').innerHTML = `
    <div class="grid grid-2 px-buyer">
      <section class="panel">
        <div class="px-whoami"><b>${esc(b.business || b.name)}</b><button class="btn btn-ghost" id="bLogout" type="button">${esc(pt('bLogout'))}</button></div>
        <div class="px-status ${b.verified ? 'ok' : 'wait'}">${b.verified ? '✔ ' + esc(pt('bVerifiedMsg')) : '⏳ ' + esc(pt('bPending'))}</div>
        <h3>${esc(e ? pt('oEdit') : pt('oNew'))}</h3>
        <form id="offerForm" novalidate>
          ${selectHtml('oCrop', pt('fCrop'), crops.map((c) => [c.id, `${c.emoji} ${c.name}`]), v.crop_id)}
          <div class="px-hint" id="oRef"></div>
          <div class="field"><label for="oPrice">${esc(pt('oPrice'))}</label><input id="oPrice" type="number" inputmode="decimal" min="1" value="${esc(v.price)}" /></div>
          <div class="field"><label for="oQty">${esc(pt('oQty'))}</label><input id="oQty" type="number" inputmode="decimal" min="1" value="${esc(v.quantity)}" /></div>
          ${selectHtml('oDist', pt('oDistrict'), districts.map((d) => [d, d]), v.district)}
          ${selectHtml('oPickup', pt('oPickup'), [['farm_gate', pt('farmGate')], ['buyer_location', pt('buyerLoc')]], v.pickup)}
          <div class="field"><label for="oValid">${esc(pt('oValid'))}</label><input id="oValid" type="date" min="${addDays(0)}" max="${addDays(90)}" value="${esc(v.valid_until)}" /></div>
          <div class="field"><label for="oNote">${esc(pt('oNote'))}</label><input id="oNote" maxlength="200" value="${esc(v.note)}" /></div>
          <div class="px-err" id="oErr" role="alert"></div>
          <button class="btn btn-primary full" type="submit">${esc(e ? pt('oUpdate') : pt('oSave'))}</button>
          ${e ? `<button class="btn btn-secondary full" id="oCancel" type="button" style="margin-top:8px">${esc(pt('oCancel'))}</button>` : ''}
        </form>
      </section>
      <section class="panel">
        <h3>${esc(pt('oMine'))}</h3>
        <div class="px-mine">${data.offers.length ? data.offers.map((o) => myOfferRow(o, b)).join('') : `<p class="muted-note">${esc(pt('oNone'))}</p>`}</div>
      </section>
    </div>`;

  const refresh = async () => {
    const id = $('oCrop').value;
    try {
      const r = await apiRequest(`/reference/${id}`);
      $('oRef').textContent = pt('oHint', { msp: r.msp ? money(r.msp) : '—', mandi: r.mandi ? money(r.mandi) : '—' });
    } catch { $('oRef').textContent = ''; }
  };
  $('oCrop').addEventListener('change', refresh);
  refresh();
  $('bLogout').addEventListener('click', () => { store.set(BUYER_KEY, ''); editing = null; renderBuyer(); });
  $('oCancel')?.addEventListener('click', () => { editing = null; renderBuyer(); });
  $('offerForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('oErr').textContent = '';
    const body = {
      crop_id: $('oCrop').value, price: Number($('oPrice').value), quantity: Number($('oQty').value),
      district: $('oDist').value, pickup: $('oPickup').value, note: $('oNote').value, valid_until: $('oValid').value,
    };
    try {
      await apiRequest(e ? `/buyer/offers/${e.id}` : '/buyer/offers',
        { method: e ? 'PUT' : 'POST', headers: buyerHeaders(), body: JSON.stringify(body) });
      toast(pt('oSaved'));
      editing = null;
      renderBuyer();
    } catch (err) { $('oErr').textContent = err.message.replace(/^Value error, /, ''); }
  });
  document.querySelector('.px-mine')?.addEventListener('click', async (ev) => {
    const ed = ev.target.closest('[data-edit]'), wd = ev.target.closest('[data-withdraw]');
    if (ed) { editing = Number(ed.dataset.edit); renderBuyer(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (wd) {
      try { await apiRequest(`/buyer/offers/${wd.dataset.withdraw}`, { method: 'DELETE', headers: buyerHeaders() }); toast(pt('oWithdrawn')); renderBuyer(); }
      catch (err) { toast(err.message); }
    }
  });
}

function myOfferRow(o, b) {
  const st = o.status === 'expired' ? pt('stExpired') : o.status === 'under_review' ? pt('stReview')
    : o.status === 'removed' ? pt('stRemoved') : (!b.verified ? pt('stNotShown') : pt('stActive'));
  const cls = o.status === 'active' && b.verified ? 'ok' : 'wait';
  const canEdit = o.status === 'active' || o.status === 'expired';
  return `<div class="px-mine-row">
    <div><b>${esc(o.emoji)} ${esc(o.crop_name)}</b> · ${money(o.price)} ${esc(pt('perQtl'))}
      <div class="px-sub">${Number(o.quantity).toLocaleString(locale())} ${esc(pt('qtl'))} · ${esc(o.district)} · ${esc(fmtDate(o.valid_until))}</div>
      <div class="px-st ${cls}">${esc(st)}</div></div>
    <div class="px-row-actions">${canEdit ? `<button class="btn btn-ghost" data-edit="${o.id}" type="button">${esc(pt('oEditBtn'))}</button>` : ''}
      <button class="btn btn-ghost" data-withdraw="${o.id}" type="button">${esc(pt('oWithdraw'))}</button></div>
  </div>`;
}

function addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderBuyerAuth(message = '') {
  const reg = authMode === 'register';
  $('pxBody').innerHTML = `
    <section class="panel px-auth">
      <h3>${esc(reg ? pt('bRegTitle') : pt('bLoginTitle'))}</h3>
      <form id="authForm" novalidate>
        ${reg ? `<div class="field"><label for="aName">${esc(pt('bName'))}</label><input id="aName" autocomplete="name" /></div>
                 <div class="field"><label for="aBiz">${esc(pt('bBusiness'))}</label><input id="aBiz" /></div>` : ''}
        <div class="field"><label for="aPhone">${esc(pt('bPhone'))}</label><input id="aPhone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" /></div>
        ${reg ? selectHtml('aDist', pt('oDistrict'), districts.map((d) => [d, d]), districts[0]) : ''}
        <div class="field"><label for="aPass">${esc(pt('bPassword'))}</label><input id="aPass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" /></div>
        <div class="px-err" id="aErr" role="alert">${esc(message)}</div>
        <button class="btn btn-primary full" type="submit">${esc(reg ? pt('bRegister') : pt('bLogin'))}</button>
      </form>
      <button class="btn btn-ghost px-switch" id="aSwitch" type="button">${esc(reg ? pt('bHaveAcc') : pt('bNeedReg'))}</button>
      ${reg ? '' : `<p class="muted-note">${esc(pt('bDemo'))}</p>`}
    </section>`;
  $('aSwitch').addEventListener('click', () => { authMode = reg ? 'login' : 'register'; renderBuyerAuth(); });
  $('authForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('aErr').textContent = '';
    const body = { phone: $('aPhone').value, password: $('aPass').value };
    if (reg) Object.assign(body, { name: $('aName').value, business: $('aBiz').value, district: $('aDist').value });
    try {
      const res = await apiRequest(reg ? '/buyers/register' : '/buyers/login', { method: 'POST', body: JSON.stringify(body) });
      store.set(BUYER_KEY, res.token);
      renderBuyer();
    } catch (err) { $('aErr').textContent = err.message.replace(/^Value error, /, ''); }
  });
}

// ============================================================ admin

async function renderAdmin(message = '') {
  const key = adminKey.get();
  if (!key) {
    $('pxBody').innerHTML = `
      <section class="panel px-auth">
        <h3>${esc(pt('tabAdmin'))}</h3>
        <form id="adminForm"><div class="field"><label for="adminKey">${esc(pt('aKey'))}</label><input id="adminKey" type="password" autocomplete="off" /></div>
        <div class="px-err" role="alert">${esc(message)}</div>
        <button class="btn btn-primary full" type="submit">${esc(pt('aOpen'))}</button></form>
      </section>`;
    $('adminForm').addEventListener('submit', (ev) => { ev.preventDefault(); adminKey.set($('adminKey').value.trim()); renderAdmin(); });
    return;
  }
  const headers = { 'X-Admin-Key': key };
  let buyers, reports;
  try {
    [buyers, reports] = await Promise.all([apiRequest('/admin/buyers', { headers }), apiRequest('/admin/reports', { headers })]);
  } catch (err) { adminKey.set(''); return renderAdmin(err.message); }

  $('pxBody').innerHTML = `
    <div class="grid grid-2">
      <section class="panel"><h3>${esc(pt('aBuyers'))}</h3>
        ${buyers.buyers.map((b) => `<div class="px-mine-row"><div><b>${esc(b.business || b.name)}</b>
          <div class="px-sub">${esc(b.name)} · ${esc(b.phone)} · ${esc(b.district)} · ${b.offers} offers</div>
          <div class="px-st ${b.verified ? 'ok' : 'wait'}">${b.verified ? '✔ ' + esc(pt('verified')) : esc(pt('notVerified'))}</div></div>
          <div class="px-row-actions"><button class="btn ${b.verified ? 'btn-ghost' : 'btn-primary btn-sm'}" data-verify="${b.id}" data-to="${b.verified ? 0 : 1}" type="button">${esc(b.verified ? pt('aRevoke') : pt('aApprove'))}</button></div></div>`).join('')}
      </section>
      <section class="panel"><h3>${esc(pt('aReports'))}</h3>
        ${reports.offers.length ? reports.offers.map((o) => `<div class="px-mine-row"><div><b>${esc(o.emoji)} ${esc(o.crop_name)}</b> · ${money(o.price)}
          <div class="px-sub">${esc(o.buyer.business || o.buyer.name)} · ${esc(pt('aReportsN', { n: o.reports }))} · ${esc(o.status)}</div></div>
          <div class="px-row-actions"><button class="btn btn-primary btn-sm" data-resolve="${o.id}" data-action="remove" type="button">${esc(pt('aRemove'))}</button>
          <button class="btn btn-ghost" data-resolve="${o.id}" data-action="dismiss" type="button">${esc(pt('aDismiss'))}</button></div></div>`).join('')
          : `<p class="muted-note">${esc(pt('aNoReports'))}</p>`}
      </section>
    </div>`;
  $('pxBody').onclick = async (ev) => {
    const v = ev.target.closest('[data-verify]'), r = ev.target.closest('[data-resolve]');
    try {
      if (v) await apiRequest(`/admin/buyers/${v.dataset.verify}/verify`, { method: 'POST', headers, body: JSON.stringify({ verified: v.dataset.to === '1' }) });
      if (r) await apiRequest(`/admin/offers/${r.dataset.resolve}/resolve`, { method: 'POST', headers, body: JSON.stringify({ action: r.dataset.action }) });
      if (v || r) renderAdmin();
    } catch (err) { toast(err.message); }
  };
}
