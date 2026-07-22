const pageMap={
 '/index.html':'home','/':'home',
 '/summaries.html':'summaries','/courses.html':'courses',
 '/ratings.html':'ratings','/tools.html':'tools',
 '/university-guide.html':'guide','/groups.html':'groups',
 '/useful-sites.html':'useful','/assistant.html':'assistant'
};

const translations={
 ar:{
  home:'الرئيسية',courses:'المقررات',tools:'الأدوات',guide:'دليل الجامعة',
  summaries:'الملخصات',groups:'المجموعات',ratings:'التقييمات',
  useful:'مواقع مهمة ومفيدة',assistant:'مساعد UON AI',
  theme:'الوضع الداكن',language:'English',menu:'القائمة',
  feedback:'اقترح ميزة',about:'عن المنصة'
 },
 en:{
  home:'Home',courses:'Courses',tools:'Tools',guide:'University Guide',
  summaries:'Summaries',groups:'WhatsApp Groups',ratings:'Ratings',
  useful:'Useful Websites',assistant:'UON AI Assistant',
  theme:'Dark mode',language:'العربية',menu:'Menu',
  feedback:'Suggest a feature',about:'About'
 }
};

const lang=()=>localStorage.getItem('uon_language')||'ar';
const active=()=>pageMap[location.pathname]||'';
const t=key=>translations[lang()][key]||key;
const link=(href,label,key)=>`<a href="${href}" class="${active()===key?'active':''}">${label}</a>`;

function applyLanguage(){
 const current=lang();
 document.documentElement.lang=current;
 document.documentElement.dir=current==='ar'?'rtl':'ltr';
 document.body.dataset.language=current;
 document.querySelectorAll('[data-i18n]').forEach(el=>{
  const value=el.dataset.i18n;
  if(translations[current][value])el.textContent=translations[current][value];
 });
}

function applyTheme(){
 const saved=localStorage.getItem('uon_theme')||'light';
 document.documentElement.dataset.theme=saved;
 document.querySelector('#themeToggle')?.setAttribute('aria-label',saved==='dark'?'Light mode':'Dark mode');
 const label=document.querySelector('#themeLabel');
 if(label)label.textContent=saved==='dark'?(lang()==='ar'?'الوضع الفاتح':'Light mode'):(lang()==='ar'?'الوضع الداكن':'Dark mode');
}

export function setupV14Shell(){
 document.body.classList.add('v175-app');
 applyLanguage();
 applyTheme();

 const header=document.querySelector('.site-header');
 if(header)header.innerHTML=`<div class="container v175-nav">
  <a class="v175-brand" href="index.html"><span>U1</span><strong>UON Hub</strong></a>
  <nav>
   ${link('index.html',t('home'),'home')}
   ${link('courses.html',t('courses'),'courses')}
   ${link('tools.html',t('tools'),'tools')}
   ${link('university-guide.html',t('guide'),'guide')}
  </nav>
  <div class="v175-actions">
   <button id="themeToggle" class="v175-action" title="${t('theme')}">◐</button>
   <button id="languageToggle" class="v175-action">${lang()==='ar'?'EN':'ع'}</button>
   <button id="v175MenuOpen" class="v175-action menu">☰</button>
  </div>
 </div>`;

 if(!document.querySelector('#v175SideMenu')){
  document.body.insertAdjacentHTML('beforeend',`<aside id="v175SideMenu" class="v175-side-menu">
   <div class="v175-menu-head"><div class="v175-brand"><span>U1</span><strong>UON Hub</strong></div><button id="v175MenuClose">✕</button></div>
   <nav>
    ${link('index.html',t('home'),'home')}
    ${link('courses.html',t('courses'),'courses')}
    ${link('summaries.html',t('summaries'),'summaries')}
    ${link('groups.html',t('groups'),'groups')}
    ${link('ratings.html',t('ratings'),'ratings')}
    ${link('university-guide.html',t('guide'),'guide')}
    ${link('tools.html',t('tools'),'tools')}
    ${link('useful-sites.html',t('useful'),'useful')}
    ${link('assistant.html',t('assistant'),'assistant')}
    ${link('feedback.html',t('feedback'),'feedback')}
   </nav>
   <div class="v175-menu-settings">
    <button id="menuThemeToggle"><span>◐</span><span id="themeLabel">${t('theme')}</span></button>
    <button id="menuLanguageToggle"><span>◎</span><span>${t('language')}</span></button>
   </div>
  </aside><div id="v175MenuBackdrop" class="v175-menu-backdrop"></div>`);
 }

 const menu=document.querySelector('#v175SideMenu');
 const backdrop=document.querySelector('#v175MenuBackdrop');
 const open=()=>{menu.classList.add('open');backdrop.classList.add('open')};
 const close=()=>{menu.classList.remove('open');backdrop.classList.remove('open')};
 document.querySelector('#v175MenuOpen')?.addEventListener('click',open);
 document.querySelector('#v175MenuClose')?.addEventListener('click',close);
 backdrop?.addEventListener('click',close);

 const toggleTheme=()=>{
  const next=(localStorage.getItem('uon_theme')||'light')==='dark'?'light':'dark';
  localStorage.setItem('uon_theme',next);
  applyTheme();
 };
 document.querySelector('#themeToggle')?.addEventListener('click',toggleTheme);
 document.querySelector('#menuThemeToggle')?.addEventListener('click',toggleTheme);

 const toggleLanguage=()=>{
  localStorage.setItem('uon_language',lang()==='ar'?'en':'ar');
  location.reload();
 };
 document.querySelector('#languageToggle')?.addEventListener('click',toggleLanguage);
 document.querySelector('#menuLanguageToggle')?.addEventListener('click',toggleLanguage);

 const drawer=document.querySelector('#notificationDrawer');
 document.querySelector('#notificationBtn')?.addEventListener('click',()=>drawer?.classList.add('open'));
 document.querySelector('#closeNotifications')?.addEventListener('click',()=>drawer?.classList.remove('open'));
}
