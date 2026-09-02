import {esc,toast} from './core.js?v=61.1.0';
import {nextClass,currentAcademicPulse,formatClassTime,readSchedule} from './student-pulse.js?v=61.1.0';
import {STUDENT_TASKS_KEY,readStudentTasks,nextStudentTask,formatTaskDue,taskDueState} from './student-tasks-data.js?v=61.1.0';

const FAVORITES_KEY='uon_favorites_v20';
const RECENT_KEY='uon_recent_pages_v61';
const PREF_KEY='uon_notification_preferences';
const BACKUP_KEYS=['uon-v7-schedule','uon-v44-schedule-profiles','uon-v44-active-schedule',STUDENT_TASKS_KEY,FAVORITES_KEY,RECENT_KEY,PREF_KEY,'uon_contributions_v20'];
const DAY_LABEL={0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس',5:'الجمعة',6:'السبت'};

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function safePage(value=''){const raw=String(value||'').trim();return /^[a-z0-9_-]+\.html(?:[?#].*)?$/i.test(raw)?raw:'index.html'}
function muscatParts(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Muscat',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 const dayIndex={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[map.weekday]??0;
 return {hour:Number(map.hour)||0,dayIndex};
}
function setText(selector,value){const node=document.querySelector(selector);if(node)node.textContent=String(value)}

const favorites=read(FAVORITES_KEY,[]).filter(Boolean);
const recents=read(RECENT_KEY,[]).filter(item=>item?.url&&item.url!=='user-dashboard.html').slice(0,8);
const pref=read(PREF_KEY,{});
const schedule=readSchedule();
const tasks=readStudentTasks();
const openTasks=tasks.filter(task=>!task.done);
const uniqueCourses=new Set(schedule.map(row=>String(row.course||'').trim()).filter(Boolean));

setText('#favCount',favorites.length);
setText('#courseCount',uniqueCourses.size);
setText('#taskCount',openTasks.length);
setText('#recentCount',recents.length);
setText('#prefCount',(pref.topics||[]).length);

const clock=muscatParts();
const greeting=clock.hour<12?'صباح الخير 👋':clock.hour<18?'مساء الخير 👋':'مساء النور 👋';
setText('#dashboardGreeting',greeting);
setText('#dashboardDate',new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',weekday:'long',day:'numeric',month:'long'}).format(new Date()));

const klass=nextClass();
if(!klass)setText('#nextClassText','ما عندك جدول محفوظ حاليًا. أضف موادك وبتظهر لك المحاضرة القادمة هنا تلقائيًا.');
else if(klass.state==='now')setText('#nextClassText',`${klass.course} الآن • إلى ${formatClassTime(klass.end)}${klass.room?` • ${klass.room}`:''}`);
else{
 const when=klass.deltaDays===0?'اليوم':klass.deltaDays===1?'بكرة':DAY_LABEL[(clock.dayIndex+klass.deltaDays)%7]||klass.day;
 setText('#nextClassText',`${klass.course} • ${when} ${formatClassTime(klass.start)}${klass.room?` • ${klass.room}`:''}${klass.teacher?` • ${klass.teacher}`:''}`);
}

const task=nextStudentTask();
const taskCard=document.querySelector('#nextTaskCard');
if(!task)setText('#nextTaskText','ما عندك مهام مفتوحة حاليًا 🎉 أضف واجب أو اختبار وبيظهر هنا تلقائيًا.');
else{
 const state=taskDueState(task);
 const stateText=state==='overdue'?'متأخرة':state==='today'?'اليوم':state==='tomorrow'?'بكرة':state==='undated'?'بدون موعد':'قادمة';
 setText('#nextTaskText',`${task.title}${task.course?` • ${task.course}`:''} • ${stateText}${task.due?` • ${formatTaskDue(task)}`:''}`);
 if(state==='overdue')taskCard?.classList.add('is-urgent');
}

const academic=currentAcademicPulse();
if(!academic)setText('#academicPulseText','ما فيه موعد أكاديمي قادم ضمن التقويم الحالي.');
else{
 setText('#academicPulseIcon',academic.icon||'📅');
 if(academic.state==='active')setText('#academicPulseText',`${academic.title} • جاري الآن${academic.start!==academic.end?` حتى ${academic.dateLabel.split(' – ')[1]}`:''}`);
 else{const prefix=academic.daysUntilStart===0?'اليوم':academic.daysUntilStart===1?'بكرة':`بعد ${academic.daysUntilStart} أيام`;setText('#academicPulseText',`${academic.title} • ${prefix} • ${academic.dateLabel}`)}
}

function listMarkup(rows,{empty}){
 if(!rows.length)return `<div class="dashboard-empty">${esc(empty)}</div>`;
 return rows.map(item=>`<a href="${esc(safePage(item.url))}"><strong>${esc(item.title||'صفحة UON Hub')}</strong><span>فتح ←</span></a>`).join('');
}
const favoriteRows=document.querySelector('#favoriteRows');if(favoriteRows)favoriteRows.innerHTML=listMarkup(favorites,{empty:'ما حفظت أي صفحة للحين. استخدم زر ♡ في الصفحات اللي تهمك.'});
const recentRows=document.querySelector('#recentRows');if(recentRows)recentRows.innerHTML=listMarkup(recents,{empty:'سجل الاستخدام فاضي. افتح أدواتك وبتظهر هنا تلقائيًا.'});

document.querySelector('#clearRecent')?.addEventListener('click',()=>{localStorage.removeItem(RECENT_KEY);if(recentRows)recentRows.innerHTML='<div class="dashboard-empty">تم مسح آخر الصفحات.</div>';setText('#recentCount',0);toast('تم مسح سجل آخر الصفحات')});

function exportLocalData(){
 const data={format:'uonhub-local-backup',version:1,exported_at:new Date().toISOString(),data:{}};
 for(const key of BACKUP_KEYS){const value=localStorage.getItem(key);if(value!==null)data.data[key]=value}
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`UON-Hub-My-Data-${new Date().toISOString().slice(0,10)}.json`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('تم تجهيز نسخة بياناتك ✅');
}

document.querySelector('#exportLocalData')?.addEventListener('click',exportLocalData);
document.querySelector('#importLocalData')?.addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  const payload=JSON.parse(await file.text());
  if(payload?.format!=='uonhub-local-backup'||payload?.version!==1||!payload.data||typeof payload.data!=='object')throw new Error('الملف مو نسخة UON Hub صالحة');
  if(!confirm('استرجاع النسخة بيستبدل جدولك ومهامك ومفضلتك وتفضيلاتك الحالية. نكمل؟'))return;
  let restored=0;
  for(const key of BACKUP_KEYS){if(typeof payload.data[key]==='string'){localStorage.setItem(key,payload.data[key]);restored++}}
  if(!restored)throw new Error('النسخة ما تحتوي بيانات قابلة للاسترجاع');
  toast('تم استرجاع بياناتك ✅');setTimeout(()=>location.reload(),450);
 }catch(error){toast(error.message||'تعذر استرجاع النسخة',true)}finally{event.target.value=''}
});