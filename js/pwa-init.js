const APP_VERSION='44.1.1';
const TEST_KEY='uonhub_pwa_test_mode';
let deferredInstallPrompt=null;

function isAdminPage(){return document.body.classList.contains('admin-page')||/\/(admin|owner-dashboard|tools-control)(?:\.html)?\/?$/.test(location.pathname)}
function isTestMode(){const params=new URLSearchParams(location.search);if(params.get('admin-pwa')==='1')localStorage.setItem(TEST_KEY,'1');if(params.get('admin-pwa')==='0')localStorage.removeItem(TEST_KEY);return localStorage.getItem(TEST_KEY)==='1'}
function removeLegacyDocks(){document.querySelectorAll('.v20-utility-dock,.page-action-dock,.floating-action-dock,[data-v20-favorite],[data-v20-qr],[data-v20-feedback]').forEach(element=>(element.closest('.v20-utility-dock,.page-action-dock,.floating-action-dock')||element).remove())}
function installLegacyDockGuard(){if(document.querySelector('#uonLegacyDockGuard'))return;const style=document.createElement('style');style.id='uonLegacyDockGuard';style.textContent='.v20-utility-dock,.page-action-dock,.floating-action-dock,[data-v20-favorite],[data-v20-qr],[data-v20-feedback]{display:none!important}';document.head.append(style);removeLegacyDocks()}
function addIndependentNotice(){if(document.querySelector('.uon-independent-notice'))return;const footer=document.querySelector('.site-footer');if(!footer)return;const notice=document.createElement('div');notice.className='uon-independent-notice';notice.setAttribute('role','note');notice.innerHTML='<span class="uon-independent-notice__icon" aria-hidden="true">i</span><p data-ar="تنبيه: UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى." data-en="Notice: UON Hub is an independent student project and is not officially affiliated with the University of Nizwa.">تنبيه: UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى.</p>';footer.parentNode.insertBefore(notice,footer)}
function addAiButton(){if(isAdminPage()||document.querySelector('.uon-ai-fab'))return;const button=document.createElement('a');button.className='uon-ai-fab';button.href='assistant.html';button.dataset.feature='assistant';button.setAttribute('aria-label','UON AI');button.innerHTML='<span class="uon-ai-fab__icon">AI</span><span class="uon-ai-fab__label" data-ar="اسأل UON AI" data-en="Ask UON AI">اسأل UON AI</span>';document.body.append(button)}
function applyVisibility(state,root=document){const map=state?.visibility||{};root.querySelectorAll('[data-feature]').forEach(element=>{const key=element.dataset.feature;if(key&&map[key]===false)element.hidden=true;else if(key&&map[key]===true){element.hidden=false;element.style.removeProperty('display')}})}
function fixWhatsAppLogo(root=document){
 const logo='<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="15" fill="#25D366"/><path fill="#fff" d="M23.2 18.7c-.4-.2-2.3-1.1-2.7-1.2-.4-.1-.6-.2-.9.2-.3.4-1 1.2-1.2 1.5-.2.3-.5.3-.9.1-2.2-1.1-3.7-2-5.2-4.5-.4-.7.4-.7 1.1-1.7.1-.3.1-.5 0-.7-.1-.2-.9-2.1-1.2-2.9-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 4 1.7 4.3c.2.3 2.9 4.5 7.1 6.3 2.6 1.1 3.6 1.2 4.9 1 .8-.1 2.3-.9 2.6-1.8.3-.9.3-1.7.2-1.8-.1-.2-.4-.3-.8-.5Z"/><path fill="#fff" d="M16 3a13 13 0 0 0-11 20l-1.7 6 6.2-1.6A13 13 0 1 0 16 3Zm0 23.6c-2.1 0-4.1-.6-5.8-1.6l-.4-.2-3.7 1 1-3.6-.2-.4A10.6 10.6 0 1 1 16 26.6Z"/></svg>';
 const selectors='[data-tool-key="groups"] .h37-service-icon,a.uon44-secondary-card[data-tool-key="groups"]>span:first-child,.uon44-tool-card[data-tool-key="groups"] .tool-icon';
 root.querySelectorAll(selectors).forEach(element=>{
  element.innerHTML=logo;
  element.style.setProperty('background-image','none','important');
  element.style.setProperty('color','inherit','important');
  element.style.setProperty('font-size','initial','important');
  element.style.setProperty('display','flex','important');
  element.style.setProperty('align-items','center','important');
  element.style.setProperty('justify-content','center','important');
  element.style.setProperty('overflow','visible','important');
  if(element.matches('a.uon44-secondary-card[data-tool-key="groups"]>span:first-child')){
   element.style.setProperty('width','34px','important');
   element.style.setProperty('height','34px','important');
   element.style.setProperty('flex','0 0 34px','important');
  }else{
   element.style.setProperty('width','52px','important');
   element.style.setProperty('height','52px','important');
  }
 });
}
function watchWhatsAppLogo(){
 fixWhatsAppLogo();
 let queued=false;
 const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;fixWhatsAppLogo()});
 });
 observer.observe(document.body,{childList:true,subtree:true});
 setTimeout(()=>observer.disconnect(),30000);
}
function activateUpdateSilently(registration){document.querySelector('#uonPwaUpdate')?.remove();registration.waiting?.postMessage({type:'SKIP_WAITING'})}
function createAdminInstallPanel(){if(!isTestMode()||document.querySelector('.uon-pwa-admin-panel'))return;const panel=document.createElement('section');panel.className='uon-pwa-admin-panel';panel.innerHTML='<h3>تجربة تطبيق UON Hub</h3><p id="uonPwaStatus">جاري التحقق من جاهزية التثبيت…</p><div class="uon-pwa-admin-actions"><button class="uon-pwa-install-btn" id="uonPwaInstall" disabled>تثبيت التطبيق</button><button class="uon-pwa-close-btn" id="uonPwaClose">إخفاء وضع التجربة</button></div>';document.body.append(panel);const installButton=panel.querySelector('#uonPwaInstall'),status=panel.querySelector('#uonPwaStatus');const sync=()=>{installButton.disabled=!deferredInstallPrompt;status.textContent=deferredInstallPrompt?'التطبيق جاهز للتثبيت.':'استخدم إضافة إلى الشاشة الرئيسية من قائمة المتصفح.'};installButton.onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice.catch(()=>null);deferredInstallPrompt=null;sync()};panel.querySelector('#uonPwaClose').onclick=()=>{localStorage.removeItem(TEST_KEY);panel.remove()};sync()}
async function registerServiceWorker(){if(!('serviceWorker'in navigator)||location.protocol!=='https:')return;try{const registration=await navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`,{scope:'/',updateViaCache:'none'});registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)activateUpdateSilently(registration)})});if(registration.waiting&&navigator.serviceWorker.controller)activateUpdateSilently(registration);setTimeout(()=>registration.update().catch(()=>{}),1500)}catch(error){console.warn('PWA registration failed',error)}}
async function bootUnifiedExperience(){
 try{
  const registry=await import(`./tool-registry-v44.js?v=${APP_VERSION}`);
  await registry.bootUnifiedTools();
  fixWhatsAppLogo();
  // The H37 home renderer may replace the legacy home cards after this module boots.
  // Wait only for that one replacement, then disconnect to avoid a mutation/render loop.
  if(!document.querySelector('.h37-services')&&document.querySelector('.v18-primary-tools')){
   const observeHome=new MutationObserver(async()=>{
    if(!document.querySelector('.h37-services'))return;
    observeHome.disconnect();
    await registry.renderHomeTools();
    fixWhatsAppLogo();
   });
   observeHome.observe(document.body,{childList:true,subtree:true});
   setTimeout(()=>observeHome.disconnect(),12000);
  }
  const experience=await import(`./platform-experience-v44.js?v=${APP_VERSION}`);
  experience.bootPlatformExperience();
 }catch(error){console.warn('Unified tools V44 skipped',error)}
}
async function boot(){
 document.querySelector('#uonPwaUpdate')?.remove();
 installLegacyDockGuard();addIndependentNotice();addAiButton();createAdminInstallPanel();
 await registerServiceWorker();
 try{const{installLanguageLayer}=await import(`./language-v41.js?v=${APP_VERSION}`);installLanguageLayer()}catch(error){console.warn('Language layer failed',error)}
 await bootUnifiedExperience();
 watchWhatsAppLogo();
 try{const{applyFeatureStates}=await import(`./core.js?v=${APP_VERSION}`);const state=await applyFeatureStates(document);applyVisibility(state,document);setTimeout(()=>{applyVisibility(state,document);fixWhatsAppLogo()},1200)}catch(error){console.warn('Feature state bootstrap skipped',error)}
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;document.querySelector('#uonPwaInstall')?.removeAttribute('disabled')});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null});
window.addEventListener('online',()=>document.body.classList.remove('uon-offline'));
window.addEventListener('offline',()=>document.body.classList.add('uon-offline'));
if(!navigator.onLine)document.body.classList.add('uon-offline');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
