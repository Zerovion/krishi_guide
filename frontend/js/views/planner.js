// Crop planner view: farm profile form, ranked recommendations, cost planner.
import { apiRequest } from '../api.js';
import { $, esc, money, readProfileForm, saveProfile, toast, t, showCropModal, showView, hydrate, state } from '../main.js';
import { rankCrops } from '../offline.js';

let ranked = [];
let showAll = false;
const INITIAL_CROPS = 12;
const MORE_TEXT = {
  more: { en: 'Show all {n} crops', hi: 'सभी {n} फसलें दिखाएँ', mr: 'सर्व {n} पिके दाखवा' },
  less: { en: 'Show fewer crops', hi: 'कम फसलें दिखाएँ', mr: 'कमी पिके दाखवा' },
};
const moreText = (key, n) => (MORE_TEXT[key][state.lang] || MORE_TEXT[key].en).replace('{n}', n);

export async function renderPlanner() {
  const p = state.profile;
  $('view-planner').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('plannerEyebrow'))}</div>
      <h1>${esc(t('plannerTitle'))}</h1>
      <p>${esc(t('plannerDesc'))}</p>
    </div>
    <div class="metrics">
      <div class="panel metric"><div class="metric-top"><span>${esc(t('metricProfile'))}</span><span>⌂</span></div>
        <strong>${p.area} ${esc(p.area === 1 ? t('acre') : t('acres'))}</strong><small>${esc(!p.district || p.district === 'Region not specified' ? t('regionNone') : p.district)}</small></div>
      <div class="panel metric"><div class="metric-top"><span>${esc(t('metricBudget'))}</span><span>₹</span></div>
        <strong>${money(p.budget)}</strong><small>${esc(t('perSeason'))}</small></div>
      <div class="panel metric"><div class="metric-top"><span>${esc(t('metricTop'))}</span><span>✦</span></div>
        <strong id="metricTopName">—</strong><small id="metricTopScore"></small></div>
    </div>
    <div class="grid grid-form">
      <aside class="panel">
        <h3>${esc(t('farmProfile'))}</h3><p class="panel-sub">${esc(t('farmProfileSub'))}</p>
        <form id="farmForm">
          <div class="field"><label for="district">${esc(t('district'))}</label>
            <input id="district" placeholder="e.g., Sangli, Maharashtra" value="${esc(p.district)}" /></div>
          <div class="field"><label for="season">${esc(t('season'))}</label>
            <select id="season" data-opt-group="season">
              <option value="kharif"></option><option value="rabi"></option><option value="summer"></option>
            </select></div>
          <div class="field"><label for="soil">${esc(t('soil'))}</label>
            <select id="soil" data-opt-group="soil">
              <option value="black"></option><option value="loamy"></option><option value="sandy"></option>
              <option value="red"></option><option value="clayey"></option>
            </select></div>
          <div class="field"><label for="water">${esc(t('water'))}</label>
            <select id="water" data-opt-group="water">
              <option value="low"></option><option value="moderate"></option><option value="high"></option>
            </select></div>
          <div class="two-col">
            <div class="field"><label for="area">${esc(t('area'))}</label>
              <input id="area" type="number" min="0.1" step="0.1" value="${p.area}" required /></div>
            <div class="field"><label for="budget">${esc(t('budget'))}</label>
              <input id="budget" type="number" min="1000" step="500" value="${p.budget}" required /></div>
          </div>
          <div class="field"><label for="goal">${esc(t('goal'))}</label>
            <select id="goal" data-opt-group="goal">
              <option value="balanced"></option><option value="lowcost"></option>
              <option value="water"></option><option value="short"></option>
            </select></div>
          <button class="btn btn-primary full" type="submit">${esc(t('getRec'))} →</button>
        </form>
      </aside>
      <div>
        <div class="panel" style="margin-bottom:14px">
          <div class="row" style="justify-content:space-between;align-items:start">
            <div><h3>${esc(t('recTitle'))}</h3><p class="panel-sub" style="margin:0">${esc(t('recSub'))}</p></div>
            <button class="btn btn-ghost" id="savePlanBtn" type="button">${esc(t('savePlan'))}</button>
          </div>
          <div class="crop-list" id="cropList" style="margin-top:14px">
            <div class="empty-state">Loading…</div>
          </div>
        </div>
        <div class="panel">
          <h3>${esc(t('costTitle'))}</h3><p class="panel-sub">${esc(t('costSub'))}</p>
          <div class="two-col">
            <div class="field"><label for="costCrop">${esc(t('commodity'))}</label><select id="costCrop"></select></div>
            <div class="field"><label for="costArea">${esc(t('area'))}</label>
              <input id="costArea" type="number" min="0.1" step="0.1" value="${p.area}" /></div>
          </div>
          <div class="water-box" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <span>${esc(t('estimatedCost'))}<br><small>${esc(t('perSeason'))}</small></span>
            <strong id="costEstimate" style="font-size:20px">—</strong>
          </div>
          <button class="btn btn-ghost" style="margin-top:12px" onclick="window.print()">${esc(t('print'))}</button>
        </div>
      </div>
    </div>
    <div class="notice"><span style="font-size:16px">ⓘ</span>
      <div><strong>Planning support only:</strong> scores and cost bands are transparent, illustrative guidance — not live agronomy.
      Confirm crop suitability with a current soil test and your local KVK or agriculture officer before planting.</div>
    </div>`;

  $('farmForm').addEventListener('submit', (e) => { e.preventDefault(); refresh(); });
  $('costCrop').addEventListener('change', updateCost);
  $('costArea').addEventListener('input', updateCost);
  $('savePlanBtn').addEventListener('click', savePlan);
  hydrate();
  await refresh();
}

async function refresh() {
  readProfileForm();
  const list = $('cropList');
  list.innerHTML = '<div class="empty-state">Loading…</div>';
  let offline = false;
  try {
    ranked = await apiRequest('/recommendations', { method: 'POST', body: JSON.stringify(state.profile) });
  } catch (err) {
    if (!state.crops.length) {
      list.innerHTML = `<div class="empty-state"><b>API unavailable</b>${esc(err.message)} — start the backend (see README) to load recommendations.</div>`;
      $('metricTopName').textContent = '—';
      return;
    }
    ranked = rankCrops(state.crops, state.profile);   // same rules, computed on-device
    offline = true;
  }
  const top = showAll ? ranked : ranked.slice(0, INITIAL_CROPS);
  list.innerHTML = (offline ? `<div class="notice" style="grid-column:1/-1"><span>⚡</span><div><strong>${esc(t('offlineMode'))}</strong> ${esc(t('offlineModeText'))}</div></div>` : '')
    + top.map((item, i) => cropCard(item, i === 0)).join('')
    + (ranked.length > INITIAL_CROPS
      ? `<div style="grid-column:1/-1;text-align:center"><button type="button" class="btn btn-ghost" id="toggleAllCrops">${esc(showAll ? moreText('less') : moreText('more', ranked.length))}</button></div>`
      : '');
  $('metricTopName').textContent = top[0].crop.name;
  $('metricTopScore').textContent = `${top[0].score}% catalogue fit`;
  fillCostOptions(top[0].crop.id);
  const toggle = $('toggleAllCrops');
  if (toggle) toggle.addEventListener('click', () => { showAll = !showAll; refresh(); });
  list.querySelectorAll('[data-details]').forEach((b) => b.addEventListener('click', () => {
    const item = ranked.find((r) => r.crop.id === b.dataset.details);
    showCropModal(item.crop);
  }));
  list.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
    state.profile.lastCrop = b.dataset.plan;
    saveProfile();
    toast(`${state.crops.find((c) => c.id === b.dataset.plan)?.name || 'Crop'} — journey calendar opened`);
    showView('calendar');
  }));
}

function cropCard(item, isBest) {
  const c = item.crop;
  const p = state.profile;
  const cost = `${money(c.cost[0] * p.area)}–${money(c.cost[1] * p.area)}`;
  return `<article class="crop-card ${isBest ? 'best' : ''}">
    ${isBest ? `<span class="best-label">✦ ${esc(t('bestMatch'))}</span>` : ''}
    <div class="crop-emoji">${c.emoji}</div>
    <h4>${esc(c.name)}</h4><div class="crop-dur">${esc(c.duration)}</div>
    <div class="score-line"><span>${esc(t('suitability'))}</span><span>${item.score}%</span></div>
    <div class="bar"><span style="width:${item.score}%"></span></div>
    <ul class="reason-list">${item.reasons.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="chip-row" style="margin-top:10px">
      <span class="chip">💧 ${esc(c.water)}</span><span class="chip">🌱 ${esc(c.family)}</span>
      ${c.nitrogen_fixing ? '<span class="chip">✚ N-fixing</span>' : ''}
    </div>
    <div class="cost-line"><span>${esc(t('costRange'))}</span><b>${cost}</b></div>
    <div class="card-actions">
      <button class="btn btn-ghost" data-details="${c.id}">${esc(t('details'))}</button>
      <button class="btn btn-ghost" data-plan="${c.id}">${esc(t('planCrop'))}</button>
    </div>
  </article>`;
}

function fillCostOptions(selected) {
  const sel = $('costCrop');
  sel.innerHTML = state.crops.map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('');
  if (selected) sel.value = selected;
  updateCost();
}

function updateCost() {
  const c = state.crops.find((x) => x.id === $('costCrop').value) || state.crops[0];
  if (!c) return;
  const a = Math.max(0.1, Number($('costArea').value) || 1);
  $('costEstimate').textContent = `${money(c.cost[0] * a)}–${money(c.cost[1] * a)}`;
}

async function savePlan() {
  const btn = $('savePlanBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const plan = await apiRequest('/plans', { method: 'POST', body: JSON.stringify(state.profile) });
    toast(`Plan #${plan.id} saved${plan.owner ? ' to your account' : ' (shared pool — sign in on the Plans page to own it)'}`);
  } catch (err) {
    toast(`Couldn't save plan: ${err.message}`);
  } finally {
    btn.disabled = false; btn.textContent = t('savePlan');
  }
}
