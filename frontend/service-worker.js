// KrishiGuide service worker.
//  - Precaches the whole app shell (HTML, CSS, every JS module, icons) so the UI opens offline.
//  - Static files: network-first (updates apply on reload), cache fallback when offline.
//  - /api/crops and /api/health: network-first with the last good response as fallback.
//  - Other /api/ calls: network only; a clear 503 JSON when offline (the UI shows a message,
//    and the planner falls back to on-device scoring).
const CACHE = 'krishiguide-shell-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/api.js', './js/i18n.js', './js/offline.js', './js/soil-data.js',
  './js/views/planner.js', './js/views/rotation.js', './js/views/calendar.js', './js/views/signals.js',
  './js/views/simulator.js', './js/views/schemes.js', './js/views/assistant.js', './js/views/plans.js', './js/views/soil.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const offlineJson = () => new Response(
  JSON.stringify({ status: 'offline', detail: 'This feature needs a network connection.' }),
  { headers: { 'Content-Type': 'application/json' }, status: 503 },
);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;            // never cache POST/DELETE
  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) {
    const cacheable = url.pathname === '/api/crops' || url.pathname === '/api/health';
    event.respondWith(
      fetch(req).then((res) => {
        if (cacheable && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => (cacheable ? caches.match(req).then((hit) => hit || offlineJson()) : offlineJson())),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))),
    );
  }
});
