const APP_VERSION='41.0.1';
const TEST_KEY='uonhub_pwa_test_mode';
let deferredInstallPrompt=null;

function isAdminPage(){
 return document.body.classList.contains('admin-page')||/\/admin(?:\.html)?\/?$/.test(location.pathname);
}
function isTestMode(){
 const params=new URLSearchParams(location.search);
 if(params.get('admin-pwa')==='1')localStorage.setItem(TEST_KEY,'1');
 if(params.get('admin-pwa')==='0')localStorage.removeItem(TEST_KEY);
 return localStorage.getItem(TEST_KEY)==='1';
}
function removeLegacyDocks(){
 document.querySelectorAll('.v20-utility-dock,.page-action-dock,.floating-action-dock,[data-v20-favorite],[data-v20-qr],[data-v20-feedback]').forEach(element=>{
  const host=element.closest('.v20-utility-dock,.page-action-dock,.floating-action-dock')||element;
  host.remove();
 });
}
function installLegacyDockGuard(){
 if(document.querySelector('#uonLegacyDockGuard'))return;
 const style=document.createElement('style');
 style.id='uonLegacyDockGuard';
 style.textContent='.v20-utility-dock,.page-action-dock,.floating-action-dock,[data-v20-favorite],[data-v20-qr],[data-v20-feedback]{display:none!important}';
 document.head.append(style);
 removeLegacyDocks();
}
function addIndependentNotice(){
 if(document.querySelector('.uon-independent-notice'))return;
 const footer=document.querySelector('.site-footer');
 if(!footer)return;
 const notice=document.createElement('div');
 notice.className='uon-independent-notice';
 notice.setAttribute('role','note');
 notice.innerHTML='<span class="uon-independent-notice__icon" aria-hidden="true">i</span><p data-ar="تنبيه: UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى." data-en="Notice: UON Hub is an independent student project and is not officially affiliated with the University of Nizwa.">تنبيه: UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى.</p>';
 footer.parentNode.insertBefore(notice,footer);
}
function addAiButton(){
 if(isAdminPage()||document.querySelector('.uon-ai-fab'))return;
 const button=document.createElement('a');
 button.className='uon-ai-fab';
 button.href='assistant.html';
 button.dataset.feature='assistant';
 button.setAttribute('aria-label','UON AI');
 button.innerHTML='<span class="uon-ai-fab__icon">AI</span><span class="uon-ai-fab__label" data-ar="اسأل UON AI" data-en="Ask UON AI">اسأل UON AI</span>';
 document.body.append(button);
}
function createAdminInstallPanel(){
 if(!isTestMode()||document.querySelector('.uon-pwa-admin-panel'))return;
 const panel=document.createElement('section');
 panel.className='uon-pwa-admin-panel';
 panel.innerHTML='<h3>تجربة تطبيق UON Hub</h3><p id="uonPwaStatus">جاري التحقق من جاهزية التثبيت…</p><div class="uon-pwa-admin-actions"><button class="uon-pwa-install-btn" id="uonPwaInstall" disabled>تثبيت التطبيق</button><button class="uon-pwa-close-btn" id="uonPwaClose">إخفاء وضع التجربة</button></div>';
 document.body.append(panel);
 const installButton=panel.querySelector('#uonPwaInstall');
 const status=panel.querySelector('#uonPwaStatus');
 const sync=()=>{
  installButton.disabled=!deferredInstallPrompt;
  status.textContent=deferredInstallPrompt?'التطبيق جاهز للتثبيت.':'استخدم إضافة إلى الشاشة الرئيسية من قائمة المتصفح.';
 };
 installButton.onclick=async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(()=>null);
  deferredInstallPrompt=null;
  sync();
 };
 panel.querySelector('#uonPwaClose').onclick=()=>{localStorage.removeItem(TEST_KEY);panel.remove()};
 sync();
}
async function registerServiceWorker(){
 if(!('serviceWorker'in navigator))return;
 try{
  const registration=await navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`,{scope:'/',updateViaCache:'none'});
  await registration.update().catch(()=>{});
  if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(sessionStorage.getItem('uon_sw_reloaded')==='1')return;
   sessionStorage.setItem('uon_sw_reloaded','1');
   location.reload();
  },{once:true});
 }catch(error){console.warn('PWA registration failed',error)}
}
async function boot(){
 installLegacyDockGuard();
 addIndependentNotice();
 addAiButton();
 createAdminInstallPanel();
 await registerServiceWorker();
 try{
  const {installLanguageLayer}=await import(`./language-v41.js?v=${APP_VERSION}`);
  installLanguageLayer();
 }catch(error){console.warn('Language layer failed',error)}
 try{
  const {applyFeatureStates}=await import(`./core.js?v=${APP_VERSION}`);
  await applyFeatureStates(document);
 }catch(error){console.warn('Feature state bootstrap skipped',error)}
}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();
 deferredInstallPrompt=event;
 document.querySelector('#uonPwaInstall')?.removeAttribute('disabled');
});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
