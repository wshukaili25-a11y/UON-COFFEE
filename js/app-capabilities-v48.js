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
 .uon-quick-tools{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));z-index:88;font-family:Tajawal,sans-serif;direction:rtl}
 .uon-quick-toggle{width:44px;height:44px;border:1px solid rgba(130,155,195,.34);border-radius:15px;background:rgba(8,17,34,.92);color:#fff;display:grid;place-items:center;font:900 22px/1 system-ui;box-shadow:0 8px 22px rgba(0,0,0,.3);backdrop-filter:blur(14px);cursor:pointer;transition:.18s}
 .uon-quick-toggle:active{transform:scale(.94)}
 .uon-quick-toggle[aria-expanded="true"]{background:#6478eb;border-color:#8190ff;transform:rotate(45deg)}
 .uon-quick-menu{position:absolute;left:0;bottom:52px;width:154px;padding:6px;border:1px solid rgba(130,155,195,.24);border-radius:17px;background:rgba(8,17,34,.96);box-shadow:0 16px 38px rgba(0,0,0,.36);backdrop-filter:blur(18px);display:grid;gap:3px;opacity:0;visibility:hidden;transform:translateY(8px) scale(.97);transform-origin:bottom left;transition:.17s}
 .uon-quick-menu.open{opacity:1;visibility:visible;transform:none}
 .uon-quick-item{width:100%;height:36px;border:0;border-radius:11px;background:transparent;color:#eef3ff;padding:0 10px;display:flex;align-items:center;justify-content:flex-start;gap:9px;font:700 12px Tajawal,sans-serif;cursor:pointer;text-align:right}
 .uon-quick-item:hover,.uon-quick-item:focus-visible{background:rgba(118,139,246,.16);outline:none}
 .uon-quick-item .uon-quick-icon{width:20px;text-align:center;font-size:14px;line-height:1}
 .uon-quick-item.saved{color:#6ee7c2;background:rgba(20,184,150,.1)}
 .uon-app-toast{position:fixed;left:50%;bottom:70px;transform:translate(-50%,12px);opacity:0;z-index:95;background:#111827;color:#fff;padding:10px 14px;border-radius:11px;transition:.2s;pointer-events:none;font:700 12px Tajawal,sans-serif;white-space:nowrap}.uon-app-toast.show{opacity:1;transform:translate(-50%,0)}
 @media(max-width:700px){
  .uon-quick-tools{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom))}
  .uon-quick-toggle{width:40px;height:40px;border-radius:13px;font-size:20px}
  .uon-quick-menu{bottom:47px;width:146px;border-radius:15px}
  .uon-quick-item{height:34px;font-size:11.5px}
 }
 `;document.head.append(style);
}
function allowedPage(){return !document.body.classList.contains('admin-page')&&!/\/(admin|owner-dashboard|tools-control|reset)(?:\.html)?\/?$/.test(location.pathname)}
function createActions(){
 if(!allowedPage()||document.querySelector('.uon-quick-tools'))return;
 installStyles();
 const root=document.createElement('div');root.className='uon-quick-tools';
 const menu=document.createElement('div');menu.className='uon-quick-menu';menu.id='uonQuickMenu';menu.setAttribute('role','menu');
 const toggle=document.createElement('button');toggle.className='uon-quick-toggle';toggle.type='button';toggle.setAttribute('aria-label','خيارات الصفحة');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',menu.id);toggle.textContent='⋯';
 const makeItem=(icon,label,handler)=>{const button=document.createElement('button');button.className='uon-quick-item';button.type='button';button.setAttribute('role','menuitem');button.innerHTML=`<span class="uon-quick-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;button.onclick=handler;return button};
 const save=makeItem('⌑',isSaved()?'محفوظ':'حفظ الصفحة',async()=>{save.disabled=true;try{if(isSaved()){await removeCurrentPage();save.classList.remove('saved');save.querySelector('span:last-child').textContent='حفظ الصفحة';toast('تم حذف الصفحة من المحفوظات')}else{await cacheCurrentPage();save.classList.add('saved');save.querySelector('span:last-child').textContent='محفوظ';toast('تم حفظ الصفحة دون إنترنت')}}catch{toast('تعذر حفظ الصفحة الآن')}finally{save.disabled=false}});if(isSaved())save.classList.add('saved');
 const share=makeItem('↗','مشاركة',async()=>{const data={title:document.title,text:'من UON Hub',url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('تم نسخ الرابط')}}catch(error){if(error?.name!=='AbortError')toast('تعذرت المشاركة')}});
 const search=makeItem('⌕','بحث شامل',()=>{const selected=window.getSelection()?.toString().trim()||'';location.href=`/search.html${selected?`?q=${encodeURIComponent(selected)}`:''}`});
 const report=makeItem('⚑','بلاغ',()=>document.dispatchEvent(new CustomEvent('uon:report-tool',{detail:{key:''}})));
 menu.append(save,share,search,report);root.append(menu,toggle);document.body.append(root);
 const close=()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='⋯'};
 toggle.onclick=()=>{const open=!menu.classList.contains('open');menu.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'⋯'};
 document.addEventListener('click',event=>{if(!root.contains(event.target))close()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
 menu.addEventListener('click',event=>{if(event.target.closest('.uon-quick-item'))setTimeout(close,80)});
}
export function bootAppCapabilities(){createActions();window.UONApp={getSavedPages:readSaved,saveCurrentPage:cacheCurrentPage,removeCurrentPage}}
