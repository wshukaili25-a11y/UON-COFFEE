const CACHE_NAME = 'uon-hub-v30';
const CORE = ['/', '/index.html', '/features.html', '/marketplace.html', '/groups.html', '/summaries.html', '/tools.html', '/schedule.html', '/404.html', '/manifest.json'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy=response.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request,copy)); return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('/404.html'))));
});
