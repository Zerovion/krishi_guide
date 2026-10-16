// Saved plans + OTP account (demo phone sign-in with server-side sessions).
import { apiRequest, auth } from '../api.js';
import { $, esc, money, saveProfile, toast, t, state, showView } from '../main.js';

export async function renderPlans() {
  $('view-plans').innerHTML = `
    <div class="view-head">
      <div class="eyebrow">${esc(t('plansEyebrow'))}</div>
      <h1>${esc(t('plansTitle'))}</h1>
      <p>${esc(t('plansDesc'))}</p>
    </div>
    <div class="grid grid-2">
      <section class="panel auth-box">
        <h3>👤 ${esc(t('account'))}</h3>
        <div id="authArea"></div>
      </section>
      <section class="panel">
        <div class="row" style="justify-content:space-between;align-items:start">
          <div><h3>▣ ${esc(t('yourPlans'))}</h3></div>
          <button class="btn btn-ghost" id="reloadPlans" type="button">↻</button>
        </div>
        <div id="plansList" style="margin-top:8px"></div>
      </section>
    </div>`;

  $('reloadPlans').addEventListener('click', loadPlans);
  renderAuth();
  await loadPlans();
}

function renderAuth() {
  const area = $('authArea');
  if (auth.signedIn) {
    area.innerHTML = `
      <p style="font-size:13px"><b>${esc(t('signedInAs'))}</b> <span id="mePhone">…</span></p>
      <p class="muted-note">Plans you save now belong to this account and stay private to it.</p>
      <button class="btn btn-secondary" id="signOutBtn" type="button">${esc(t('signOut'))}</button>`;
    apiRequest('/auth/me').then((d) => { $('mePhone').textContent = d.user.phone; })
      .catch(() => { auth.token = ''; renderAuth(); });
    $('signOutBtn').addEventListener('click', async () => {
      try { await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* session may already be gone */ }
      auth.token = '';
      toast('Signed out');
      renderAuth();
      loadPlans();
    });
    return;
  }
  area.innerHTML = `
    <div class="field"><label for="phoneInput">${esc(t('phone'))}</label>
      <input id="phoneInput" inputmode="numeric" placeholder="9876543210" maxlength="10" /></div>
    <button class="btn btn-primary" id="requestOtpBtn" type="button">${esc(t('requestOtp'))}</button>
    <div class="otp-step" id="otpStep">
      <div class="field" style="margin-top:12px"><label for="otpInput">${esc(t('otpCode'))}</label>
        <input id="otpInput" inputmode="numeric" placeholder="••••••" maxlength="6" /></div>
      <button class="btn btn-primary" id="verifyBtn" type="button">${esc(t('verify'))}</button>
      <p class="muted-note">Demo mode: the OTP is printed in the backend console (no SMS configured).</p>
    </div>`;
  $('requestOtpBtn').addEventListener('click', async () => {
    const phone = $('phoneInput').value.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) { toast('Enter a valid 10-digit Indian mobile number'); return; }
    $('requestOtpBtn').disabled = true;
    try {
      await apiRequest('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      $('otpStep').classList.add('visible');
      toast('OTP requested — check the backend console');
    } catch (err) { toast(err.message); }
    finally { $('requestOtpBtn').disabled = false; }
  });
  $('verifyBtn')?.addEventListener('click', async () => {
    const phone = $('phoneInput').value.replace(/\D/g, '');
    const code = $('otpInput').value.trim();
    try {
      const d = await apiRequest('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) });
      auth.token = d.token;
      toast('Signed in');
      renderAuth();
      loadPlans();
    } catch (err) { toast(err.message); }
  });
}

async function loadPlans() {
  const target = $('plansList');
  if (!target) return;
  target.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const plans = await apiRequest('/plans');
    if (!plans.length) { target.innerHTML = `<div class="empty-state">${esc(t('plansEmpty'))}</div>`; return; }
    target.innerHTML = plans.map((p) => `
      <div class="plan-row">
        <span><b>#${p.id} · ${esc(p.district || '—')}</b>
          <small>${new Date(p.created_at).toLocaleString()} ${p.user_id ? '· 🔒 account' : '· shared pool'}</small></span>
        <span>${esc(p.season)} · ${p.area} acres · ${money(p.budget)}<small>top: ${esc(p.recommendations?.[0]?.crop?.name || '—')}</small></span>
        <span class="row" style="gap:6px">
          <button class="btn btn-ghost" data-load="${p.id}">${esc(t('loadPlan'))}</button>
          <button class="btn btn-ghost" data-del="${p.id}">${esc(t('delete'))}</button>
        </span>
      </div>`).join('');
    target.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const plan = plans.find((x) => String(x.id) === b.dataset.load);
      if (!plan) return;
      state.profile = { ...state.profile, district: plan.district, season: plan.season, soil: plan.soil,
        water: plan.water, area: plan.area, budget: plan.budget, goal: plan.goal };
      saveProfile();
      toast('Farm profile loaded');
      showView('planner');
    }));
    target.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await apiRequest(`/plans/${b.dataset.del}`, { method: 'DELETE' }); await loadPlans(); }
      catch (err) { b.disabled = false; toast(err.message); }
    }));
  } catch (err) {
    target.innerHTML = `<div class="empty-state">Couldn't load plans: ${esc(err.message)}</div>`;
  }
}
