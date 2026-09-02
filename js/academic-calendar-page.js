import {ACADEMIC_EVENTS,formatAcademicDate,nextDayCompact} from './academic-calendar-data.js?v=61.0.0';

const list=document.querySelector('#calendarList');
const downloadAll=document.querySelector('#downloadAll');
const shareCalendar=document.querySelector('#shareCalendar');

function render(){
 if(!list)return;
 list.innerHTML=ACADEMIC_EVENTS.map((event,index)=>`<article class="calendar-event"><div class="calendar-icon" aria-hidden="true">${event.icon}</div><div><h3>${event.title}</h3><p class="calendar-date">${formatAcademicDate(event.start)}${event.start!==event.end?` – ${formatAcademicDate(event.end)}`:''}</p></div><button class="btn" type="button" data-calendar-index="${index}">📅 إضافة للتقويم</button></article>`).join('');
 list.querySelectorAll('[data-calendar-index]').forEach(button=>button.addEventListener('click',()=>download([ACADEMIC_EVENTS[Number(button.dataset.calendarIndex)]])));
}

function escapeIcs(value=''){return String(value).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function ics(items){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UON Hub//Academic Calendar//AR','CALSCALE:GREGORIAN','X-WR-CALNAME:UON Hub - التقويم الأكاديمي 2026/2027'];
 items.forEach((event,index)=>lines.push('BEGIN:VEVENT',`UID:uonhub-academic-2026-${index}-${event.start}@uonhub.space`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,'DTSTART;VALUE=DATE:'+event.start.replaceAll('-',''),'DTEND;VALUE=DATE:'+nextDayCompact(event.end),'SUMMARY:'+escapeIcs(event.title),'DESCRIPTION:UON Hub - التقويم الأكاديمي للفصل الدراسي الأول 2026/2027','END:VEVENT'));
 lines.push('END:VCALENDAR');
 return lines.join('\r\n')+'\r\n';
}
function download(items){
 const url=URL.createObjectURL(new Blob([ics(items)],{type:'text/calendar;charset=utf-8'}));
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download='UON-Hub-Academic-Calendar-2026-2027.ics';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

render();
downloadAll?.addEventListener('click',()=>download(ACADEMIC_EVENTS));
shareCalendar?.addEventListener('click',async()=>{
 const file=new File([ics(ACADEMIC_EVENTS)],'UON-Hub-Academic-Calendar-2026-2027.ics',{type:'text/calendar'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){
  try{await navigator.share({title:'التقويم الأكاديمي 2026/2027',text:'التقويم الأكاديمي من UON Hub',files:[file]});return}catch{}
 }
 download(ACADEMIC_EVENTS);
});
