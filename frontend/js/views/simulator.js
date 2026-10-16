// Profit simulator: three what-if scenarios from user estimates.
import { apiRequest } from '../api.js';
import { $, esc, money, t, state } from '../main.js';

export async function renderSimulator() {
  const p = state.profile;
  $('view-simulator').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('simEyebrow'))}</div>
      <h1>${esc(t('simTitle'))}</h1>
      <p>${esc(t('simDesc'))}</p>
    </div>
    <section class="panel">
      <h3>⌁ What-if scenarios</h3>
      <p class="panel-sub">Illustrative calculations from the inputs below — not a profit forecast.</p>
      <div class="row" style="align-items:end">
        <div class="field" style="min-width:220px"><label for="simCrop">${esc(t('commodity'))}</label>
          <select id="simCrop">${state.crops.map((c) =>
            `<option value="${c.id}" ${c.id === state.lastPlantedCrop ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field" style="width:130px"><label for="simArea">${esc(t('area'))}</label>
          <input id="simArea" type="number" min="0.1" step="0.1" value="${p.area}" /></div>
        <div class="field" style="width:190px"><label for="simYield">${esc(t('yieldLabel'))}</label>
          <input id="simYield" type="number" min="0.1" step="0.1" value="8" /></div>
        <div class="field" style="width:190px"><label for="simPrice">${esc(t('priceLabel'))}</label>
          <input id="simPrice" type="number" min="1" step="50" value="4500" /></div>
        <button class="btn btn-primary" id="runSim" type="button">${esc(t('runSim'))}</button>
      </div>
      <div class="grid grid-3" id="scenarioResults" style="margin-top:14px">
        <div class="empty-state" style="grid-column:1/-1">${esc(t('simEmpty'))}</div>
      </div>
    </section>`;

  $('runSim').addEventListener('click', run);
  await run();
}

async function run() {
  const target = $('scenarioResults');
  const payload = {
    crop_id: $('simCrop').value,
    area: Number($('simArea').value),
    yield_quintals_per_acre: Number($('simYield').value),
    price_per_quintal: Number($('simPrice').value),
  };
  if (!(payload.area > 0) || !(payload.yield_quintals_per_acre > 0) || !(payload.price_per_quintal > 0)) {
    target.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Enter positive numbers for area, yield and price.</div>';
    return;
  }
  target.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Calculating…</div>';
  try {
    const d = await apiRequest('/simulator', { method: 'POST', body: JSON.stringify(payload) });
    target.innerHTML = d.scenarios.map((s) => `
      <div class="scenario ${s.scenario === 'Worst' ? 'worst' : ''}">
        <b>${esc(s.scenario)} case</b>
        <strong>${money(s.profit)}</strong>
        <small>Revenue ${money(s.revenue)} · Cost ${money(s.cost)}</small>
      </div>`).join('') + `<p class="muted-note" style="grid-column:1/-1">${esc(d.note)}</p>`;
  } catch (err) {
    target.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><b>Couldn't calculate</b>${esc(err.message)}</div>`;
  }
}
