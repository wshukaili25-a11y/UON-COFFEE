const CACHE_PREFIX = 'uon-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) || key.includes('uon'))
        .map(key => caches.delete(key))
    );

    await self.clients.claim();

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of clients) {
      client.postMessage({ type: 'UON_CACHE_CLEARED' });
    }

    await self.registration.unregister();
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
