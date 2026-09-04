import{esc,enforceUonMaintenance,watchUonMaintenance,getUonState,applyFeatureStates,trackEvent,trackClicks}from'./core.js?v=61.2.1';
import{currentAcademicPulse}from'./student-pulse.js?v=61.2.0';

await enforceUonMaintenance();

const LANG_KEY='uon_language';
const THEME_KEY='uon_theme';
const lang=localStorage.getItem(LANG_KEY)==='en'?'en':'ar';
const en=lang==='en';
const t=(ar,enText)=>en?enText:ar;
const services=[
 {feature:'summaries',url:'summaries.html',icon:'📚',title:t('الملخصات والاختبارات','Summaries & Exams'),desc:t('وصل لملفات المادة بسرعة وبدون لف.','Reach course files quickly and clearly.')},
 {feature:'groups',url:'groups.html',icon:'💬',title:t('مجموعات المواد','Course Groups'),desc:t('مجموعات واتساب مرتبة حسب المادة.','WhatsApp groups organized by course.')},
 {feature:'assistant',url:'assistant.html',icon:'🤖',title:'UON AI',desc:t('اسأل عن الجامعة والمقررات والخدمات.','Ask about university services and courses.')},
 {feature:'university-guide',url:'university-guide.html',icon:'🎓',title:t('دليل الجامعة','University Guide'),desc:t('الكليات والتخصصات والمعلومات المهمة.','Colleges, majors, and essential information.')},
 {feature:'schedule',url:'schedule.html',icon:'🗓️',title:t('الجدول الدراسي','Study Schedule'),desc:t('رتب محاضراتك وشوف أسبوعك بوضوح.','Organize classes and see your week clearly.')},
 {feature:'tools',url:'tools.html',icon:'🧰',title:t('كل الأدوات','All Tools'),desc:t('باقي خدمات UON Hub في مكان واحد.','All other UON Hub services in one place.')}
];
const more=[
 {feature:'ratings',url:'ratings.html',icon:'⭐',title:t('التقييمات','Ratings'),desc:t('تجارب الطلبة','Student experiences')},
 {feature:'projects',url:'projects.html',icon:'💡',title:t('مشاريع الطلاب','Student Projects'),desc:t('أفكار ومشاريع','Ideas & projects')},
 {feature:'useful-sites',url:'useful-sites.html',icon:'🔗',title:t('روابط مهمة','Useful Links'),desc:t('خدمات رسمية','Official services')},
 {feature:'confessions',url:'confessions.html',icon:'👀',title:t('الاعترافات','Confessions'),desc:t('مجتمع الطلاب','Student community')}
];

function applyTheme(){
 const theme=localStorage.getItem(THEME_KEY)==='light'?'light':'dark';
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 const button=document.querySelector('#rdTheme');
 if(button){button.textContent=theme==='dark'?'☀':'☾';button.setAttribute('aria-label',theme==='dark'?t('الوضع الفاتح','Light mode'):t('الوضع الداكن','Dark mode'))}
}
function toggleTheme(){localStorage.setItem(THEME_KEY,document.documentElement.dataset.theme==='dark'?'light':'dark');applyTheme()}
function academicData(){
 const academic=currentAcademicPulse();
 if(!academic)return{icon:'📅',title:t('ما فيه موعد أكاديمي قريب','No upcoming academic date'),text:t('إذا نزل موعد جديد في التقويم بيظهر هنا مباشرة.','New academic dates will appear here automatically.')};
 const text=academic.state==='active'?`${academic.title} • ${t('جاري الآن','Happening now')}`:academic.daysUntilStart===0?`${academic.title} • ${t('اليوم','Today')}`:academic.daysUntilStart===1?`${academic.title} • ${t('بكرة','Tomorrow')}`:`${academic.title} • ${t('بعد','in')} ${academic.daysUntilStart} ${t('أيام','days')}`;
 return{icon:academic.icon||'📅',title:academic.title,text};
}
function card(x){return`<a class="uon-rd-card" href="${x.url}" data-feature="${x.feature}"><span class="uon-rd-card-icon">${x.icon}</span><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></a>`}
function mini(x){return`<a class="uon-rd-mini" href="${x.url}" data-feature="${x.feature}"><span>${x.icon}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></div></a>`}
function header(){
 const node=document.querySelector('.site-header');if(!node)return;
 node.className='uon-rd-header';
 node.innerHTML=`<div class="uon-rd-container uon-rd-nav"><a class="uon-rd-brand" href="index.html"><span class="uon-rd-logo">U</span><span><strong>UON Hub</strong><small>${t('مجتمع طلاب جامعة نزوى','University of Nizwa Students')}</small></span></a><nav class="uon-rd-links"><a class="active" href="index.html">${t('الرئيسية','Home')}</a><a href="summaries.html" data-feature="summaries">${t('الملخصات','Summaries')}</a><a href="groups.html" data-feature="groups">${t('المجموعات','Groups')}</a><a href="university-guide.html" data-feature="university-guide">${t('دليل الجامعة','University Guide')}</a><a href="tools.html" data-feature="tools">${t('الأدوات','Tools')}</a></nav><div class="uon-rd-actions"><button class="uon-rd-icon" id="rdTheme" type="button"></button><button class="uon-rd-icon" id="rdLang" type="button">${en?'ع':'EN'}</button><button class="uon-rd-icon uon-rd-menu-btn" id="rdMenu" type="button" aria-label="${t('القائمة','Menu')}">☰</button></div></div><nav class="uon-rd-mobile-panel" id="rdMobile"><a href="summaries.html" data-feature="summaries">${t('الملخصات والاختبارات','Summaries & Exams')}</a><a href="groups.html" data-feature="groups">${t('المجموعات','Groups')}</a><a href="assistant.html" data-feature="assistant">UON AI</a><a href="university-guide.html" data-feature="university-guide">${t('دليل الجامعة','University Guide')}</a><a href="schedule.html" data-feature="schedule">${t('الجدول الدراسي','Study Schedule')}</a><a href="tools.html" data-feature="tools">${t('كل الأدوات','All Tools')}</a></nav>`;
 document.querySelector('#rdTheme')?.addEventListener('click',toggleTheme);
 document.querySelector('#rdLang')?.addEventListener('click',()=>{localStorage.setItem(LANG_KEY,en?'ar':'en');location.reload()});
 const menu=document.querySelector('#rdMobile');document.querySelector('#rdMenu')?.addEventListener('click',()=>menu?.classList.toggle('open'));
 document.addEventListener('click',e=>{if(menu?.classList.contains('open')&&!e.target.closest('#rdMobile,#rdMenu'))menu.classList.remove('open')});
 applyTheme();
}
function mount(){
 const main=document.querySelector('main');if(!main)return;
 const academic=academicData();
 main.outerHTML=`<main class="uon-rd-home home37"><section class="uon-rd-hero h37-hero"><div class="uon-rd-container uon-rd-hero-grid"><div><span class="uon-rd-kicker">● UON Hub · ${t('للطلاب أولًا','Student first')}</span><h1>${t('كل اللي تحتاجه في الجامعة،','Everything you need for university,')} <span>${t('بدون لف ودوران.','without the clutter.')}</span></h1><p class="uon-rd-lead">${t('ملخصات، مجموعات، جدول، دليل الجامعة وUON AI. أهم خدمات الطالب واضحة من أول ما تدخل.','Summaries, groups, schedule, university guide, and UON AI. The essentials are clear from the moment you arrive.')}</p><form class="uon-rd-search" id="rdSearch"><input id="rdSearchInput" autocomplete="off" aria-label="${t('بحث','Search')}" placeholder="${t('ابحث عن مادة، ملخص، خدمة أو تخصص...','Search for a course, summary, service, or major...')}"><button class="uon-rd-btn primary" type="submit">⌕ ${t('بحث','Search')}</button></form><div class="uon-rd-shortcuts"><a href="assistant.html" data-feature="assistant">🤖 UON AI</a><a href="summaries.html" data-feature="summaries">📚 ${t('الملخصات','Summaries')}</a><a href="groups.html" data-feature="groups">💬 ${t('المجموعات','Groups')}</a><a href="schedule.html" data-feature="schedule">🗓️ ${t('جدولي','My Schedule')}</a></div></div><aside class="uon-rd-academic"><div class="uon-rd-academic-head"><div><div class="uon-rd-academic-label">${t('الآن في UON Hub','Now on UON Hub')}</div><h2>${t('الموعد الأكاديمي','Academic Date')}</h2></div><span class="uon-rd-academic-icon">${academic.icon}</span></div><p>${esc(academic.text)}</p><a class="uon-rd-btn" href="academic-calendar.html">${t('فتح التقويم الأكاديمي','Open Academic Calendar')} ←</a></aside></div></section><section class="uon-rd-section"><div class="uon-rd-container"><div class="uon-rd-section-head"><div><h2>${t('ابدأ من هنا','Start here')}</h2><p>${t('ست خدمات أساسية، والباقي داخل صفحة الأدوات بدل ما نزحم الرئيسية.','Six essential services. Everything else stays inside Tools to keep the homepage clean.')}</p></div><a class="uon-rd-btn" href="tools.html" data-feature="tools">${t('كل الخدمات','All services')}</a></div><div class="uon-rd-grid">${services.map(card).join('')}</div></div></section><section class="uon-rd-section alt"><div class="uon-rd-container"><div class="uon-rd-section-head"><div><h2>${t('أكثر بعد','More when you need it')}</h2><p>${t('خدمات إضافية موجودة، لكن بدون ما تنافس الأشياء الأساسية.','Extra services stay available without competing with the essentials.')}</p></div></div><div class="uon-rd-more">${more.map(mini).join('')}</div></div></section></main>`;
 document.querySelector('#rdSearch')?.addEventListener('submit',e=>{e.preventDefault();const q=document.querySelector('#rdSearchInput')?.value.trim()||'';location.href=q?`search.html?q=${encodeURIComponent(q)}`:'search.html'});
}
async function syncVisibility(){
 try{
  const state=await getUonState();const visibility=state?.visibility||{};
  document.querySelectorAll('[data-feature]').forEach(node=>{const key=node.dataset.feature;const hidden=visibility[key]===false;node.dataset.uonHidden=hidden?'true':'false';node.toggleAttribute('aria-hidden',hidden)});
 }catch(error){console.warn('Visibility state unavailable',error)}
}

header();mount();await syncVisibility();await applyFeatureStates(document).catch(()=>{});trackClicks();watchUonMaintenance();void trackEvent('page_view',{page:'home_redesign_green_v1',language:lang});
window.addEventListener('focus',()=>{void syncVisibility();void applyFeatureStates(document)});
