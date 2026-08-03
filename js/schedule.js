import {setupNav,enforceUonMaintenance,watchUonMaintenance,$,toast,esc,uid} from './core.js?v=43.0.0';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();

const STORAGE_KEY='uon-v7-schedule';
const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const dayNames={
 'الأحد':{ar:'الأحد',en:'Sunday'},
 'الاثنين':{ar:'الاثنين',en:'Monday'},
 'الثلاثاء':{ar:'الثلاثاء',en:'Tuesday'},
 'الأربعاء':{ar:'الأربعاء',en:'Wednesday'},
 'الخميس':{ar:'الخميس',en:'Thursday'}
};

const form=$('#scheduleForm');
const week=$('#week');
const courseInput=$('#course');
const dayInput=$('#day');
const startInput=$('#start');
const endInput=$('#end');
const roomInput=$('#room');
const teacherInput=$('#teacher');
const countElement=$('#scheduleCount');
const clearButton=$('#clearSchedule');

const language=()=>document.documentElement.lang?.toLowerCase().startsWith('en')?'en':'ar';
const t=(ar,en)=>language()==='en'?en:ar;

function parseTime(value){
 const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));
 if(!match)return null;
 const hour=Number(match[1]);
 const minute=Number(match[2]);
 if(hour<0||hour>23||minute<0||minute>59)return null;
 return hour*60+minute;
}

function normaliseCampusTime(value){
 let total=parseTime(value);
 if(total==null)return null;
 const hour=Math.floor(total/60);
 // University classes do not run between 1:00 and 7:59 AM. Treat these
 // ambiguous browser values as afternoon/evening to avoid 12:00 -> 01:50 errors.
 if(hour>=1&&hour<=7)total+=12*60;
 return total;
}

function toTimeValue(total){
 const safe=((Number(total)||0)%1440+1440)%1440;
 return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`;
}

function formatTime(total){
 const safe=((Number(total)||0)%1440+1440)%1440;
 const hour24=Math.floor(safe/60);
 const minute=String(safe%60).padStart(2,'0');
 const hour12=hour24%12||12;
 if(language()==='en')return `${hour12}:${minute} ${hour24<12?'AM':'PM'}`;
 return `${hour12}:${minute} ${hour24<12?'ص':'م'}`;
}

function normaliseCourse(value){
 const clean=String(value||'').trim();
 return /^[a-z]{2,8}\s*\d{2,4}[a-z]?$/i.test(clean)?clean.toUpperCase().replace(/\s+/g,''):clean;
}

function normaliseRow(row){
 if(!row||!days.includes(row.day))return null;
 const course=normaliseCourse(row.course);
 const startMinutes=normaliseCampusTime(row.start);
 const endMinutes=normaliseCampusTime(row.end);
 if(!course||startMinutes==null||endMinutes==null||endMinutes<=startMinutes)return null;
 return {
  id:String(row.id||uid()),
  course,
  day:row.day,
  start:toTimeValue(startMinutes),
  end:toTimeValue(endMinutes),
  room:String(row.room||'').trim(),
  teacher:String(row.teacher||'').trim()
 };
}

function loadRows(){
 try{
  const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  if(!Array.isArray(raw))return [];
  return raw.map(normaliseRow).filter(Boolean);
 }catch(error){
  console.warn('Could not read saved schedule',error);
  return [];
 }
}

let rows=loadRows();

function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rows))}
 catch(error){console.error(error);toast(t('تعذر حفظ الجدول على الجهاز','Could not save the schedule on this device'),true)}
 render();
}

function countLabel(count){
 if(language()==='en')return `${count} ${count===1?'class':'classes'}`;
 if(count===0)return '0 محاضرات';
 if(count===1)return 'محاضرة واحدة';
 if(count===2)return 'محاضرتان';
 if(count>=3&&count<=10)return `${count} محاضرات`;
 return `${count} محاضرة`;
}

function eventMarkup(item){
 const start=normaliseCampusTime(item.start);
 const end=normaliseCampusTime(item.end);
 const meta=[];
 if(item.room)meta.push(`<div class="schedule-meta-row"><dt>${t('القاعة','Room')}</dt><dd>${esc(item.room)}</dd></div>`);
 if(item.teacher)meta.push(`<div class="schedule-meta-row"><dt>${t('الدكتور','Instructor')}</dt><dd>${esc(item.teacher)}</dd></div>`);
 return `<article class="schedule-event">
  <div class="schedule-event-top">
   <strong class="schedule-course">${esc(item.course)}</strong>
   <span class="schedule-time" dir="ltr">${formatTime(start)} – ${formatTime(end)}</span>
  </div>
  ${meta.length?`<dl class="schedule-meta">${meta.join('')}</dl>`:''}
  <button class="schedule-delete" type="button" data-delete-id="${esc(item.id)}" aria-label="${t('حذف','Delete')} ${esc(item.course)}">${t('حذف','Delete')}</button>
 </article>`;
}

function render(){
 if(!week)return;
 week.innerHTML=days.map(day=>{
  const events=rows
   .filter(item=>item.day===day)
   .sort((a,b)=>normaliseCampusTime(a.start)-normaliseCampusTime(b.start));
  return `<section class="schedule-day">
   <h3>${dayNames[day][language()]}</h3>
   <div class="schedule-day-events">${events.length?events.map(eventMarkup).join(''):`<p class="schedule-empty">${t('فارغ','Empty')}</p>`}</div>
  </section>`;
 }).join('');

 week.querySelectorAll('[data-delete-id]').forEach(button=>{
  button.addEventListener('click',()=>{
   rows=rows.filter(item=>item.id!==button.dataset.deleteId);
   save();
   toast(t('تم حذف المحاضرة','Class deleted'));
  });
 });

 if(countElement)countElement.textContent=countLabel(rows.length);
 if(clearButton)clearButton.hidden=rows.length===0;
}

function findConflict(candidate){
 const start=normaliseCampusTime(candidate.start);
 const end=normaliseCampusTime(candidate.end);
 return rows.find(item=>{
  if(item.day!==candidate.day)return false;
  const itemStart=normaliseCampusTime(item.start);
  const itemEnd=normaliseCampusTime(item.end);
  return start<itemEnd&&end>itemStart;
 });
}

form?.addEventListener('submit',event=>{
 event.preventDefault();
 const rawStart=startInput.value;
 const rawEnd=endInput.value;
 const startMinutes=normaliseCampusTime(rawStart);
 const endMinutes=normaliseCampusTime(rawEnd);
 const course=normaliseCourse(courseInput.value);

 if(!course||startMinutes==null||endMinutes==null){
  toast(t('أدخل المادة ووقت البداية والنهاية','Enter the course, start time, and end time'),true);
  courseInput.focus();
  return;
 }
 if(endMinutes<=startMinutes){
  toast(t('وقت النهاية يجب أن يكون بعد وقت البداية','The end time must be after the start time'),true);
  endInput.focus();
  return;
 }

 const candidate={
  id:uid(),
  course,
  day:dayInput.value,
  start:toTimeValue(startMinutes),
  end:toTimeValue(endMinutes),
  room:roomInput.value.trim(),
  teacher:teacherInput.value.trim()
 };
 const conflict=findConflict(candidate);
 if(conflict){
  toast(t(`يوجد تعارض مع ${conflict.course} (${formatTime(normaliseCampusTime(conflict.start))} – ${formatTime(normaliseCampusTime(conflict.end))})`,`Conflicts with ${conflict.course} (${formatTime(normaliseCampusTime(conflict.start))} – ${formatTime(normaliseCampusTime(conflict.end))})`),true);
  return;
 }

 const corrected=candidate.start!==rawStart||candidate.end!==rawEnd;
 rows.push(candidate);
 startInput.value=candidate.start;
 endInput.value=candidate.end;
 courseInput.value='';
 roomInput.value='';
 teacherInput.value='';
 save();
 courseInput.focus();
 toast(corrected?t('تمت الإضافة وحُسب الوقت بعد الظهر تلقائيًا','Class added and PM time was corrected automatically'):t('تمت الإضافة','Class added'));
});

clearButton?.addEventListener('click',()=>{
 if(!rows.length)return;
 if(!window.confirm(t('متأكد تريد مسح جميع محاضرات الجدول؟','Clear every class from the schedule?')))return;
 rows=[];
 save();
 toast(t('تم مسح الجدول','Schedule cleared'));
});

window.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY)return;
 rows=loadRows();
 render();
});

new MutationObserver(mutations=>{
 if(mutations.some(item=>item.attributeName==='lang'))render();
}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

// Persist repaired legacy values such as 01:50 intended as 1:50 PM.
try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rows))}catch{}
render();
