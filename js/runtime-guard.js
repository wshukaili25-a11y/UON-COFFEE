import {get,esc} from './core.js?v=41.0.2';

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
 console.error('Hidden technical error:',technical);
 showMessage('تعذر إكمال العملية حاليًا. حدّث الصفحة أو حاول مرة أخرى.');
});

addEventListener('error',event=>{
 console.error('Runtime error:',event.error||event.message);
});

const isHomePage=()=>location.pathname==='/'||location.pathname.endsWith('/index.html');
const supportKeys=[
 'anjiz_title','anjiz_description','anjiz_booking_url','anjiz_cta',
 'masalik_title','masalik_description','masalik_booking_url','masalik_cta'
];

function safeExternalUrl(value){
 const raw=String(value||'').trim();
 if(!raw)return'';
 try{
  const url=new URL(raw,location.origin);
  return ['http:','https:'].includes(url.protocol)?url.href:'';
 }catch{return''}
}

function installSupportStyles(){
 if(document.querySelector('#uonSupportCentersStyle'))return;
 const style=document.createElement('style');
 style.id='uonSupportCentersStyle';
 style.textContent=`
 .uon-support-centers{position:relative}
 .uon-support-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
 .uon-support-card{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start;padding:24px;border:1px solid rgba(148,163,184,.18);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035));box-shadow:0 18px 45px rgba(2,6,23,.16)}
 .uon-support-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:rgba(56,189,248,.13);font-size:29px}
 .uon-support-content{min-width:0}
 .uon-support-kicker{display:block;margin-bottom:7px;font-size:.82rem;font-weight:800;opacity:.72}
 .uon-support-card h3{margin:0 0 8px;font-size:1.2rem;line-height:1.5}
 .uon-support-card p{margin:0 0 18px;line-height:1.85;opacity:.82}
 .uon-support-card .btn{width:max-content;max-width:100%}
 @media(max-width:760px){.uon-support-grid{grid-template-columns:1fr}.uon-support-card{padding:20px;grid-template-columns:auto 1fr;gap:14px}.uon-support-icon{width:50px;height:50px;font-size:25px}}
 @media(max-width:430px){.uon-support-card{grid-template-columns:1fr}.uon-support-icon{width:48px;height:48px}}
 `;
 document.head.append(style);
}

async function loadSupportSettings(){
 const defaults={
  anjiz_title:'ابدأ أقوى مع مركز أنجز',
  anjiz_description:'دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.',
  anjiz_booking_url:'https://portal.unizwa.edu.om/twc/',
  anjiz_cta:'احجز موعدك',
  masalik_title:'طوّر مستواك مع مركز تعزيز مسالك التعلم',
  masalik_description:'جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.',
  masalik_booking_url:'https://portal.unizwa.edu.om/twc/',
  masalik_cta:'احجز موعدك'
 };
 try{
  const rows=await get('site_settings',`select=key,value&key=in.(${supportKeys.join(',')})`);
  for(const row of rows||[]){
   if(row?.key in defaults&&row.value!==null&&row.value!==undefined)defaults[row.key]=String(row.value);
  }
 }catch(error){
  console.warn('Support center settings fallback used',error);
 }
 return defaults;
}

async function ensureSupportCenters(){
 if(!isHomePage()||document.querySelector('.uon-support-centers'))return;
 const main=document.querySelector('main.home37,main.v18-home,main');
 if(!main)return false;
 installSupportStyles();
 const settings=await loadSupportSettings();
 if(document.querySelector('.uon-support-centers'))return true;
 const anjizUrl=safeExternalUrl(settings.anjiz_booking_url);
 const masalikUrl=safeExternalUrl(settings.masalik_booking_url);
 const section=document.createElement('section');
 section.className='h37-section h37-soft uon-support-centers';
 section.setAttribute('aria-labelledby','uonSupportCentersTitle');
 section.innerHTML=`<div class="h37-container">
  <div class="h37-head h37-reveal"><div><h2 id="uonSupportCentersTitle">مراكز الدعم الأكاديمي</h2><p>دعم جامعي يساعدك في السنة التأسيسية ومواد التخصص.</p></div></div>
  <div class="uon-support-grid h37-reveal">
   <article class="uon-support-card">
    <div class="uon-support-icon" aria-hidden="true">🚀</div>
    <div class="uon-support-content"><span class="uon-support-kicker">لطلاب السنة التأسيسية</span><h3>${esc(settings.anjiz_title)}</h3><p>${esc(settings.anjiz_description)}</p>${anjizUrl?`<a class="btn primary" href="${esc(anjizUrl)}" target="_blank" rel="noopener noreferrer">${esc(settings.anjiz_cta||'احجز الآن')}</a>`:''}</div>
   </article>
   <article class="uon-support-card">
    <div class="uon-support-icon" aria-hidden="true">🎓</div>
    <div class="uon-support-content"><span class="uon-support-kicker">لطلاب التخصص</span><h3>${esc(settings.masalik_title)}</h3><p>${esc(settings.masalik_description)}</p>${masalikUrl?`<a class="btn primary" href="${esc(masalikUrl)}" target="_blank" rel="noopener noreferrer">${esc(settings.masalik_cta||'احجز الآن')}</a>`:''}</div>
   </article>
  </div>
 </div>`;
 main.append(section);
 return true;
}

if(isHomePage()){
 let tries=0;
 const restore=async()=>{
  if(await ensureSupportCenters())return;
  tries+=1;
  if(tries<30)setTimeout(restore,120);
 };
 restore();
}
