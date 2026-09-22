import{esc,enforceUonMaintenance,watchUonMaintenance,getUonState,applyFeatureStates,trackEvent,trackClicks,get,safeHref,rpc}from'./core.js?v=61.2.1';
import{currentAcademicPulse,nextClass,formatClassTime}from'./student-pulse.js?v=61.2.0';

import{recentCourses,courseHref,mountStudentDock}from'./student-workspace.js?v=68.0.0';

await enforceUonMaintenance();

const LANG_KEY='uon_language';
const THEME_KEY='uon_theme';
const lang=localStorage.getItem(LANG_KEY)==='en'?'en':'ar';
const en=lang==='en';
const t=(ar,enText)=>en?enText:ar;
const FOOTER_KEYS=['footer_top_text','footer_credit_prefix','footer_credit_label','footer_credit_url','footer_rights'];

const services=[
 {feature:'courses',url:'courses.html',icon:'▤',title:t('صفحة مادتك','Your Course Hub'),desc:t('ملخصات واختبارات ومجموعات المقرر، في صفحة واحدة.','Summaries, exams, and groups together for each course.')},
 {feature:'summaries',url:'summaries.html',icon:'📚',title:t('الملخصات والاختبارات','Summaries & Exams'),desc:t('ملفات المواد والاختبارات مرتبة وسريعة الوصول.','Course files and exams, organized and easy to reach.')},
 {feature:'groups',url:'groups.html',icon:'<img src="/assets/whatsapp-outline-white.svg" alt="" width="29" height="29">',title:t('مجموعات المواد','Course Groups'),desc:t('ادخل مجموعة مادتك بدون بحث طويل، وشارك مجموعتك لزملائك.','Join your course group quickly, and share your group with classmates.')},
 {feature:'assistant',url:'assistant.html',icon:'🤖',title:'UON AI',desc:t('اسأل عن الجامعة والمقررات والخدمات.','Ask about university, courses, and services.')},
 {feature:'schedule',url:'schedule.html',icon:'🗓️',title:t('الجدول الدراسي','Study Schedule'),desc:t('رتب أسبوعك وشوف محاضراتك بوضوح.','Plan your week and see classes clearly.')},
 {feature:'university-guide',url:'university-guide.html',icon:'🎓',title:t('دليل الجامعة','University Guide'),desc:t('الكليات والتخصصات والمعلومات المهمة.','Colleges, majors, and essential information.')},
 {feature:'gpa',url:'gpa.html',icon:'🧮',title:t('حاسبة المعدل التراكمي','GPA Calculator'),desc:t('احسب معدلك الحالي وخطط للفصل القادم بسهولة.','Calculate your GPA and plan the next semester.')},
 {feature:'tools',url:'tools.html',icon:'✦',title:t('كل الأدوات','All Tools'),desc:t('كل الخدمات الإضافية في مكان واحد.','All extra services in one place.')}
];
const more=[
 {feature:'ratings',url:'ratings.html',icon:'⭐',title:t('التقييمات','Ratings')},
 {feature:'projects',url:'projects.html',icon:'💡',title:t('مشاريع الطلاب','Student Projects')},
 {feature:'useful-sites',url:'useful-sites.html',icon:'🔗',title:t('روابط مهمة','Useful Links')},
 {feature:'confessions',url:'confessions.html',icon:'👀',title:t('الاعترافات','Confessions')}
];
const supportFallback=[
 {name:'مركز أنجز',description:'دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.',booking_url:'https://portal.unizwa.edu.om/twc/',icon:'🚀',audience:'لطلاب السنة التأسيسية'},
 {name:'مركز تعزيز مسالك التعلم',description:'جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.',booking_url:'https://portal.unizwa.edu.om/twc/',icon:'🎓',audience:'لطلاب التخصص'}
];
const footerFallback={
 footer_top_text:'رَبِّ زِدْنِي عِلْمًا',
 footer_credit_prefix:'صمم بحب من طلاب جامعة نزوى❤️.',
 footer_credit_label:'@uonhub',
 footer_credit_url:'https://www.instagram.com/uonhub',
 footer_rights:'جميع الحقوق محفوظة © 2026 UON Hub'
};

function applyTheme(){
 const theme=localStorage.getItem(THEME_KEY)==='light'?'light':'dark';
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 const button=document.querySelector('#rdTheme');
 if(button){button.textContent=theme==='dark'?'☀':'☾';button.setAttribute('aria-label',theme==='dark'?t('الوضع الفاتح','Light mode'):t('الوضع الداكن','Dark mode'))}
}
function toggleTheme(){localStorage.setItem(THEME_KEY,document.documentElement.dataset.theme==='dark'?'light':'dark');applyTheme()}
function dayCount(value){
 const days=Math.max(0,Math.trunc(Number(value)||0));
 if(en)return `${days} ${days===1?'day':'days'}`;
 if(days===1)return'يوم';
 if(days===2)return'يومين';
 if(days>=3&&days<=10)return`${days} أيام`;
 return`${days} يوم`;
}
function academicData(){
 const academic=currentAcademicPulse();
 if(!academic)return{icon:'📅',text:t('ما فيه موعد أكاديمي قريب حاليًا.','No upcoming academic date right now.')};
 const text=academic.state==='active'?`${academic.title} • ${t('جاري الآن','Happening now')}`:academic.daysUntilStart===0?`${academic.title} • ${t('اليوم','Today')}`:`${academic.title} • ${t('بعد','in')} ${dayCount(academic.daysUntilStart)}`;
 return{icon:academic.icon||'📅',text};
}
function card(x){return`<a class="uon-rd-card uon-rd-card-${x.feature}${x.feature==='gpa'?' uon-rd-card-featured':''}" href="${x.url}" data-feature="${x.feature}"><span class="uon-rd-card-icon">${x.icon}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></div><span class="uon-rd-card-arrow">←</span></a>`}
function mini(x){return`<a class="uon-rd-mini" href="${x.url}" data-feature="${x.feature}"><span>${x.icon}</span><strong>${esc(x.title)}</strong></a>`}
function supportCard(center){
 const booking=safeHref(center.booking_url,'support-centers.html');
 const isAnjiz=String(center.name||'').includes('أنجز');
 const icon=center.icon||(isAnjiz?'🚀':'🎓');
 const isMasalik=/مسالك|learning pathways/i.test(String(center.name||''));
 const audience=en?(isAnjiz?'Foundation students':isMasalik?'Major students':center.audience||'Students'):(center.audience||(isAnjiz?'لطلاب السنة التأسيسية':'لطلاب التخصص'));
 const name=en?(isAnjiz?'Anjiz Center':isMasalik?'Learning Pathways Enhancement Center':center.name):center.name;
 const description=en?(isAnjiz?'Support for foundation-year students in English, mathematics, computing, and study skills.':isMasalik?'Academic support sessions and small workshops for major students in foundational courses.':center.description):center.description;
 return`<article class="uon-rd-support-card ${isAnjiz?'anjiz':'masalik'}"><div class="uon-rd-support-top"><span class="uon-rd-support-label">${esc(audience)}</span><span class="uon-rd-support-icon">${icon}</span></div><h3>${esc(name)}</h3><p>${esc(description||t('دعم أكاديمي متاح لطلبة جامعة نزوى.','Academic support for University of Nizwa students.'))}</p><div class="uon-rd-support-actions"><a class="uon-rd-btn primary" href="${esc(booking)}" target="_blank" rel="noopener noreferrer">${t('احجز موعدك','Book a session')}</a></div></article>`;
}
function normalizeFooterValue(value,fallback=''){
 if(typeof value==='string')return value.trim()||fallback;
 if(value==null)return fallback;
 return String(value).trim()||fallback;
}
function normalizeFooterUrl(value){
 let url=normalizeFooterValue(value,footerFallback.footer_credit_url);
 if(/^www\./i.test(url))url=`https://${url}`;
 return safeHref(url,footerFallback.footer_credit_url);
}
function renderFooter(settings=footerFallback){
 const footer=document.querySelector('#rdManagedFooter');if(!footer)return;
 const top=normalizeFooterValue(settings.footer_top_text,footerFallback.footer_top_text);
 const prefix=normalizeFooterValue(settings.footer_credit_prefix,footerFallback.footer_credit_prefix);
 const label=normalizeFooterValue(settings.footer_credit_label,footerFallback.footer_credit_label);
 const url=normalizeFooterUrl(settings.footer_credit_url);
 const rights=normalizeFooterValue(settings.footer_rights,footerFallback.footer_rights);
 footer.innerHTML=`<div class="uon-rd-container uon-rd-footer-main"><p class="uon-rd-footer-prayer">${esc(top)}</p><p class="uon-rd-footer-credit">${esc(prefix)}</p><a class="uon-rd-footer-handle" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a><p class="uon-rd-footer-rights">${esc(rights)}</p></div>`;
 footer.removeAttribute('aria-busy');
}
async function loadFooterSettings(){
 renderFooter(footerFallback);
 try{
  const rows=await get('site_settings',`select=key,value&key=in.(${FOOTER_KEYS.join(',')})`);
  const settings={...footerFallback};
  for(const row of Array.isArray(rows)?rows:[])if(FOOTER_KEYS.includes(row.key))settings[row.key]=row.value;
  renderFooter(settings);
 }catch(error){console.warn('Footer settings unavailable',error)}
}
function header(){
 const node=document.querySelector('.site-header');if(!node)return;
 node.className='uon-rd-header';
 node.innerHTML=`<div class="uon-rd-container uon-rd-nav"><a class="uon-rd-brand" href="index.html"><span class="uon-rd-logo"><img src="/assets/uonhub-logo-original-20260904.jpeg" alt="" width="42" height="42"></span><span><strong>UON Hub</strong><small>${t('مجتمع طلاب جامعة نزوى','University of Nizwa Students')}</small></span></a><nav class="uon-rd-links" aria-label="${t('القائمة الرئيسية','Main navigation')}"><a class="active" href="index.html">${t('الرئيسية','Home')}</a><a href="courses.html" data-feature="courses">${t('المواد','Courses')}</a><a href="summaries.html" data-feature="summaries">${t('الملخصات','Summaries')}</a><a href="groups.html" data-feature="groups">${t('المجموعات','Groups')}</a><a href="university-guide.html" data-feature="university-guide">${t('دليل الجامعة','University Guide')}</a><a href="tools.html" data-feature="tools">${t('الأدوات','Tools')}</a></nav><div class="uon-rd-actions"><button class="uon-rd-icon" id="rdTheme" type="button"></button><button class="uon-rd-icon" id="rdLang" type="button">${en?'ع':'EN'}</button><button class="uon-rd-icon uon-rd-menu-btn" id="rdMenu" type="button" aria-expanded="false" aria-controls="rdMobile" aria-label="${t('القائمة','Menu')}">☰</button></div></div><nav class="uon-rd-mobile-panel" id="rdMobile"><a href="courses.html" data-feature="courses">${t('صفحة مادتك','Your Course Hub')}</a><a href="summaries.html" data-feature="summaries">${t('الملخصات والاختبارات','Summaries & Exams')}</a><a href="groups.html" data-feature="groups">${t('المجموعات','Groups')}</a><a href="assistant.html" data-feature="assistant">UON AI</a><a href="schedule.html" data-feature="schedule">${t('الجدول الدراسي','Study Schedule')}</a><a href="gpa.html" data-feature="gpa">${t('حاسبة المعدل','GPA Calculator')}</a><a href="university-guide.html" data-feature="university-guide">${t('دليل الجامعة','University Guide')}</a><a href="tools.html" data-feature="tools">${t('كل الأدوات','All Tools')}</a></nav>`;
 document.querySelector('#rdTheme')?.addEventListener('click',toggleTheme);
 document.querySelector('#rdLang')?.addEventListener('click',()=>{localStorage.setItem(LANG_KEY,en?'ar':'en');location.reload()});
 const menu=document.querySelector('#rdMobile');document.querySelector('#rdMenu')?.addEventListener('click',()=>{const open=menu?.classList.toggle('open');document.querySelector('#rdMenu')?.setAttribute('aria-expanded',String(Boolean(open)))});
 document.addEventListener('click',e=>{if(menu?.classList.contains('open')&&!e.target.closest('#rdMobile,#rdMenu')){menu.classList.remove('open');document.querySelector('#rdMenu')?.setAttribute('aria-expanded','false')}});
 applyTheme();
}
function renderPersonalWorkspace(){
 const node=document.querySelector('#rdNextClass');if(!node)return;
 const klass=nextClass();
 const englishDays={'الأحد':'Sunday','الاثنين':'Monday','الثلاثاء':'Tuesday','الأربعاء':'Wednesday','الخميس':'Thursday'};
 node.innerHTML=klass?`<span class="workspace-label">${klass.state==='now'?t('محاضرتك الآن','In class now'):t('محاضرتك القادمة','Your next class')}</span><h2>${esc(klass.course||t('محاضرة','Class'))}</h2><p class="workspace-class-time">${esc(en?(englishDays[klass.day]||klass.day):klass.day)} <span dir="ltr"><bdi>${esc(en?klass.start:formatClassTime(klass.start))}</bdi> – <bdi>${esc(en?klass.end:formatClassTime(klass.end))}</bdi></span></p>${klass.room?`<p>${t('القاعة','Room')} · ${esc(klass.room)}</p>`:''}<a href="schedule.html" class="uon-rd-btn">${t('افتح جدولي','Open my schedule')} ←</a><small>${t('حسب جدولك المحفوظ على هذا الجهاز','From the schedule saved on this device')}</small>`:`<span class="workspace-label">${t('أسبوعك قدامك','Your week, at a glance')}</span><div class="workspace-schedule-mark" aria-hidden="true">▦</div><h2>${t('ابدأ بجدولك','Start with your schedule')}</h2><p>${t('أضف محاضراتك، وتلقّى المحاضرة القادمة هنا كل مرة ترجع.','Add your classes and see what’s next whenever you return.')}</p><a href="schedule.html" class="uon-rd-btn primary">${t('أضف جدولي','Add my schedule')} ←</a>`;
 const recent=document.querySelector('#rdRecentCourses'),rows=recentCourses();
 if(!recent)return;
 recent.hidden=!rows.length;
 recent.innerHTML=rows.length?`<div class="workspace-recent-heading"><h2>${t('رجوع سريع لموادك','Back to your courses')}</h2><span>${t('آخر ما تصفّحت على هذا الجهاز','Recently viewed on this device')}</span></div><div class="workspace-recent-list">${rows.map(row=>`<a href="${courseHref(row.code)}"><b dir="ltr">${esc(row.code)}</b><span>${esc(en?(row.name_en||row.name_ar):(row.name_ar||row.name_en))}</span><i aria-hidden="true">←</i></a>`).join('')}</div>`:'';
}
function bindHomeSearch(){
 const input=document.querySelector('#rdSearchInput'),results=document.querySelector('#rdSearchResults'),status=document.querySelector('#rdSearchStatus');
 let timer,sequence=0;
 document.querySelector('#rdSearch').addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();location.href=q?`search.html?q=${encodeURIComponent(q)}`:'search.html'});
 input.addEventListener('input',()=>{
  clearTimeout(timer);const current=++sequence,q=input.value.trim();results.hidden=true;status.textContent='';
  if(q.length<2)return;
  timer=setTimeout(async()=>{
   try{
    const rows=await rpc('uon_global_search_v44',{p_query:q,p_limit:6,p_language:lang});
    if(current!==sequence)return;
    const items=(Array.isArray(rows)?rows:[]).filter(row=>safeHref(row.url,''));
    results.innerHTML=items.map(row=>`<a href="${esc(safeHref(row.url,''))}"><strong>${esc(row.title||'')}</strong><small>${esc(row.subtitle||row.result_type||'')}</small></a>`).join('')+`<a class="workspace-search-all" href="search.html?q=${encodeURIComponent(q)}">${t('كل نتائج البحث','All search results')} ←</a>`;
    results.hidden=false;status.textContent=items.length?`${items.length} ${t('اقتراحات بحث','search suggestions')}`:t('اضغط بحث لعرض النتائج','Press Search to view results');
   }catch{if(current===sequence)status.textContent=t('اضغط بحث للمتابعة','Press Search to continue')}
  },260);
 });
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){sequence++;clearTimeout(timer);results.hidden=true}});
 document.addEventListener('click',e=>{if(!e.target.closest('.workspace-search-wrap')){sequence++;clearTimeout(timer);results.hidden=true}});
}
function mount(){
 const main=document.querySelector('main');if(!main)return;
 const academic=academicData();
 main.outerHTML=`<main class="uon-rd-home uon-rd-v2">
 <section class="uon-rd-hero workspace-hero"><div class="uon-rd-container workspace-hero-grid">
  <div class="workspace-intro"><span class="uon-rd-kicker">${t('مساحتك الطلابية · جامعة نزوى','Your student space · University of Nizwa')}</span><h1>${t('يومك الجامعي،','Your university day,')}<br><span>${t('مرتب.','organized.')}</span></h1><p class="uon-rd-lead">${t('مادتك، ملفاتك وجدولك. كل اللي تحتاجه لبداية أسهل.','Your courses, files, and schedule. Everything for an easier start.')}</p>
  <div class="workspace-search-wrap"><form class="uon-rd-search" id="rdSearch" role="search"><input id="rdSearchInput" type="search" autocomplete="off" maxlength="180" aria-label="${t('ابحث عن مادة أو خدمة','Search for a course or service')}" aria-describedby="rdSearchStatus" placeholder="${t('اسم المادة، رمزها، أو خدمة…','Course name, code, or service…')}"><button class="uon-rd-btn primary" type="submit">${t('بحث','Search')}</button></form><div id="rdSearchResults" class="workspace-search-results" aria-label="${t('اقتراحات البحث','Search suggestions')}" hidden></div><span id="rdSearchStatus" class="workspace-sr-only" role="status"></span></div>
  <div class="uon-rd-shortcuts"><a href="courses.html" data-feature="courses">▤ ${t('كل المواد','All courses')}</a><a href="summaries.html" data-feature="summaries">📚 ${t('الملخصات','Summaries')}</a><a href="assistant.html" data-feature="assistant">✦ UON AI</a></div></div>
  <aside class="workspace-next" id="rdNextClass" data-feature="schedule" aria-label="${t('جدولك الدراسي','Your schedule')}"></aside>
 </div></section>
 <section class="uon-rd-container workspace-recent" id="rdRecentCourses" data-feature="courses" hidden></section>
 <section class="uon-rd-academic-wrap"><div class="uon-rd-container"><a class="uon-rd-academic" href="academic-calendar.html"><span class="uon-rd-academic-icon">${academic.icon}</span><div><small>${t('الموعد الأكاديمي','Academic date')}</small><strong>${esc(academic.text)}</strong></div><span class="uon-rd-academic-open">${t('عرض التقويم','Open calendar')} ←</span></a></div></section>
 <section class="uon-rd-section"><div class="uon-rd-container"><div class="uon-rd-section-head workspace-section-head"><div><span>${t('على طول','Straight to it')}</span><h2>${t('وش تحتاج اليوم؟','What do you need today?')}</h2></div><a href="courses.html" data-feature="courses">${t('استعرض المواد','Browse courses')} ←</a></div><div class="uon-rd-grid">${services.map(card).join('')}</div></div></section>
 <section class="uon-rd-support-section" data-feature="support-centers"><div class="uon-rd-container"><div class="uon-rd-section-head centered uon-rd-support-head"><span>${t('مراكز الدعم','Support centers')}</span><h2>${t('دعم أكاديمي لما تحتاجه','Academic support when you need it')}</h2><p>${t('أنجز للسنة التأسيسية، ومسالك التعلم لطلاب التخصص — والحجز من نفس المكان.','Anjiz for foundation students and Learning Pathways for major students — with booking in one place.')}</p></div><div class="uon-rd-support-grid" id="rdSupportCenters" aria-busy="true">${supportFallback.map(supportCard).join('')}</div></div></section>
 <section class="uon-rd-section alt"><div class="uon-rd-container"><div class="uon-rd-more">${more.map(mini).join('')}</div><div class="uon-rd-all"><a class="uon-rd-btn" href="tools.html" data-feature="tools">${t('استعرض كل خدمات UON Hub','Browse all UON Hub services')} ←</a></div></div></section></main>`;
 renderPersonalWorkspace();bindHomeSearch();mountStudentDock('home',en);
 window.addEventListener('focus',renderPersonalWorkspace);
 window.addEventListener('storage',renderPersonalWorkspace);
 setInterval(()=>{if(!document.hidden)renderPersonalWorkspace()},60000);
}
async function loadSupportCenters(){
 const root=document.querySelector('#rdSupportCenters');if(!root)return;
 try{
  const rows=await get('support_centers','select=name,description,booking_url,sort_order&active=eq.true&order=sort_order.asc&limit=2');
  if(Array.isArray(rows)&&rows.length)root.innerHTML=rows.map(supportCard).join('');
 }catch(error){console.warn('Support centers unavailable',error)}
 root.removeAttribute('aria-busy');
}
async function syncVisibility(){
 try{const state=await getUonState();const visibility=state?.visibility||{};document.querySelectorAll('[data-feature]').forEach(node=>{const key=node.dataset.feature;const hidden=visibility[key]===false;node.dataset.uonHidden=hidden?'true':'false';node.toggleAttribute('aria-hidden',hidden)})}catch(error){console.warn('Visibility state unavailable',error)}
}
header();mount();void loadSupportCenters();void loadFooterSettings();await syncVisibility();await applyFeatureStates(document).catch(()=>{});trackClicks();watchUonMaintenance();void trackEvent('page_view',{page:'home_student_workspace_v68',language:lang});
window.addEventListener('focus',()=>{void loadSupportCenters();void loadFooterSettings();void syncVisibility();void applyFeatureStates(document)});
