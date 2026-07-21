
import {$,esc,setupNav,toast} from './ui.js';setupNav();
const DAYS=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];let items=[];
function minutes(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function conflicts(item,ignore=null){return items.some(x=>x.id!==ignore&&x.day===item.day&&minutes(item.start)<minutes(x.end)&&minutes(item.end)>minutes(x.start))}
function save(){localStorage.setItem('uon-schedule-v2',JSON.stringify(items))}
function render(){
 const week=$('#scheduleWeek');week.innerHTML=DAYS.map(day=>`<section class="schedule-day"><h3>${day}</h3><div>${items.filter(x=>x.day===day).sort((a,b)=>a.start.localeCompare(b.start)).map(x=>`<article class="schedule-event" style="border-inline-start-color:${esc(x.color)}"><strong>${esc(x.course)} ${esc(x.name)}</strong><span>${esc(x.start)}–${esc(x.end)}</span><small>${esc(x.room||'')} ${x.instructor?'• '+esc(x.instructor):''}</small><button data-id="${x.id}" title="حذف"><i class="fas fa-times"></i></button></article>`).join('')||'<p class="day-empty">لا توجد محاضرات</p>'}</div></section>`).join('');
 week.querySelectorAll('button').forEach(b=>b.onclick=()=>{items=items.filter(x=>x.id!==b.dataset.id);save();render()});
 $('#scheduleList').innerHTML=items.length?items.sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||a.start.localeCompare(b.start)).map(x=>`<div class="list-item"><div><p><strong>${esc(x.course)}</strong> ${esc(x.name)}</p><small>${esc(x.day)} ${esc(x.start)}–${esc(x.end)} | ${esc(x.room||'بدون قاعة')}</small></div><button class="outline-btn" data-id="${x.id}">حذف</button></div>`).join(''):'<div class="empty">لم تضف أي محاضرة بعد</div>';
 $('#scheduleList').querySelectorAll('button').forEach(b=>b.onclick=()=>{items=items.filter(x=>x.id!==b.dataset.id);save();render()});
}
$('#addScheduleItem').onclick=()=>{
 const item={id:crypto.randomUUID(),course:$('#scCourse').value.trim(),name:$('#scName').value.trim(),day:$('#scDay').value,start:$('#scStart').value,end:$('#scEnd').value,room:$('#scRoom').value.trim(),instructor:$('#scInstructor').value.trim(),color:$('#scColor').value};
 if(!item.course||!item.start||!item.end)return toast('أدخل رمز المادة والوقت',true);
 if(minutes(item.end)<=minutes(item.start))return toast('وقت النهاية يجب أن يكون بعد البداية',true);
 if(conflicts(item)){const w=$('#scheduleWarning');w.hidden=false;w.className='gpa-advice danger';w.textContent='يوجد تعارض مع محاضرة أخرى في نفس اليوم والوقت.';return}
 $('#scheduleWarning').hidden=true;items.push(item);save();render();toast('تمت إضافة المحاضرة');
};
$('#clearSchedule').onclick=()=>{if(confirm('مسح الجدول كاملًا؟')){items=[];save();render()}};
$('#printSchedule').onclick=()=>window.print();
$('#exportSchedule').onclick=()=>{const blob=new Blob([JSON.stringify(items,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='uon-schedule.json';a.click();URL.revokeObjectURL(a.href)};
$('#importSchedule').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data))throw new Error();items=data;save();render();toast('تم استيراد الجدول')}catch{toast('ملف الجدول غير صالح',true)}};
try{items=JSON.parse(localStorage.getItem('uon-schedule-v2')||'[]')}catch{items=[]}render();
