// Farmer assistant chat: backend-grounded (LLM when configured, rules otherwise),
// with browser voice input and spoken replies.
import { apiRequest } from '../api.js';
import { $, esc, t, state, toast } from '../main.js';

export async function renderAssistant() {
  $('view-assistant').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('asstReady'))}</div>
      <h1>${esc(t('asstTitle'))}</h1>
      <p>${esc(t('asstSub'))}</p>
    </div>
    <section class="panel chat" style="max-width:780px">
      <div class="chat-head">
        <div class="bot-avatar">🌱</div>
        <div><h3>${esc(t('asstTitle'))}</h3><span class="chat-mode" id="assistantMode">${esc(t('rulesMode'))}</span></div>
        <span style="flex:1"></span>
        <label class="toggle" style="padding:6px 10px;font-size:11px;gap:6px"><span>${esc(t('speakReplies'))}</span><input id="speakToggle" type="checkbox" ${speakOn() ? 'checked' : ''} /></label>
        <button class="btn btn-ghost" id="voiceBtn" type="button" title="${esc(t('voiceInput'))}" aria-label="${esc(t('voiceInput'))}">🎙</button>
      </div>
      <div class="chat-messages" id="chatMessages" aria-live="polite"></div>
      <form class="chat-form" id="chatForm">
        <input id="chatInput" placeholder="${esc(t('asstPlaceholder'))}" autocomplete="off" required />
        <button type="submit" aria-label="Send">➤</button>
      </form>
      <div class="quick-asks">
        <button type="button" data-ask="${esc(t('qaLowWater'))}">${esc(t('qaLowWater'))}</button>
        <button type="button" data-ask="${esc(t('qaRotation'))}">${esc(t('qaRotation'))}</button>
        <button type="button" data-ask="${esc(t('qaWater'))}">${esc(t('qaWater'))}</button>
        <button type="button" data-ask="${esc(t('qaSchemes'))}">${esc(t('qaSchemes'))}</button>
        <button type="button" data-ask="${esc(t('qaWeather'))}">${esc(t('qaWeather'))}</button>
      </div>
    </section>`;

  addBubble(t('asstSub'), false, null);
  $('chatForm').addEventListener('submit', (e) => { e.preventDefault(); ask(); });
  document.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => {
    $('chatInput').value = b.dataset.ask;
    ask();
  }));
  $('voiceBtn').addEventListener('click', voiceInput);
  $('speakToggle').addEventListener('change', (e) => {
    localStorage.setItem('krishi_speak', e.target.checked ? '1' : '0');
    if (!e.target.checked && 'speechSynthesis' in window) speechSynthesis.cancel();
  });

  try {
    const h = await apiRequest('/health');
    $('assistantMode').textContent = h.assistant_mode === 'llm' ? t('llmMode') : t('rulesMode');
  } catch { /* keep default label */ }
}

const speakOn = () => localStorage.getItem('krishi_speak') === '1';

function addBubble(text, isUser, meta, speak = false) {
  const wrap = $('chatMessages');
  const d = document.createElement('div');
  d.className = 'bubble' + (isUser ? ' user' : '');
  d.textContent = text;
  if (meta) {
    const m = document.createElement('span');
    m.className = 'meta';
    m.textContent = meta;
    d.appendChild(m);
  }
  wrap.appendChild(d);
  wrap.scrollTop = wrap.scrollHeight;
  if (speak && speakOn() && 'speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ''));
    utter.lang = state.lang === 'mr' ? 'mr-IN' : state.lang === 'hi' ? 'hi-IN' : 'en-IN';
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }
}

async function ask() {
  const input = $('chatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  addBubble(question, true, null);
  const thinking = document.createElement('div');
  thinking.className = 'bubble';
  thinking.textContent = '…';
  $('chatMessages').appendChild(thinking);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  try {
    const d = await apiRequest('/assistant', {
      method: 'POST',
      body: JSON.stringify({ question, lang: state.lang, profile: state.profile }),
    });
    thinking.remove();
    addBubble(d.answer, false, `${d.mode === 'llm' ? t('llmMode') : t('rulesMode')} · ${d.disclaimer}`, true);
  } catch (err) {
    thinking.remove();
    addBubble(`The assistant is unavailable right now (${err.message}). Verify decisions locally with your KVK.`, false, null);
  }
}

function voiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input is not supported by this browser.'); return; }
  const rec = new SR();
  rec.lang = state.lang === 'mr' ? 'mr-IN' : state.lang === 'hi' ? 'hi-IN' : 'en-IN';
  rec.onresult = (e) => { $('chatInput').value = e.results[0][0].transcript; ask(); };
  rec.onend = () => $('voiceBtn')?.classList.remove('listening');
  rec.onstart = () => { $('voiceBtn')?.classList.add('listening'); toast('Listening…'); };
  rec.onerror = () => toast('Voice recognition failed or microphone permission was denied.');
  rec.start();
}
