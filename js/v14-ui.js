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

const FEATURE_STATE_URL='https://irkhvydgxpseflggbeqq.supabase.co/rest/v1/rpc/uon_public_state';
const FEATURE_STATE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
let featureStatePromise=null;
let featureStateMap={};
let featureVisibilityMap={};
const featureAliases={
 university_guide:'university-guide',useful_sites:'useful-sites',support_centers:'support-centers'
};
const normalizeFeatureKey=key=>featureAliases[key]||key||'';
const featureByPage={
 'courses.html':'courses','course.html':'courses','summaries.html':'summaries','groups.html':'groups',
 'ratings.html':'ratings','university-guide.html':'university-guide','tools.html':'tools','gpa.html':'gpa',
 'schedule.html':'schedule','calendar.html':'calendar','projects.html':'projects','useful-sites.html':'useful-sites',
 'assistant.html':'assistant','feedback.html':'feedback','confessions.html':'confessions'
};

async function loadFeatureState(){
 if(featureStatePromise)return featureStatePromise;
 featureStatePromise=fetch(FEATURE_STATE_URL,{method:'POST',headers:{apikey:FEATURE_STATE_KEY,'Content-Type':'application/json'},body:'{}',cache:'no-store'})
  .then(async r=>{if(!r.ok)throw new Error(`feature state ${r.status}`);return r.json()})
  .then(state=>{
   featureStateMap=state?.features||{};
   featureVisibilityMap=state?.visibility||{};
   return state;
  })
  .catch(error=>{featureStatePromise=null;console.warn('Feature guard state failed',error);return null});
 return featureStatePromise;
}

function targetFeature(link){
 const direct=normalizeFeatureKey(link?.dataset?.feature);
 if(direct)return direct;
 try{return normalizeFeatureKey(featureByPage[new URL(link.href,location.href).pathname.split('/').pop()]||'')}catch{return ''}
}

function featureVisible(feature){
 return featureVisibilityMap[normalizeFeatureKey(feature)]!==false;
}

function visibilityHost(element){
 if(element.matches?.('[data-feature]'))return element;
 const featureParent=element.closest?.('[data-feature]');
 if(featureParent)return featureParent;
 const listItem=element.closest?.('li');
 if(listItem)return listItem;
 const article=element.closest?.('article');
 if(article&&article.querySelectorAll('a[href]').length===1)return article;
 return element;
}

function setFeatureElementVisibility(element,visible){
 const host=visibilityHost(element);
 if(!host)return;
 if(!visible){
  host.hidden=true;
  host.dataset.featureHidden='1';
  host.setAttribute('aria-hidden','true');
 }else if(host.dataset.featureHidden==='1'){
  host.hidden=false;
  delete host.dataset.featureHidden;
  host.removeAttribute('aria-hidden');
 }
}

function applyFeatureVisibility(root=document){
 const nodes=[];
 if(root.matches?.('[data-feature],a[href]'))nodes.push(root);
 root.querySelectorAll?.('[data-feature],a[href]').forEach(node=>nodes.push(node));
 nodes.forEach(node=>{
  const feature=targetFeature(node);
  if(feature)setFeatureElementVisibility(node,featureVisible(feature));
 });
}

function installVisibilityObserver(){
 if(document.documentElement.dataset.featureVisibilityObserver==='1')return;
 document.documentElement.dataset.featureVisibilityObserver='1';
 const observer=new MutationObserver(mutations=>{
  mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
   if(node.nodeType===1)applyFeatureVisibility(node);
  }));
 });
 observer.observe(document.body,{childList:true,subtree:true});
}

function installFeatureNavigationGuard(){
 if(document.documentElement.dataset.featureGuardInstalled==='1')return;
 document.documentElement.dataset.featureGuardInstalled='1';
 document.addEventListener('click',async event=>{
  const link=event.target.closest('a[href]');
  if(!link||link.target==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const feature=targetFeature(link);if(!feature)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!featureStateMap[feature]&&featureVisibilityMap[feature]===undefined)await loadFeatureState();
  if(!featureVisible(feature))return;
  const status=featureStateMap[feature]||'active';
  if(status!=='active'){
   showFeatureStateBanner(status,link.textContent?.trim()||'');
   return;
  }
  location.href=link.href;
 },true);

 loadFeatureState().then(()=>{
  applyFeatureVisibility(document);
  installVisibilityObserver();
  document.querySelectorAll('a[href]').forEach(link=>{
   const feature=targetFeature(link);if(!feature||!featureVisible(feature))return;
   const status=featureStateMap[feature]||'active';
   link.dataset.status=status;
   link.classList.toggle('feature-unavailable',status!=='active');
   if(status!=='active')link.setAttribute('aria-disabled','true');else link.removeAttribute('aria-disabled');
  });
  const page=location.pathname.split('/').pop()||'index.html';
  const feature=featureByPage[page];
  if(feature&&!featureVisible(feature)&&page!=='index.html'){
   location.replace('index.html');
   return;
  }
  const status=feature?featureStateMap[feature]:'active';
  if(feature&&status&&status!=='active'&&page!=='coming-soon.html'){
   const q=new URLSearchParams({feature,status});
   location.replace(`coming-soon.html?${q}`);
  }
 });
}

const featureKeys={
 courses:'courses',summaries:'summaries',groups:'groups',ratings:'ratings',guide:'university-guide',
 tools:'tools',gpa:'gpa',schedule:'schedule',calendar:'calendar',projects:'projects',
 useful:'useful-sites',assistant:'assistant',feedback:'feedback',confessions:'confessions'
};

function navLink(href,key){
 const feature=featureKeys[key];
 const attr=feature?` data-feature="${feature}"`:'';
 return `<a href="${href}"${attr} class="${activePage()===key?'active':''}">${tr(key)}</a>`;
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
 installFeatureNavigationGuard();

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
