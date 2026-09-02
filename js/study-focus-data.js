export const STUDY_SESSIONS_KEY='uon_study_sessions_v62';
export const STUDY_SETTINGS_KEY='uon_study_focus_settings_v62';
export const STUDY_ACTIVE_KEY='uon_study_focus_active_v62';
const SCHEDULE_KEY='uon-v7-schedule';

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function cleanCourse(value){return String(value||'').trim().slice(0,30)}
function muscatDate(value=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
function startOfMuscatWeek(now=new Date()){
 const dateLabel=muscatDate(now);const noon=new Date(`${dateLabel}T12:00:00+04:00`);const day=noon.getDay();const delta=day===6?0:day+1;noon.setDate(noon.getDate()-delta);return muscatDate(noon);
}
export function readStudySessions(){const rows=readJson(STUDY_SESSIONS_KEY,[]);return Array.isArray(rows)?rows.filter(Boolean):[]}
export function saveStudySessions(rows){writeJson(STUDY_SESSIONS_KEY,(Array.isArray(rows)?rows:[]).slice(0,1000))}
export function addStudySession({course='',durationMinutes=0,startedAt=null,endedAt=null,kind='focus'}={}){
 const minutes=Math.max(1,Math.min(600,Math.round(Number(durationMinutes)||0)));if(!minutes)return null;
 const ended=endedAt?new Date(endedAt):new Date();const started=startedAt?new Date(startedAt):new Date(ended.getTime()-minutes*60000);
 const item={id:crypto.randomUUID(),course:cleanCourse(course),duration_minutes:minutes,kind:String(kind||'focus').slice(0,20),started_at:started.toISOString(),ended_at:ended.toISOString(),date:muscatDate(ended)};
 const rows=readStudySessions();rows.unshift(item);saveStudySessions(rows);return item;
}
export function readStudySettings(){return readJson(STUDY_SETTINGS_KEY,{focusMinutes:25,breakMinutes:5,autoBreak:false,lastCourse:''})}
export function saveStudySettings(settings){const next={focusMinutes:Math.max(5,Math.min(120,Number(settings?.focusMinutes)||25)),breakMinutes:Math.max(1,Math.min(60,Number(settings?.breakMinutes)||5)),autoBreak:Boolean(settings?.autoBreak),lastCourse:cleanCourse(settings?.lastCourse)};writeJson(STUDY_SETTINGS_KEY,next);return next}
export function scheduleCourses(){const rows=readJson(SCHEDULE_KEY,[]);const values=Array.isArray(rows)?rows.map(row=>cleanCourse(row?.course)).filter(Boolean):[];return [...new Set(values)].sort((a,b)=>a.localeCompare(b,'en'))}
export function studyStats(now=new Date()){
 const rows=readStudySessions();const today=muscatDate(now),weekStart=startOfMuscatWeek(now);
 const todayRows=rows.filter(row=>row.date===today);const weekRows=rows.filter(row=>String(row.date||'')>=weekStart&&String(row.date||'')<=today);
 const total=items=>items.reduce((sum,row)=>sum+Math.max(0,Number(row.duration_minutes)||0),0);
 const byCourse=new Map();for(const row of weekRows){const key=row.course||'عام';byCourse.set(key,(byCourse.get(key)||0)+(Number(row.duration_minutes)||0))}
 return {todayMinutes:total(todayRows),weekMinutes:total(weekRows),todaySessions:todayRows.length,weekSessions:weekRows.length,topCourses:[...byCourse.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([course,minutes])=>({course,minutes}))};
}
export function formatStudyDuration(minutes){const total=Math.max(0,Math.round(Number(minutes)||0));const h=Math.floor(total/60),m=total%60;if(h&&m)return `${h}س ${m}د`;if(h)return `${h}س`;return `${m}د`}
