const PENDING='uon_ai_pending_schedule_v1',TARGET='uon-v7-schedule';
function uid(){try{return crypto.randomUUID()}catch{return`${Date.now()}-${Math.random()}`}}
const validDays=new Set(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس']);
function apply(){
 let p;try{p=JSON.parse(sessionStorage.getItem(PENDING)||'null')}catch{return}
 if(!p?.rows?.length)return;
 const grouped=new Map(),out=[];
 for(const r of p.rows){
  if(!validDays.has(r.day)||!/^[0-2]\d:[0-5]\d$/.test(r.start)||!/^[0-2]\d:[0-5]\d$/.test(r.end))continue;
  const key=[r.course,r.start,r.end,r.room||'',r.teacher||''].join('|');
  if(!grouped.has(key))grouped.set(key,uid());
  out.push({id:uid(),seriesId:grouped.get(key),course:String(r.course||'').toUpperCase(),day:r.day,start:r.start,end:r.end,room:String(r.room||''),teacher:String(r.teacher||''),type:'lecture'});
 }
 if(!out.length)return;
 const profiles=window.UONScheduleProfiles;
 if(profiles?.create&&profiles?.keys?.ACTIVE_KEY){
  const name=`UON AI — ${String(p.term||'الفصل المقترح')}`;
  const profile=profiles.create(name,out);
  localStorage.setItem(profiles.keys.ACTIVE_KEY,profile.id);
  localStorage.setItem(TARGET,JSON.stringify(out));
 }else{
  localStorage.setItem(TARGET,JSON.stringify(out));
 }
 sessionStorage.removeItem(PENDING);
 sessionStorage.setItem('uon_ai_schedule_applied_v1','1');
}
apply();