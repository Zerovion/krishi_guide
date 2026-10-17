// Soil care: one hub with three tools the farmer can pick from.
//   #/soil           hub (choose a tool)
//   #/soil/card      Soil Health Card entry + plain-language explanation
//   #/soil/finder    Find my soil type (5-question guide)
//   #/soil/advice    Fertilizer & soil advice (soil type + card values)
//
// Navigation: hub -> tool pushes a history entry, so the browser Back button and the
// on-screen "Back to Soil care" button both return to the hub. Moving between tools
// (tabs, next-step buttons) replaces the entry, so Back never walks through a long trail.
// The current screen is always read from the URL, never from module state.
import { $, esc, t, opt, state, toast, saveProfile } from '../main.js';
import {
  SOIL_UI, PARAMS, TONE, TONE_RANK, STATUS_LABEL, MEANING, QUIZ, SOIL_TIPS, SOIL_ICON,
  HIGH_ADVICE, HIGH_CANDIDATES, assess, rateParam, adviceFor, scoreSoil, isValidValue,
} from '../soil-data.js';

const SUBS = ['card', 'finder', 'advice'];
const CARD_KEY = 'krishi_soil_card';
const FINDER_KEY = 'krishi_soil_finder';

// ------------------------------------------------------------------ helpers
const tx = (o) => (o && (o[state.lang] || o.en)) || '';
const fill = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : `{${k}}`));
const ui = (key, vars) => fill(tx(SOIL_UI[key]), vars);
const soilName = (id) => (opt('soil')[id] || id);
const dateText = (iso) => {
  try { return new Date(iso).toLocaleDateString({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[state.lang] || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, value) => {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: keep working in memory */ }
};
const subFromHash = () => {
  const sub = location.hash.replace(/^#\/?/, '').split('/')[1] || '';
  return SUBS.includes(sub) ? sub : '';
};

// ------------------------------------------------------------------ navigation
function go(sub, { replace = false } = {}) {
  const hash = sub ? `#/soil/${sub}` : '#/soil';
  if (replace) history.replaceState(history.state, '', hash);
  else history.pushState({ soil: true }, '', hash);
  paint(true);
  window.scrollTo({ top: 0 });
}

function goBack() {
  // A pushed entry always sits directly above the hub, so history.back() lands on the hub.
  if (history.state && history.state.soil) history.back();
  else go('', { replace: true });
}

// ------------------------------------------------------------------ module state (UI drafts only)
let quiz = null;        // { step, answers }  step === QUIZ.length means "show result"
let cardDraft = null;   // raw strings typed into the card form

function getQuiz() {
  if (quiz) return quiz;
  const saved = read(FINDER_KEY);
  quiz = saved && Array.isArray(saved.answers) ? { step: QUIZ.length, answers: saved.answers } : { step: 0, answers: [] };
  return quiz;
}
function getDraft() {
  if (cardDraft) return cardDraft;
  const saved = read(CARD_KEY);
  cardDraft = { plot: (saved && saved.plot) || '' };
  if (saved && saved.values) Object.entries(saved.values).forEach(([k, v]) => { cardDraft[k] = String(v); });
  return cardDraft;
}

// ------------------------------------------------------------------ render entry
export async function renderSoil() { paint(true); }

function paint(animate) {
  wire();
  const sub = subFromHash();
  const root = $('view-soil');
  root.dataset.sub = sub;
  const body = sub === 'card' ? cardScreen() : sub === 'finder' ? finderScreen() : sub === 'advice' ? adviceScreen() : hubScreen();
  root.innerHTML = `<div class="soil-screen${animate ? ' enter' : ''}">${sub ? topBar(sub) : ''}${body}</div>`;
  if (sub === 'card') refreshCardLive();
}

const TABS = [
  { sub: 'card', ico: '🧾', key: 'cardTitle' },
  { sub: 'finder', ico: '🔎', key: 'finderTitle' },
  { sub: 'advice', ico: '🌱', key: 'adviceTitle' },
];

function topBar(sub) {
  return `<div class="soil-top">
    <button type="button" class="soil-back" data-soil-back>← ${esc(ui('back'))}</button>
    <nav class="soil-tabs" aria-label="${esc(ui('toolsAria'))}">
      ${TABS.map((tab) => `<button type="button" class="soil-tab${tab.sub === sub ? ' active' : ''}" data-soil-tab="${tab.sub}"${tab.sub === sub ? ' aria-current="page"' : ''}>
        <span aria-hidden="true">${tab.ico}</span> ${esc(ui(tab.key))}</button>`).join('')}
    </nav>
  </div>`;
}

function heading(titleKey, descKey) {
  return `<div class="view-head"><h1>${esc(ui(titleKey))}</h1><p>${esc(ui(descKey))}</p></div>`;
}

// ------------------------------------------------------------------ hub
function hubScreen() {
  const card = read(CARD_KEY);
  const finder = read(FINDER_KEY);
  const attention = card ? assess(card.values).filter((i) => i.tone !== 'good').length : 0;
  const finderResult = finder && finder.soil ? finder.soil : null;

  const tiles = [
    { sub: 'card', ico: '🧾', title: 'cardTitle', blurb: 'cardBlurb',
      chip: card ? (attention ? ui('chipCardAttn', { n: attention }) : ui('chipCardFine')) : ui('chipNone'),
      tone: card ? (attention ? 'watch' : 'good') : '' },
    { sub: 'finder', ico: '🔎', title: 'finderTitle', blurb: 'finderBlurb',
      chip: finderResult ? ui('chipFinder', { soil: soilName(finderResult) }) : ui('chipNone'),
      tone: finderResult ? 'good' : '' },
    { sub: 'advice', ico: '🌱', title: 'adviceTitle', blurb: 'adviceBlurb',
      chip: ui('chipAdvice', { soil: soilName(state.profile.soil) }), tone: '' },
  ];

  return `
    <div class="view-head">
      <div class="eyebrow">${esc(ui('hubEyebrow'))}</div>
      <h1>${esc(ui('hubTitle'))}</h1>
      <p>${esc(ui('hubDesc'))}</p>
    </div>
    <div class="soil-hub">
      ${tiles.map((tile) => `
        <button type="button" class="soil-tile" data-soil-go="${tile.sub}">
          <span class="soil-tile-ico" aria-hidden="true">${tile.ico}</span>
          <span class="soil-tile-title">${esc(ui(tile.title))}</span>
          <span class="soil-tile-blurb">${esc(ui(tile.blurb))}</span>
          <span class="soil-tile-foot">
            <span class="soil-chip ${tile.tone ? `tone-${tile.tone}` : ''}">${esc(tile.chip)}</span>
            <span class="soil-tile-go">${esc(ui('open'))} ›</span>
          </span>
        </button>`).join('')}
    </div>
    <p class="muted-note">${esc(ui('hubHint'))}</p>`;
}

// ------------------------------------------------------------------ tool 1: Soil Health Card
function fieldHtml(p, draft) {
  const value = draft[p.id] == null ? '' : draft[p.id];
  return `<div class="field soil-field">
    <label for="sp-${p.id}">${esc(tx(p.name))} <small>${esc(p.unit)}</small></label>
    <input id="sp-${p.id}" class="soil-input" data-param="${p.id}" type="number" inputmode="decimal"
      step="${p.step}" min="${p.min}" max="${p.max}" placeholder="e.g. ${p.eg}" value="${esc(value)}" />
    <div class="soil-hint" id="sh-${p.id}" aria-live="polite"></div>
  </div>`;
}

function cardScreen() {
  const draft = getDraft();
  const microOpen = PARAMS.some((p) => p.group === 'micro' && draft[p.id] != null && draft[p.id] !== '');
  return `
    ${heading('cardTitle', 'cardDesc')}
    <div class="grid grid-form">
      <aside class="panel">
        <div class="field"><label for="sp-plot">${esc(ui('plotLabel'))}</label>
          <input id="sp-plot" class="soil-plot" type="text" maxlength="60" value="${esc(draft.plot || '')}" /></div>
        <h3 class="soil-group">${esc(ui('mainGroup'))}</h3>
        ${PARAMS.filter((p) => p.group === 'main').map((p) => fieldHtml(p, draft)).join('')}
        <details class="soil-more"${microOpen ? ' open' : ''}>
          <summary>${esc(ui('microGroup'))}</summary>
          <div class="soil-more-body">${PARAMS.filter((p) => p.group === 'micro').map((p) => fieldHtml(p, draft)).join('')}</div>
        </details>
        <div class="row" style="margin-top:6px">
          <button type="button" class="btn btn-primary" id="soilSave">${esc(ui('saveCard'))}</button>
          <button type="button" class="btn btn-ghost" id="soilClear">${esc(ui('clearCard'))}</button>
        </div>
        <p class="muted-note">${esc(ui('noCardNote'))}</p>
      </aside>
      <section class="panel" id="soilResults" aria-live="polite"></section>
    </div>`;
}

function resultRow(p, value, status) {
  const tone = TONE[status];
  return `<div class="soil-row">
    <div class="soil-row-head">
      <b>${esc(tx(p.name))} · ${value}${p.unit ? ` ${esc(p.unit)}` : ''}</b>
      <span class="soil-chip tone-${tone}">${esc(tx(STATUS_LABEL[status]))}</span>
    </div>
    <p class="soil-meaning">${esc(tx(MEANING[status]))}</p>
    <details class="soil-what"><summary>${esc(ui('whatIs'))}</summary><p>${esc(tx(p.what))}</p></details>
  </div>`;
}

// Re-rate whatever is typed, update the per-field hints and the results panel. Never touches the inputs' values.
function refreshCardLive() {
  const draft = getDraft();
  const rows = [];
  PARAMS.forEach((p) => {
    const input = $(`sp-${p.id}`);
    const hint = $(`sh-${p.id}`);
    if (!input || !hint) return;
    input.classList.remove('invalid');
    hint.className = 'soil-hint';
    hint.textContent = '';
    const raw = String(draft[p.id] == null ? '' : draft[p.id]).trim();
    if (raw === '') return;
    if (!isValidValue(p.id, raw)) {
      input.classList.add('invalid');
      hint.classList.add('err');
      hint.textContent = ui('invalid', { min: p.min, max: p.max });
      return;
    }
    const status = rateParam(p.id, Number(raw));
    hint.classList.add(`tone-${TONE[status]}`);
    hint.textContent = tx(STATUS_LABEL[status]);
    rows.push(resultRow(p, Number(raw), status));
  });
  const saved = read(CARD_KEY);
  $('soilResults').innerHTML = `
    <h3>${esc(ui('resultsTitle'))}</h3>
    <p class="panel-sub">${esc(ui('rangeNote'))}</p>
    ${rows.length ? rows.join('') : `<div class="empty-state">${esc(ui('resultsEmpty'))}</div>`}
    ${rows.length ? `<div class="soil-next"><button type="button" class="btn btn-primary" data-soil-next="advice">${esc(ui('nextAdvice'))} →</button></div>` : ''}
    ${saved && saved.savedAt ? `<p class="muted-note">${esc(ui('savedOn', { date: dateText(saved.savedAt) }))}</p>` : ''}`;
}

// Validates the draft and writes it. Returns true on success, false (with a toast) otherwise.
function saveCard() {
  const draft = getDraft();
  const values = {};
  let firstBad = null;
  PARAMS.forEach((p) => {
    const raw = String(draft[p.id] == null ? '' : draft[p.id]).trim();
    if (raw === '') return;
    if (isValidValue(p.id, raw)) values[p.id] = Number(raw);
    else if (!firstBad) firstBad = p.id;
  });
  if (firstBad) { toast(ui('fixFirst')); const el = $(`sp-${firstBad}`); if (el) el.focus(); return false; }
  if (!Object.keys(values).length) { toast(ui('needOne')); return false; }
  write(CARD_KEY, { values, plot: (draft.plot || '').trim(), savedAt: new Date().toISOString() });
  return true;
}

// ------------------------------------------------------------------ tool 2: Find my soil type
function finderScreen() {
  const q = getQuiz();
  if (q.step >= QUIZ.length) return finderResultScreen(q);
  const question = QUIZ[q.step];
  const picked = q.answers[q.step];
  const pct = Math.round((q.step / QUIZ.length) * 100);
  return `
    ${heading('finderTitle', 'finderDesc')}
    <section class="panel soil-quiz">
      <div class="progress-line"><span>${esc(ui('qOf', { n: q.step + 1, total: QUIZ.length }))}</span><span>${pct}%</span></div>
      <div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <h3 style="margin-top:16px">${esc(tx(question.title))}</h3>
      <p class="panel-sub" style="margin:4px 0 0">${esc(tx(question.help))}</p>
      <div class="soil-opts" role="radiogroup" aria-label="${esc(tx(question.title))}">
        ${question.options.map((o, i) => `
          <button type="button" role="radio" aria-checked="${picked === i}" class="soil-opt${picked === i ? ' selected' : ''}" data-q-opt="${i}">
            ${o.swatch ? `<span class="soil-swatch" style="background:${o.swatch}"></span>` : `<span class="soil-ico" aria-hidden="true">${o.icon || ''}</span>`}
            <span>${esc(tx(o.text))}</span>
            <span class="soil-radio" aria-hidden="true"></span>
          </button>`).join('')}
      </div>
      <div class="row" style="justify-content:space-between">
        <button type="button" class="btn btn-ghost" data-q-prev${q.step === 0 ? ' disabled' : ''}>← ${esc(ui('prev'))}</button>
        <button type="button" class="btn btn-primary" data-q-next${picked == null ? ' disabled' : ''}>${esc(ui(q.step === QUIZ.length - 1 ? 'seeResult' : 'next'))} →</button>
      </div>
      <p class="muted-note">${esc(ui('quizNote'))}</p>
    </section>`;
}

function finderResultScreen(q) {
  const result = scoreSoil(q.answers);
  if (!result) {
    return `${heading('finderTitle', 'finderDesc')}
      <section class="panel"><div class="empty-state"><b>${esc(ui('notEnough'))}</b></div>
        <div class="soil-next"><button type="button" class="btn btn-primary" data-q-retake>${esc(ui('retake'))}</button></div></section>`;
  }
  write(FINDER_KEY, { soil: result.soil, also: result.also, answers: q.answers, at: new Date().toISOString() });
  const used = state.profile.soil === result.soil;
  return `
    ${heading('finderTitle', 'finderDesc')}
    <section class="panel soil-result">
      <div class="eyebrow">${esc(ui('resultEyebrow'))}</div>
      <h2>${SOIL_ICON[result.soil]} ${esc(soilName(result.soil))}</h2>
      <div class="row" style="margin:6px 0 10px">
        <span class="pill">${esc(ui(result.confidence === 'strong' ? 'strongMatch' : 'likelyMatch'))}</span>
        ${result.also ? `<span class="chip">${esc(ui('alsoClose', { soil: soilName(result.also) }))}</span>` : ''}
      </div>
      <p class="soil-desc">${esc(tx(SOIL_TIPS[result.soil].desc))}</p>
      <div class="soil-next">
        <button type="button" class="btn btn-primary" data-use-soil="${result.soil}"${used ? ' disabled' : ''}>${esc(ui(used ? 'usedSoil' : 'useSoil'))}</button>
      </div>
      <div class="soil-next">
        <button type="button" class="btn btn-secondary" data-soil-next="advice">${esc(ui('adviceTitle'))} →</button>
        <button type="button" class="btn btn-secondary" data-soil-next="card">${esc(ui('cardTitle'))} →</button>
        <button type="button" class="btn btn-ghost" data-view="planner">${esc(t('navPlanner'))}</button>
        <button type="button" class="btn btn-ghost" data-q-retake>${esc(ui('retake'))}</button>
      </div>
      <p class="muted-note">${esc(ui('quizNote'))}</p>
    </section>`;
}

// ------------------------------------------------------------------ tool 3: Fertilizer & soil advice
function stepsHtml(block) {
  return `<ul class="soil-steps">${block.steps.map((s) => `<li>${esc(tx(s))}</li>`).join('')}</ul>
    ${block.action === 'rotation' ? `<button type="button" class="btn btn-ghost" data-view="rotation" style="margin-top:8px">${esc(t('navRotation'))} →</button>` : ''}`;
}

function adviceScreen() {
  const soil = state.profile.soil;
  const tips = SOIL_TIPS[soil];
  const card = read(CARD_KEY);

  const typeSection = tips ? `
    <section class="panel">
      <h3>${SOIL_ICON[soil] || ''} ${esc(ui('forSoilType', { soil: soilName(soil) }))}</h3>
      <p class="panel-sub">${esc(tx(tips.desc))}</p>
      <ul class="soil-steps">${tips.tips.map((s) => `<li>${esc(tx(s))}</li>`).join('')}</ul>
      <button type="button" class="btn btn-ghost" data-soil-next="finder" style="margin-top:10px">${esc(ui('changeSoil'))}</button>
    </section>` : '';

  let cardSection;
  if (!card || !card.values) {
    cardSection = `
      <section class="panel">
        <h3>${esc(ui('fromCard'))}</h3>
        <div class="empty-state" style="margin-top:10px"><b>${esc(ui('noCardYet'))}</b>
          <button type="button" class="btn btn-primary" data-soil-next="card" style="margin-top:8px">${esc(ui('addCard'))} →</button></div>
      </section>`;
  } else {
    const items = assess(card.values);
    const todo = items.filter((i) => adviceFor(i.id, i.status))
      .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
    const plenty = items.filter((i) => i.status === 'high' && HIGH_CANDIDATES.includes(i.id));
    const byId = Object.fromEntries(PARAMS.map((p) => [p.id, p]));
    cardSection = `
      <section class="panel">
        <div class="row" style="justify-content:space-between;align-items:start">
          <div><h3>${esc(ui('fromCard'))}</h3>
            <p class="panel-sub" style="margin:0">${esc([card.plot, dateText(card.savedAt), todo.length ? ui('attnCount', { n: todo.length }) : ''].filter(Boolean).join(' · '))}</p></div>
          <button type="button" class="btn btn-ghost" data-soil-next="card">${esc(ui('editCard'))}</button>
        </div>
        <div style="margin-top:12px">
          ${todo.length ? todo.map((i) => {
            const p = byId[i.id];
            return `<article class="soil-advice tone-${i.tone}">
              <div class="soil-row-head"><b>${esc(tx(p.name))} · ${i.value}${p.unit ? ` ${esc(p.unit)}` : ''}</b>
                <span class="soil-chip tone-${i.tone}">${esc(tx(STATUS_LABEL[i.status]))}</span></div>
              ${stepsHtml(adviceFor(i.id, i.status))}
            </article>`;
          }).join('') : `<div class="flag info"><span class="ico">✅</span><div>${esc(ui('allFine'))}</div></div>`}
          ${plenty.length ? `<article class="soil-advice tone-good">
            <div class="soil-row-head"><b>${esc(ui('plentyTitle'))}</b>
              <span class="chip-row">${plenty.map((i) => `<span class="soil-chip tone-good">${esc(tx(byId[i.id].name))}</span>`).join('')}</span></div>
            <p class="soil-meaning">${esc(tx(HIGH_ADVICE))}</p></article>` : ''}
        </div>
      </section>`;
  }

  return `
    ${heading('adviceTitle', 'adviceDesc')}
    ${typeSection}
    ${cardSection}
    <div class="notice"><span style="font-size:16px">ⓘ</span><div>${esc(ui('verifyNote'))}</div></div>
    <div class="soil-next"><button type="button" class="btn btn-secondary" data-view="planner">${esc(ui('planCrops'))} →</button></div>`;
}

// ------------------------------------------------------------------ events (delegated, wired once)
let wired = false;
function wire() {
  if (wired) return;
  const root = $('view-soil');
  if (!root) return;
  wired = true;

  root.addEventListener('click', (e) => {
    const hit = (sel) => e.target.closest(sel);
    let el;
    if ((el = hit('[data-soil-go]'))) return go(el.dataset.soilGo);                       // hub -> tool (push)
    if ((el = hit('[data-soil-tab]'))) { if (el.dataset.soilTab !== subFromHash()) go(el.dataset.soilTab, { replace: true }); return; }
    if ((el = hit('[data-soil-next]'))) {                                                  // next-step buttons
      const target = el.dataset.soilNext;
      if (subFromHash() === 'card' && target === 'advice' && !saveCard()) return;          // advice reads the saved card
      return go(target, { replace: true });
    }
    if (hit('[data-soil-back]')) return goBack();

    // finder
    if ((el = hit('[data-q-opt]'))) { const q = getQuiz(); q.answers[q.step] = Number(el.dataset.qOpt); return paint(false); }
    if (hit('[data-q-prev]')) { const q = getQuiz(); if (q.step > 0) q.step -= 1; return paint(false); }
    if (hit('[data-q-next]')) { const q = getQuiz(); if (q.answers[q.step] != null) q.step += 1; paint(false); return window.scrollTo({ top: 0 }); }
    if (hit('[data-q-retake]')) { quiz = { step: 0, answers: [] }; paint(false); return window.scrollTo({ top: 0 }); }
    if ((el = hit('[data-use-soil]'))) {
      state.profile.soil = el.dataset.useSoil;
      saveProfile();
      toast(ui('usedToast', { soil: soilName(el.dataset.useSoil) }));
      return paint(false);
    }

    // card
    if (hit('#soilSave')) { if (saveCard()) { toast(ui('cardSavedToast')); refreshCardLive(); } return; }
    if (hit('#soilClear')) { cardDraft = { plot: '' }; write(CARD_KEY, null); toast(ui('cardClearedToast')); return paint(false); }
  });

  root.addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('soil-input')) { getDraft()[target.dataset.param] = target.value; refreshCardLive(); }
    else if (target.classList.contains('soil-plot')) { getDraft().plot = target.value; }
  });
}
