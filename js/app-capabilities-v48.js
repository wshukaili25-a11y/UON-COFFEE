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
 .uon-app-actions{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:80;display:flex;flex-direction:column;align-items:stretch;gap:6px;width:138px;direction:rtl}
 .uon-app-actions>.uon-app-action,.uon-app-actions>.uon44-command-button,.uon-app-actions>.uon44-report-page{position:static!important;inset:auto!important;margin:0!important;transform:none!important;width:100%!important;min-width:0!important;max-width:none!important;min-height:36px!important;height:36px!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;border:1px solid rgba(255,255,255,.14)!important;background:rgba(6,11,27,.9)!important;color:#fff!important;border-radius:14px!important;padding:0 11px!important;font:700 12px Tajawal,sans-serif!important;line-height:1!important;box-shadow:0 7px 18px rgba(0,0,0,.24)!important;backdrop-filter:blur(12px)!important;white-space:nowrap!important;cursor:pointer!important}
 .uon-app-actions>.uon44-report-page{background:rgba(255,255,255,.96)!important;color:#1687e8!important;border-color:rgba(22,135,232,.16)!important}
 .uon-app-actions>.uon44-command-button kbd{display:none!important}
 .uon-app-actions>.uon44-command-button span:first-child{font-size:14px!important}
 .uon-app-action[aria-pressed="true"]{background:rgba(15,118,110,.94)!important}
 .uon-app-toast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,15px);opacity:0;z-index:90;background:#111827;color:#fff;padding:10px 14px;border-radius:11px;transition:.2s;pointer-events:none;font:700 12px Tajawal,sans-serif}.uon-app-toast.show{opacity:1;transform:translate(-50%,0)}
 @media(max-width:700px){
  .uon-app-actions{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));width:126px;gap:5px}
  .uon-app-actions>.uon-app-action,.uon-app-actions>.uon44-command-button,.uon-app-actions>.uon44-report-page{height:34px!important;min-height:34px!important;border-radius:13px!important;padding:0 9px!important;font-size:11.5px!important}
  .uon-app-toast{bottom:54px}
 }
 `;document.head.append(style);
}
function allowedPage(){return !document.body.classList.contains('admin-page')&&!/\/(admin|owner-dashboard|tools-control|reset)(?:\.html)?\/?$/.test(location.pathname)}
function moveSharedButtons(wrap){
 const report=document.querySelector('.uon44-report-page');
 const search=document.querySelector('.uon44-command-button');
 if(report&&report.parentElement!==wrap)wrap.prepend(report);
 if(search&&search.parentElement!==wrap)wrap.append(search);
}
function createActions(){
 if(!allowedPage()||document.querySelector('.uon-app-actions'))return;
 installStyles();const wrap=document.createElement('div');wrap.className='uon-app-actions';wrap.setAttribute('aria-label','أدوات التطبيق');
 const save=document.createElement('button');save.className='uon-app-action';save.type='button';save.textContent=isSaved()?'محفوظ ✓':'حفظ';save.setAttribute('aria-pressed',String(isSaved()));
 save.onclick=async()=>{save.disabled=true;try{if(isSaved()){await removeCurrentPage();save.textContent='حفظ';save.setAttribute('aria-pressed','false');toast('تم حذف الصفحة من المحفوظات')}else{await cacheCurrentPage();save.textContent='محفوظ ✓';save.setAttribute('aria-pressed','true');toast('تم حفظ الصفحة للاستخدام دون إنترنت')}}catch{toast('تعذر حفظ الصفحة الآن')}finally{save.disabled=false}};
 const share=document.createElement('button');share.className='uon-app-action';share.type='button';share.textContent='مشاركة';share.onclick=async()=>{const data={title:document.title,text:'من UON Hub',url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('تم نسخ الرابط')}}catch(error){if(error?.name!=='AbortError')toast('تعذرت المشاركة')}};
 wrap.append(save,share);document.body.append(wrap);moveSharedButtons(wrap);
 const observer=new MutationObserver(()=>moveSharedButtons(wrap));observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});setTimeout(()=>observer.disconnect(),12000);
}
export function bootAppCapabilities(){createActions();window.UONApp={getSavedPages:readSaved,saveCurrentPage:cacheCurrentPage,removeCurrentPage}}
