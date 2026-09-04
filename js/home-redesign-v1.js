import{esc,enforceUonMaintenance,watchUonMaintenance,getUonState,applyFeatureStates,trackEvent,trackClicks}from'./core.js?v=61.2.1';
import{currentAcademicPulse}from'./student-pulse.js?v=61.2.0';

await enforceUonMaintenance();

const LANG_KEY='uon_language';
const THEME_KEY='uon_theme';
const lang=localStorage.getItem(LANG_KEY)==='en'?'en':'ar';
const en=lang==='en';
const t=(ar,enText)=>en?enText:ar;

const services=[
 {feature:'summaries',url:'summaries.html',icon:'📚',title:t('الملخصات والاختبارات','Summaries & Exams'),desc:t('ملفات المواد والاختبارات مرتبة وسريعة الوصول.','Course files and exams, organized and easy to reach.')},
 {feature:'groups',url:'groups.html',icon:'💬',title:t('مجموعات المواد','Course Groups'),desc:t('ادخل مجموعة مادتك بدون بحث طويل.','Jump into your course group without the hunt.')},
 {feature:'assistant',url:'assistant.html',icon:'AI',title:'UON AI',desc:t('اسأل عن الجامعة والمقررات والخدمات.','Ask about university, courses, and services.')},
 {feature:'schedule',url:'schedule.html',icon:'🗓️',title:t('الجدول الدراسي','Study Schedule'),desc:t('رتب أسبوعك وشوف محاضراتك بوضوح.','Plan your week and see classes clearly.')},
 {feature:'university-guide',url:'university-guide.html',icon:'🎓',title:t('دليل الجامعة','University Guide'),desc:t('الكليات والتخصصات والمعلومات المهمة.','Colleges, majors, and essential information.')},
 {feature:'tools',url:'tools.html',icon:'✦',title:t('كل الأدوات','All Tools'),desc:t('كل الخدمات الإضافية في مكان واحد.','All extra services in one place.')}
];
const more=[
 {feature:'ratings',url:'ratings.html',icon:'⭐',title:t('التقييمات','Ratings')},
 {feature:'projects',url:'projects.html',icon:'💡',title:t('مشاريع الطلاب','Student Projects')},
 {feature:'useful-sites',url:'useful-sites.html',icon:'🔗',title:t('روابط مهمة','Useful Links')},
 {feature:'confessions',url:'confessions.html',icon:'👀',title:t('الاعترافات','Confessions')}
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
 if(!academic)return{icon:'📅',text:t('ما فيه موعد أكاديمي قريب حاليًا.','No upcoming academic date right now.')};
 const text=academic.state==='active'?`${academic.title} • ${t('جاري الآن','Happening now')}`:academic.daysUntilStart===0?`${academic.title} • ${t('اليوم','Today')}`:academic.daysUntilStart===1?`${academic.title} • ${t('بكرة','Tomorrow')}`:`${academic.title} • ${t('بعد','in')} ${academic.daysUntilStart} ${t('أيام','days')}`;
 return{icon:academic.icon||'📅',text};
}
function card(x){return`<a class="uon-rd-card" href="${x.url}" data-feature="${x.feature}"><span class="uon-rd-card-icon">${x.icon}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></div><span class="uon-rd-card-arrow">←</span></a>`}
function mini(x){return`<a class="uon-rd-mini" href="${x.url}" data-feature="${x.feature}"><span>${x.icon}</span><strong>${esc(x.title)}</strong></a>`}
function header(){
 const node=document.querySelector('.site-header');if(!node)return;
 node.className='uon-rd-header';
 node.innerHTML=`<div class="uon-rd-container uon-rd-nav"><a class="uon-rd-brand" href="index.html"><span class="uon-rd-logo">U</span><span><strong>UON Hub</strong><small>${t('مجتمع طلاب جامعة نزوى','University of Nizwa Students')}</small></span></a><nav class="uon-rd-links"><a class="active" href="index.html">${t('الرئيسية','Home')}</a><a href="summaries.html" data-feature="summaries">${t('الملخصات','Summaries')}</a><a href="groups.html" data-feature="groups">${t('المجموعات','Groups')}</a><a href="university-guide.html" data-feature="university-guide">${t('دليل الجامعة','University Guide')}</a><a href="tools.html" data-feature="tools">${t('الأدوات','Tools')}</a></nav><div class="uon-rd-actions"><button class="uon-rd-icon" id="rdTheme" type="button"></button><button class="uon-rd-icon" id="rdLang" type="button">${en?'ع':'EN'}</button><button class="uon-rd-icon uon-rd-menu-btn" id="rdMenu" type="button" aria-label="${t('القائمة','Menu')}">☰</button></div></div><nav class="uon-rd-mobile-panel" id="rdMobile"><a href="summaries.html" data-feature="summaries">${t('الملخصات والاختبارات','Summaries & Exams')}</a><a href="groups.html" data-feature="groups">${t('المجموعات','Groups')}</a><a href="assistant.html" data-feature="assistant">UON AI</a><a href="schedule.html" data-feature="schedule">${t('الجدول الدراسي','Study Schedule')}</a><a href="university-guide.html" data-feature="university-guide">${t('دليل الجامعة','University Guide')}</a><a href="tools.html" data-feature="tools">${t('كل الأدوات','All Tools')}</a></nav>`;
 document.querySelector('#rdTheme')?.addEventListener('click',toggleTheme);
 document.querySelector('#rdLang')?.addEventListener('click',()=>{localStorage.setItem(LANG_KEY,en?'ar':'en');location.reload()});
 const menu=document.querySelector('#rdMobile');document.querySelector('#rdMenu')?.addEventListener('click',()=>menu?.classList.toggle('open'));
 document.addEventListener('click',e=>{if(menu?.classList.contains('open')&&!e.target.closest('#rdMobile,#rdMenu'))menu.classList.remove('open')});
 applyTheme();
}
function mount(){
 const main=document.querySelector('main');if(!main)return;
 const academic=academicData();
 main.outerHTML=`<main class="uon-rd-home uon-rd-v2"><section class="uon-rd-hero"><div class="uon-rd-container uon-rd-hero-center"><span class="uon-rd-kicker">● UON Hub · ${t('للطلاب أولًا','Student first')}</span><h1>${t('كل الي يحتاجه طلبة','Everything University of Nizwa students need')} <span>${t('جامعة نزوى','in one place')}</span> ${t('في مكان واحد','')}</h1><p class="uon-rd-lead">${t('من الملخصات والمجموعات إلى الجدول وUON AI — كل خدمة مهمة توصلك لها بسرعة ومن غير زحمة.','From summaries and groups to your schedule and UON AI — the essentials are easy to reach without clutter.')}</p><form class="uon-rd-search" id="rdSearch"><input id="rdSearchInput" autocomplete="off" aria-label="${t('بحث','Search')}" placeholder="${t('ابحث عن مادة، ملخص، خدمة أو تخصص...','Search for a course, summary, service, or major...')}"><button class="uon-rd-btn primary" type="submit">⌕ ${t('بحث','Search')}</button></form><div class="uon-rd-shortcuts"><a href="assistant.html" data-feature="assistant">AI UON AI</a><a href="summaries.html" data-feature="summaries">📚 ${t('الملخصات','Summaries')}</a><a href="groups.html" data-feature="groups">💬 ${t('المجموعات','Groups')}</a><a href="schedule.html" data-feature="schedule">🗓️ ${t('جدولي','My Schedule')}</a></div></div></section><section class="uon-rd-academic-wrap"><div class="uon-rd-container"><a class="uon-rd-academic" href="academic-calendar.html"><span class="uon-rd-academic-icon">${academic.icon}</span><div><small>${t('الموعد الأكاديمي','Academic date')}</small><strong>${esc(academic.text)}</strong></div><span class="uon-rd-academic-open">${t('عرض التقويم','Open calendar')} ←</span></a></div></section><section class="uon-rd-section"><div class="uon-rd-container"><div class="uon-rd-section-head centered"><span>${t('أهم الخدمات','Core services')}</span><h2>${t('وصل للي تحتاجه مباشرة','Get where you need, faster')}</h2><p>${t('رتبنا الأساسيات أولًا، والباقي موجود بدون ما يزحم الصفحة.','The essentials come first, while everything else stays available without clutter.')}</p></div><div class="uon-rd-grid">${services.map(card).join('')}</div></div></section><section class="uon-rd-section alt"><div class="uon-rd-container"><div class="uon-rd-more">${more.map(mini).join('')}</div><div class="uon-rd-all"><a class="uon-rd-btn" href="tools.html" data-feature="tools">${t('استعرض كل خدمات UON Hub','Browse all UON Hub services')} ←</a></div></div></section></main>`;
 document.querySelector('#rdSearch')?.addEventListener('submit',e=>{e.preventDefault();const q=document.querySelector('#rdSearchInput')?.value.trim()||'';location.href=q?`search.html?q=${encodeURIComponent(q)}`:'search.html'});
}
async function syncVisibility(){
 try{const state=await getUonState();const visibility=state?.visibility||{};document.querySelectorAll('[data-feature]').forEach(node=>{const key=node.dataset.feature;const hidden=visibility[key]===false;node.dataset.uonHidden=hidden?'true':'false';node.toggleAttribute('aria-hidden',hidden)})}catch(error){console.warn('Visibility state unavailable',error)}
}
header();mount();await syncVisibility();await applyFeatureStates(document).catch(()=>{});trackClicks();watchUonMaintenance();void trackEvent('page_view',{page:'home_redesign_green_v2',language:lang});
window.addEventListener('focus',()=>{void syncVisibility();void applyFeatureStates(document)});
