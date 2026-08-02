// PocketTrack Service Worker — Offline Support
const CACHE_NAME = 'pockettrack-v1';
const PRECACHE_URLS = [
  './', './index.html', './manifest.json',
  './styles.css', './app.js', './firebase.js',
  './auth.js', './transactions.js', './reports.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/2.47.0/iconfont/tabler-icons.min.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ns => Promise.all(ns.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Network-first for Firebase APIs
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.hostname.includes('gstatic.com') || url.hostname.includes('identitytoolkit')) {
    e.respondWith(fetch(e.request).then(r => { if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // Stale-while-revalidate for static assets
  e.respondWith(caches.match(e.request).then(cached => {
    const fresh = fetch(e.request).then(r => { if (r && r.status === 200) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone())); return r; }).catch(() => cached);
    return cached || fresh;
  }));
});
