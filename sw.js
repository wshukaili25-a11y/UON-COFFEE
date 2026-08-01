const CACHE_NAME='uonhub-pwa-v39-0-0';
const OFFLINE_URL='/offline.html';
const CORE_ASSETS=[
 OFFLINE_URL,
 '/manifest.webmanifest',
 '/assets/icons/icon-192.png',
 '/assets/icons/icon-512.png'
];

self.addEventListener('install',event=>{
 event.waitUntil(
  caches.open(CACHE_NAME)
   .then(cache=>Promise.allSettled(CORE_ASSETS.map(asset=>cache.add(asset))))
   .then(()=>self.skipWaiting())
 );
});
self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

async function networkFirst(request,{fallback=OFFLINE_URL,timeout=9000}={}){
 const cache=await caches.open(CACHE_NAME);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(request,{cache:'no-store',signal:controller.signal});
  if(response?.ok)cache.put(request,response.clone()).catch(()=>{});
  return response;
 }catch{
  return await cache.match(request,{ignoreSearch:true})
   || await caches.match(request,{ignoreSearch:true})
   || (fallback?await caches.match(fallback):null)
   || new Response('Offline',{status:503,statusText:'Offline'});
 }finally{clearTimeout(timer)}
}

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.headers.has('range'))return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;

 if(request.mode==='navigate'){
  event.respondWith(networkFirst(request,{fallback:OFFLINE_URL,timeout:9000}));
  return;
 }
 if(/\.(?:js|css)$/.test(url.pathname)){
  event.respondWith(networkFirst(request,{fallback:null,timeout:7000}));
  return;
 }
 if(/\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)){
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
   const cached=await cache.match(request,{ignoreSearch:true});
   const network=fetch(request).then(response=>{
    if(response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
   }).catch(()=>null);
   return cached||await network||new Response('',{status:504,statusText:'Offline'});
  }));
 }
});
