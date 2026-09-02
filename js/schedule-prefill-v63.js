import {toast} from './core.js?v=63.0.0';
const params=new URLSearchParams(location.search);
if(params.get('prefill')==='1'){
 const course=String(params.get('course')||'').trim().slice(0,24),days=String(params.get('days')||'').split(',').map(x=>x.trim()).filter(Boolean),start=String(params.get('start')||''),end=String(params.get('end')||''),room=String(params.get('room')||'').trim().slice(0,30),teacher=String(params.get('teacher')||'').trim().slice(0,80),type=['lecture','lab','tutorial','workshop','other'].includes(params.get('type'))?params.get('type'):'lecture';
 const split=value=>{const match=/^(\d{2}):(\d{2})$/.exec(value);if(!match)return null;const hour=Number(match[1]),minute=match[2];return{value:`${String(hour%12||12).padStart(2,'0')}:${minute}`,period:hour<12?'am':'pm'}};
 const startClock=split(start),endClock=split(end);
 if(course&&days.length&&startClock&&endClock){
  const courseInput=document.querySelector('#course'),startInput=document.querySelector('#start'),endInput=document.querySelector('#end'),startPeriod=document.querySelector('#startPeriod'),endPeriod=document.querySelector('#endPeriod'),roomInput=document.querySelector('#room'),teacherInput=document.querySelector('#teacher'),typeInput=document.querySelector('#classType');
  if(courseInput)courseInput.value=course;if(startInput)startInput.value=startClock.value;if(endInput)endInput.value=endClock.value;if(startPeriod)startPeriod.value=startClock.period;if(endPeriod)endPeriod.value=endClock.period;if(roomInput)roomInput.value=room;if(teacherInput)teacherInput.value=teacher;if(typeInput)typeInput.value=type;
  const selected=new Set(days);document.querySelectorAll('input[name="days"]').forEach(box=>box.checked=selected.has(box.value));
  const title=document.querySelector('#scheduleFormTitle'),button=document.querySelector('#add');if(title)title.textContent='راجع المحاضرة قبل الإضافة';if(button)button.textContent='تأكيد وإضافة للجدول';
  history.replaceState(null,'',location.pathname);
  setTimeout(()=>{document.querySelector('#scheduleForm')?.scrollIntoView({behavior:'smooth',block:'center'});courseInput?.focus();toast('جهز UON AI المحاضرة. راجع التفاصيل واضغط تأكيد وإضافة ✅')},100);
 }
}
