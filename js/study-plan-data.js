import {readStudentTasks,taskDueState,hoursUntilTask} from './student-tasks-data.js?v=62.2.0';
import {readStudySessions,scheduleCourses} from './study-focus-data.js?v=62.2.0';

const SCHEDULE_KEY='uon-v7-schedule';
const DAY_AR={0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت'};
const DAY_EN={Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function minutes(value){const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));if(!match)return null;return Number(match[1])*60+Number(match[2])}
function toClock(total){const safe=Math.max(0,Math.min(1439,Math.round(Number(total)||0))),h=Math.floor(safe/60),m=safe%60,h12=h%12||12;return `${h12}:${String(m).padStart(2,'0')} ${h<12?'ص':'م'}`}
function muscatClock(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Muscat',weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return {dayIndex:DAY_EN[map.weekday]??0,day:DAY_AR[DAY_EN[map.weekday]??0],minutes:Number(map.hour)*60+Number(map.minute),date:`${map.year}-${map.month}-${map.day}`};
}
function readSchedule(){const rows=readJson(SCHEDULE_KEY,[]);return Array.isArray(rows)?rows.filter(row=>row&&minutes(row.start)!=null&&minutes(row.end)!=null):[]}
function todayClasses(clock){return readSchedule().filter(row=>row.day===clock.day).map(row=>({...row,startMinutes:minutes(row.start),endMinutes:minutes(row.end)})).filter(row=>row.endMinutes>row.startMinutes).sort((a,b)=>a.startMinutes-b.startMinutes)}
function mergeBusy(rows){const blocks=[];for(const row of rows){const last=blocks.at(-1);if(last&&row.startMinutes<=last.end)last.end=Math.max(last.end,row.endMinutes);else blocks.push({start:row.startMinutes,end:row.endMinutes})}return blocks}
function freeWindows(clock,{dayStart=7*60,dayEnd=22*60}={}){
 let start=Math.max(dayStart,Math.ceil((clock.minutes+10)/5)*5);if(clock.dayIndex===5||clock.dayIndex===6)start=Math.max(start,9*60);
 const busy=mergeBusy(todayClasses(clock).filter(row=>row.endMinutes>start));const windows=[];let cursor=start;
 for(const block of busy){if(block.start>cursor)windows.push({start:cursor,end:block.start});cursor=Math.max(cursor,block.end)}
 if(cursor<dayEnd)windows.push({start:cursor,end:dayEnd});return windows.filter(window=>window.end-window.start>=25);
}
function priorityScore(task,now){
 const state=taskDueState(task,now);let score=task.priority==='high'?70:task.priority==='normal'?35:10;
 if(state==='overdue')score+=160;else if(state==='today')score+=120;else if(state==='tomorrow')score+=85;else if(state==='upcoming'){const hours=hoursUntilTask(task,now);if(hours!=null)score+=Math.max(0,60-Math.min(60,hours/4))}else score+=5;
 if(task.course)score+=10;return score;
}
function studiedMinutesByCourse(){const map=new Map();for(const row of readStudySessions()){const course=String(row.course||'').trim().toUpperCase();if(!course)continue;map.set(course,(map.get(course)||0)+(Number(row.duration_minutes)||0))}return map}
function targets(now){
 const open=readStudentTasks().filter(task=>!task.done).sort((a,b)=>priorityScore(b,now)-priorityScore(a,now));
 const targetRows=open.map(task=>({course:String(task.course||'').trim().toUpperCase(),title:task.title,reason:taskDueState(task,now)==='overdue'?'مهمة متأخرة':taskDueState(task,now)==='today'?'موعدها اليوم':taskDueState(task,now)==='tomorrow'?'موعدها بكرة':task.priority==='high'?'أولوية عالية':'مهمة قادمة',kind:taskDueState(task,now)==='today'||taskDueState(task,now)==='overdue'?'assignment':'focus',taskId:task.id,score:priorityScore(task,now)}));
 const studied=studiedMinutesByCourse();for(const course of scheduleCourses()){const code=String(course).toUpperCase();if(targetRows.some(row=>row.course===code))continue;targetRows.push({course:code,title:`مراجعة ${code}`,reason:studied.has(code)?'مراجعة دورية':'ما سجلت لها مذاكرة بعد',kind:'review',taskId:null,score:20-Math.min(15,(studied.get(code)||0)/60)})}
 if(!targetRows.length)targetRows.push({course:'',title:'مراجعة عامة',reason:'استغل وقتك في مراجعة خفيفة',kind:'review',taskId:null,score:5});
 return targetRows.sort((a,b)=>b.score-a.score);
}
function chooseDuration(window,target){const available=window.end-window.start;if(available>=60&&(target.score>=70||available>=90))return 50;if(available>=30)return 25;return Math.max(20,Math.min(25,available))}
export function buildDailyStudyPlan(now=new Date(),{maxSessions=4}={}){
 const clock=muscatClock(now),classes=todayClasses(clock),windows=freeWindows(clock),queue=targets(now),sessions=[];
 const cursors=windows.map(window=>({...window,cursor:window.start}));let targetIndex=0;
 for(const window of cursors){while(window.end-window.cursor>=25&&sessions.length<maxSessions){const target=queue[targetIndex%queue.length];const duration=chooseDuration({start:window.cursor,end:window.end},target);if(duration<20)break;const start=window.cursor,end=start+duration;sessions.push({id:`${clock.date}-${sessions.length+1}`,start,end,duration,course:target.course,title:target.title,reason:target.reason,kind:target.kind,taskId:target.taskId,focusUrl:`study-focus.html?minutes=${duration}${target.course?`&course=${encodeURIComponent(target.course)}`:''}&kind=${encodeURIComponent(target.kind)}`});window.cursor=end+10;targetIndex++}}
 const totalMinutes=sessions.reduce((sum,row)=>sum+row.duration,0);
 return {date:clock.date,day:clock.day,nowMinutes:clock.minutes,classes,windows,sessions,totalMinutes,openTasks:readStudentTasks().filter(task=>!task.done).length,summary:sessions.length?`${sessions.length} جلسات • ${totalMinutes} دقيقة مقترحة`:'ما فيه وقت مناسب متبقٍ اليوم ضمن الفترة المحددة'};
}
export function formatPlanTime(value){return toClock(value)}
export function planDayLabel(now=new Date()){return muscatClock(now).day}
