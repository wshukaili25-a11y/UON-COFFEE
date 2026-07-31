const UON_PWA_TEST_KEY = 'uonhub_pwa_test_mode';
let deferredInstallPrompt = null;

function removeLegacyActionDock(){
  const selectors = [
    '.v20-utility-dock',
    '.page-action-dock',
    '.floating-action-dock',
    '[data-v20-favorite]',
    '[data-v20-qr]',
    '[data-v20-feedback]'
  ];
  document.querySelectorAll(selectors.join(',')).forEach(element=>{
    const dock = element.closest('.v20-utility-dock,.page-action-dock,.floating-action-dock') || element;
    dock.remove();
  });
}

function installLegacyDockBlocker(){
  if(document.querySelector('#uonLegacyDockBlocker')) return;
  const style = document.createElement('style');
  style.id = 'uonLegacyDockBlocker';
  style.textContent = '.v20-utility-dock,.page-action-dock,.floating-action-dock,[data-v20-favorite],[data-v20-qr],[data-v20-feedback]{display:none!important;visibility:hidden!important;pointer-events:none!important}';
  document.head.appendChild(style);
  removeLegacyActionDock();
  const observer = new MutationObserver(()=>removeLegacyActionDock());
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

function isPwaTestMode(){
  const params = new URLSearchParams(location.search);
  if(params.get('admin-pwa') === '1') localStorage.setItem(UON_PWA_TEST_KEY,'1');
  if(params.get('admin-pwa') === '0') localStorage.removeItem(UON_PWA_TEST_KEY);
  return localStorage.getItem(UON_PWA_TEST_KEY) === '1';
}

function addIndependentNotice(){
  if(document.querySelector('.uon-independent-notice')) return;
  const footer = document.querySelector('.site-footer');
  if(!footer) return;
  const notice = document.createElement('div');
  notice.className = 'uon-independent-notice';
  notice.setAttribute('role','note');
  notice.setAttribute('aria-label','تنبيه عن طبيعة الموقع');
  notice.innerHTML = '<span class="uon-independent-notice__icon" aria-hidden="true">i</span><p><strong>تنبيه:</strong> UON Hub هو مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى. جميع الشعارات والأسماء المستخدمة تعود لمالكيها، ويهدف الموقع إلى تسهيل وصول الطلبة إلى الخدمات والمعلومات.</p>';
  const container = footer.querySelector('.container') || footer;
  container.insertBefore(notice, container.firstChild);
}

function createAdminInstallPanel(){
  if(!isPwaTestMode() || document.querySelector('.uon-pwa-admin-panel')) return;
  const panel = document.createElement('section');
  panel.className = 'uon-pwa-admin-panel';
  panel.setAttribute('aria-label','اختبار تطبيق UON Hub للمشرفين');
  panel.innerHTML = '<h3>تجربة تطبيق UON Hub</h3><p id="uonPwaStatus">جاري التحقق من جاهزية التثبيت…</p><div class="uon-pwa-admin-actions"><button class="uon-pwa-install-btn" id="uonPwaInstall" disabled>تثبيت التطبيق</button><button class="uon-pwa-close-btn" id="uonPwaClose">إخفاء وضع التجربة</button></div>';
  document.body.appendChild(panel);
  const installBtn = panel.querySelector('#uonPwaInstall');
  const status = panel.querySelector('#uonPwaStatus');
  const closeBtn = panel.querySelector('#uonPwaClose');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if(standalone){status.textContent='التطبيق مثبت ويعمل بوضع مستقل.';installBtn.textContent='مثبّت بالفعل';}
  else if(deferredInstallPrompt){status.textContent='التطبيق جاهز للتثبيت على هذا الجهاز.';installBtn.disabled=false;}
  else{status.textContent='التطبيق جاهز، وقد يحتاج المتصفح عدة ثوانٍ لإظهار خيار التثبيت.';}
  installBtn.addEventListener('click',async()=>{
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.disabled = true;
    status.textContent = choice.outcome === 'accepted' ? 'تم قبول تثبيت التطبيق.' : 'تم إلغاء التثبيت.';
  });
  closeBtn.addEventListener('click',()=>{localStorage.removeItem(UON_PWA_TEST_KEY);panel.remove();});
}

window.addEventListener('beforeinstallprompt',(event)=>{
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = document.querySelector('#uonPwaInstall');
  const status = document.querySelector('#uonPwaStatus');
  if(btn){btn.disabled=false;if(status)status.textContent='التطبيق جاهز للتثبيت على هذا الجهاز.';}
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  const status=document.querySelector('#uonPwaStatus');
  const btn=document.querySelector('#uonPwaInstall');
  if(status)status.textContent='تم تثبيت التطبيق بنجاح.';
  if(btn){btn.disabled=true;btn.textContent='مثبّت بالفعل';}
});

async function registerPwa(){
  if(!('serviceWorker' in navigator)) return;
  try{await navigator.serviceWorker.register('/sw.js',{scope:'/'});}catch(error){console.warn('PWA registration failed:',error);}
}

installLegacyDockBlocker();
document.addEventListener('DOMContentLoaded',()=>{removeLegacyActionDock();addIndependentNotice();createAdminInstallPanel();registerPwa();});
