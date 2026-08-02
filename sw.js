const CACHE_NAME = 'pockettrack-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './firebase.js',
  './auth.js',
  './transactions.js',
  './reports.js',
  './onboarding.js',
  './voice.js',
  './ledger.js',
  './aicoach.js',
  './monetization.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Stale-While-Revalidate Strategy
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networked = fetch(e.request).then((res) => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const cacheCopy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
        }
        return res;
      }).catch(() => cached);
      return cached || networked;
    })
  );
});
