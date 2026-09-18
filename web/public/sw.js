/* Nimdee service worker: app-shell caching so the attendance screen opens offline. API calls are never cached. */
const CACHE = 'nimdee-shell-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/offline', '/manifest.json', '/icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  if (url.pathname.startsWith('/_next/static/')) { e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))); return; }
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(async () => (await caches.match(e.request)) || (await caches.match('/offline')))); }
});
