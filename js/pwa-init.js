const APP_VERSION='39.0.0';
const UON_PWA_TEST_KEY='uonhub_pwa_test_mode';
let deferredInstallPrompt=null;

function normalizeUiPreferences(){
 const language=localStorage.getItem('uon_language');
 const theme=localStorage.getItem('uon_theme');
 if(!['ar','en'].includes(language||''))localStorage.setItem('uon_language','ar');
 if(!['dark','light'].includes(theme||''))localStorage.setItem('uon_theme','dark');
 const lang=localStorage.getItem('uon_language')||'ar';
 const mode=localStorage.getItem('uon_theme')||'dark';
 document.documentElement.lang=lang;
 document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.documentElement.dataset.theme=mode;
 document.body?.setAttribute('data-theme',mode);
 document.body?.setAttribute('data-language',lang);
}

const legacySelectors='.v20-utility-dock,.page-action-dock,.floating-action-dock,[data-v20-favorite],[data-v20-qr],[data-v20-feedback]';
function removeLegacyActionDock(root=document){
 root.querySelectorAll?.(legacySelectors).forEach(element=>{
  const dock=element.closest('.v20-utility-dock,.page-action-dock,.floating-action-dock')||element;
  dock.remove();
 });
}
function installLegacyDockBlocker(){
 if(document.querySelector('#uonLegacyDockBlocker'))return;
 const style=document.createElement('style');
 style.id='uonLegacyDockBlocker';
 style.textContent=`${legacySelectors}{display:none!important;visibility:hidden!important;pointer-events:none!important}`;
 document.head.appendChild(style);
 removeLegacyActionDock();
 let queued=false;
 new MutationObserver(mutations=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
   mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===1)removeLegacyActionDock(node)}));
   queued=false;
  });
 }).observe(document.body,{childList:true,subtree:true});
}

async function installExperience(){
 if(!document.querySelector('link[data-uon-experience]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`/css/experience-v38.css?v=${APP_VERSION}`;
  link.dataset.uonExperience=APP_VERSION;
  document.head.appendChild(link);
 }
 if(document.body.classList.contains('admin-page')||/\/admin(?:\.html)?\/?$/.test(location.pathname))return;
 let button=document.querySelector('.uon-ai-fab');
 if(!button){
  button=document.createElement('a');
  button.className='uon-ai-fab';
  button.href='assistant.html';
  button.dataset.feature='assistant';
  button.setAttribute('aria-label','فتح مساعد UON AI');
  button.innerHTML='<span class="uon-ai-fab__icon">AI</span><span class="uon-ai-fab__label">اسأل UON AI</span>';
  document.body.appendChild(button);
 }
 try{
  const {applyFeatureStates}=await import(`./core.js?v=${APP_VERSION}`);
  await applyFeatureStates(document);
 }catch(error){console.warn('Global experience state unavailable',error)}
}

function applyWhatsAppCommunityBranding(){
 const replacements=new Map([
  ['قناة UON Hub الرسمية على واتساب','مجتمع طلاب جامعة نزوى'],
  ['متابعة القناة ←','الانضمام للمجتمع ←'],
  ['مجموعات المواد والقناة الرسمية.','مجموعات المواد ومجتمع طلاب جامعة نزوى.'],
  ['تابع الإعلانات والتحديثات الجديدة أولًا بأول','انضم للمجتمع وتابع الإعلانات والمجموعات والخدمات الطلابية']
 ]);
 document.querySelectorAll('strong,small,b,p,h1,h2,h3,a,span').forEach(element=>{
  const text=element.textContent?.trim();
  if(text&&replacements.has(text))element.textContent=replacements.get(text);
 });
}
function isPwaTestMode(){
 const params=new URLSearchParams(location.search);
 if(params.get('admin-pwa')==='1')localStorage.setItem(UON_PWA_TEST_KEY,'1');
 if(params.get('admin-pwa')==='0')localStorage.removeItem(UON_PWA_TEST_KEY);
 return localStorage.getItem(UON_PWA_TEST_KEY)==='1';
}
function addIndependentNotice(){
 if(document.querySelector('.uon-independent-notice'))return;
 const footer=document.querySelector('.site-footer');
 if(!footer)return;
 const notice=document.createElement('div');
 notice.className='uon-independent-notice';
 notice.setAttribute('role','note');
 notice.innerHTML='<span class="uon-independent-notice__icon" aria-hidden="true">i</span><p><strong>تنبيه:</strong> UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى.</p>';
 footer.parentNode.insertBefore(notice,footer);
}
function createAdminInstallPanel(){
 if(!isPwaTestMode()||document.querySelector('.uon-pwa-admin-panel'))return;
 const panel=document.createElement('section');
 panel.className='uon-pwa-admin-panel';
 panel.innerHTML='<h3>تجربة تطبيق UON Hub</h3><p id="uonPwaStatus">جاري التحقق من جاهزية التثبيت…</p><div class="uon-pwa-admin-actions"><button class="uon-pwa-install-btn" id="uonPwaInstall" disabled>تثبيت التطبيق</button><button class="uon-pwa-close-btn" id="uonPwaClose">إخفاء وضع التجربة</button></div>';
 document.body.appendChild(panel);
 panel.querySelector('#uonPwaClose').onclick=()=>{localStorage.removeItem(UON_PWA_TEST_KEY);panel.remove()};
 const install=panel.querySelector('#uonPwaInstall');
 const status=panel.querySelector('#uonPwaStatus');
 const sync=()=>{
  install.disabled=!deferredInstallPrompt;
  status.textContent=deferredInstallPrompt?'التطبيق جاهز للتثبيت.':'التثبيت غير متاح حاليًا أو التطبيق مثبت مسبقًا.';
 };
 install.onclick=async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  sync();
 };
 sync();
}

window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();
 deferredInstallPrompt=event;
 document.querySelector('#uonPwaInstall')?.removeAttribute('disabled');
 const status=document.querySelector('#uonPwaStatus');
 if(status)status.textContent='التطبيق جاهز للتثبيت.';
});
async function registerPwa(){
 if(!('serviceWorker'in navigator))return;
 try{
  const registration=await navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`,{scope:'/'});
  await registration.update();
  if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
 }catch(error){console.warn('PWA registration failed:',error)}
}
async function loadAdminEnhancements(){
 const isAdmin=document.body.classList.contains('admin-page')||/\/admin(?:\.html)?\/?$/.test(location.pathname);
 if(!isAdmin)return;
 try{await import(`./admin-v39-fixes.js?v=${APP_VERSION}`)}catch(error){console.error('Admin V39 enhancements failed',error)}
}

normalizeUiPreferences();
document.addEventListener('DOMContentLoaded',()=>{
 normalizeUiPreferences();
 installLegacyDockBlocker();
 installExperience();
 applyWhatsAppCommunityBranding();
 addIndependentNotice();
 createAdminInstallPanel();
 loadAdminEnhancements();
 registerPwa();
});
