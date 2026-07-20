const CACHE_NAME = 'uon-coffee-v4';
const ASSETS = ['/site-enhancements.css', '/coming-soon.html', '/404.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';
  event.respondWith(
    fetch(event.request).then(response => {
      if (!isNavigation && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || (isNavigation ? caches.match('/404.html') : Response.error())))
  );
});
