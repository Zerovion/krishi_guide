// Crop journey calendar (week-by-week, dated, checkable) + water budget planner.
import { apiRequest } from '../api.js';
import { seasonName } from '../i18n.js';
import { $, esc, readProfileForm, saveProfile, t, state, hydrate } from '../main.js';

const progressKey = (cropId, sowingDate) => `krishi_progress_${cropId}_${sowingDate}`;

export async function renderCalendar() {
  const p = state.profile;
  const today = new Date().toISOString().slice(0, 10);
  $('view-calendar').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('calEyebrow'))}</div>
      <h1>${esc(t('calTitle'))}</h1>
      <p>${esc(t('calDesc'))}</p>
    </div>
    <div class="grid grid-form">
      <aside class="panel">
        <h3>${esc(t('calTitle'))}</h3>
        <div class="field"><label for="calCrop">${esc(t('commodity'))}</label>
          <select id="calCrop">${state.crops.map((c) =>
            `<option value="${c.id}" ${c.id === state.lastPlantedCrop ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="sowingDate">${esc(t('sowingDate'))}</label>
          <input id="sowingDate" type="date" value="${today}" /></div>
        <div class="field"><label for="calArea">${esc(t('area'))}</label>
          <input id="calArea" type="number" min="0.1" step="0.1" value="${p.area}" /></div>
        <button class="btn btn-primary full" id="genTimeline" type="button">${esc(t('genTimeline'))}</button>
      </aside>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="panel" id="timelinePanel"><div class="empty-state">Pick a crop and sowing date, then generate the journey.</div></div>
        <div class="panel">
          <h3>💧 ${esc(t('waterTitle'))}</h3><p class="panel-sub">${esc(t('waterSub'))}</p>
          <div class="two-col">
            <div class="field"><label for="waterCrop">${esc(t('commodity'))}</label>
              <select id="waterCrop">${state.crops.map((c) =>
                `<option value="${c.id}" ${c.id === state.lastPlantedCrop ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}
              </select></div>
            <div class="field"><label for="waterSeason">${esc(t('season'))}</label>
              <select id="waterSeason" data-opt-group="season">
                <option value="kharif"></option><option value="rabi"></option><option value="summer"></option>
              </select></div>
          </div>
          <div class="field"><label for="waterArea">${esc(t('area'))}</label>
            <input id="waterArea" type="number" min="0.1" step="0.1" value="${p.area}" /></div>
          <button class="btn btn-ghost" id="runWater" type="button">💧 ${esc(t('waterTitle'))}</button>
          <div id="waterResults" style="margin-top:12px"></div>
        </div>
      </div>
    </div>`;

  hydrate();
  $('waterSeason').value = state.profile.season;
  $('genTimeline').addEventListener('click', () => loadTimeline());
  $('calCrop').addEventListener('change', () => { state.profile.lastCrop = $('calCrop').value; saveProfile(); });
  $('runWater').addEventListener('click', () => loadWater());
  await loadTimeline();
}

async function loadTimeline() {
  const panel = $('timelinePanel');
  const cropId = $('calCrop').value;
  const sowing = $('sowingDate').value || new Date().toISOString().slice(0, 10);
  const area = Math.max(0.1, Number($('calArea').value) || 1);
  state.profile.lastCrop = cropId;
  saveProfile();
  panel.innerHTML = '<div class="empty-state">Building the journey…</div>';
  try {
    const data = await apiRequest(`/crops/${cropId}/timeline?sowing_date=${sowing}&area=${area}`);
    const done = JSON.parse(localStorage.getItem(progressKey(cropId, sowing)) || '[]');
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:start">
        <div>
          <h3>${data.crop.emoji} ${esc(data.crop.name)} — journey from ${esc(data.sowing_date)}</h3>
          <p class="panel-sub" style="margin:0">${esc(data.note)}</p>
        </div>
        <button class="btn btn-ghost no-print" onclick="window.print()">🖨 Print</button>
      </div>
      <div class="progress-wrap no-print">
        <div class="progress-line"><span>${esc(t('progress'))}</span><span id="progressPct">0%</span></div>
        <div class="bar"><span id="progressBar" style="width:0%"></span></div>
      </div>
      <div class="timeline" style="margin-top:14px">
        ${data.stages.map((s, si) => `
          <div class="tl-item">
            <div class="tl-when"><b>${esc(s.stage)}</b>Week ${s.week_start}–${s.week_end}</div>
            <div class="tl-rail"><span class="tl-dot"></span></div>
            <div class="tl-body">
              <h4>${esc(s.stage)}</h4>
              <div class="tl-dates">📅 ${esc(s.start_date)} → ${esc(s.end_date)}</div>
              ${s.tasks.map((task, ti) => {
                const key = `${si}-${ti}`;
                const isDone = done.includes(key);
                return `<div class="task ${isDone ? 'done' : ''}">
                  <input type="checkbox" data-task="${key}" ${isDone ? 'checked' : ''} id="task_${key}" />
                  <label for="task_${key}">${esc(task)}</label>
                </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>
      <p class="muted-note">Expected harvest window: <b>${esc(data.expected_harvest_window.start)}</b> to <b>${esc(data.expected_harvest_window.end)}</b>
       (${esc(data.crop.duration)} after sowing).</p>`;
    const boxes = panel.querySelectorAll('[data-task]');
    const updateProgress = () => {
      const checked = [...boxes].filter((b) => b.checked).map((b) => b.dataset.task);
      localStorage.setItem(progressKey(cropId, sowing), JSON.stringify(checked));
      const pct = boxes.length ? Math.round((checked.length / boxes.length) * 100) : 0;
      $('progressPct').textContent = `${pct}%`;
      $('progressBar').style.width = `${pct}%`;
    };
    boxes.forEach((b) => {
      b.addEventListener('change', () => {
        b.closest('.task').classList.toggle('done', b.checked);
        updateProgress();
      });
    });
    updateProgress();
  } catch (err) {
    panel.innerHTML = `<div class="empty-state"><b>Couldn't build timeline</b>${esc(err.message)}</div>`;
  }
}

async function loadWater() {
  const target = $('waterResults');
  const cropId = $('waterCrop').value;
  const season = $('waterSeason').value;
  const area = Math.max(0.1, Number($('waterArea').value) || 1);
  target.innerHTML = '<div class="empty-state">Calculating…</div>';
  try {
    const d = await apiRequest(`/water-plan?crop_id=${cropId}&area=${area}&season=${season}`);
    const fmt = (l) => (l >= 100000 ? `${(l / 100000).toFixed(1)} lakh L` : `${Math.round(l).toLocaleString('en-IN')} L`);
    target.innerHTML = `
      <div class="water-figure">
        <div class="water-box"><span>${esc(t('waterGross'))}</span><strong>${fmt(d.gross_water_need_litres[0])}–${fmt(d.gross_water_need_litres[1])}</strong></div>
        <div class="water-box"><span>${esc(t('waterNet'))} (${esc(seasonName(d.season, state.lang))} · ${Math.round(d.assumed_effective_rainfall_share * 100)}% rain credit)</span>
          <strong>${fmt(d.net_irrigation_need_litres[0])}–${fmt(d.net_irrigation_need_litres[1])}</strong></div>
        <div class="water-box"><span>${esc(t('waterTanker'))}</span><strong>${d.tanker_loads_5000L[0]}–${d.tanker_loads_5000L[1]}</strong></div>
        <div class="water-box"><span>${esc(t('waterWeek'))}</span><strong>${fmt(d.per_week_irrigation_litres[0])}–${fmt(d.per_week_irrigation_litres[1])}</strong></div>
      </div>
      <div class="formula">💧 ${esc(d.crop.name)}: ${d.crop_water_need_mm[0]}–${d.crop_water_need_mm[1]} mm × ${d.area_acres} acres · ${esc(t('waterFormula'))}: ${esc(d.formula)}</div>
      <p class="muted-note">${esc(d.note)}</p>`;
  } catch (err) {
    target.innerHTML = `<div class="empty-state"><b>Couldn't compute water plan</b>${esc(err.message)}</div>`;
  }
}
