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
 .uon-support-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
 .uon-support-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start;padding:24px;border:1px solid rgba(148,163,184,.18);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035));box-shadow:0 18px 45px rgba(2,6,23,.16)}
 .uon-support-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:rgba(56,189,248,.13);font-size:29px}
 .uon-support-content{min-width:0}
 .uon-support-kicker{display:block;margin-bottom:7px;font-size:.82rem;font-weight:800;opacity:.72}
 .uon-support-card h3{margin:0 0 8px;font-size:1.2rem;line-height:1.5}
 .uon-support-card p{margin:0 0 18px;line-height:1.85;opacity:.82}
 .uon-support-card .btn{display:inline-flex;width:max-content;max-width:100%;align-items:center;justify-content:center}
 @media(max-width:760px){.uon-support-grid{grid-template-columns:1fr}.uon-support-card{padding:20px;gap:14px}.uon-support-icon{width:50px;height:50px;font-size:25px}}
 @media(max-width:430px){.uon-support-card{grid-template-columns:1fr}.uon-support-icon{width:48px;height:48px}}
 `;
 document.head.append(style);
}

function supportMarkup(){
 return `<section class="h37-section uon-support-centers" aria-labelledby="uonSupportCentersTitle">
  <div class="h37-container">
   <div class="h37-head h37-reveal visible">
    <div><h2 id="uonSupportCentersTitle">مراكز الدعم الأكاديمي</h2><p>خدمات مساندة للطلبة، مرتبة تحت الأدوات للوصول السريع.</p></div>
   </div>
   <div class="uon-support-grid h37-reveal visible">
    <article class="uon-support-card">
     <div class="uon-support-icon" aria-hidden="true">🚀</div>
     <div class="uon-support-content"><span class="uon-support-kicker">لطلاب السنة التأسيسية</span><h3>ابدأ أقوى مع مركز أنجز</h3><p>دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.</p><a class="btn primary" href="https://portal.unizwa.edu.om/twc/" target="_blank" rel="noopener noreferrer">احجز موعدك</a></div>
    </article>
    <article class="uon-support-card">
     <div class="uon-support-icon" aria-hidden="true">🎓</div>
     <div class="uon-support-content"><span class="uon-support-kicker">لطلاب التخصص</span><h3>طوّر مستواك مع مركز تعزيز مسالك التعلم</h3><p>جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.</p><a class="btn primary" href="https://portal.unizwa.edu.om/twc/" target="_blank" rel="noopener noreferrer">احجز موعدك</a></div>
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
 console.info('UON support centers rendered below tools');
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