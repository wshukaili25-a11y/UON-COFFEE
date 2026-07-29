
import {get,$,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
let rows=[];
const labels={registration:'التسجيل',study:'الدراسة',exam:'الاختبارات',holiday:'إجازة',other:'موعد'};
async function load(){
 rows=await get('academic_calendar_events','select=*&active=eq.true&order=start_date.asc').catch(()=>[]);
 await loadOfficialCalendar();render();trackEvent('page_view',{page:'calendar'});
}
async function loadOfficialCalendar(){
 let url='https://www.unizwa.edu.om/index.php?contentid=1071&lang=ar';
 try{const r=await get('site_settings','select=value&key=eq.official_calendar_url&limit=1');if(r[0]?.value)url=r[0].value}catch{}
 const card=$('#officialCalendarCard');if(card)card.innerHTML=`<div class="section-head"><div><span class="badge">المصدر الرسمي</span><h3>التقويم الأكاديمي لجامعة نزوى</h3><p>راجع النسخة الرسمية المحدثة للعام الأكاديمي الحالي.</p></div><a class="btn primary" target="_blank" rel="noopener" href="${esc(url)}">فتح التقويم الرسمي ↗</a></div>`;
}
function render(){
 const type=$('#calendarType').value;
 const list=rows.filter(x=>!type||x.event_type===type);
 $('#calendarList').innerHTML=list.length?list.map(x=>`<article class="timeline-item card">
 <div class="timeline-date"><strong>${new Date(x.start_date).toLocaleDateString('ar',{day:'numeric',month:'short'})}</strong><small>${x.end_date&&x.end_date!==x.start_date?'إلى '+new Date(x.end_date).toLocaleDateString('ar',{day:'numeric',month:'short'}):''}</small></div>
 <div><span class="badge">${esc(labels[x.event_type]||'موعد')}</span><h3>${esc(x.title)}</h3><p>${esc(x.description||'')}</p></div>
 </article>`).join(''):'<div class="empty">لا توجد مواعيد محلية مضافة. استخدم رابط التقويم الرسمي أعلاه.</div>';
}
$('#calendarType').onchange=render;load();
