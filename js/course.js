import{whatsappShare,reportBrokenLink,installErrorCapture,$,$$,esc,toast,rpc,uid,enforceUonMaintenance,watchUonMaintenance,trackEvent}from'./core.js?v=42.0.0';
await enforceUonMaintenance();watchUonMaintenance();installErrorCapture();

const code=(new URLSearchParams(location.search).get('code')||'').trim().toUpperCase();
if(!code)location.replace('courses.html');
const lang=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const t=(ar,en)=>lang()==='en'?en:ar;
let hub=null;
const empty=(ar,en)=>`<div class="course-empty"><strong>${esc(t(ar,en))}</strong><span>${esc(t('يُعرض المحتوى بعد اعتماده من المشرف.','Content appears after supervisor approval.'))}</span></div>`;

function itemUrl(x){return x.url||x.link||x.pdf_url||x.file_url||''}
function resourceCard(item,type,table){
 const title=item.title||item.subject||item.target_name||t('محتوى','Content');
 const url=itemUrl(item);
 return `<article class="course-resource"><div><span class="student-label">${esc(type)}</span><h3>${esc(title)}</h3><p>${esc(item.description||item.college||item.comment||'')}</p></div><div class="course-resource-actions">${url?`<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">${t('فتح','Open')}</a><a class="btn" href="${whatsappShare(title,url)}" target="_blank" rel="noopener">${t('مشاركة','Share')}</a>`:''}<button class="btn danger" data-report-table="${esc(table)}" data-report-id="${esc(item.id)}" data-report-title="${esc(title)}" data-report-url="${esc(url)}">${t('بلاغ','Report')}</button></div></article>`;
}
function openTab(name,{updateHash=true}={}){$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$$('.course-panel').forEach(p=>p.classList.remove('active'));$(`#course${name[0].toUpperCase()+name.slice(1)}`)?.classList.add('active');if(updateHash)history.replaceState(null,'',`${location.pathname}${location.search}#${name}`)}
function bind(){
 $$('[data-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.tab));
 $$('[data-open-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.openTab));
 $$('[data-report-table]').forEach(b=>b.onclick=()=>reportBrokenLink({sourceTable:b.dataset.reportTable,sourceId:b.dataset.reportId,title:b.dataset.reportTitle,url:b.dataset.reportUrl}));
 $('#requestCourseContent')?.addEventListener('click',requestContent);
 const initial=location.hash.slice(1);if(['overview','summaries','exams','groups','ratings','resources'].includes(initial))openTab(initial,{updateHash:false});
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
 $('#courseMeta').innerHTML=[course.credit_hours!=null?`${course.credit_hours} ${t('ساعات معتمدة','credit hours')}`:null,course.level?`${t('المستوى','Level')} ${course.level}`:null,course.requirement_type||null,programs.length?`${programs.length} ${t('برنامج مرتبط','linked programs')}`:null].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join('');
 $('#courseShare').href=whatsappShare(`${course.code} — ${title}`,location.href);
 $('#tabSummaryCount').textContent=summaries.length?`(${summaries.length})`:'';$('#tabExamCount').textContent=exams.length?`(${exams.length})`:'';
 $('#courseStats').innerHTML=[[t('الملخصات','Summaries'),stats.summaries??summaries.length],[t('الاختبارات','Exams'),stats.exams??exams.length],[t('المجموعات','Groups'),stats.groups??groups.length],[t('التقييمات','Ratings'),stats.ratings??ratings.length],[t('المصادر','Resources'),stats.resources??resources.length]].map(([label,value])=>`<div><strong>${Number(value).toLocaleString(lang()==='en'?'en':'ar')}</strong><span>${label}</span></div>`).join('');
 $('#coursePrerequisites').innerHTML=prerequisites.length?prerequisites.map(x=>`<a href="course.html?code=${encodeURIComponent(x.prerequisite_code||x.code)}">${esc(x.prerequisite_code||x.code)}</a>`).join(''):`<span>${t('لا توجد متطلبات مسجلة','No prerequisites recorded')}</span>`;
 $('#courseOverview').innerHTML=`<article class="course-panel-card"><h2>${t('عن المقرر','About the course')}</h2><p>${esc(course.description||t('لم تتم إضافة وصف لهذا المقرر بعد.','No description has been added yet.'))}</p>${course.learning_outcomes?`<h3>${t('مخرجات التعلم','Learning outcomes')}</h3><p>${esc(course.learning_outcomes)}</p>`:''}</article>${programs.length?`<article class="course-panel-card"><h3>${t('البرامج المرتبطة','Linked programs')}</h3><div class="course-prereq-list">${programs.map(p=>`<span>${esc(lang()==='en'?(p.name_en||p.name_ar):(p.name_ar||p.name_en))}</span>`).join('')}</div></article>`:''}<article class="course-panel-card"><h3>${t('الوصول السريع','Quick access')}</h3><div class="course-prereq-list"><button class="btn" data-open-tab="summaries">📚 ${t('الملخصات','Summaries')}</button><button class="btn" data-open-tab="exams">📝 ${t('الاختبارات','Exams')}</button><button class="btn" data-open-tab="groups">💬 ${t('المجموعات','Groups')}</button><button class="btn" data-open-tab="ratings">⭐ ${t('التقييمات','Ratings')}</button><a class="btn" href="search.html?q=${encodeURIComponent(code)}">🔎 ${t('البحث الشامل','Global search')}</a></div></article>`;
 $('#courseSummaries').innerHTML=summaries.length?summaries.map(x=>resourceCard(x,t('ملخص','Summary'),'summaries')).join(''):empty('لا توجد ملخصات معتمدة بعد','No approved summaries yet');
 $('#courseExams').innerHTML=exams.length?exams.map(x=>resourceCard(x,t('اختبار سابق','Past exam'),'summaries')).join(''):empty('لا توجد اختبارات معتمدة بعد','No approved exams yet');
 $('#courseGroups').innerHTML=groups.length?groups.map(x=>resourceCard(x,t('مجموعة واتساب','WhatsApp group'),'whatsapp_groups')).join(''):empty('لا توجد مجموعات معتمدة بعد','No approved groups yet');
 $('#courseRatings').innerHTML=ratings.length?ratings.map(x=>`<article class="course-panel-card"><div class="course-rating-stars">${stars(x.overall||x.overall_rating)}</div><h3>${esc(x.target_name||title)}</h3><p>${esc(x.comment||t('بدون تعليق','No comment'))}</p></article>`).join(''):empty('لا توجد تقييمات معتمدة بعد','No approved ratings yet');
 $('#courseResources').innerHTML=resources.length?resources.map(x=>resourceCard(x,x.resource_type||t('مصدر','Resource'),'course_resources')).join(''):empty('لا توجد مصادر مضافة بعد','No resources added yet');
 bind();
}
async function load(){
 try{hub=await rpc('uon_course_hub_v42',{p_code:code,p_language:lang()});if(!hub?.course)throw new Error(t('المقرر غير موجود','Course not found'));render();trackEvent('course_view_v42',{code})}
 catch(error){console.error(error);toast(error.message,true);document.querySelector('.course-detail-grid').innerHTML=`<div class="course-empty"><strong>${esc(error.message)}</strong><a class="btn primary" href="courses.html">${t('العودة للمقررات','Back to courses')}</a></div>`}
}
$('#copyCourseLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast(t('تم نسخ رابط المقرر','Course link copied'))}catch{toast(t('تعذر نسخ الرابط','Could not copy link'),true)}});
load();
