
const CACHE='uon-hub-v18-13-2';
const SHELL=['/index.html','/css/app.css','/js/core.js','/manifest.webmanifest'];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));
 self.skipWaiting();
});

self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);

 if(url.origin!==location.origin)return;
 if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/functions/'))return;

 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('/index.html')));
  return;
 }

 event.respondWith(
  fetch(req).then(res=>{
   const copy=res.clone();
   caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
   return res;
  }).catch(()=>caches.match(req))
 );
});
