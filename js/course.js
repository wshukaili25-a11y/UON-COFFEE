import {
 checkFeature,
 whatsappShare,
 reportBrokenLink,
 installErrorCapture,
 $,
 $$,
 get,
 esc,
 toast,
 enforceUonMaintenance,
 watchUonMaintenance,
 trackEvent
} from './core.js';

await enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

const featureState=await checkFeature('courses');
if(featureState!=='active'){
 document.querySelector('main').innerHTML=`<section class="page-hero"><div class="container"><h1>مركز المقررات</h1><p>${featureState==='maintenance'?'الخدمة تحت الصيانة حاليًا':featureState==='coming_soon'?'الخدمة قادمة قريبًا':'الخدمة متوقفة حاليًا'}</p></div></section>`;
 throw new Error('COURSES_FEATURE_DISABLED');
}

const code=(new URLSearchParams(location.search).get('code')||'').trim().toUpperCase();
if(!code)location.replace('courses.html');

let course=null,summaries=[],exams=[],groups=[],ratings=[],resources=[];

async function load(){
 try{
  const courseRows=await get('courses',`select=*&code=eq.${encodeURIComponent(code)}&limit=1`);
  course=courseRows[0];
  if(!course)throw new Error('المادة غير موجودة');

  [summaries,groups,ratings,resources]=await Promise.all([
   get('summaries',`select=*&approved=eq.true&or=(course_code.eq.${encodeURIComponent(code)},subject.ilike.*${encodeURIComponent(code)}*,title.ilike.*${encodeURIComponent(code)}*)&order=created_at.desc`),
   get('whatsapp_groups',`select=*&approved=eq.true&or=(course_code.eq.${encodeURIComponent(code)},subject.ilike.*${encodeURIComponent(code)}*)&order=created_at.desc`),
   get('rating_submissions',`select=*&status=eq.approved&or=(course_code.eq.${encodeURIComponent(code)},target_name.ilike.*${encodeURIComponent(code)}*)&order=created_at.desc`),
   get('course_resources',`select=*&course_code=eq.${encodeURIComponent(code)}&active=eq.true&order=sort_order.asc`)
  ]);

  exams=summaries.filter(item=>item.content_type==='exam'||/exam|اختبار/i.test(`${item.title||''} ${item.subject||''}`));
  summaries=summaries.filter(item=>!exams.includes(item));

  render();
  trackEvent('course_view',{code});
 }catch(error){
  toast(error.message,true);
 }
}

function card(item,type,table){
 const title=item.title||item.subject||item.target_name||'محتوى';
 const url=item.url||item.link||'';
 return `<article class="v16-resource-card">
  <div>
   <span>${esc(type)}</span>
   <h3>${esc(title)}</h3>
   <p>${esc(item.description||item.college||item.comment||'')}</p>
  </div>
  <div class="v16-resource-actions">
   ${url?`<a class="btn primary" href="${esc(url)}" target="_blank">فتح</a>`:''}
   ${url?`<a class="btn" href="${whatsappShare(title,url)}" target="_blank">مشاركة</a>`:''}
   ${url?`<button class="btn danger" data-report-table="${table}" data-report-id="${item.id}" data-report-title="${esc(title)}" data-report-url="${esc(url)}">بلاغ</button>`:''}
  </div>
 </article>`;
}

function render(){
 $('#courseTitle').textContent=`${course.code} — ${course.name_ar}`;
 $('#courseCollege').textContent=course.college||'مقرر';
 $('#courseMeta').textContent=[course.name_en,course.credit_hours?`${course.credit_hours} ساعات`:null,course.department].filter(Boolean).join(' • ');
 $('#courseShare').href=whatsappShare(`${course.code} — ${course.name_ar}`,location.href);

 $('#courseStats').innerHTML=[
  ['الملخصات',summaries.length],
  ['الاختبارات',exams.length],
  ['المجموعات',groups.length],
  ['التقييمات',ratings.length],
  ['المصادر',resources.length]
 ].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');

 $('#courseOverview').innerHTML=`
  <div class="v16-course-overview">
   <div>
    <h2>عن المادة</h2>
    <p>${esc(course.description||'لم تتم إضافة وصف لهذه المادة بعد.')}</p>
   </div>
   <div class="v16-course-quick-links">
    <button data-open-tab="summaries">📚 الملخصات</button>
    <button data-open-tab="exams">📝 الاختبارات</button>
    <button data-open-tab="groups">💬 مجموعة واتساب</button>
    <button data-open-tab="ratings">⭐ التقييمات</button>
   </div>
  </div>`;

 $('#courseSummaries').innerHTML=summaries.length?summaries.map(item=>card(item,'ملخص','summaries')).join(''):'<div class="empty">لا توجد ملخصات معتمدة بعد</div>';
 $('#courseExams').innerHTML=exams.length?exams.map(item=>card(item,'اختبار سابق','summaries')).join(''):'<div class="empty">لا توجد اختبارات معتمدة بعد</div>';
 $('#courseGroups').innerHTML=groups.length?groups.map(item=>card(item,'مجموعة واتساب','whatsapp_groups')).join(''):'<div class="empty">لا توجد مجموعات معتمدة بعد</div>';
 $('#courseRatings').innerHTML=ratings.length?ratings.map(item=>`<article class="v16-rating-card"><div><strong>${esc(item.target_name||course.name_ar)}</strong><span>${'★'.repeat(Math.round(item.overall||0))}${'☆'.repeat(5-Math.round(item.overall||0))}</span></div><p>${esc(item.comment||'بدون تعليق')}</p></article>`).join(''):'<div class="empty">لا توجد تقييمات بعد</div>';
 $('#courseResources').innerHTML=resources.length?resources.map(item=>card(item,item.resource_type||'مصدر','course_resources')).join(''):'<div class="empty">لا توجد مصادر مضافة بعد</div>';

 bind();
}

function openTab(name){
 $$('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===name));
 $$('.v16-course-panel').forEach(panel=>panel.classList.remove('active'));
 $(`#course${name[0].toUpperCase()+name.slice(1)}`)?.classList.add('active');
}

function bind(){
 $$('[data-tab]').forEach(button=>button.onclick=()=>openTab(button.dataset.tab));
 $$('[data-open-tab]').forEach(button=>button.onclick=()=>openTab(button.dataset.openTab));
 $$('[data-report-table]').forEach(button=>button.onclick=()=>reportBrokenLink({
  sourceTable:button.dataset.reportTable,
  sourceId:button.dataset.reportId,
  title:button.dataset.reportTitle,
  url:button.dataset.reportUrl
 }));
}

load();
