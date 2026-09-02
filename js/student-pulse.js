import {nextAcademicEvent,eventState,daysUntil,formatAcademicDate,omanDate} from './academic-calendar-data.js?v=61.1.0';
import {nextStudentTask,hoursUntilTask,formatTaskDue,taskDueState} from './student-tasks-data.js?v=61.1.0';

const SCHEDULE_KEY='uon-v7-schedule';
const PREF_KEY='uon_notification_preferences';
const NOTICE_KEY='uon_student_pulse_notified_v61';
const DAY_INDEX={'الأحد':0,'الاثنين':1,'الثلاثاء':2,'الأربعاء':3,'الخميس':4};
const EN_DAY_INDEX={Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function parseMinutes(value){const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));if(!m)return null;return Number(m[1])*60+Number(m[2])}
function muscatClock(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Muscat',weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return {day:EN_DAY_INDEX[map.weekday]??0,minutes:Number(map.hour)*60+Number(map.minute),date:omanDate(now)};
}
export function formatClassTime(value){const minutes=parseMinutes(value);if(minutes==null)return value||'';const hour24=Math.floor(minutes/60),minute=String(minutes%60).padStart(2,'0'),hour12=hour24%12||12;return `${hour12}:${minute} ${hour24<12?'ص':'م'}`}
export function readSchedule(){const rows=readJson(SCHEDULE_KEY,[]);return Array.isArray(rows)?rows.filter(row=>row&&DAY_INDEX[row.day]!==undefined&&parseMinutes(row.start)!=null&&parseMinutes(row.end)!=null):[]}
export function nextClass(now=new Date()){
 const rows=readSchedule();if(!rows.length)return null;const clock=muscatClock(now),candidates=[];
 for(const row of rows){const start=parseMinutes(row.start),end=parseMinutes(row.end);let delta=(DAY_INDEX[row.day]-clock.day+7)%7,state='upcoming';if(delta===0&&clock.minutes>=start&&clock.minutes<end)state='now';else if(delta===0&&clock.minutes>=end)delta=7;const score=delta*1440+Math.max(0,start-(delta===0?clock.minutes:0));candidates.push({...row,deltaDays:delta,state,score,startMinutes:start,endMinutes:end})}
 return candidates.sort((a,b)=>a.state==='now'?-1:b.state==='now'?1:a.score-b.score)[0]||null;
}
export function currentAcademicPulse(now=new Date()){const event=nextAcademicEvent(now);if(!event)return null;const state=eventState(event,now),remaining=daysUntil(event.start,now);return {...event,state,daysUntilStart:remaining,dateLabel:event.start===event.end?formatAcademicDate(event.start):`${formatAcademicDate(event.start)} – ${formatAcademicDate(event.end)}`}}
function addStyle(){if(document.querySelector('link[data-student-pulse]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/student-pulse.css?v=61.1.0';link.dataset.studentPulse='1';document.head.append(link)}
function renderBanner(item){if(!item||document.querySelector(`[data-pulse-id="${CSS.escape(item.id)}"]`))return;addStyle();const box=document.createElement('aside');box.className='uon-smart-alert';box.dataset.pulseId=item.id;box.setAttribute('role','status');box.innerHTML=`<span class="uon-smart-alert__icon">${item.icon}</span><div><strong>${item.title}</strong><p>${item.body}</p></div><a href="${item.url}">فتح</a><button type="button" aria-label="إغلاق">×</button>`;box.querySelector('button').addEventListener('click',()=>box.remove());document.body.append(box)}
function notificationPreferences(){return readJson(PREF_KEY,{topics:[],class_lead_minutes:30,task_lead_hours:12})}
function notifiedSet(){const data=readJson(NOTICE_KEY,[]);return new Set(Array.isArray(data)?data:[])}
function rememberNotification(key,set){set.add(key);localStorage.setItem(NOTICE_KEY,JSON.stringify([...set].slice(-160)))}
function notify(key,title,body,url,set){if(!('Notification' in window)||Notification.permission!=='granted'||set.has(key))return;try{const notification=new Notification(title,{body,icon:'/assets/icons/icon-192.png',tag:key});notification.onclick=()=>{window.focus();location.href=url};rememberNotification(key,set)}catch{}}
export function runStudentPulse(now=new Date()){
 if(document.body.classList.contains('admin-page'))return;
 const pref=notificationPreferences(),topics=new Set(pref.topics||[]),seen=notifiedSet(),clock=muscatClock(now);
 const klass=nextClass(now);
 if(klass&&klass.deltaDays===0){const until=klass.startMinutes-clock.minutes,lead=Math.min(180,Math.max(5,Number(pref.class_lead_minutes)||30));if(klass.state==='now')renderBanner({kind:'class',id:`now-${klass.id||klass.course}-${clock.date}`,icon:'🎓',title:`${klass.course} الآن`,body:`${formatClassTime(klass.start)} – ${formatClassTime(klass.end)}${klass.room?` • ${klass.room}`:''}`,url:'schedule.html'});else if(until>=0&&until<=lead){const body=`بعد ${until} دقيقة • ${formatClassTime(klass.start)}${klass.room?` • ${klass.room}`:''}`;renderBanner({kind:'class',id:`soon-${klass.id||klass.course}-${clock.date}`,icon:'⏰',title:`محاضرتك القادمة: ${klass.course}`,body,url:'schedule.html'});if(topics.has('classes'))notify(`uon-class-${klass.id||klass.course}-${clock.date}`,`محاضرتك القادمة: ${klass.course}`,body,'schedule.html',seen)}}
 const task=nextStudentTask(now);
 if(task){const state=taskDueState(task,now),hours=hoursUntilTask(task,now),lead=Math.min(168,Math.max(1,Number(pref.task_lead_hours)||12));const title=task.course?`${task.title} • ${task.course}`:task.title;if(state==='overdue')renderBanner({kind:'task',id:`task-overdue-${task.id}`,icon:'⚠️',title:'مهمة متأخرة',body:`${title} • كان موعدها ${formatTaskDue(task)}`,url:'tasks.html'});else if(hours!==null&&hours>=0&&hours<=lead){const body=hours<1?`باقي أقل من ساعة • ${formatTaskDue(task)}`:hours<2?`باقي حوالي ساعة • ${formatTaskDue(task)}`:`باقي ${Math.ceil(hours)} ساعة • ${formatTaskDue(task)}`;renderBanner({kind:'task',id:`task-soon-${task.id}`,icon:'✅',title:`موعد مهمة قريب: ${title}`,body,url:'tasks.html'});if(topics.has('tasks'))notify(`uon-task-${task.id}-${task.due}`,`موعد مهمة قريب: ${title}`,body,'tasks.html',seen)}}
 const academic=currentAcademicPulse(now);
 if(academic&&topics.has('calendar')){const key=`uon-academic-${academic.start}-${academic.title}`;if(academic.state==='active'){const body=academic.start===academic.end?'اليوم':`مستمر حتى ${formatAcademicDate(academic.end)}`;renderBanner({kind:'academic',id:`academic-${academic.start}`,icon:academic.icon,title:academic.title,body,url:'academic-calendar.html'});notify(key,academic.title,body,'academic-calendar.html',seen)}else if(academic.daysUntilStart>=0&&academic.daysUntilStart<=2){const body=academic.daysUntilStart===0?'يبدأ اليوم':academic.daysUntilStart===1?'يبدأ بكرة':`يبدأ بعد ${academic.daysUntilStart} أيام`;notify(key,academic.title,body,'academic-calendar.html',seen)}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>runStudentPulse(),{once:true});else runStudentPulse();