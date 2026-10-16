// Rotation planner: "what should I grow next?" with transparent agronomic rules.
import { apiRequest } from '../api.js';
import { seasonName } from '../i18n.js';
import { $, esc, money, readProfileForm, saveProfile, toast, t, state, hydrate, showView, showCropModal } from '../main.js';

export async function renderRotation() {
  const p = state.profile;
  $('view-rotation').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('rotEyebrow'))}</div>
      <h1>${esc(t('rotTitle'))}</h1>
      <p>${esc(t('rotDesc'))}</p>
    </div>
    <div class="grid grid-form">
      <aside class="panel">
        <h3>${esc(t('farmProfile'))}</h3><p class="panel-sub">${esc(t('farmProfileSub'))}</p>
        <form id="farmForm">
          <div class="field"><label for="district">${esc(t('district'))}</label>
            <input id="district" placeholder="e.g., Sangli, Maharashtra" value="${esc(p.district)}" /></div>
          <div class="field"><label for="season">${esc(t('season'))} — ${esc(t('currentCrop'))} is growing now</label>
            <select id="season" data-opt-group="season">
              <option value="kharif"></option><option value="rabi"></option><option value="summer"></option>
            </select></div>
          <div class="field"><label for="currentCrop">${esc(t('currentCrop'))}</label>
            <select id="currentCrop">${state.crops.map((c) =>
              `<option value="${c.id}" ${c.id === state.lastPlantedCrop ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}
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
          <button class="btn btn-primary full" type="submit">${esc(t('rotEyebrow'))} →</button>
        </form>
      </aside>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="panel" id="rotationResults"><div class="empty-state">Choose your current crop and calculate.</div></div>
        <div class="panel" style="background:#213f2b;border-color:#213f2b;color:#e9f3df">
          <h3 style="color:#eef5e4">${esc(t('rotRules'))}</h3>
          <div class="rule-strip" style="margin-top:10px">
            <div class="rule-chip" style="background:#ffffff12;border:1px solid #ffffff20"><b>${esc(t('ruleFamily'))}</b>${esc(t('ruleFamilyText'))}</div>
            <div class="rule-chip" style="background:#ffffff12;border:1px solid #ffffff20"><b>${esc(t('ruleLegume'))}</b>${esc(t('ruleLegumeText'))}</div>
            <div class="rule-chip" style="background:#ffffff12;border:1px solid #ffffff20"><b>${esc(t('ruleRoot'))}</b>${esc(t('ruleRootText'))}</div>
            <div class="rule-chip" style="background:#ffffff12;border:1px solid #ffffff20"><b>${esc(t('ruleWater'))}</b>${esc(t('ruleWaterText'))}</div>
          </div>
        </div>
      </div>
    </div>`;

  $('farmForm').addEventListener('submit', (e) => { e.preventDefault(); refresh(); });
  hydrate();
  await refresh();
}

async function refresh() {
  readProfileForm();
  const target = $('rotationResults');
  const cropId = $('currentCrop').value;
  state.profile.lastCrop = cropId;
  saveProfile();
  target.innerHTML = '<div class="empty-state">Calculating rotation…</div>';
  try {
    const data = await apiRequest('/rotation', {
      method: 'POST',
      body: JSON.stringify({ crop_id: cropId, ...state.profile, lastCrop: undefined }),
    });
    const cur = data.current_crop;
    target.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:start">
        <div>
          <h3>${esc(cur.emoji)} ${esc(cur.name)} → ${esc(data.next_season.toUpperCase())} options</h3>
          <p class="panel-sub" style="margin:0">${esc(data.note)}</p>
        </div>
        <span class="pill">Next season: ${esc(seasonName(data.next_season, state.lang))}</span>
      </div>
      <div class="crop-list" style="margin-top:14px">
        ${data.candidates.slice(0, 6).map((item) => rotationCard(item, data.next_season)).join('')}
      </div>
      ${data.excluded.length ? `
        <div style="margin-top:14px">
          <h3 style="font-size:13px">${esc(t('excluded'))}</h3>
          ${data.excluded.map((x) => `<p style="font-size:11px;color:var(--muted);margin:6px 0">• ${x.crop.emoji} <b>${esc(x.crop.name)}</b> — ${esc(x.reason)}</p>`).join('')}
        </div>` : ''}`;
    target.querySelectorAll('[data-apply]').forEach((b) => b.addEventListener('click', () => {
      state.profile.lastCrop = b.dataset.apply;
      saveProfile();
      toast('Crop journey view opened');
      showView('calendar');
    }));
    target.querySelectorAll('[data-details]').forEach((b) => b.addEventListener('click', () => {
      const item = data.candidates.find((r) => r.crop.id === b.dataset.details);
      showCropModal(item.crop);
    }));
  } catch (err) {
    target.innerHTML = `<div class="empty-state"><b>Couldn't calculate rotation</b>${esc(err.message)}</div>`;
  }
}

function rotationCard(item, nextSeason) {
  const c = item.crop;
  const p = state.profile;
  return `<article class="crop-card ${item.score >= 75 ? 'best' : ''}">
    <div class="crop-emoji">${c.emoji}</div>
    <h4>${esc(c.name)}</h4><div class="crop-dur">${esc(seasonName(nextSeason, state.lang))} · ${esc(c.duration)}</div>
    <div class="score-line"><span>${esc(t('rotationFit'))}</span><span>${item.score}%</span></div>
    <div class="bar"><span style="width:${item.score}%"></span></div>
    <div style="margin-top:10px">
      <div class="eyebrow" style="color:#5f7a55">${esc(t('rotationReasons'))}</div>
      <ul class="reason-list">${item.rotation_reasons.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px">
      <div class="eyebrow" style="color:#8a6d3b">${esc(t('farmFit'))}</div>
      <ul class="reason-list neg">${item.fit_reasons.slice(0, 2).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>
    <div class="cost-line"><span>${esc(t('costRange'))}</span><b>${money(c.cost[0] * p.area)}–${money(c.cost[1] * p.area)}</b></div>
    <div class="card-actions">
      <button class="btn btn-ghost" data-details="${c.id}">${esc(t('details'))}</button>
      <button class="btn btn-ghost" data-apply="${c.id}">${esc(t('apply'))}</button>
    </div>
  </article>`;
}
