import{
 setupNav,enforceUonMaintenance,watchUonMaintenance,$,toast,esc,uid,
 trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

setupNav();enforceUonMaintenance();watchUonMaintenance();installErrorCapture();
const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const STORAGE_KEY='uon_schedule_v39';
let rows=[];
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem('uon-v7-schedule')||'[]');rows=Array.isArray(saved)?saved:[]}catch{rows=[]}
const minutes=time=>{const [hours,mins]=String(time||'').split(':').map(Number);return Number.isFinite(hours)&&Number.isFinite(mins)?hours*60+mins:-1};
const validRow=row=>row&&days.includes(row.day)&&row.course&&minutes(row.start)>=0&&minutes(row.end)>minutes(row.start);
rows=rows.filter(validRow).slice(0,100);

function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));render()}
function eventCard(item){
 return `<article class="schedule-event" data-event-id="${esc(item.id)}"><div><strong>${esc(item.course)}</strong><small>${esc(item.start)}–${esc(item.end)}${item.room?` • ${esc(item.room)}`:''}</small>${item.teacher?`<small>${esc(item.teacher)}</small>`:''}</div><button class="icon-btn" type="button" data-delete-event="${esc(item.id)}" aria-label="حذف">✕</button></article>`;
}
function render(){
 $('#week').innerHTML=days.map(day=>{
  const events=rows.filter(item=>item.day===day).sort((a,b)=>a.start.localeCompare(b.start));
  return `<section class="card schedule-day"><header><h3>${day}</h3><span>${events.length} محاضرة</span></header>${events.map(eventCard).join('')||'<p class="empty">فارغ</p>'}</section>`;
 }).join('');
 $('#scheduleCount').textContent=rows.length;
 const totalMinutes=rows.reduce((sum,item)=>sum+minutes(item.end)-minutes(item.start),0);
 $('#scheduleHours').textContent=(totalMinutes/60).toFixed(1);
}
function conflicts(candidate,ignoreId=''){
 return rows.some(item=>item.id!==ignoreId&&item.day===candidate.day&&minutes(candidate.start)<minutes(item.end)&&minutes(candidate.end)>minutes(item.start));
}
$('#add')?.addEventListener('click',()=>{
 const item={id:uid(),course:$('#course').value.trim().toUpperCase(),day:$('#day').value,start:$('#start').value,end:$('#end').value,room:$('#room').value.trim(),teacher:$('#teacher').value.trim()};
 if(!item.course||minutes(item.start)<0||minutes(item.end)<=minutes(item.start))return toast('تحقق من المادة والوقت',true);
 if(conflicts(item))return toast('يوجد تعارض مع محاضرة ثانية في نفس اليوم',true);
 rows.push(item);save();toast('تمت إضافة المحاضرة');trackEvent('schedule_event_added',{day:item.day});
 $('#course').value='';$('#room').value='';$('#teacher').value='';
});
$('#week')?.addEventListener('click',event=>{
 const button=event.target.closest('[data-delete-event]');if(!button)return;
 rows=rows.filter(item=>item.id!==button.dataset.deleteEvent);save();toast('تم حذف المحاضرة');
});
$('#clearSchedule')?.addEventListener('click',()=>{
 if(!rows.length)return;
 if(!confirm('مسح الجدول كاملًا؟'))return;
 rows=[];save();toast('تم مسح الجدول');
});
$('#printSchedule')?.addEventListener('click',()=>window.print());
$('#exportSchedule')?.addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({version:39,exported_at:new Date().toISOString(),courses:rows},null,2)],{type:'application/json'});
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='uonhub-schedule.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
});
render();trackEvent('page_view',{page:'schedule'});
