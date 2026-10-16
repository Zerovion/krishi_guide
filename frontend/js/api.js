// KrishiGuide API client.
// The base URL is discovered at startup (resolveApiBase): same-origin `/api` when FastAPI
// serves the UI, otherwise a local backend on :8000 (UI opened from file:// or a static
// server). Override with  ?api=http://host:port  (remembered on this device).
export let API_BASE = '/api';

async function probe(base) {
  try {
    const r = await fetch(`${base}/health`, { cache: 'no-store' });
    return r.ok && (await r.json()).status === 'ok';
  } catch { return false; }
}

export async function resolveApiBase() {
  const asked = new URLSearchParams(location.search).get('api');
  if (asked) localStorage.setItem('krishi_api_base', asked.replace(/\/+$/, '').replace(/\/api$/, '') + '/api');
  const candidates = [localStorage.getItem('krishi_api_base')];
  if (location.protocol !== 'file:') candidates.push('/api');
  candidates.push('http://127.0.0.1:8000/api', 'http://localhost:8000/api');
  for (const base of candidates.filter(Boolean)) {
    if (await probe(base)) { API_BASE = base; return base; }
  }
  return API_BASE;   // nothing reachable: stay on same-origin; the UI shows "API offline"
}

const TOKEN_KEY = 'krishi_token';
export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
  get signedIn() { return Boolean(this.token); },
};

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
  if (!response.ok) {
    const detail = payload.detail || payload.message || `Request failed (${response.status})`;
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
      : JSON.stringify(detail);
    throw new Error(message);
  }
  return payload;
}

export async function checkHealth() {
  return apiRequest('/health');
}
