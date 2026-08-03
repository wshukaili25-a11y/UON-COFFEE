import {setupNav,enforceUonMaintenance,watchUonMaintenance,$,toast,esc,uid} from './core.js?v=43.1.0';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();

const STORAGE_KEY='uon-v7-schedule';
const EXPORT_FORMAT='uonhub-schedule';
const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const dayNames={
 'الأحد':{ar:'الأحد',en:'Sunday'},
 'الاثنين':{ar:'الاثنين',en:'Monday'},
 'الثلاثاء':{ar:'الثلاثاء',en:'Tuesday'},
 'الأربعاء':{ar:'الأربعاء',en:'Wednesday'},
 'الخميس':{ar:'الخميس',en:'Thursday'}
};
const typeNames={
 lecture:{ar:'محاضرة',en:'Lecture'},
 lab:{ar:'مختبر / عملي',en:'Lab / Practical'},
 tutorial:{ar:'تمارين',en:'Tutorial'},
 workshop:{ar:'ورشة',en:'Workshop'},
 other:{ar:'أخرى',en:'Other'}
};
const allowedTypes=Object.keys(typeNames);
const palette=['#22d3ee','#818cf8','#34d399','#fbbf24','#fb7185','#c084fc','#60a5fa','#f97316'];

const form=$('#scheduleForm');
const week=$('#week');
const courseInput=$('#course');
const typeInput=$('#classType');
const startInput=$('#start');
const startPeriodInput=$('#startPeriod');
const endInput=$('#end');
const endPeriodInput=$('#endPeriod');
const roomInput=$('#room');
const teacherInput=$('#teacher');
const countElement=$('#scheduleCount');
const clearButton=$('#clearSchedule');
const submitButton=$('#add');
const cancelEditButton=$('#cancelEdit');
const editingBadge=$('#editingBadge');
const formTitle=$('#scheduleFormTitle');
const exportImageButton=$('#exportImage');
const printButton=$('#printSchedule');
const exportJsonButton=$('#exportJson');
const importJsonButton=$('#importJson');
const importFileInput=$('#importFile');
const dayCheckboxes=Array.from(document.querySelectorAll('input[name="days"]'));

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

function clockToMinutes(value,period){
 const parsed=parseTime(value);
 if(parsed==null)return null;
 let hour=Math.floor(parsed/60);
 const minute=parsed%60;
 if(hour>12)return parsed;
 if(hour===0)hour=12;
 if(period==='pm'&&hour<12)hour+=12;
 if(period==='am'&&hour===12)hour=0;
 return hour*60+minute;
}

function legacyStoredMinutes(value,period){
 if(period==='am'||period==='pm')return clockToMinutes(value,period);
 const parsed=parseTime(value);
 if(parsed==null)return null;
 const hour=Math.floor(parsed/60);
 return hour>=1&&hour<=7?parsed+12*60:parsed;
}

function toTimeValue(total){
 const safe=((Number(total)||0)%1440+1440)%1440;
 return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`;
}

function splitClock(total){
 const safe=((Number(total)||0)%1440+1440)%1440;
 const hour24=Math.floor(safe/60);
 const minute=safe%60;
 return {
  value:`${String(hour24%12||12).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
  period:hour24<12?'am':'pm'
 };
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

function colourForCourse(course){
 let hash=0;
 for(const char of String(course||''))hash=(hash*31+char.charCodeAt(0))>>>0;
 return palette[hash%palette.length];
}

function normaliseRows(rawRows){
 if(!Array.isArray(rawRows))return [];
 const legacyGroups=new Map();
 const seenIds=new Set();
 const output=[];
 for(const raw of rawRows){
  if(!raw||!days.includes(raw.day))continue;
  const course=normaliseCourse(raw.course);
  const startMinutes=legacyStoredMinutes(raw.start,raw.startPeriod);
  const endMinutes=legacyStoredMinutes(raw.end,raw.endPeriod);
  if(!course||startMinutes==null||endMinutes==null||endMinutes<=startMinutes)continue;
  const type=allowedTypes.includes(raw.type)?raw.type:'lecture';
  const room=String(raw.room||'').trim();
  const teacher=String(raw.teacher||'').trim();
  const key=[course,startMinutes,endMinutes,room,teacher,type].join('|');
  let seriesId=String(raw.seriesId||raw.series_id||'');
  if(!seriesId){
   if(!legacyGroups.has(key))legacyGroups.set(key,uid());
   seriesId=legacyGroups.get(key);
  }
  let id=String(raw.id||uid());
  while(seenIds.has(id))id=uid();
  seenIds.add(id);
  output.push({
   id,seriesId,course,day:raw.day,
   start:toTimeValue(startMinutes),end:toTimeValue(endMinutes),
   room,teacher,type
  });
 }
 return output;
}

function loadRows(){
 try{return normaliseRows(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'))}
 catch(error){console.warn('Could not read saved schedule',error);return []}
}

let rows=loadRows();
let editingSeriesId=null;

function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rows))}
 catch(error){console.error(error);toast(t('تعذر حفظ الجدول على الجهاز','Could not save the schedule on this device'),true)}
 render();
}

function selectedDays(){return dayCheckboxes.filter(input=>input.checked).map(input=>input.value)}
function setSelectedDays(values){
 const selected=new Set(values);
 dayCheckboxes.forEach(input=>{input.checked=selected.has(input.value)});
}

function countLabel(){
 const courses=new Set(rows.map(row=>row.course)).size;
 if(language()==='en')return `${rows.length} ${rows.length===1?'class':'classes'} • ${courses} ${courses===1?'course':'courses'}`;
 return `${rows.length} محاضرة • ${courses} مادة`;
}

function seriesCount(seriesId){return rows.filter(row=>row.seriesId===seriesId).length}

function eventMarkup(item){
 const start=parseTime(item.start);
 const end=parseTime(item.end);
 const repeatCount=seriesCount(item.seriesId);
 const accent=colourForCourse(item.course);
 const meta=[];
 if(item.room)meta.push(`<div class="schedule-meta-row"><dt>${t('القاعة','Room')}</dt><dd>${esc(item.room)}</dd></div>`);
 if(item.teacher)meta.push(`<div class="schedule-meta-row"><dt>${t('الدكتور','Instructor')}</dt><dd>${esc(item.teacher)}</dd></div>`);
 const repeat=repeatCount>1?`<span class="schedule-repeat-badge">${t(`يتكرر ${repeatCount} أيام`,`Repeats ${repeatCount} days`)}</span>`:'';
 const actionsClass=repeatCount>1?'schedule-event-actions three-actions':'schedule-event-actions';
 return `<article class="schedule-event" style="--event-accent:${accent}">
  <div class="schedule-event-top">
   <div class="schedule-event-title">
    <strong class="schedule-course">${esc(item.course)}</strong>
    <div class="schedule-badges"><span class="schedule-type-badge">${typeNames[item.type][language()]}</span>${repeat}</div>
   </div>
   <span class="schedule-time" dir="ltr">${formatTime(start)} – ${formatTime(end)}</span>
  </div>
  ${meta.length?`<dl class="schedule-meta">${meta.join('')}</dl>`:''}
  <div class="${actionsClass}">
   <button class="schedule-event-button edit" type="button" data-edit-id="${esc(item.id)}">${t('تعديل','Edit')}</button>
   <button class="schedule-event-button delete" type="button" data-delete-id="${esc(item.id)}">${repeatCount>1?t('حذف هذا اليوم','Delete this day'):t('حذف','Delete')}</button>
   ${repeatCount>1?`<button class="schedule-event-button delete-series" type="button" data-delete-series="${esc(item.seriesId)}">${t('حذف كل الأيام','Delete all days')}</button>`:''}
  </div>
 </article>`;
}

function render(){
 if(!week)return;
 week.innerHTML=days.map(day=>{
  const events=rows.filter(item=>item.day===day).sort((a,b)=>parseTime(a.start)-parseTime(b.start));
  return `<section class="schedule-day">
   <h3>${dayNames[day][language()]}</h3>
   <div class="schedule-day-events">${events.length?events.map(eventMarkup).join(''):`<p class="schedule-empty">${t('فارغ','Empty')}</p>`}</div>
  </section>`;
 }).join('');

 week.querySelectorAll('[data-edit-id]').forEach(button=>button.addEventListener('click',()=>beginEdit(button.dataset.editId)));
 week.querySelectorAll('[data-delete-id]').forEach(button=>button.addEventListener('click',()=>deleteDay(button.dataset.deleteId)));
 week.querySelectorAll('[data-delete-series]').forEach(button=>button.addEventListener('click',()=>deleteSeries(button.dataset.deleteSeries)));

 if(countElement)countElement.textContent=countLabel();
 if(clearButton)clearButton.hidden=rows.length===0;
 [exportImageButton,printButton,exportJsonButton].forEach(button=>{if(button)button.disabled=rows.length===0});
}

function syncFormMode(){
 const editing=Boolean(editingSeriesId);
 if(formTitle)formTitle.textContent=editing?t('تعديل المادة','Edit course'):t('إضافة محاضرة','Add a class');
 if(submitButton)submitButton.textContent=editing?t('حفظ التعديلات','Save changes'):t('إضافة للجدول','Add to schedule');
 if(cancelEditButton)cancelEditButton.hidden=!editing;
 if(editingBadge)editingBadge.hidden=!editing;
}

function resetForm({focus=true}={}){
 editingSeriesId=null;
 form?.reset();
 setSelectedDays(['الأحد']);
 if(startInput)startInput.value='08:00';
 if(endInput)endInput.value='09:50';
 if(startPeriodInput)startPeriodInput.value='am';
 if(endPeriodInput)endPeriodInput.value='am';
 if(typeInput)typeInput.value='lecture';
 syncFormMode();
 if(focus)courseInput?.focus();
}

function beginEdit(id){
 const item=rows.find(row=>row.id===id);
 if(!item)return;
 const group=rows.filter(row=>row.seriesId===item.seriesId);
 editingSeriesId=item.seriesId;
 courseInput.value=item.course;
 typeInput.value=item.type;
 roomInput.value=item.room;
 teacherInput.value=item.teacher;
 const start=splitClock(parseTime(item.start));
 const end=splitClock(parseTime(item.end));
 startInput.value=start.value;
 startPeriodInput.value=start.period;
 endInput.value=end.value;
 endPeriodInput.value=end.period;
 setSelectedDays(group.map(row=>row.day));
 syncFormMode();
 form?.scrollIntoView({behavior:'smooth',block:'center'});
 courseInput.focus();
}

function findConflict(candidates,excludeSeriesId=null,sourceRows=rows){
 for(const candidate of candidates){
  const start=parseTime(candidate.start);
  const end=parseTime(candidate.end);
  const conflict=sourceRows.find(item=>{
   if(excludeSeriesId&&item.seriesId===excludeSeriesId)return false;
   if(item.day!==candidate.day)return false;
   const itemStart=parseTime(item.start);
   const itemEnd=parseTime(item.end);
   return start<itemEnd&&end>itemStart;
  });
  if(conflict)return {candidate,conflict};
 }
 return null;
}

function findInternalConflict(list){
 for(const day of days){
  const dayRows=list.filter(row=>row.day===day).sort((a,b)=>parseTime(a.start)-parseTime(b.start));
  for(let index=0;index<dayRows.length;index++){
   for(let next=index+1;next<dayRows.length;next++){
    if(parseTime(dayRows[next].start)>=parseTime(dayRows[index].end))break;
    if(parseTime(dayRows[next].start)<parseTime(dayRows[index].end))return {first:dayRows[index],second:dayRows[next]};
   }
  }
 }
 return null;
}

form?.addEventListener('submit',event=>{
 event.preventDefault();
 const course=normaliseCourse(courseInput.value);
 const chosenDays=selectedDays();
 const startMinutes=clockToMinutes(startInput.value,startPeriodInput.value);
 const endMinutes=clockToMinutes(endInput.value,endPeriodInput.value);
 if(!course){toast(t('أدخل رمز المادة أو اسمها','Enter the course code or name'),true);courseInput.focus();return}
 if(!chosenDays.length){toast(t('اختر يومًا واحدًا على الأقل','Select at least one day'),true);dayCheckboxes[0]?.focus();return}
 if(startMinutes==null||endMinutes==null){toast(t('تحقق من وقت البداية والنهاية','Check the start and end times'),true);startInput.focus();return}
 if(endMinutes<=startMinutes){toast(t('وقت النهاية يجب أن يكون بعد وقت البداية','The end time must be after the start time'),true);endInput.focus();return}

 const seriesId=editingSeriesId||uid();
 const existingByDay=new Map(rows.filter(row=>row.seriesId===seriesId).map(row=>[row.day,row]));
 const common={course,start:toTimeValue(startMinutes),end:toTimeValue(endMinutes),room:roomInput.value.trim(),teacher:teacherInput.value.trim(),type:allowedTypes.includes(typeInput.value)?typeInput.value:'lecture',seriesId};
 const candidates=chosenDays.map(day=>({...common,day,id:existingByDay.get(day)?.id||uid()}));
 const result=findConflict(candidates,editingSeriesId);
 if(result){
  const conflict=result.conflict;
  toast(t(`يوجد تعارض يوم ${result.candidate.day} مع ${conflict.course} (${formatTime(parseTime(conflict.start))} – ${formatTime(parseTime(conflict.end))})`,`Conflict on ${dayNames[result.candidate.day].en} with ${conflict.course} (${formatTime(parseTime(conflict.start))} – ${formatTime(parseTime(conflict.end))})`),true);
  return;
 }

 if(editingSeriesId){
  rows=rows.filter(row=>row.seriesId!==editingSeriesId).concat(candidates);
  save();
  toast(t('تم حفظ تعديلات المادة في كل الأيام المحددة','Course changes saved for all selected days'));
 }else{
  rows.push(...candidates);
  save();
  toast(chosenDays.length>1?t(`تمت إضافة المادة في ${chosenDays.length} أيام`,`Course added on ${chosenDays.length} days`):t('تمت الإضافة','Class added'));
 }
 resetForm();
});

cancelEditButton?.addEventListener('click',()=>resetForm());

function deleteDay(id){
 const item=rows.find(row=>row.id===id);
 if(!item)return;
 rows=rows.filter(row=>row.id!==id);
 if(editingSeriesId===item.seriesId)resetForm({focus:false});
 save();
 toast(t('تم حذف المحاضرة من هذا اليوم','Class removed from this day'));
}

function deleteSeries(seriesId){
 const group=rows.filter(row=>row.seriesId===seriesId);
 if(!group.length)return;
 const course=group[0].course;
 if(!window.confirm(t(`حذف ${course} من جميع الأيام؟`,`Delete ${course} from every day?`)))return;
 rows=rows.filter(row=>row.seriesId!==seriesId);
 if(editingSeriesId===seriesId)resetForm({focus:false});
 save();
 toast(t('تم حذف المادة من جميع الأيام','Course removed from all days'));
}

clearButton?.addEventListener('click',()=>{
 if(!rows.length)return;
 if(!window.confirm(t('متأكد تريد مسح جميع محاضرات الجدول؟','Clear every class from the schedule?')))return;
 rows=[];
 resetForm({focus:false});
 save();
 toast(t('تم مسح الجدول','Schedule cleared'));
});

function downloadBlob(blob,fileName){
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;
 link.download=fileName;
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}

exportJsonButton?.addEventListener('click',()=>{
 const payload={format:EXPORT_FORMAT,version:2,exportedAt:new Date().toISOString(),rows};
 downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`uonhub-schedule-${new Date().toISOString().slice(0,10)}.json`);
 toast(t('تم حفظ ملف الجدول','Schedule file saved'));
});

importJsonButton?.addEventListener('click',()=>importFileInput?.click());
importFileInput?.addEventListener('change',async()=>{
 const file=importFileInput.files?.[0];
 if(!file)return;
 try{
  if(file.size>2*1024*1024)throw new Error('file_too_large');
  const parsed=JSON.parse(await file.text());
  const source=Array.isArray(parsed)?parsed:parsed?.rows;
  const imported=normaliseRows(source);
  if(!imported.length)throw new Error('empty_schedule');
  const conflict=findInternalConflict(imported);
  if(conflict)throw new Error(`conflict:${conflict.first.course}:${conflict.second.course}:${conflict.first.day}`);
  if(rows.length&&!window.confirm(t('سيتم استبدال الجدول الحالي بالملف المستورد. متابعة؟','The imported file will replace the current schedule. Continue?')))return;
  rows=imported;
  resetForm({focus:false});
  save();
  toast(t('تم استيراد الجدول بنجاح','Schedule imported successfully'));
 }catch(error){
  console.error(error);
  toast(t('تعذر استيراد الملف. تأكد أنه ملف جدول صحيح وبدون تعارضات.','Could not import the file. Make sure it is a valid schedule without conflicts.'),true);
 }finally{importFileInput.value=''}
});

printButton?.addEventListener('click',()=>window.print());

function roundedRect(context,x,y,width,height,radius){
 const r=Math.min(radius,width/2,height/2);
 context.beginPath();
 context.moveTo(x+r,y);
 context.arcTo(x+width,y,x+width,y+height,r);
 context.arcTo(x+width,y+height,x,y+height,r);
 context.arcTo(x,y+height,x,y,r);
 context.arcTo(x,y,x+width,y,r);
 context.closePath();
}

function fitText(context,text,maxWidth){
 const value=String(text||'');
 if(context.measureText(value).width<=maxWidth)return value;
 let output=value;
 while(output.length>1&&context.measureText(`${output}…`).width>maxWidth)output=output.slice(0,-1);
 return `${output}…`;
}

async function exportScheduleImage(){
 if(!rows.length)return;
 try{
  await document.fonts?.ready;
  const width=2000;
  const margin=56;
  const gap=16;
  const columnWidth=(width-margin*2-gap*4)/5;
  const grouped=days.map(day=>rows.filter(row=>row.day===day).sort((a,b)=>parseTime(a.start)-parseTime(b.start)));
  const maxEvents=Math.max(1,...grouped.map(group=>group.length));
  const eventHeight=126;
  const height=210+maxEvents*(eventHeight+12)+105;
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('canvas_unavailable');

  context.fillStyle='#060b1b';
  context.fillRect(0,0,width,height);
  context.direction='rtl';
  context.textAlign='right';
  context.fillStyle='#f7f9ff';
  context.font='900 52px Tajawal, sans-serif';
  context.fillText(t('الجدول الدراسي','Study Schedule'),width-margin,72);
  context.fillStyle='#9aa8c7';
  context.font='500 24px Tajawal, sans-serif';
  context.fillText(`UON Hub • ${countLabel()}`,width-margin,112);

  grouped.forEach((group,index)=>{
   const x=width-margin-columnWidth-index*(columnWidth+gap);
   const y=148;
   const panelHeight=height-y-70;
   roundedRect(context,x,y,columnWidth,panelHeight,24);
   context.fillStyle='#101833';
   context.fill();
   context.strokeStyle='#26345d';
   context.lineWidth=2;
   context.stroke();
   context.fillStyle='#f7f9ff';
   context.font='800 28px Tajawal, sans-serif';
   context.textAlign='center';
   context.fillText(dayNames[days[index]][language()],x+columnWidth/2,y+47);

   group.forEach((item,eventIndex)=>{
    const cardX=x+14;
    const cardY=y+70+eventIndex*(eventHeight+12);
    const cardWidth=columnWidth-28;
    roundedRect(context,cardX,cardY,cardWidth,eventHeight,18);
    context.fillStyle='#162142';
    context.fill();
    context.strokeStyle='#26345d';
    context.stroke();
    context.fillStyle=colourForCourse(item.course);
    roundedRect(context,cardX+cardWidth-7,cardY,7,eventHeight,4);
    context.fill();

    context.textAlign='right';
    context.direction='rtl';
    context.fillStyle='#f7f9ff';
    context.font='800 24px Tajawal, sans-serif';
    context.fillText(fitText(context,item.course,cardWidth-38),cardX+cardWidth-20,cardY+32);
    context.fillStyle='#c8d3e9';
    context.font='700 19px Tajawal, sans-serif';
    context.fillText(`${formatTime(parseTime(item.start))} – ${formatTime(parseTime(item.end))}`,cardX+cardWidth-20,cardY+61);
    context.fillStyle='#9aa8c7';
    context.font='500 17px Tajawal, sans-serif';
    const details=[typeNames[item.type][language()],item.room?`${t('القاعة','Room')}: ${item.room}`:'',item.teacher||''].filter(Boolean).join(' • ');
    context.fillText(fitText(context,details,cardWidth-38),cardX+cardWidth-20,cardY+92);
   });

   if(!group.length){
    context.fillStyle='#9aa8c7';
    context.font='500 22px Tajawal, sans-serif';
    context.textAlign='center';
    context.fillText(t('فارغ','Empty'),x+columnWidth/2,y+130);
   }
  });

  context.textAlign='right';
  context.fillStyle='#64748b';
  context.font='500 18px Tajawal, sans-serif';
  context.fillText(t('تم إنشاء الجدول بواسطة UON Hub','Created with UON Hub'),width-margin,height-28);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));
  if(!blob)throw new Error('image_export_failed');
  downloadBlob(blob,`uonhub-schedule-${new Date().toISOString().slice(0,10)}.png`);
  toast(t('تم تصدير الجدول كصورة','Schedule exported as an image'));
 }catch(error){
  console.error(error);
  toast(t('تعذر تصدير الصورة على هذا المتصفح','Could not export the image in this browser'),true);
 }
}

exportImageButton?.addEventListener('click',exportScheduleImage);

[startInput,endInput].forEach((input,index)=>input?.addEventListener('change',()=>{
 const parsed=parseTime(input.value);
 if(parsed==null)return;
 const hour=Math.floor(parsed/60);
 const periodInput=index===0?startPeriodInput:endPeriodInput;
 if(hour>12)periodInput.value='pm';
 if(hour===0)periodInput.value='am';
}));

window.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY)return;
 rows=loadRows();
 resetForm({focus:false});
 render();
});

new MutationObserver(mutations=>{
 if(mutations.some(item=>item.attributeName==='lang')){syncFormMode();render()}
}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rows))}catch{}
syncFormMode();
render();
