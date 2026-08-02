const VERSION='41.0.0';
const STATIC_CACHE=`uonhub-static-${VERSION}`;
const PAGE_CACHE=`uonhub-pages-${VERSION}`;
const OFFLINE_URL='/offline.html';
const PRECACHE=[
 '/',
 '/index.html',
 OFFLINE_URL,
 '/manifest.webmanifest',
 '/css/app.css',
 '/css/ui-refresh-v24.css',
 '/css/pwa.css',
 '/js/v14-ui.js',
 '/js/pwa-init.js',
 '/js/language-v41.js',
 '/assets/icons/icon-192.png',
 '/assets/icons/icon-512.png'
];

self.addEventListener('install',event=>{
 event.waitUntil(
  caches.open(STATIC_CACHE)
   .then(cache=>Promise.allSettled(PRECACHE.map(url=>cache.add(new Request(url,{cache:'reload'})))))
   .then(()=>self.skipWaiting())
 );
});

self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>![STATIC_CACHE,PAGE_CACHE].includes(key)).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

async function networkFirst(request){
 const cache=await caches.open(PAGE_CACHE);
 try{
  const response=await fetch(request,{cache:'no-store'});
  if(response.ok)await cache.put(request,response.clone());
  return response;
 }catch{
  return await cache.match(request)||await caches.match(OFFLINE_URL);
 }
}

async function staleWhileRevalidate(request){
 const cache=await caches.open(STATIC_CACHE);
 const cached=await cache.match(request,{ignoreSearch:true});
 const network=fetch(request,{cache:'no-cache'}).then(async response=>{
  if(response.ok)await cache.put(request,response.clone());
  return response;
 }).catch(()=>null);
 return cached||await network||new Response('',{status:504,statusText:'Offline'});
}

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(networkFirst(request));
  return;
 }
 if(['script','style','font','image'].includes(request.destination)){
  event.respondWith(staleWhileRevalidate(request));
 }
});

self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
 if(event.data?.type==='CLEAR_CACHES'){
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))));
 }
});
