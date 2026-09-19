import{whatsappShare,reportBrokenLink,installErrorCapture,$,$$,esc,toast,rpc,uid,enforceUonMaintenance,watchUonMaintenance,trackEvent,safeHref,applyFeatureStates}from'./core.js?v=42.0.0';
import{normalizeCourseCode,rememberCourse,courseClasses,mountStudentDock}from'./student-workspace.js?v=68.0.0';
import{readSchedule,formatClassTime}from'./student-pulse.js?v=61.2.0';
await enforceUonMaintenance();watchUonMaintenance();installErrorCapture();

const code=normalizeCourseCode(new URLSearchParams(location.search).get('code'));
if(!code)location.replace('courses.html');
const lang=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const t=(ar,en)=>lang()==='en'?en:ar;
let hub=null;
const empty=(ar,en)=>`<div class="course-empty"><strong>${esc(t(ar,en))}</strong><span>${esc(t('يُعرض المحتوى بعد اعتماده من المشرف.','Content appears after supervisor approval.'))}</span></div>`;

function itemUrl(x){const value=x.url||x.link||x.pdf_url||x.file_url||'';return value?safeHref(value,''):''}
function resourceCard(item,type,table){
 const title=item.title||item.subject||item.target_name||t('محتوى','Content');
 const url=itemUrl(item);
 return `<article class="course-resource"><div><span class="student-label">${esc(type)}</span><h3>${esc(title)}</h3><p>${esc(item.description||item.college||item.comment||'')}</p></div><div class="course-resource-actions">${url?`<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">${t('فتح','Open')}</a><a class="btn" href="${whatsappShare(title,url)}" target="_blank" rel="noopener">${t('مشاركة','Share')}</a>`:''}<button class="btn danger" data-report-table="${esc(table)}" data-report-id="${esc(item.id)}" data-report-title="${esc(title)}" data-report-url="${esc(url)}">${t('بلاغ','Report')}</button></div></article>`;
}
const tabs=['overview','summaries','exams','groups','ratings','resources'];
function openTab(name,{updateHash=true,focus=false}={}){
 if(!tabs.includes(name))name='overview';
 $$('[data-tab]').forEach(button=>{const active=button.dataset.tab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus()});
 $$('.course-panel').forEach(panel=>{const active=panel.id===`course${name[0].toUpperCase()+name.slice(1)}`;panel.classList.toggle('active',active);panel.hidden=!active});
 if(updateHash)history.replaceState(null,'',`${location.pathname}${location.search}#${name}`);
}
function bind(){
 const tablist=document.querySelector('.course-tabs');tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label',t('محتوى المادة','Course content'));
 $$('[data-tab]').forEach(button=>{
  const name=button.dataset.tab,id=`course${name[0].toUpperCase()+name.slice(1)}`,panel=document.getElementById(id);
  button.id=`tab-${name}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',id);
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
  button.onclick=()=>openTab(name);
  button.onkeydown=event=>{
   const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;
   event.preventDefault();const rtl=document.documentElement.dir==='rtl',index=tabs.indexOf(name);
   const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+((event.key==='ArrowRight')!==rtl?1:-1)+tabs.length)%tabs.length;
   openTab(tabs[next],{focus:true});
  };
 });
 $$('[data-open-tab]').forEach(button=>button.onclick=()=>{openTab(button.dataset.openTab,{focus:true});tablist.scrollIntoView({block:'nearest'})});
 $$('[data-report-table]').forEach(button=>button.onclick=()=>reportBrokenLink({sourceTable:button.dataset.reportTable,sourceId:button.dataset.reportId,title:button.dataset.reportTitle,url:button.dataset.reportUrl}));
 $('#requestCourseContent')?.addEventListener('click',requestContent);
 openTab(location.hash.slice(1)||'overview',{updateHash:false});
}
function renderCourseWeek(){
 const root=$('#courseWeek');if(!root||!hub?.course)return;
 const rows=courseClasses(readSchedule(),hub.course),days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
 const englishDays=['Sunday','Monday','Tuesday','Wednesday','Thursday'];
 rows.sort((a,b)=>days.indexOf(a.day)-days.indexOf(b.day)||a.start.localeCompare(b.start));
 root.innerHTML=`<h2>${t('المادة في جدولك','This course in your schedule')}</h2>${rows.length?`<div class="course-week">${rows.map(row=>`<div class="course-week-row"><div><strong>${esc(lang()==='en'?(englishDays[days.indexOf(row.day)]||row.day):row.day)}</strong><small>${esc([row.room?`${t('القاعة','Room')} ${row.room}`:'',row.teacher||''].filter(Boolean).join(' · '))}</small></div><span dir="ltr">${esc(lang()==='en'?`${row.start} – ${row.end}`:`${formatClassTime(row.start)} – ${formatClassTime(row.end)}`)}</span></div>`).join('')}</div><p>${t('من جدولك المحفوظ على هذا الجهاز.','From your schedule saved on this device.')}</p>`:`<p>${t('ما عندك محاضرات محفوظة لهذه المادة على هذا الجهاز. أضفها من صفحة الجدول لتظهر هنا.','No classes for this course are saved on this device. Add them to your schedule to see them here.')}</p>`}<a class="btn" href="schedule.html">${t('افتح جدولي','Open my schedule')} ←</a>`;
}
async function requestContent(){
 const types={summary:t('ملخص','Summary'),exam:t('اختبار سابق','Past exam'),group:t('مجموعة واتساب','WhatsApp group'),resource:t('مصدر رسمي','Official resource'),description:t('وصف المقرر','Course description')};
 const choice=prompt(`${t('اكتب نوع المحتوى المطلوب:','Enter requested content type:')}\nsummary / exam / group / resource / description`,'summary');
 if(!choice||!types[choice])return;
 try{
  const sessionKey='uon_course_request_session';let session=localStorage.getItem(sessionKey);if(!session){session=uid();localStorage.setItem(sessionKey,session)}
  const id=await rpc('uon_submit_course_content_request',{p_course_code:code,p_request_type:choice,p_details:`${types[choice]} — ${code}`,p_session_id:session});
  toast(`${t('تم إرسال الطلب للمشرف','Request sent to supervisor')} #${String(id).slice(0,8)}`);trackEvent('course_content_request',{code,type:choice});
 }catch(error){toast(error.message||t('تعذر إرسال الطلب','Could not send request'),true)}
}
function stars(value){const n=Math.max(0,Math.min(5,Math.round(Number(value)||0)));return '★'.repeat(n)+'☆'.repeat(5-n)}
function render(){
 const {course,summaries=[],exams=[],groups=[],ratings=[],resources=[],prerequisites=[],programs=[],stats={}}=hub;
 const title=lang()==='en'?(course.name_en||course.name_ar||course.code):(course.name_ar||course.name_en||course.code);
 document.title=`${course.code} — ${title} | UON Hub`;
 $('#courseTitle').textContent=`${course.code} — ${title}`;
 $('#courseCollege').textContent=lang()==='en'?(course.college_en||course.college||'University course'):(course.college_ar||course.college||'مقرر جامعي');
 $('#courseMeta').innerHTML=[course.credit_hours!=null?`${course.credit_hours} ${t('ساعات معتمدة','credit hours')}`:null,course.level?`${t('المستوى','Level')} ${course.level}`:null,({university:t('متطلب جامعة','University requirement'),college:t('متطلب كلية','College requirement'),major:t('متطلب تخصص','Major requirement'),elective:t('اختياري','Elective'),service:t('مقرر خدمة','Service course')}[course.requirement_type]||course.requirement_type||null),programs.length?`${programs.length} ${t('برنامج مرتبط','linked programs')}`:null].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join('');
 $('#courseShare').href=whatsappShare(`${course.code} — ${title}`,location.href);
 $('#tabSummaryCount').textContent=summaries.length?`(${summaries.length})`:'';$('#tabExamCount').textContent=exams.length?`(${exams.length})`:'';
 $('#courseStats').innerHTML=[[t('الملخصات','Summaries'),stats.summaries??summaries.length],[t('الاختبارات','Exams'),stats.exams??exams.length],[t('المجموعات','Groups'),stats.groups??groups.length],[t('التقييمات','Ratings'),stats.ratings??ratings.length],[t('المصادر','Resources'),stats.resources??resources.length]].map(([label,value])=>`<div><strong>${Number(value).toLocaleString(lang()==='en'?'en':'ar')}</strong><span>${label}</span></div>`).join('');
 $('#coursePrerequisites').innerHTML=prerequisites.length?prerequisites.map(x=>`<a href="course.html?code=${encodeURIComponent(x.prerequisite_code||x.code)}">${esc(x.prerequisite_code||x.code)}</a>`).join(''):`<span>${t('لا توجد متطلبات مسجلة','No prerequisites recorded')}</span>`;
 $('#courseOverview').innerHTML=`<div class="course-hub-shortcuts">${[["summaries",t('الملخصات','Summaries'),summaries.length],["exams",t('الاختبارات','Exams'),exams.length],["groups",t('المجموعات','Groups'),groups.length]].map(([tab,label,count])=>`<button type="button" data-open-tab="${tab}"><strong>${count}</strong>${label} ←</button>`).join('')}</div><article id="courseWeek" class="course-panel-card" data-feature="schedule"></article><a class="course-panel-card course-ai-link" data-feature="assistant" href="assistant.html?prompt=${encodeURIComponent(t('أريد معلومات ومصادر معتمدة عن مادة ','I need verified information and resources for ')+code)}"><div><span class="student-label">✦ UON AI</span><strong>${t('اسأل عن مادتك','Ask about your course')}</strong><p>${t('ابدأ سؤالك برمز المادة للوصول إلى المعلومات المرتبطة بها.','Start with your course code to find related information.')}</p></div><span aria-hidden="true">←</span></a><article class="course-panel-card"><h2>${t('عن المقرر','About the course')}</h2><p>${esc(course.description||t('لم تتم إضافة وصف لهذا المقرر بعد.','No description has been added yet.'))}</p>${course.learning_outcomes?`<h3>${t('مخرجات التعلم','Learning outcomes')}</h3><p>${esc(course.learning_outcomes)}</p>`:''}</article>${programs.length?`<article class="course-panel-card"><h3>${t('البرامج المرتبطة','Linked programs')}</h3><div class="course-prereq-list">${programs.map(p=>`<span>${esc(lang()==='en'?(p.name_en||p.name_ar):(p.name_ar||p.name_en))}</span>`).join('')}</div></article>`:''}<article class="course-panel-card"><h3>${t('الوصول السريع','Quick access')}</h3><div class="course-prereq-list"><button class="btn" data-open-tab="summaries">📚 ${t('الملخصات','Summaries')}</button><button class="btn" data-open-tab="exams">📝 ${t('الاختبارات','Exams')}</button><button class="btn" data-open-tab="groups">💬 ${t('المجموعات','Groups')}</button><button class="btn" data-open-tab="ratings">⭐ ${t('التقييمات','Ratings')}</button><a class="btn" href="search.html?q=${encodeURIComponent(code)}">🔎 ${t('البحث الشامل','Global search')}</a></div></article>`;
 $('#courseSummaries').innerHTML=summaries.length?summaries.map(x=>resourceCard(x,t('ملخص','Summary'),'summaries')).join(''):empty('لا توجد ملخصات معتمدة بعد','No approved summaries yet');
 $('#courseExams').innerHTML=exams.length?exams.map(x=>resourceCard(x,t('اختبار سابق','Past exam'),'summaries')).join(''):empty('لا توجد اختبارات معتمدة بعد','No approved exams yet');
 $('#courseGroups').innerHTML=groups.length?groups.map(x=>resourceCard(x,t('مجموعة واتساب','WhatsApp group'),'whatsapp_groups')).join(''):empty('لا توجد مجموعات معتمدة بعد','No approved groups yet');
 $('#courseRatings').innerHTML=ratings.length?ratings.map(x=>`<article class="course-panel-card"><div class="course-rating-stars">${stars(x.overall||x.overall_rating)}</div><h3>${esc(x.target_name||title)}</h3><p>${esc(x.comment||t('بدون تعليق','No comment'))}</p></article>`).join(''):empty('لا توجد تقييمات معتمدة بعد','No approved ratings yet');
 $('#courseResources').innerHTML=resources.length?resources.map(x=>resourceCard(x,x.resource_type||t('مصدر','Resource'),'course_resources')).join(''):empty('لا توجد مصادر مضافة بعد','No resources added yet');
 rememberCourse(course);renderCourseWeek();bind();void applyFeatureStates(document);
}
async function load(){
 try{hub=await rpc('uon_course_hub_v65',{p_code:code,p_language:lang()});if(!hub?.course)throw new Error(t('المقرر غير موجود','Course not found'));render();trackEvent('course_view_v42',{code})}
 catch(error){console.error(error);toast(error.message,true);document.querySelector('.course-detail-grid').innerHTML=`<div class="course-empty"><strong>${esc(error.message)}</strong><a class="btn primary" href="courses.html">${t('العودة للمقررات','Back to courses')}</a></div>`}
}
mountStudentDock('courses',lang()==='en');
window.addEventListener('focus',renderCourseWeek);
window.addEventListener('storage',renderCourseWeek);
window.addEventListener('hashchange',()=>openTab(location.hash.slice(1),{updateHash:false}));
$('#copyCourseLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast(t('تم نسخ رابط المقرر','Course link copied'))}catch{toast(t('تعذر نسخ الرابط','Could not copy link'),true)}});
load();