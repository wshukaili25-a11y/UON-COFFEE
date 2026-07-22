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

function navLink(href,label,key){
 return `<a href="${href}" class="${activePage()===key?'active':''}">${label}</a>`;
}

export function setupV14Shell(){
 document.body.classList.add('simple-app');

 const header=document.querySelector('.site-header');
 if(header){
  header.className='site-header simple-header';
  header.innerHTML=`<div class="container simple-nav">
   <a class="simple-brand" href="index.html">
    <span class="simple-logo">U1</span>
    <span><strong>UON Hub</strong><small>منصة طلاب جامعة نزوى</small></span>
   </a>

   <nav class="simple-desktop-links">
    ${navLink('index.html','الرئيسية','home')}
    ${navLink('courses.html','المقررات','courses')}
    ${navLink('summaries.html','الملخصات','summaries')}
    ${navLink('groups.html','المجموعات','groups')}
    ${navLink('ratings.html','التقييمات','ratings')}
    ${navLink('university-guide.html','دليل الجامعة','guide')}
   </nav>

   <div class="simple-nav-actions">
    <button id="simpleSearchOpen" class="simple-icon-button" aria-label="البحث">⌕</button>
    <button id="simpleNotificationOpen" class="simple-icon-button" aria-label="الإشعارات">🔔</button>
    <button id="simpleMenuOpen" class="simple-icon-button simple-mobile-only" aria-label="القائمة">☰</button>
   </div>
  </div>`;
 }

 if(!document.querySelector('#simpleSearchOverlay')){
  document.body.insertAdjacentHTML('beforeend',`<div class="simple-search-overlay" id="simpleSearchOverlay">
   <div class="simple-search-box">
    <input id="simpleSearchInput" placeholder="ابحث عن مادة، ملخص أو تخصص">
    <button id="simpleSearchClose">إغلاق</button>
   </div>
  </div>`);
 }

 if(!document.querySelector('#simpleMobileMenu')){
  document.body.insertAdjacentHTML('beforeend',`<aside class="simple-mobile-menu" id="simpleMobileMenu">
   <div class="simple-menu-head"><strong>القائمة</strong><button id="simpleMenuClose">✕</button></div>
   <nav>
    <a href="index.html">الرئيسية</a>
    <a href="courses.html">مركز المقررات</a>
    <a href="summaries.html">الملخصات والاختبارات</a>
    <a href="groups.html">مجموعات الواتساب</a>
    <a href="ratings.html">التقييمات</a>
    <a href="calendar.html">التقويم الأكاديمي</a>
    <a href="projects.html">مشاريع الطلاب</a>
    <a href="university-guide.html">دليل الجامعة</a>
    <a href="feedback.html">اقترح ميزة</a>
   </nav>
  </aside>`);
 }

 if(!document.querySelector('#simpleBottomNav')){
  document.body.insertAdjacentHTML('beforeend',`<nav class="simple-bottom-nav" id="simpleBottomNav">
   ${navLink('index.html','الرئيسية','home')}
   ${navLink('courses.html','المقررات','courses')}
   ${navLink('summaries.html','الملخصات','summaries')}
   ${navLink('groups.html','المجموعات','groups')}
   ${navLink('tools.html','المزيد','tools')}
  </nav>`);
 }

 const search=document.querySelector('#simpleSearchOverlay');
 document.querySelector('#simpleSearchOpen')?.addEventListener('click',()=>search.classList.add('open'));
 document.querySelector('#simpleSearchClose')?.addEventListener('click',()=>search.classList.remove('open'));
 document.querySelector('#simpleSearchInput')?.addEventListener('keydown',event=>{
  const value=event.target.value.trim();
  if(event.key==='Enter'&&value)location.href=`search.html?q=${encodeURIComponent(value)}`;
 });

 const menu=document.querySelector('#simpleMobileMenu');
 document.querySelector('#simpleMenuOpen')?.addEventListener('click',()=>menu.classList.add('open'));
 document.querySelector('#simpleMenuClose')?.addEventListener('click',()=>menu.classList.remove('open'));

 const drawer=document.querySelector('#notificationDrawer');
 document.querySelector('#simpleNotificationOpen')?.addEventListener('click',async()=>{
  drawer?.classList.add('open');
  try{
   const {loadNotificationCenter}=await import('./core.js');
   await loadNotificationCenter();
  }catch{}
 });

 document.querySelector('#closeNotifications')?.addEventListener('click',()=>drawer?.classList.remove('open'));
}
