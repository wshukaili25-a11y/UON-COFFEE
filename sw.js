const CACHE='uon-hub-v19-stable';
const CORE=['/','/index.html','/css/app.css','/js/home.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 const dynamic=e.request.mode==='navigate'||/\.(?:html|css|js)$/.test(u.pathname);
 if(dynamic){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)));return;}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const x=n.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return n})));
});
