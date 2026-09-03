const VERSION = '64.4.5';
const STATIC_CACHE = `uonhub-static-${VERSION}`;
const PAGE_CACHE = `uonhub-pages-${VERSION}`;
const DATA_CACHE = `uonhub-data-${VERSION}`;
const USER_SAVED_CACHE = 'uonhub-user-saved-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  '/index.html','/tools.html','/useful-sites.html','/schedule.html','/tasks.html','/study-focus.html','/user-dashboard.html','/assistant.html','/google-connect.html',
  '/notifications.html','/academic-calendar.html','/search.html','/go.html','/support-centers.html',
  OFFLINE_URL,'/manifest.webmanifest','/css/app.css','/css/ui-refresh-v24.css','/css/schedule.css',
  '/css/schedule-extras-v44.css','/css/schedule-insights-v61.css','/css/schedule-smart-v63.css','/css/assistant-smart-v63.css','/css/google-connect-v641.css','/css/student-tasks-v61.css','/css/study-focus-v62.css','/css/pwa.css','/css/tool-registry-v44.css','/css/tools-primary-v46.css',
  '/css/useful-sites-v46.css','/css/support-centers.css','/css/user-dashboard-v61.css','/css/student-pulse.css',
  '/css/home-student-pulse.css','/css/student-tools-ui-v47.css','/js/core.js','/js/v14-ui.js','/js/tools.js','/js/tools-primary-v46.js',
  '/js/useful-sites.js','/js/student-tools-ui-v47.js','/js/schedule-time-fix-v44.js','/js/schedule-profile-boot-v44.js','/js/schedule.js','/js/schedule-main.js','/js/schedule-ai-import.js','/js/schedule-ai-applied-toast.js','/js/schedule-ai-sync-v54.js','/js/schedule-extras-v44.js',
  '/js/schedule-insights-v61.js','/js/schedule-smart-v63.js','/js/schedule-prefill-v63.js','/js/assistant-smart-v63.js','/js/assistant-schedule-actions-v63.js','/js/assistant.js','/js/assistant-history.js','/js/google-connect-v641.js','/js/google-auth-session-v641.js','/js/google-auth-status-v641.js','/js/student-tasks-data.js','/js/tasks.js','/js/study-focus-data.js','/js/study-focus.js','/js/search.js','/js/go.js','/js/pwa-init.js','/js/tool-registry-v44.js','/js/platform-experience-v44.js',
  '/js/app-capabilities-v48.js','/js/support-centers.js','/js/academic-calendar-data.js',
  '/js/academic-calendar-page.js','/js/student-pulse.js','/js/user-dashboard.js','/js/notifications.js','/js/v20-experience.js',
  '/js/home-student-pulse.js','/js/security-guard-v48.js','/assets/whatsapp-official.svg','/assets/icons/icon-192.png','/assets/icons/icon-512.png'
];

self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC_CACHE).then(cache=>Promise.allSettled(PRECACHE.map(url=>cache.add(new Request(url,{cache:'reload'}))))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>![STATIC_CACHE,PAGE_CACHE,DATA_CACHE,USER_SAVED_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(async()=>{const clients=await self.clients.matchAll({type:'window'});clients.forEach(client=>client.postMessage({type:'UON_SW_READY',version:VERSION}))}))});
async function networkFirst(request,cacheName,fallback){const cache=await caches.open(cacheName);try{const response=await fetch(request,{cache:'no-store'});if(response.ok)await cache.put(request,response.clone());return response}catch{return await caches.match(request,{ignoreSearch:false})||await cache.match(request,{ignoreSearch:true})||await caches.match(fallback)||new Response('',{status:503,statusText:'Offline'})}}
async function cacheFirst(request){const cache=await caches.open(STATIC_CACHE);const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response}catch{return new Response('',{status:504,statusText:'Offline'})}}
async function staleWhileRevalidate(request){const cache=await caches.open(STATIC_CACHE);const cached=await cache.match(request,{ignoreSearch:true});const network=fetch(request,{cache:'no-cache'}).then(async response=>{if(response.ok)await cache.put(request,response.clone());return response}).catch(()=>null);return cached||await network||new Response('',{status:504,statusText:'Offline'})}
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;if(request.mode==='navigate'){if(/\/admin|owner-dashboard|tools-control|reset/.test(url.pathname))return;event.respondWith(networkFirst(request,PAGE_CACHE,OFFLINE_URL));return}if(['script','style','worker'].includes(request.destination)){event.respondWith(networkFirst(request,STATIC_CACHE));return}if(['font','image'].includes(request.destination)){event.respondWith(staleWhileRevalidate(request));return}if(url.pathname.startsWith('/assets/'))event.respondWith(cacheFirst(request))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='CLEAR_CACHES')event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==USER_SAVED_CACHE).map(key=>caches.delete(key)))));if(event.data?.type==='GET_VERSION')event.source?.postMessage?.({type:'UON_SW_VERSION',version:VERSION})});