const PENDING='uon_ai_pending_schedule_v1';
const TARGET='uon-v7-schedule';
const APPLIED='uon_ai_schedule_applied_v1';

function uid(){
 try{return crypto.randomUUID()}
 catch{return`${Date.now()}-${Math.random()}`}
}

const dayMap={
 Sunday:'الأحد',Monday:'الاثنين',Tuesday:'الثلاثاء',Wednesday:'الأربعاء',Thursday:'الخميس',
 'الأحد':'الأحد','الاثنين':'الاثنين','الثلاثاء':'الثلاثاء','الأربعاء':'الأربعاء','الخميس':'الخميس'
};

function apply(){
 let pending;
 try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null')}
 catch{return}
 if(!pending?.rows?.length)return;

 const grouped=new Map();
 const rows=[];
 for(const raw of pending.rows){
  const day=dayMap[String(raw.day||'').trim()];
  const start=String(raw.start||'').slice(0,5);
  const end=String(raw.end||'').slice(0,5);
  if(!day||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||end<=start)continue;

  const course=String(raw.course||'').trim().toUpperCase();
  if(!course)continue;
  const room=String(raw.room||'').trim();
  const teacher=String(raw.teacher||'').trim();
  const key=[course,start,end,room,teacher].join('|');
  if(!grouped.has(key))grouped.set(key,uid());
  rows.push({id:uid(),seriesId:grouped.get(key),course,day,start,end,room,teacher,type:'lecture'});
 }
 if(!rows.length)return;

 try{
  const current=JSON.parse(localStorage.getItem(TARGET)||'[]');
  if(Array.isArray(current)&&current.length){
   const replace=confirm(document.documentElement.lang?.startsWith('en')
    ?'Replace your current schedule with the UON AI suggestion?'
    :'استبدال جدولك الحالي باقتراح UON AI؟');
   if(!replace)return;
  }

  localStorage.setItem(TARGET,JSON.stringify(rows));

  // The multi-schedule profile system is already booted before this module.
  // Persist the imported AI rows into the active profile immediately so a
  // refresh cannot restore the previous profile over the new suggestion.
  try{window.UONScheduleProfiles?.sync?.()}
  catch(error){console.warn('AI schedule profile sync failed',error)}

  sessionStorage.removeItem(PENDING);
  sessionStorage.setItem(APPLIED,'1');
 }catch(error){
  console.warn('AI schedule import failed',error);
 }
}

apply();
