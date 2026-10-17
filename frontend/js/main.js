// App bootstrap: shared state, router, i18n application, toasts, modals.
import { apiRequest, checkHealth, resolveApiBase } from './api.js';
import { strings, optionLabels } from './i18n.js';
import { renderPlanner } from './views/planner.js';
import { renderRotation } from './views/rotation.js';
import { renderCalendar } from './views/calendar.js';
import { renderSignals } from './views/signals.js';
import { renderSimulator } from './views/simulator.js';
import { renderSchemes } from './views/schemes.js';
import { renderAssistant } from './views/assistant.js';
import { renderPlans } from './views/plans.js';
import { renderSoil } from './views/soil.js';
import { renderPrices } from './views/prices.js';

export const state = {
  lang: localStorage.getItem('krishi_lang') || 'en',
  crops: [],
  profile: JSON.parse(localStorage.getItem('krishi_profile') || 'null') || {
    district: '', season: 'kharif', soil: 'black', water: 'moderate',
    area: 2, budget: 30000, goal: 'balanced',
  },
  lastPlantedCrop: localStorage.getItem('krishi_last_crop') || 'soybean',
  health: null,
};

export function saveProfile() {
  localStorage.setItem('krishi_profile', JSON.stringify(state.profile));
  if (state.profile.lastCrop) {
    state.lastPlantedCrop = state.profile.lastCrop;
    localStorage.setItem('krishi_last_crop', state.profile.lastCrop);
  }
}

export function readProfileForm(formId = 'farmForm') {
  const f = document.getElementById(formId);
  if (!f) return state.profile;
  state.profile = {
    ...state.profile,
    district: f.querySelector('#district').value.trim() || state.profile.district || 'Region not specified',
    season: f.querySelector('#season').value,
    soil: f.querySelector('#soil').value,
    water: f.querySelector('#water').value,
    area: Math.max(0.1, Number(f.querySelector('#area').value) || 1),
    budget: Math.max(0, Number(f.querySelector('#budget').value) || 0),
    goal: f.querySelector('#goal').value,
  };
  saveProfile();
  return state.profile;
}

export const $ = (id) => document.getElementById(id);
export const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const t = (key) => (strings[state.lang] && strings[state.lang][key]) || strings.en[key] || key;
export const opt = (group) => optionLabels[state.lang]?.[group] || optionLabels.en[group];

export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

export function showCropModal(crop, extraHtml = '') {
  $('modalTitle').textContent = `${crop.emoji} ${crop.name}`;
  $('modalContent').innerHTML = `
    <p>${esc(crop.desc)}</p>
    <div class="chip-row" style="margin:10px 0">
      <span class="chip">💧 ${esc(crop.water)} water</span><span class="chip">◷ ${esc(crop.duration)}</span>
      <span class="chip">🌱 ${esc(crop.family)}${crop.nitrogen_fixing ? ' · nitrogen-fixing' : ''}</span>
      <span class="chip">⤓ ${esc(crop.root_depth)} roots</span>
      <span class="chip">💦 ~${crop.water_mm[0]}–${crop.water_mm[1]} mm / season</span>
    </div>
    <h4>Risks and checks</h4><p>${esc(crop.risks)}</p>
    <h4>Before you sow</h4><p>${esc(crop.tip)}</p>
    ${extraHtml}
    <p class="muted-note">Illustrative planning guidance only — confirm variety, sowing window and plant protection with your local Krishi Vigyan Kendra (KVK) or agriculture officer.</p>`;
  $('cropModal').classList.add('open');
}

export function setApiStatus(status, text) {
  const badge = document.querySelector('.live-badge');
  badge.classList.remove('ready', 'offline');
  if (status) badge.classList.add(status);
  $('healthStatus').textContent = text;
}

function applyI18n() {
  document.documentElement.lang = state.lang === 'en' ? 'en' : state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  // option groups inside every profile form on the page
  document.querySelectorAll('[data-opt-group]').forEach((sel) => {
    const labels = opt(sel.dataset.optGroup);
    Array.from(sel.options).forEach((o) => { if (labels[o.value]) o.textContent = labels[o.value]; });
  });
}

// ------------------------------------------------------------------ routing
const VIEWS = {
  planner: { render: renderPlanner, title: () => t('navPlanner') },
  soil: { render: renderSoil, title: () => t('navSoil'), subs: ['card', 'finder', 'advice', 'where', 'history'] },
  prices: { render: renderPrices, title: () => t('navPrices'), subs: ['buyer', 'admin'] },
  rotation: { render: renderRotation, title: () => t('navRotation') },
  calendar: { render: renderCalendar, title: () => t('navCalendar') },
  signals: { render: renderSignals, title: () => t('navSignals') },
  simulator: { render: renderSimulator, title: () => t('navSimulator') },
  schemes: { render: renderSchemes, title: () => t('navSchemes') },
  assistant: { render: renderAssistant, title: () => t('navAssistant') },
  plans: { render: renderPlans, title: () => t('navPlans') },
};

// The URL is the single source of truth for routing: "#/<view>" or "#/<view>/<sub>".
// Nothing here keeps module-level route state, so it stays correct even if this module
// is evaluated more than once.
export function parseHash() {
  const [name = '', sub = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, sub };
}

// sub === null keeps the sub-screen when re-rendering the same view (language change, refresh);
// sub === '' goes to the view's top screen (sidebar clicks).
export async function showView(name, sub = null) {
  if (!VIEWS[name]) name = 'planner';
  if (sub === null) sub = name === currentView() ? parseHash().sub : '';
  if (!(VIEWS[name].subs || []).includes(sub)) sub = '';
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.side-link').forEach((l) => l.classList.toggle('active', l.dataset.view === name));
  const section = $(`view-${name}`);
  if (section) { section.classList.add('active'); section.dataset.sub = sub; }
  $('currentPageName').textContent = VIEWS[name].title();
  // Keep history.state so a pushed sub-screen entry still knows it was pushed.
  history.replaceState(history.state, '', sub ? `#/${name}/${sub}` : `#/${name}`);
  window.scrollTo({ top: 0 });
  await VIEWS[name].render();
  applyI18n();
}

export async function loadCrops() {
  try {
    state.crops = await apiRequest('/crops');
    localStorage.setItem('krishi_crops_cache', JSON.stringify(state.crops));
    state.cropsFromCache = false;
  } catch {
    // Offline / API down: fall back to the last catalogue we saw on this device.
    try { state.crops = JSON.parse(localStorage.getItem('krishi_crops_cache') || '[]'); } catch { state.crops = []; }
    state.cropsFromCache = state.crops.length > 0;
  }
}

// Label every <select data-opt-group> in the current language and push the saved
// farm profile into the form. Views call this right after mounting their HTML and
// BEFORE their first fetch, so a render never resets the farmer's saved choices.
export function hydrate() {
  applyI18n();
  fillProfileForm();
}

export function fillProfileForm() {
  const f = $('farmForm');
  if (!f) return;
  const set = (id, value) => { const el = f.querySelector(`#${id}`); if (el) el.value = value; };
  set('district', state.profile.district);
  set('season', state.profile.season);
  set('soil', state.profile.soil);
  set('water', state.profile.water);
  set('area', state.profile.area);
  set('budget', state.profile.budget);
  set('goal', state.profile.goal);
}

// ------------------------------------------------------------------ startup
async function init() {
  $('language').value = state.lang;
  applyI18n();
  fillProfileForm();

  await resolveApiBase();
  try {
    state.health = await checkHealth();
    setApiStatus('ready', state.health.assistant_mode === 'llm' ? 'API + AI assistant' : 'API connected');
  } catch {
    setApiStatus('offline', 'API offline');
  }
  await loadCrops();

  // One delegated handler for every [data-view] control (sidebar, brand, account chip).
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-view]');
    if (!link || !link.dataset.view) return;
    e.preventDefault();
    showView(link.dataset.view, '');
  });
  // Browser Back/Forward and manual hash edits.
  window.addEventListener('hashchange', () => {
    const { name, sub } = parseHash();
    if (!VIEWS[name]) return;
    const shown = $(`view-${name}`);
    if (name !== currentView() || sub !== ((shown && shown.dataset.sub) || '')) showView(name, sub);
  });
  $('language').addEventListener('change', (e) => {
    state.lang = e.target.value;
    localStorage.setItem('krishi_lang', state.lang);
    applyI18n();
    showView(currentView());
  });
  $('refreshData').addEventListener('click', async () => {
    await loadCrops();
    await showView(currentView());
    toast('Refreshed');
  });
  $('closeModal').addEventListener('click', () => $('cropModal').classList.remove('open'));
  $('cropModal').addEventListener('click', (e) => { if (e.target === $('cropModal')) $('cropModal').classList.remove('open'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('cropModal').classList.remove('open'); });

  const first = parseHash();
  await (VIEWS[first.name] ? showView(first.name, first.sub) : showView('planner', ''));
}

export function currentView() {
  const active = document.querySelector('.view.active');
  return active ? active.id.replace('view-', '') : 'planner';
}

export const cropById = (id) => state.crops.find((c) => c.id === id);
export const cropsForSeason = (season) => state.crops.filter((c) => c.seasons.includes(season));

init();
