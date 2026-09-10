import {ACADEMIC_EVENTS,dateAtMuscatMidnight,omanDate,nextDayCompact} from './academic-calendar-data.js?v=61.0.0';

const list=document.querySelector('#calendarList');
const downloadAll=document.querySelector('#downloadAll');
const shareCalendar=document.querySelector('#shareCalendar');
const lang=localStorage.getItem('uon_language')==='en'?'en':'ar',en=lang==='en';
const t=(ar,enText)=>en?enText:ar;
const titles={
 'فترة التسجيل الثانية':'Second registration period',
 'بداية الدراسة + أسبوع الحذف والإضافة':'Classes begin + Add/Drop week',
 'فترة الحذف والإضافة':'Add/Drop period',
 'أسبوع التهيئة للطلبة الجدد':'New student orientation week',
 'الاختبار الأول – الأسبوع الأول':'First exam period – Week 1',
 'الاختبار الأول – الأسبوع الثاني':'First exam period – Week 2',
 'الاختبار الثاني – الأسبوع الأول':'Second exam period – Week 1',
 'الاختبار الثاني – الأسبوع الثاني':'Second exam period – Week 2',
 'آخر يوم للانسحاب بدرجة (W)':'Last day to withdraw with (W)',
 'فترة التسجيل الأولى لفصل الربيع':'First registration period for Spring',
 'آخر يوم للانسحاب بدرجة (WF)':'Last day to withdraw with (WF)',
 'آخر يوم للدراسة':'Last day of classes',
 'الاختبارات النهائية':'Final examinations'
};
function titleOf(event){return en?(titles[event.title]||event.title):event.title}
function formatDate(value){return new Intl.DateTimeFormat(en?'en-GB':'ar-OM',{timeZone:'Asia/Muscat',day:'numeric',month:'long',year:'numeric'}).format(dateAtMuscatMidnight(value))}
function state(event){const today=omanDate(new Date());if(today<event.start)return'upcoming';if(today>event.end)return'past';return'active'}
function stateLabel(value){return value==='active'?t('اليوم / جاري','Active'):value==='past'?t('انتهى','Past'):t('قادم','Upcoming')}

function render(){
 if(!list)return;
 list.innerHTML=ACADEMIC_EVENTS.map((event,index)=>{const s=state(event);return `<article class="calendar-event ${s}"><div class="calendar-icon" aria-hidden="true">${event.icon}</div><div><h3>${titleOf(event)}${s==='active'?`<span class="calendar-state">${stateLabel(s)}</span>`:''}</h3><p class="calendar-date">${formatDate(event.start)}${event.start!==event.end?` – ${formatDate(event.end)}`:''}</p></div><button class="btn" type="button" data-calendar-index="${index}">${t('📅 إضافة للتقويم','📅 Add to calendar')}</button></article>`}).join('');
 list.querySelectorAll('[data-calendar-index]').forEach(button=>button.addEventListener('click',()=>download([ACADEMIC_EVENTS[Number(button.dataset.calendarIndex)]])));
}
function escapeIcs(value=''){return String(value).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function ics(items){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UON Hub//Academic Calendar//AR','CALSCALE:GREGORIAN','X-WR-CALNAME:UON Hub - Academic Calendar 2026/2027'];items.forEach((event,index)=>lines.push('BEGIN:VEVENT',`UID:uonhub-academic-2026-${index}-${event.start}@uonhub.space`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,'DTSTART;VALUE=DATE:'+event.start.replaceAll('-',''),'DTEND;VALUE=DATE:'+nextDayCompact(event.end),'SUMMARY:'+escapeIcs(titleOf(event)),'DESCRIPTION:'+escapeIcs(t('UON Hub - التقويم الأكاديمي للفصل الدراسي الأول 2026/2027','UON Hub - Academic Calendar, First Semester 2026/2027')),'END:VEVENT'));lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n'}
function download(items){const url=URL.createObjectURL(new Blob([ics(items)],{type:'text/calendar;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='UON-Hub-Academic-Calendar-2026-2027.ics';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
render();
downloadAll?.addEventListener('click',()=>download(ACADEMIC_EVENTS));
shareCalendar?.addEventListener('click',async()=>{const file=new File([ics(ACADEMIC_EVENTS)],'UON-Hub-Academic-Calendar-2026-2027.ics',{type:'text/calendar'});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:t('التقويم الأكاديمي 2026/2027','Academic Calendar 2026/2027'),text:t('التقويم الأكاديمي من UON Hub','Academic calendar from UON Hub'),files:[file]});return}catch{}}download(ACADEMIC_EVENTS)});
