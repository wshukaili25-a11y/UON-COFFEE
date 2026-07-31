import {whatsappShare,reportBrokenLink,installErrorCapture,$,$$,get,esc,toast,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js?v=32.2.0';

await enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

const code=(new URLSearchParams(location.search).get('code')||'').trim().toUpperCase();
if(!code)location.replace('courses.html');

let course=null,summaries=[],exams=[],groups=[],ratings=[],resources=[],prerequisites=[],programLinks=[],programs=[];
const requirementLabels={university:'متطلب جامعة',college:'متطلب كلية',major:'متطلب تخصص',elective:'مقرر اختياري',service:'مقرر خدمة'};
const empty=message=>`<div class="course-empty"><strong>${esc(message)}</strong><span>يُعرض المحتوى بعد اعتماده من المشرف.</span></div>`;
const optionalGet=async(table,query)=>{try{const rows=await get(table,query);return Array.isArray(rows)?rows:[]}catch(error){console.warn(`[course] ${table}`,error);return[]}};
const programLabel=program=>[program?.name_ar||program?.name_en,program?.degree_ar||program?.degree_en].filter(Boolean).join(' — ');

function resourceCard(item,type,table){
 const title=item.title||item.subject||item.target_name||'محتوى';
 const url=item.url||item.link||item.pdf_url||item.file_url||'';
 return `<article class="course-resource"><div><span class="student-label">${esc(type)}</span><h3>${esc(title)}</h3><p>${esc(item.description||item.college||item.comment||'')}</p></div><div class="course-resource-actions">${url?`<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">فتح</a><a class="btn" href="${whatsappShare(title,url)}" target="_blank" rel="noopener">مشاركة</a><button class="btn danger" data-report-table="${esc(table)}" data-report-id="${esc(item.id)}" data-report-title="${esc(title)}" data-report-url="${esc(url)}">بلاغ</button>`:''}</div></article>`;
}

function openTab(name,{updateHash=true}={}){
 $$('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===name));
 $$('.course-panel').forEach(panel=>panel.classList.remove('active'));
 $(`#course${name[0].toUpperCase()+name.slice(1)}`)?.classList.add('active');
 if(updateHash)history.replaceState(null,'',`${location.pathname}${location.search}#${name}`);
}

function bind(){
 $$('[data-tab]').forEach(button=>button.onclick=()=>openTab(button.dataset.tab));
 $$('[data-open-tab]').forEach(button=>button.onclick=()=>openTab(button.dataset.openTab));
 $$('[data-report-table]').forEach(button=>button.onclick=()=>reportBrokenLink({sourceTable:button.dataset.reportTable,sourceId:button.dataset.reportId,title:button.dataset.reportTitle,url:button.dataset.reportUrl}));
 const initial=location.hash.slice(1);
 if(['overview','summaries','exams','groups','ratings','resources'].includes(initial))openTab(initial,{updateHash:false});
}

function render(){
 const title=course.name_ar||course.name_en||course.code;
 const english=course.name_en&&course.name_en!==title?course.name_en:'';
 const linkedDetails=programLinks.map(link=>({link,program:programs.find(program=>program.id===link.program_id)})).filter(item=>item.program);
 const linkedPrograms=linkedDetails.map(item=>item.program);
 const courseType=requirementLabels[course.requirement_type]||'';
 document.title=`${course.code} — ${title} | UON Hub`;
 $('#courseTitle').textContent=`${course.code} — ${title}`;
 $('#courseCollege').textContent=course.college_ar||course.college||linkedPrograms[0]?.college_name_ar||'مقرر جامعي';
 $('#courseMeta').innerHTML=[english,course.credit_hours?`${course.credit_hours} ساعات معتمدة`:null,course.level?`المستوى ${course.level}`:null,courseType,linkedPrograms.length?`${linkedPrograms.length} برنامج مرتبط`:course.requirement_type==='service'?'بدون ربط بخطة محددة':null].filter(Boolean).map(value=>`<span>${esc(value)}</span>`).join('');
 $('#courseShare').href=whatsappShare(`${course.code} — ${title}`,location.href);
 $('#tabSummaryCount').textContent=summaries.length?`(${summaries.length})`:'';
 $('#tabExamCount').textContent=exams.length?`(${exams.length})`:'';
 $('#courseStats').innerHTML=[['الملخصات',summaries.length],['الاختبارات',exams.length],['المجموعات',groups.length],['التقييمات',ratings.length],['المصادر',resources.length]].map(([label,value])=>`<div><strong>${Number(value).toLocaleString('ar')}</strong><span>${label}</span></div>`).join('');
 $('#coursePrerequisites').innerHTML=prerequisites.length?prerequisites.map(item=>`<a href="course.html?code=${encodeURIComponent(item.prerequisite_code)}">${esc(item.prerequisite_code)}</a>`).join(''):'<span>لا توجد متطلبات مسجلة</span>';
 const programsHtml=linkedDetails.length?`<article class="course-panel-card"><h3>البرامج المرتبطة</h3><div class="course-prereq-list">${linkedDetails.map(({program,link})=>`<span>${esc(programLabel(program))} • ${esc(requirementLabels[link.requirement_type]||link.requirement_type||'مقرر')}</span>`).join('')}</div></article>`:course.requirement_type==='service'?`<article class="course-panel-card"><h3>تصنيف المقرر</h3><p>هذا مقرر خدمة يُطرح لطلاب من برامج مختلفة، ولم يُربط بخطة واحدة محددة.</p></article>`:'';
 $('#courseOverview').innerHTML=`<article class="course-panel-card"><h2>عن المقرر</h2><p>${esc(course.description||'لم تتم إضافة وصف لهذا المقرر بعد.')}</p>${course.learning_outcomes?`<h3>مخرجات التعلم</h3><p>${esc(course.learning_outcomes)}</p>`:''}</article>${programsHtml}<article class="course-panel-card"><h3>الوصول السريع</h3><div class="course-prereq-list"><button class="btn" data-open-tab="summaries">📚 الملخصات</button><button class="btn" data-open-tab="exams">📝 الاختبارات</button><button class="btn" data-open-tab="groups">💬 المجموعات</button><button class="btn" data-open-tab="ratings">⭐ التقييمات</button></div></article>`;
 $('#courseSummaries').innerHTML=summaries.length?summaries.map(item=>resourceCard(item,'ملخص','summaries')).join(''):empty('لا توجد ملخصات معتمدة بعد');
 $('#courseExams').innerHTML=exams.length?exams.map(item=>resourceCard(item,'اختبار سابق','summaries')).join(''):empty('لا توجد اختبارات معتمدة بعد');
 $('#courseGroups').innerHTML=groups.length?groups.map(item=>resourceCard(item,'مجموعة واتساب','whatsapp_groups')).join(''):empty('لا توجد مجموعات معتمدة بعد');
 $('#courseRatings').innerHTML=ratings.length?ratings.map(item=>`<article class="course-panel-card"><div class="course-rating-stars">${'★'.repeat(Math.max(0,Math.min(5,Math.round(item.overall||0))))}${'☆'.repeat(5-Math.max(0,Math.min(5,Math.round(item.overall||0))))}</div><h3>${esc(item.target_name||title)}</h3><p>${esc(item.comment||'بدون تعليق')}</p></article>`).join(''):empty('لا توجد تقييمات معتمدة بعد');
 $('#courseResources').innerHTML=resources.length?resources.map(item=>resourceCard(item,item.resource_type||'مصدر','course_resources')).join(''):empty('لا توجد مصادر مضافة بعد');
 bind();
}

async function load(){
 try{
  const rows=await get('courses',`select=*&code=eq.${encodeURIComponent(code)}&active=eq.true&limit=1`);
  course=rows?.[0];
  if(!course)throw new Error('المقرر غير موجود');
  const results=await Promise.all([
   optionalGet('summaries',`select=*&approved=eq.true&course_code=eq.${encodeURIComponent(code)}&order=created_at.desc`),
   optionalGet('whatsapp_groups',`select=*&approved=eq.true&course_code=eq.${encodeURIComponent(code)}&order=created_at.desc`),
   optionalGet('rating_submissions',`select=*&status=eq.approved&course_code=eq.${encodeURIComponent(code)}&order=created_at.desc`),
   optionalGet('course_resources',`select=*&course_code=eq.${encodeURIComponent(code)}&active=eq.true&order=sort_order.asc`),
   optionalGet('course_prerequisites',`select=prerequisite_code&course_code=eq.${encodeURIComponent(code)}`),
   optionalGet('course_programs',`select=program_id,requirement_type,semester_no&course_code=eq.${encodeURIComponent(code)}`),
   optionalGet('academic_programs','select=id,name_ar,name_en,degree_ar,degree_en,college_id,department_id&active=eq.true')
  ]);
  [summaries,groups,ratings,resources,prerequisites,programLinks,programs]=results;
  exams=summaries.filter(item=>item.content_type==='exam'||item.resource_type==='exam'||/exam|اختبار|فاينل|ميد/i.test(`${item.title||''} ${item.subject||''}`));
  summaries=summaries.filter(item=>!exams.includes(item));
  render();trackEvent('course_view',{code});
 }catch(error){
  console.error('[course] load failed',error);toast(error.message,true);
  document.querySelector('.course-detail-grid').innerHTML=`<div class="course-empty"><strong>${esc(error.message)}</strong><a class="btn primary" href="courses.html">العودة للمقررات</a></div>`;
 }
}

$('#copyCourseLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('تم نسخ رابط المقرر')}catch{toast('تعذر نسخ الرابط',true)}});
load();