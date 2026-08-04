const shown=new Set();

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
 .uon-support-card.h37-service{min-height:220px;padding:18px;display:flex;flex-direction:column;justify-content:flex-start}
 .uon-support-card .h37-service-icon{margin-bottom:15px}
 .uon-support-kicker{display:inline-flex;width:max-content;max-width:100%;margin-bottom:9px;padding:5px 9px;border:1px solid var(--h-border);border-radius:999px;background:#ffffff08;font-size:11px;font-weight:800;opacity:.72}
 .uon-support-card h3{margin:0;font-size:17px;line-height:1.55}
 .uon-support-card p{margin:8px 0 0;line-height:1.7;font-size:13px;opacity:.62}
 .uon-support-actions{margin-top:auto;padding-top:15px}
 .uon-support-card .btn{display:inline-flex;width:max-content;max-width:100%;align-items:center;justify-content:center;padding:9px 14px;font-size:13px}
 @media(max-width:650px){.uon-support-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.uon-support-card.h37-service{min-height:225px}}
 @media(max-width:430px){.uon-support-grid{grid-template-columns:1fr}.uon-support-card.h37-service{min-height:190px}}
 `;
 document.head.append(style);
}

function supportMarkup(){
 return `<section class="h37-section uon-support-centers" aria-labelledby="uonSupportCentersTitle">
  <div class="h37-container">
   <div class="h37-head h37-reveal visible">
    <div><h2 id="uonSupportCentersTitle">مراكز الدعم الأكاديمي</h2><p>خدمات مساندة للطالب بنفس نظام أدوات المنصة.</p></div>
   </div>
   <div class="uon-support-grid h37-reveal visible">
    <article class="h37-service uon-support-card">
     <span class="h37-service-icon" aria-hidden="true">🚀</span>
     <span class="uon-support-kicker">لطلاب السنة التأسيسية</span>
     <h3>ابدأ أقوى مع مركز أنجز</h3>
     <p>دعم في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.</p>
     <div class="uon-support-actions"><a class="btn primary" href="https://portal.unizwa.edu.om/twc/" target="_blank" rel="noopener noreferrer">احجز موعدك</a></div>
    </article>
    <article class="h37-service uon-support-card">
     <span class="h37-service-icon" aria-hidden="true">🎓</span>
     <span class="uon-support-kicker">لطلاب التخصص</span>
     <h3>مركز تعزيز مسالك التعلم</h3>
     <p>جلسات دعم أكاديمي وورش مساندة في مواد التخصص الأساسية.</p>
     <div class="uon-support-actions"><a class="btn primary" href="https://portal.unizwa.edu.om/twc/" target="_blank" rel="noopener noreferrer">احجز موعدك</a></div>
    </article>
   </div>
  </div>
 </section>`;
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
 console.info('UON support centers rendered below tools with matching theme');
 return true;
}

if(isHomePage()){
 ensureSupportCenters();
 const observer=new MutationObserver(()=>ensureSupportCenters());
 observer.observe(document.documentElement,{childList:true,subtree:true});
 setTimeout(()=>ensureSupportCenters(),100);
 setTimeout(()=>ensureSupportCenters(),500);
 setTimeout(()=>ensureSupportCenters(),1500);
 setTimeout(()=>ensureSupportCenters(),4000);
}
