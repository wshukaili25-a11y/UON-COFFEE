
import {getSetting,trackEvent} from './core.js';

const pageMap={
 '/index.html':'home','/':'home',
 '/summaries.html':'summaries',
 '/courses.html':'courses',
 '/ratings.html':'ratings',
 '/calendar.html':'calendar',
 '/tools.html':'tools',
 '/university-guide.html':'guide',
 '/projects.html':'projects',
 '/groups.html':'groups'
};

function activePage(){
 return pageMap[location.pathname]||'';
}

function navLink(href,label,key,icon){
 return `<a href="${href}" class="${activePage()===key?'active':''}"><span>${icon}</span><b>${label}</b></a>`;
}

export function setupV14Shell(){
 document.body.classList.add('v14-body');

 const header=document.querySelector('.site-header');
 if(header){
  header.classList.add('v14-header');
  header.innerHTML=`<div class="container v14-nav">
   <a class="v14-brand" href="index.html">
    <span class="v14-logo">U1</span>
    <span><strong>UON Hub</strong><small>منصة طلاب جامعة نزوى</small></span>
   </a>
   <nav class="v14-desktop-nav">
    ${navLink('index.html','الرئيسية','home','⌂')}
    ${navLink('courses.html','المقررات','courses','▤')}
    ${navLink('summaries.html','الملخصات','summaries','▧')}
    ${navLink('ratings.html','التقييمات','ratings','★')}
    ${navLink('university-guide.html','دليل الجامعة','guide','◫')}
   </nav>
   <div class="v14-nav-actions">
    <button id="v14SearchOpen" class="v14-icon-btn" aria-label="البحث">⌕</button>
    <button id="notificationBtn" class="v14-icon-btn" aria-label="الإشعارات">◉</button>
    <button id="v14MenuOpen" class="v14-icon-btn v14-menu-btn" aria-label="القائمة">☰</button>
   </div>
  </div>`;
 }

 if(!document.querySelector('#v14BottomNav')){
  document.body.insertAdjacentHTML('beforeend',`<nav class="v14-bottom-nav" id="v14BottomNav">
   ${navLink('index.html','الرئيسية','home','⌂')}
   ${navLink('courses.html','المقررات','courses','▤')}
   ${navLink('summaries.html','الملخصات','summaries','▧')}
   ${navLink('ratings.html','التقييمات','ratings','★')}
   ${navLink('tools.html','المزيد','tools','•••')}
  </nav>`);
 }

 if(!document.querySelector('#v14SearchOverlay')){
  document.body.insertAdjacentHTML('beforeend',`<div class="v14-search-overlay" id="v14SearchOverlay">
   <div class="v14-search-panel">
    <div class="v14-search-top">
     <span>⌕</span>
     <input id="v14SearchInput" placeholder="ابحث عن مادة، ملخص، تخصص أو خدمة..." autofocus>
     <button id="v14SearchClose">إغلاق</button>
    </div>
    <div class="v14-search-hints">
     <a href="search.html?q=STAT101">STAT101</a>
     <a href="search.html?q=التمريض">التمريض</a>
     <a href="search.html?q=محاسبة">المحاسبة</a>
     <a href="search.html?q=رياضيات">رياضيات</a>
    </div>
   </div>
  </div>`);
 }

 if(!document.querySelector('#v14MobileMenu')){
  document.body.insertAdjacentHTML('beforeend',`<aside class="v14-mobile-menu" id="v14MobileMenu">
   <div class="v14-mobile-menu-head"><strong>UON Hub</strong><button id="v14MenuClose">✕</button></div>
   <div class="v14-mobile-links">
    <a href="index.html">الرئيسية</a><a href="courses.html">مركز المقررات</a>
    <a href="summaries.html">الملخصات والاختبارات</a><a href="groups.html">مجموعات المواد</a>
    <a href="ratings.html">التقييمات</a><a href="calendar.html">التقويم الأكاديمي</a>
    <a href="projects.html">مشاريع الطلاب</a><a href="university-guide.html">دليل الجامعة</a>
    <a href="feedback.html">اقترح ميزة</a>
   </div>
  </aside>`);
 }

 const overlay=document.querySelector('#v14SearchOverlay');
 document.querySelector('#v14SearchOpen')?.addEventListener('click',()=>overlay.classList.add('open'));
 document.querySelector('#v14SearchClose')?.addEventListener('click',()=>overlay.classList.remove('open'));
 document.querySelector('#v14SearchInput')?.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.value.trim())location.href=`search.html?q=${encodeURIComponent(e.target.value.trim())}`;
 });
 overlay?.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open')});

 const menu=document.querySelector('#v14MobileMenu');
 document.querySelector('#v14MenuOpen')?.addEventListener('click',()=>menu.classList.add('open'));
 document.querySelector('#v14MenuClose')?.addEventListener('click',()=>menu.classList.remove('open'));

 let lastY=0;
 addEventListener('scroll',()=>{
  const y=scrollY;
  document.body.classList.toggle('v14-scrolled',y>20);
  if(innerWidth<760){
   document.body.classList.toggle('v14-hide-bottom',y>lastY&&y>180);
  }
  lastY=y;
 },{passive:true});

 setupOnboarding();
}

function setupOnboarding(){
 if(localStorage.getItem('uon_onboarding_done'))return;
 if(location.pathname.includes('admin')||location.pathname.includes('maintenance'))return;

 document.body.insertAdjacentHTML('beforeend',`<div class="v14-onboarding" id="v14Onboarding">
  <div class="v14-onboarding-card">
   <span class="v14-onboarding-logo">U1</span>
   <small>مرحبًا بك في UON Hub</small>
   <h2>خلّنا نرتب لك المنصة حسب احتياجك</h2>
   <p>اختياراتك تحفظ في جهازك فقط، وما نطلب حساب أو بيانات شخصية.</p>
   <label>أنا طالب</label>
   <div class="v14-choice-grid">
    <button data-stage="foundation">السنة التأسيسية</button>
    <button data-stage="major">طالب تخصص</button>
   </div>
   <label>أكثر شيء أحتاجه</label>
   <div class="v14-choice-grid">
    <button data-need="summaries">ملخصات واختبارات</button>
    <button data-need="courses">مركز المقررات</button>
    <button data-need="ratings">التقييمات</button>
    <button data-need="guide">دليل الجامعة</button>
   </div>
   <button class="btn primary" id="v14OnboardingDone">ابدأ استخدام المنصة</button>
   <button class="v14-skip" id="v14OnboardingSkip">تخطي</button>
  </div>
 </div>`);

 let stage='',need='';
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{stage=b.dataset.stage;document.querySelectorAll('[data-stage]').forEach(x=>x.classList.toggle('selected',x===b))});
 document.querySelectorAll('[data-need]').forEach(b=>b.onclick=()=>{need=b.dataset.need;document.querySelectorAll('[data-need]').forEach(x=>x.classList.toggle('selected',x===b))});
 const close=()=>{
  localStorage.setItem('uon_onboarding_done','1');
  if(stage||need)localStorage.setItem('uon_preferences',JSON.stringify({stage,need}));
  document.querySelector('#v14Onboarding')?.remove();
  trackEvent('onboarding_complete',{stage,need});
 };
 document.querySelector('#v14OnboardingDone').onclick=close;
 document.querySelector('#v14OnboardingSkip').onclick=close;
}

export function showSkeleton(target,count=6){
 const el=typeof target==='string'?document.querySelector(target):target;
 if(!el)return;
 el.innerHTML=Array.from({length:count},()=>`<div class="v14-skeleton-card"><span></span><i></i><i></i><i></i></div>`).join('');
}
