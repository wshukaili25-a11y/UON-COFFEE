const SAVED_KEY='uonhub_saved_pages_v1';
const MAX_SAVED=30;

function readSaved(){
 try{return JSON.parse(localStorage.getItem(SAVED_KEY)||'[]')}catch{return []}
}
function writeSaved(items){localStorage.setItem(SAVED_KEY,JSON.stringify(items.slice(0,MAX_SAVED)))}
function currentPage(){return{url:location.pathname+location.search,title:document.title,savedAt:new Date().toISOString()}}
function isSaved(){return readSaved().some(item=>item.url===currentPage().url)}
async function cacheCurrentPage(){
 if(!('caches'in window))throw new Error('Cache API unavailable');
 const page=currentPage();
 const cache=await caches.open('uonhub-user-saved-v1');
 const response=await fetch(location.href,{cache:'reload',credentials:'same-origin'});
 if(!response.ok)throw new Error('Unable to save page');
 await cache.put(location.href,response.clone());
 const items=readSaved().filter(item=>item.url!==page.url);
 items.unshift(page);writeSaved(items);
 return page;
}
async function removeCurrentPage(){
 const page=currentPage();
 if('caches'in window){const cache=await caches.open('uonhub-user-saved-v1');await cache.delete(location.href,{ignoreSearch:false})}
 writeSaved(readSaved().filter(item=>item.url!==page.url));
}
function toast(message){
 let node=document.querySelector('.uon-app-toast');
 if(!node){node=document.createElement('div');node.className='uon-app-toast';node.setAttribute('role','status');document.body.append(node)}
 node.textContent=message;node.classList.add('show');clearTimeout(node._timer);node._timer=setTimeout(()=>node.classList.remove('show'),2400);
}
function installStyles(){
 if(document.querySelector('#uonAppCapabilitiesStyle'))return;
 const style=document.createElement('style');style.id='uonAppCapabilitiesStyle';style.textContent=`
 .uon-app-actions{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));z-index:60;display:flex;gap:8px;direction:rtl}
 .uon-app-action{border:1px solid rgba(255,255,255,.16);background:rgba(6,11,27,.92);color:#fff;border-radius:999px;padding:10px 14px;font:700 13px Tajawal,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);backdrop-filter:blur(14px);cursor:pointer}
 .uon-app-action[aria-pressed="true"]{background:#0f766e}.uon-app-toast{position:fixed;left:50%;bottom:82px;transform:translate(-50%,15px);opacity:0;z-index:90;background:#111827;color:#fff;padding:11px 16px;border-radius:12px;transition:.2s;pointer-events:none;font:700 13px Tajawal,sans-serif}.uon-app-toast.show{opacity:1;transform:translate(-50%,0)}
 @media(max-width:700px){.uon-app-actions{left:10px;bottom:max(10px,env(safe-area-inset-bottom))}.uon-app-action{padding:9px 11px;font-size:12px}}
 `;document.head.append(style);
}
function allowedPage(){return !document.body.classList.contains('admin-page')&&!/\/(admin|owner-dashboard|tools-control|reset)(?:\.html)?\/?$/.test(location.pathname)}
function createActions(){
 if(!allowedPage()||document.querySelector('.uon-app-actions'))return;
 installStyles();const wrap=document.createElement('div');wrap.className='uon-app-actions';wrap.setAttribute('aria-label','أدوات التطبيق');
 const save=document.createElement('button');save.className='uon-app-action';save.type='button';save.textContent=isSaved()?'محفوظ ✓':'حفظ دون إنترنت';save.setAttribute('aria-pressed',String(isSaved()));
 save.onclick=async()=>{save.disabled=true;try{if(isSaved()){await removeCurrentPage();save.textContent='حفظ دون إنترنت';save.setAttribute('aria-pressed','false');toast('تم حذف الصفحة من المحفوظات')}else{await cacheCurrentPage();save.textContent='محفوظ ✓';save.setAttribute('aria-pressed','true');toast('تم حفظ الصفحة للاستخدام دون إنترنت')}}catch{toast('تعذر حفظ الصفحة الآن')}finally{save.disabled=false}};
 const share=document.createElement('button');share.className='uon-app-action';share.type='button';share.textContent='مشاركة';share.onclick=async()=>{const data={title:document.title,text:'من UON Hub',url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('تم نسخ الرابط')}}catch(error){if(error?.name!=='AbortError')toast('تعذرت المشاركة')}};
 wrap.append(save,share);document.body.append(wrap);
}
export function bootAppCapabilities(){createActions();window.UONApp={getSavedPages:readSaved,saveCurrentPage:cacheCurrentPage,removeCurrentPage}}
