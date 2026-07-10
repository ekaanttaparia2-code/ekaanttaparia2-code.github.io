const CACHE_NAME = 'pockettrack-v2'; // 1. BUMPED VERSION TO V2
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for Firebase/API calls
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis')) {
    return; 
  }
  
  // 2. STRATEGY CHANGE: Network-First with Cache Fallback for regular files
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If network request is successful, clone it into the cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails (offline), pull from cache
        return caches.match(event.request);
      })
  );
});
