// Farm signals: weather-aware field advisory + official mandi feed.
import { apiRequest } from '../api.js';
import { $, esc, t, state } from '../main.js';

// "Region not specified" is only a placeholder the planner sends to the API; never use it as a place name.
const realDistrict = (d) => (d && d.trim() && d !== 'Region not specified' ? d.trim() : '');

export async function renderSignals() {
  const p = { ...state.profile, district: realDistrict(state.profile.district) };
  $('view-signals').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('sigEyebrow'))}</div>
      <h1>${esc(t('sigTitle'))}</h1>
      <p>${esc(t('sigDesc'))}</p>
    </div>
    <div class="grid grid-2">
      <section class="panel" style="grid-column:1/-1">
        <h3>🌦️ ${esc(t('advisoryTitle'))}</h3>
        <div class="two-col">
          <div class="field"><label for="advDistrict">${esc(t('district'))}</label>
            <input id="advDistrict" placeholder="e.g., Nashik" value="${esc(p.district || 'Nashik')}" /></div>
          <div class="field"><label for="advCrop">${esc(t('commodity'))} (optional)</label>
            <select id="advCrop"><option value="">— general —</option>${state.crops.map((c) =>
              `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
        </div>
        <button class="btn btn-primary" id="loadAdvisory" type="button">${esc(t('loadAdvisory'))}</button>
        <div id="advisoryResults" style="margin-top:14px"></div>
      </section>
      <section class="panel">
        <h3>📈 ${esc(t('mandiTitle'))}</h3>
        <p class="panel-sub">data.gov.in Agmarknet feed — set DATA_GOV_IN_API_KEY on the backend to enable. No prices are invented when the key is missing.</p>
        <div class="two-col">
          <div class="field"><label for="mandiCommodity">${esc(t('commodity'))}</label>
            <select id="mandiCommodity">${state.crops.map((c) =>
              `<option value="${esc(c.name)}">${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="mandiState">${esc(t('state'))}</label>
            <input id="mandiState" placeholder="e.g., Maharashtra" value="${esc(p.district.split(',').pop()?.trim() || 'Maharashtra')}" /></div>
        </div>
        <button class="btn btn-ghost" id="loadMandi" type="button">${esc(t('mandiLoad'))}</button>
        <div id="mandiResults" style="margin-top:12px"></div>
      </section>
      <section class="panel">
        <h3>✅ Verify before you act</h3>
        <p class="panel-sub">Official sources this app points to — the app itself does not replace them.</p>
        <ul class="reason-list" style="font-size:12px">
          <li><a href="https://soilhealth.dac.gov.in" target="_blank" rel="noopener noreferrer">Soil Health Card portal</a></li>
          <li><a href="https://mausam.imd.gov.in/responsive/agromet_adv_ser_district_current_lo.php" target="_blank" rel="noopener noreferrer">IMD district agromet advisories</a></li>
          <li><a href="https://icar.gov.in/en/kharif-agro-advisory-farmers" target="_blank" rel="noopener noreferrer">ICAR farmer advisories</a></li>
          <li><a href="https://www.enam.gov.in/web/dashboard/agmarknet" target="_blank" rel="noopener noreferrer">AGMARKNET / e-NAM dashboard</a></li>
        </ul>
      </section>
    </div>`;

  $('loadAdvisory').addEventListener('click', loadAdvisory);
  $('loadMandi').addEventListener('click', loadMandi);
  await loadAdvisory();
}

async function loadAdvisory() {
  const target = $('advisoryResults');
  const district = $('advDistrict').value.trim() || 'Nashik';
  const cropId = $('advCrop').value;
  target.innerHTML = '<div class="empty-state">Loading live forecast…</div>';
  try {
    const d = await apiRequest(`/advisory?district=${encodeURIComponent(district)}${cropId ? `&crop_id=${cropId}` : ''}`);
    if (d.status !== 'live') {
      target.innerHTML = `<div class="empty-state"><b>Weather unavailable</b>${esc(d.message || '')}<br>${esc(d.fallback || '')}</div>`;
      return;
    }
    const day = d.daily;
    target.innerHTML = `
      <p class="panel-sub" style="margin:0">📍 <b>${esc(d.matched_location || d.district)}${d.admin1 ? ', ' + esc(d.admin1) : ''}</b> · source ${esc(d.source)}${d.crop ? ` · crop: ${d.crop.emoji} ${esc(d.crop.name)}` : ''}</p>
      <div class="weather-strip">
        ${day.time.map((date, i) => `<div class="wday"><b>${new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}</b>${date.slice(5)}
          <span class="r">${day.precipitation_probability_max[i]}%</span>
          ${day.temperature_2m_min[i]}–${day.temperature_2m_max[i]}°C</div>`).join('')}
      </div>
      <div style="margin-top:12px">
        <h3 style="font-size:13px">${esc(t('advisoryTitle'))}</h3>
        ${d.flags.length ? d.flags.map(flagCard).join('') :
          '<div class="flag info"><span class="ico">🌤️</span><div><b>No weather alerts for the next 7 days</b>Conditions look steady. Continue the plan; check the IMD bulletin before critical operations.</div></div>'}
      </div>
      <p class="muted-note">${esc(d.verify_note)}</p>`;
  } catch (err) {
    target.innerHTML = `<div class="empty-state"><b>Couldn't load advisory</b>${esc(err.message)}</div>`;
  }
}

function flagCard(f) {
  const cls = f.level === 'alert' ? 'alert' : f.level === 'watch' ? 'watch' : 'info';
  return `<div class="flag ${cls}"><span class="ico">${f.icon}</span><div><b>${esc(f.title)}</b>${esc(f.detail)}</div></div>`;
}

async function loadMandi() {
  const target = $('mandiResults');
  const commodity = $('mandiCommodity').value;
  const stateName = $('mandiState').value.trim() || 'Maharashtra';
  target.innerHTML = '<div class="empty-state">Querying official feed…</div>';
  try {
    const d = await apiRequest(`/mandi/prices?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(stateName)}`);
    if (d.status === 'live' && d.records?.length) {
      target.innerHTML = `<div style="max-height:280px;overflow:auto">
        ${d.records.slice(0, 20).map((r) => `<div class="plan-row" style="grid-template-columns:1.2fr 1fr 1fr">
          <span><b>${esc(r.market || r.market_name || 'Market')}</b><small>${esc(r.district || '')} · ${esc(r.arrival_date || '')}</small></span>
          <span>${esc(r.commodity)}<small>${esc(r.variety || '')}</small></span>
          <span><b>₹${esc(r.modal_price)}</b><small>min ₹${esc(r.min_price)} · max ₹${esc(r.max_price)}</small></span>
        </div>`).join('')}</div>
        <p class="muted-note">Source: data.gov.in Agmarknet. Confirm grade, variety and date on the official portal before selling.</p>`;
    } else {
      target.innerHTML = `<div class="empty-state"><b>Official feed unavailable</b>${esc(d.message || 'No records returned for this commodity/state.')}</div>`;
    }
  } catch (err) {
    target.innerHTML = `<div class="empty-state"><b>Couldn't load mandi prices</b>${esc(err.message)}</div>`;
  }
}
