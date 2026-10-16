// Government schemes: interactive eligibility navigator + browse list.
import { apiRequest } from '../api.js';
import { $, esc, t } from '../main.js';

const strengthLabel = { strong: 'strongMatch', check: 'worthCheck', done: 'browse', skip: 'browse' };

export async function renderSchemes() {
  $('view-schemes').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('schEyebrow'))}</div>
      <h1>${esc(t('schTitle'))}</h1>
      <p>${esc(t('schDesc'))}</p>
    </div>
    <div class="grid grid-2">
      <section class="panel">
        <h3>🧭 ${esc(t('eligTitle'))}</h3>
        <div class="field"><label for="landBucket">${esc(t('landBucket'))}</label>
          <select id="landBucket">
            <option value="marginal">${esc(t('marginal'))}</option>
            <option value="small" selected>${esc(t('small'))}</option>
            <option value="medium">${esc(t('medium'))}</option>
            <option value="large">${esc(t('large'))}</option>
          </select></div>
        <div class="toggle-grid">
          <label class="toggle">${esc(t('ownsLand'))}<input id="ownsLand" type="checkbox" checked /></label>
          <label class="toggle">${esc(t('hasSoilCard'))}<input id="hasSoilCard" type="checkbox" /></label>
          <label class="toggle">${esc(t('wantsInsurance'))}<input id="wantsInsurance" type="checkbox" checked /></label>
          <label class="toggle">${esc(t('wantsCredit'))}<input id="wantsCredit" type="checkbox" checked /></label>
          <label class="toggle">${esc(t('hasIrrigation'))}<input id="hasIrrigation" type="checkbox" /></label>
          <label class="toggle">${esc(t('sellsMandi'))}<input id="sellsMandi" type="checkbox" checked /></label>
        </div>
        <div class="field" style="margin-top:10px"><label for="gender">${esc(t('gender'))}</label>
          <select id="gender">
            <option value="male">${esc(t('male'))}</option>
            <option value="female">${esc(t('female'))}</option>
            <option value="other">${esc(t('other'))}</option>
          </select></div>
        <button class="btn btn-primary full" id="eligRun" type="button">${esc(t('eligRun'))}</button>
        <div id="eligResults" style="margin-top:14px"></div>
      </section>
      <section class="panel">
        <h3>📚 ${esc(t('browse'))}</h3>
        <p class="panel-sub">Official programme starting points, always verify on the portal.</p>
        <div id="schemeBrowse" style="display:flex;flex-direction:column;gap:9px"></div>
      </section>
    </div>`;

  $('eligRun').addEventListener('click', runEligibility);
  loadBrowse();
  await runEligibility();
}

async function runEligibility() {
  const target = $('eligResults');
  const answers = {
    land_bucket: $('landBucket').value,
    owns_land: $('ownsLand').checked,
    has_soil_card: $('hasSoilCard').checked,
    wants_insurance: $('wantsInsurance').checked,
    wants_credit: $('wantsCredit').checked,
    has_irrigation: $('hasIrrigation').checked,
    sells_in_mandi: $('sellsMandi').checked,
    gender: $('gender').value,
  };
  target.innerHTML = '<div class="empty-state">Matching…</div>';
  try {
    const d = await apiRequest('/schemes/eligibility', { method: 'POST', body: JSON.stringify(answers) });
    target.innerHTML = `
      <div class="grid" style="gap:9px">
        ${d.matches.map((m) => `
          <div class="sch-card">
            <div class="sch-head"><b>${esc(m.name)}</b>
              <span class="badge ${m.strength}">${esc(t(strengthLabel[m.strength] || m.strength))}</span></div>
            <div class="sch-why">${esc(m.why)}</div>
            <div class="sch-docs"><b>${esc(t('docsNeeded'))}:</b> ${m.docs.map(esc).join(' · ')}</div>
            <a href="${m.url}" target="_blank" rel="noopener noreferrer">Official programme ↗</a>
          </div>`).join('')}
      </div>
      <p class="muted-note">${esc(d.note)}</p>`;
  } catch (err) {
    target.innerHTML = `<div class="empty-state"><b>Couldn't match schemes</b>${esc(err.message)}</div>`;
  }
}

async function loadBrowse() {
  const target = $('schemeBrowse');
  try {
    const list = await apiRequest('/schemes');
    target.innerHTML = list.map((s) => `
      <div class="sch-card">
        <div class="sch-head"><b>${esc(s.name)}</b></div>
        <div class="sch-why">${esc(s.summary)}</div>
        <a href="${s.url}" target="_blank" rel="noopener noreferrer">Official details ↗</a>
      </div>`).join('');
  } catch (err) {
    target.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}
