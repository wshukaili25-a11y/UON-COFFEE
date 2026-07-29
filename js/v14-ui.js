const pageMap={
 '/index.html':'home','/':'home','/summaries.html':'summaries',
 '/courses.html':'courses','/course.html':'courses','/ratings.html':'ratings',
 '/tools.html':'tools','/university-guide.html':'guide','/groups.html':'groups',
 '/useful-sites.html':'useful','/assistant.html':'assistant',
 '/gpa.html':'gpa','/schedule.html':'schedule','/calendar.html':'calendar',
 '/projects.html':'projects','/feedback.html':'feedback','/confessions.html':'confessions'
};

const dictionary={
 ar:{
  home:'الرئيسية',courses:'المقررات',tools:'الأدوات',guide:'دليل الجامعة',
  summaries:'الملخصات',groups:'المجموعات',ratings:'التقييمات',
  useful:'مواقع مهمة ومفيدة',assistant:'مساعد UON AI',gpa:'حاسبة المعدل',
  schedule:'الجدول الدراسي',calendar:'التقويم الأكاديمي',projects:'مشاريع الطلاب',
  feedback:'اقترح ميزة',confessions:'الاعترافات',
  dark:'الوضع الداكن',light:'الوضع الفاتح',language:'English'
 },
 en:{
  home:'Home',courses:'Courses',tools:'Tools',guide:'University Guide',
  summaries:'Summaries',groups:'Groups',ratings:'Ratings',
  useful:'Useful Websites',assistant:'UON AI Assistant',gpa:'GPA Calculator',
  schedule:'Study Schedule',calendar:'Academic Calendar',projects:'Student Projects',
  feedback:'Suggest a Feature',confessions:'Confessions',
  dark:'Dark Mode',light:'Light Mode',language:'العربية'
 }
};

const currentLanguage=()=>localStorage.getItem('uon_language')||'ar';
const currentTheme=()=>localStorage.getItem('uon_theme')||'dark';
const activePage=()=>pageMap[location.pathname]||'';
const tr=key=>dictionary[currentLanguage()]?.[key]||key;

function navLink(href,key){
 return `<a href="${href}" class="${activePage()===key?'active':''}">${tr(key)}</a>`;
}

function applyTheme(){
 const theme=currentTheme();
 document.documentElement.setAttribute('data-theme',theme);
 document.body?.setAttribute('data-theme',theme);
 const icon=theme==='dark'?'☀':'☾';
 document.querySelectorAll('[data-theme-toggle]').forEach(btn=>btn.textContent=icon);
 const label=document.querySelector('#themeText');
 if(label)label.textContent=theme==='dark'?tr('light'):tr('dark');
}

function applyLanguage(){
 const lang=currentLanguage();
 document.documentElement.lang=lang;
 document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.body?.setAttribute('data-language',lang);

 document.querySelectorAll('[data-ar][data-en]').forEach(el=>{
  el.textContent=lang==='ar'?el.dataset.ar:el.dataset.en;
 });
 document.querySelectorAll('[data-placeholder-ar][data-placeholder-en]').forEach(el=>{
  el.setAttribute('placeholder',lang==='ar'?el.dataset.placeholderAr:el.dataset.placeholderEn);
 });
}

export function setupV14Shell(){
 document.body.classList.add('v176-app');
 applyTheme();
 applyLanguage();

 const header=document.querySelector('.site-header');
 if(header){
  header.innerHTML=`<div class="container v176-nav">
   <a class="v176-brand" href="index.html"><span>U1</span><strong>UON Hub</strong></a>
   <nav class="v176-desktop-nav">
    ${navLink('index.html','home')}
    ${navLink('courses.html','courses')}
    ${navLink('tools.html','tools')}
    ${navLink('university-guide.html','guide')}
   </nav>
   <div class="v176-nav-actions">
    <button class="v176-nav-button" data-theme-toggle aria-label="Theme"></button>
    <button class="v176-nav-button" data-language-toggle>${currentLanguage()==='ar'?'EN':'ع'}</button>
    <button class="v176-nav-button" data-menu-open>☰</button>
   </div>
  </div>`;
 }

 document.querySelector('#v176SideMenu')?.remove();
 document.querySelector('#v176Backdrop')?.remove();

 document.body.insertAdjacentHTML('beforeend',`<aside class="v176-side-menu" id="v176SideMenu">
  <div class="v176-menu-head">
   <div class="v176-brand"><span>U1</span><strong>UON Hub</strong></div>
   <button data-menu-close>✕</button>
  </div>
  <nav>
   ${navLink('index.html','home')}
   ${navLink('courses.html','courses')}
   ${navLink('summaries.html','summaries')}
   ${navLink('groups.html','groups')}
   ${navLink('ratings.html','ratings')}
   ${navLink('university-guide.html','guide')}
   ${navLink('tools.html','tools')}
   ${navLink('gpa.html','gpa')}
   ${navLink('schedule.html','schedule')}
   ${navLink('calendar.html','calendar')}
   ${navLink('projects.html','projects')}
   ${navLink('useful-sites.html','useful')}
   ${navLink('assistant.html','assistant')}
   ${navLink('feedback.html','feedback')}
  </nav>
  <div class="v176-menu-settings">
   <button data-theme-toggle><span>◐</span><span id="themeText">${currentTheme()==='dark'?tr('light'):tr('dark')}</span></button>
   <button data-language-toggle><span>◎</span><span>${tr('language')}</span></button>
  </div>
 </aside><div class="v176-backdrop" id="v176Backdrop"></div>`);

 const menu=document.querySelector('#v176SideMenu');
 const backdrop=document.querySelector('#v176Backdrop');
 const open=()=>{menu.classList.add('open');backdrop.classList.add('open')};
 const close=()=>{menu.classList.remove('open');backdrop.classList.remove('open')};

 document.querySelectorAll('[data-menu-open]').forEach(btn=>btn.addEventListener('click',open));
 document.querySelectorAll('[data-menu-close]').forEach(btn=>btn.addEventListener('click',close));
 backdrop.addEventListener('click',close);

 document.querySelectorAll('[data-theme-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
  localStorage.setItem('uon_theme',currentTheme()==='dark'?'light':'dark');
  applyTheme();
 }));

 document.querySelectorAll('[data-language-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
  localStorage.setItem('uon_language',currentLanguage()==='ar'?'en':'ar');
  location.reload();
 }));

 // Inline service state banner
 if(!document.querySelector('#featureStateBanner')){
  document.body.insertAdjacentHTML('beforeend',`<div class="feature-state-banner" id="featureStateBanner">
   <button id="featureStateBannerClose">✕</button>
   <div><strong id="featureStateBannerTitle"></strong><p id="featureStateBannerText"></p></div>
  </div>`);
 }
 document.querySelector('#featureStateBannerClose')?.addEventListener('click',()=>{
  document.querySelector('#featureStateBanner')?.classList.remove('show');
 });
}

export function showFeatureStateBanner(status,title=''){
 const lang=currentLanguage();
 const messages={
  ar:{
   maintenance:['الخدمة تحت الصيانة','نعمل على تحسين هذه الخدمة، جرّب مرة أخرى لاحقًا.'],
   disabled:['الخدمة غير متاحة حاليًا','تم إيقاف هذه الخدمة مؤقتًا.'],
   coming_soon:['الخدمة قادمة قريبًا','هذه الخدمة لم تُفتح بعد وستتوفر قريبًا.']
  },
  en:{
   maintenance:['Service under maintenance','We are improving this service. Please try again later.'],
   disabled:['Service unavailable','This service is temporarily disabled.'],
   coming_soon:['Coming soon','This service will be available soon.']
  }
 };
 const content=messages[lang]?.[status]||messages[lang].disabled;
 const banner=document.querySelector('#featureStateBanner');
 document.querySelector('#featureStateBannerTitle').textContent=title?`${title} — ${content[0]}`:content[0];
 document.querySelector('#featureStateBannerText').textContent=content[1];
 banner.className=`feature-state-banner ${status} show`;
 setTimeout(()=>banner.classList.remove('show'),5000);
}
