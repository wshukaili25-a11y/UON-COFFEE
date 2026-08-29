const shown=new Set();

(function installUnifiedTheme(){
 document.querySelectorAll('link[data-uon-green-theme]').forEach(x=>x.remove());
 const files=['/css/uon-green-theme.css?v=2.1.0','/css/uon-green-v18-fix.css?v=1.1.0'];
 const links=files.map(href=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.uonGreenTheme='1';document.head.appendChild(link);return link});
 const moveLast=()=>links.forEach(link=>{if(link.parentNode){link.remove();document.head.appendChild(link)}});
 addEventListener('load',()=>{moveLast();setTimeout(moveLast,150);setTimeout(moveLast,800)},{once:true});
})();

function forceGreenHomepageAccents(){
 if(!(location.pathname==='/'||location.pathname.endsWith('/index.html')))return;
 const whatsapp=document.querySelector('.v18-primary-tools a[data-feature="groups"]');
 if(whatsapp){
  whatsapp.style.setProperty('background','#fff','important');
  whatsapp.style.setProperty('border-color','#d5e6dc','important');
  whatsapp.style.setProperty('color','#13251c','important');
  const icon=whatsapp.querySelector('.v18-tool-icon,.v18-wa-icon');
  if(icon){
   icon.style.setProperty('background','#edf7f1','important');
   icon.style.setProperty('border-color','#c8e1d3','important');
   icon.style.setProperty('color','#0f7a4b','important');
   icon.style.setProperty('box-shadow','none','important');
   icon.querySelectorAll('*').forEach(el=>{
    el.style.setProperty('color','#0f7a4b','important');
    el.style.setProperty('stroke','#0f7a4b','important');
    el.style.setProperty('fill','#0f7a4b','important');
   });
  }
 }
 const university=document.querySelector('.v20-stat-card.university');
 if(university){
  university.style.setProperty('background','linear-gradient(145deg,#fff,#edf7f1)','important');
  university.style.setProperty('border-color','#c7dfd2','important');
  university.style.setProperty('box-shadow','0 8px 28px rgba(15,122,75,.055)','important');
  const code=university.querySelector('.v20-university-code');
  if(code){
   code.style.setProperty('color','#0f7a4b','important');
   code.style.setProperty('-webkit-text-fill-color','#0f7a4b','important');
   code.style.setProperty('background','none','important');
   code.style.setProperty('text-shadow','none','important');
  }
 }
}

function installGreenAccentGuard(){
 const run=()=>forceGreenHomepageAccents();
 run();
 [50,150,400,900,1500,3000].forEach(ms=>setTimeout(run,ms));
 addEventListener('load',()=>{run();setTimeout(run,250);setTimeout(run,1200)},{once:true});
 const observer=new MutationObserver(run);
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-theme']});
}
installGreenAccentGuard();

function showMessage(message,type='error'){
 const key=`${type}:${message}`;
 if(shown.has(key))return;
 shown.add(key);
 let box=document.querySelector('#runtimeGuardMessage');
 if(!box){
  box=document.createElement('div');
  box.id='runtimeGuardMessage';
  box.className='runtime-guard-message';
  box.innerHTML='<button aria-label="إغلاق">✕</button><strong></strong><p></p>';
  document.body.appendChild(box);
  box.querySelector('button').onclick=()=>box.classList.remove('show');
 }
 box.dataset.type=type;
 box.querySelector('strong').textContent=type==='offline'?'لا يوجد اتصال بالإنترنت':'حدث خطأ بسيط';
 box.querySelector('p').textContent=message;
 box.classList.add('show');
 setTimeout(()=>box.classList.remove('show'),5000);
}

addEventListener('offline',()=>showMessage('تحقق من الاتصال ثم حاول مرة أخرى.','offline'));
addEventListener('online',()=>{
 const box=document.querySelector('#runtimeGuardMessage');
 if(box){
  box.dataset.type='success';
  box.querySelector('strong').textContent='عاد الاتصال';
  box.querySelector('p').textContent='يمكنك متابعة استخدام المنصة.';
  box.classList.add('show');
  setTimeout(()=>box.classList.remove('show'),2500);
 }
});
addEventListener('unhandledrejection',event=>{
 console.error('Unhandled promise rejection:',event.reason);
 if(!navigator.onLine)return;
 const technical=String(event.reason?.message||event.reason||'');
 if(/COURSES_FEATURE_DISABLED|FEATURE_DISABLED/i.test(technical))return;
 showMessage('تعذر إكمال العملية حاليًا. حدّث الصفحة أو حاول مرة أخرى.');
});
addEventListener('error',event=>console.error('Runtime error:',event.error||event.message));

const isHomePage=()=>location.pathname==='/'||location.pathname.endsWith('/index.html');

function installSupportStyles(){
 if(document.querySelector('#uonSupportCentersStyle'))return;
 const style=document.createElement('style');
 style.id='uonSupportCentersStyle';
 style.textContent=`
 .uon-support-centers{position:relative}
 .uon-support-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .uon-support-card.h37-service{min-height:180px}
 .uon-support-tool-icon.h37-service-icon{display:grid;place-items:center;width:54px;height:54px;margin:0 0 22px;border:1px solid rgba(15,122,75,.28);border-radius:16px;background:rgba(15,122,75,.055);color:#0f7a4b;box-shadow:inset 0 1px rgba(255,255,255,.04)}
 .uon-support-tool-icon svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
 .uon-support-card.h37-service strong{font-size:16px;line-height:1.55}
 .uon-support-card.h37-service small{line-height:1.7;margin-top:auto;padding-top:10px}
 @media(max-width:650px){.uon-support-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.uon-support-card.h37-service{min-height:145px}}
 `;
 document.head.append(style);
}

function supportMarkup(){
 return `<section class="h37-section uon-support-centers" aria-labelledby="uonSupportCentersTitle"><div class="h37-container"><div class="h37-head h37-reveal visible"><div><h2 id="uonSupportCentersTitle">مراكز الدعم الأكاديمي</h2><p>خدمات مساندة للطالب بنفس نظام أدوات المنصة.</p></div></div><div class="uon-support-grid h37-reveal visible"><a class="h37-service uon-support-card" href="https://portal.unizwa.edu.om/twc/" target="_blank" rel="noopener noreferrer" aria-label="فتح حجز مركز أنجز"><span class="h37-service-icon uon-support-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 5.5c2.6-2.6 5.8-2.8 5.8-2.8s-.2 3.2-2.8 5.8l-4.2 4.2-2-2 3.2-5.2Z"/><path d="m11.3 10.7-3.8-.2-3 3 5.1 1.1M13.3 12.7l.2 3.8-3 3-1.1-5.1M16.8 7.2h.01M6.5 17.5c-1.2.2-2.3 1.3-2.5 2.5 1.2-.2 2.3-1.3 2.5-2.5Z"/></svg></span><strong>مركز أنجز</strong><small>دعم طلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.</small></a><a class="h37-service uon-support-card" href="https://portal.unizwa.edu.om/twc/" target="_blank" rel="noopener noreferrer" aria-label="فتح حجز مركز تعزيز مسالك التعلم"><span class="h37-service-icon uon-support-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v4.2c2.8 2.1 7.2 2.1 10 0V12M21 9v6"/></svg></span><strong>مركز تعزيز مسالك التعلم</strong><small>جلسات دعم أكاديمي وورش مساندة لطلاب التخصص في المواد الأساسية.</small></a></div></div></section>`;
}

function ensureSupportCenters(){
 if(!isHomePage())return true;
 const main=document.querySelector('main.home37');
 if(!main)return false;
 if(main.querySelector('.uon-support-centers'))return true;
 const toolsSection=main.querySelector('.h37-services')?.closest('.h37-section');
 if(!toolsSection)return false;
 installSupportStyles();
 toolsSection.insertAdjacentHTML('afterend',supportMarkup());
 return true;
}
if(isHomePage()){
 ensureSupportCenters();
 const observer=new MutationObserver(()=>ensureSupportCenters());
 observer.observe(document.documentElement,{childList:true,subtree:true});
 [100,500,1500,4000].forEach(ms=>setTimeout(()=>ensureSupportCenters(),ms));
}
