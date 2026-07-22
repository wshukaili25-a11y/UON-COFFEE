
import {checkFeature,whatsappShare,reportBrokenLink,installErrorCapture,$,$$,get,esc,toast,enforceUonMaintenance,watchUonMaintenance,loadSocialLinks,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();installErrorCapture();
const featureState=await checkFeature('courses');
if(featureState!=='active'){
 document.querySelector('main').innerHTML=`<section class="page-hero"><div class="container"><h1>نادي المواد</h1><p>${featureState==='maintenance'?'الخدمة تحت الصيانة حاليًا':featureState==='coming_soon'?'الخدمة قادمة قريبًا':'الخدمة متوقفة حاليًا'}</p></div></section>`;
 throw new Error('COURSES_FEATURE_DISABLED');
}

const code=(new URLSearchParams(location.search).get('code')||'').trim();
if(!code){location.replace('courses.html')}
let course=null,summaries=[],groups=[],ratings=[],resources=[],exams=[];
async function load(){
 try{
  const rows=await get('courses',`select=*&code=eq.${encodeURIComponent(code)}&limit=1`);
  course=rows[0];
  if(!course)throw new Error('المادة غير موجودة');
  [summaries,groups,ratings,resources,exams]=await Promise.all([
   get('summaries',`select=*&approved=eq.true&or=(course_code.eq.${encodeURIComponent(code)},subject.ilike.*${encodeURIComponent(code)}*)&order=created_at.desc`),
   get('whatsapp_groups',`select=*&approved=eq.true&or=(course_code.eq.${encodeURIComponent(code)},subject.ilike.*${encodeURIComponent(code)}*)&order=created_at.desc`),
   get('rating_submissions',`select=*&status=eq.approved&target_type=eq.course&or=(course_code.eq.${encodeURIComponent(code)},target_name.ilike.*${encodeURIComponent(code)}*)&order=created_at.desc`),
   get('course_resources',`select=*&course_code=eq.${encodeURIComponent(code)}&active=eq.true&order=sort_order.asc`),
   get('summaries',`select=*&approved=eq.true&course_code=eq.${encodeURIComponent(code)}&content_type=eq.exam&order=created_at.desc`)
  ]);
  render();trackEvent('course_view',{code});
 }catch(e){toast(e.message,true)}
}
function item(x,label,table){
 const title=x.title||x.subject||x.name||'محتوى';
 const url=x.url||x.link||'';
 return `<div class="list-row rich-resource"><a href="${esc(url||'#')}" target="${url?'_blank':'_self'}"><div><span class="badge">${esc(label)}</span><strong>${esc(title)}</strong><small>${esc(x.description||x.college||'')}</small></div></a><div class="resource-actions"><a class="icon-btn" href="${whatsappShare(title,url)}" target="_blank" title="مشاركة">↗</a><button class="icon-btn" data-report-table="${table}" data-report-id="${x.id}" data-report-title="${esc(title)}" data-report-url="${esc(url)}" title="بلاغ">!</button></div></div>`;
}
function bindReports(){
 $$('[data-report-table]').forEach(b=>b.onclick=()=>reportBrokenLink({sourceTable:b.dataset.reportTable,sourceId:b.dataset.reportId,title:b.dataset.reportTitle,url:b.dataset.reportUrl}));
}
function render(){
 $('#courseTitle').textContent=`${course.code} — ${course.name_ar}`;
 $('#courseCollege').textContent=course.college||'المادة';
 $('#courseMeta').textContent=[course.name_en,course.credit_hours?`${course.credit_hours} ساعات`:null,course.department].filter(Boolean).join(' • ');
 $('#courseOverview').innerHTML=`<div class="grid grid-4">
 <div class="card stat"><span>الملخصات</span><strong>${summaries.length}</strong></div>
 <div class="card stat"><span>المجموعات</span><strong>${groups.length}</strong></div>
 <div class="card stat"><span>التقييمات</span><strong>${ratings.length}</strong></div>
 <div class="card stat"><span>الاختبارات</span><strong>${exams.length}</strong></div></div>
 <div class="card form-card" style="margin-top:18px"><h2>عن المادة</h2><p>${esc(course.description||'لا يوجد وصف مضاف حاليًا.')}</p></div>`;
 $('#courseSummaries').innerHTML=summaries.length?summaries.map(x=>item(x,x.content_type==='exam'?'اختبار':'ملخص','summaries')).join(''):'<div class="empty">لا توجد ملخصات معتمدة بعد</div>';
 $('#courseGroups').innerHTML=groups.length?groups.map(x=>item(x,'واتساب','whatsapp_groups')).join(''):'<div class="empty">لا توجد مجموعات معتمدة بعد</div>';
 $('#courseRatings').innerHTML=ratings.length?ratings.map(x=>`<article class="card item-card"><span class="badge">تقييم</span><h3>${esc(x.target_name)}</h3><strong class="rating-stars">${'★'.repeat(Math.round(x.overall||0))}${'☆'.repeat(5-Math.round(x.overall||0))}</strong><p>${esc(x.comment||'')}</p></article>`).join(''):'<div class="empty">لا توجد تقييمات بعد</div>';
 $('#courseResources').innerHTML=(resources.length||exams.length)?[...exams.map(x=>item(x,'اختبار سابق','summaries')),...resources.map(x=>item(x,x.resource_type||'مصدر','course_resources'))].join(''):'<div class="empty">لا توجد مصادر مضافة بعد</div>';bindReports();
}
$$('[data-tab]').forEach(b=>b.onclick=()=>{$$('[data-tab]').forEach(x=>x.classList.remove('active'));$$('.course-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#course'+b.dataset.tab[0].toUpperCase()+b.dataset.tab.slice(1)).classList.add('active')});
load();
