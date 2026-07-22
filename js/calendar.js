
import {get,$,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
let rows=[];
const labels={registration:'التسجيل',study:'الدراسة',exam:'الاختبارات',holiday:'إجازة',other:'موعد'};
async function load(){
 rows=await get('academic_calendar_events','select=*&active=eq.true&order=start_date.asc');
 render();trackEvent('page_view',{page:'calendar'});
}
function render(){
 const type=$('#calendarType').value;
 const list=rows.filter(x=>!type||x.event_type===type);
 $('#calendarList').innerHTML=list.length?list.map(x=>`<article class="timeline-item card">
 <div class="timeline-date"><strong>${new Date(x.start_date).toLocaleDateString('ar',{day:'numeric',month:'short'})}</strong><small>${x.end_date&&x.end_date!==x.start_date?'إلى '+new Date(x.end_date).toLocaleDateString('ar',{day:'numeric',month:'short'}):''}</small></div>
 <div><span class="badge">${esc(labels[x.event_type]||'موعد')}</span><h3>${esc(x.title)}</h3><p>${esc(x.description||'')}</p></div>
 </article>`).join(''):'<div class="empty">لا توجد مواعيد مضافة حاليًا</div>';
}
$('#calendarType').onchange=render;load();
