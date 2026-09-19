export const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
export function normalizeTime(value){
 const raw=String(value??'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[.]/g,':');
 const m=/^(\d{1,2}):(\d{2})\s*(am|pm|ص|م)?$/i.exec(raw);if(!m)return '';
 let hour=Number(m[1]);const minute=Number(m[2]),period=(m[3]||'').toLowerCase();
 if(minute>59||hour>23||(period&&(hour<1||hour>12)))return '';
 if((period==='pm'||period==='م')&&hour<12)hour+=12;
 if((period==='am'||period==='ص')&&hour===12)hour=0;
 return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}
export function normalizeDay(value){
 const key=String(value??'').trim().replace(/[أإآ]/g,'ا').toLowerCase();
 const aliases=[['ح','الاحد','sun','sunday'],['ن','الاثنين','mon','monday'],['ث','الثلاثاء','tue','tuesday'],['ر','الاربعاء','wed','wednesday'],['خ','الخميس','thu','thursday']];
 return DAYS[aliases.findIndex(list=>list.includes(key))]||'';
}
export const clash=(a,b)=>a.day===b.day&&a.start<b.end&&b.start<a.end;
export function validMeetings(rows){
 return Array.isArray(rows)&&rows.length>0&&rows.every(row=>DAYS.includes(row.day)&&normalizeTime(row.start)===row.start&&normalizeTime(row.end)===row.end&&row.end>row.start)&&!rows.some((row,i)=>rows.slice(i+1).some(other=>clash(row,other)));
}
export function normalizeExtraction(data){
 return (Array.isArray(data?.courses)?data.courses:[]).map(course=>({
  course_code:String(course.course_code||course.code||'').trim().toUpperCase().replace(/[\s-]/g,''),course_name:String(course.course_name||course.name||'').trim(),
  sections:(Array.isArray(course.sections)?course.sections:[]).map(section=>{
   const meetings=(Array.isArray(section.meetings)?section.meetings:[]).map(m=>({day:normalizeDay(m.day),start:normalizeTime(m.start),end:normalizeTime(m.end),room:String(m.room||'').trim()}));
   const section_no=String(section.section_no||section.number||'').trim(),valid=Boolean(section_no)&&validMeetings(meetings);
   return {...section,section_no,instructor:String(section.instructor||section.teacher||''),meetings,selected:valid,valid};
  })
 })).filter(course=>course.sections.length);
}
const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
function score(rows,kind){
 const active=new Set(rows.map(row=>row.day)).size;let gaps=0;
 for(const day of DAYS){const list=rows.filter(row=>row.day===day).sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<list.length;i++)gaps+=Math.max(0,minutes(list[i].start)-minutes(list[i-1].end));}
 const avg=rows.reduce((sum,row)=>sum+minutes(row.start),0)/Math.max(1,rows.length);
 return kind==='compact'?active*10000+gaps:kind==='gaps'?gaps*100+active:kind==='morning'?avg+active*20:kind==='late'?-avg+active*20:gaps+active*180+Math.abs(avg-720);
}
export function generateProposals(courses,{maxNodes=50000,maxResults=2500}={}){
 if(!Array.isArray(courses)||!courses.length)return {proposals:[],reason:'empty',limited:false};
 const codes=courses.map(course=>course.course_code);
 if(codes.some(code=>!/^[A-Z]{2,10}\d{2,4}[A-Z]?$/.test(code))||new Set(codes).size!==codes.length)return {proposals:[],reason:'course_codes',limited:false};
 const available=courses.map((course,index)=>({course,index,sections:course.sections.filter(section=>section.selected&&validMeetings(section.meetings))}));
 if(available.some(item=>!item.sections.length))return {proposals:[],reason:'missing_sections',limited:false};
 available.sort((a,b)=>a.sections.length-b.sections.length);
 let visited=0,limited=false;const combos=[];
 function walk(index,chosen,rows){
  if(++visited>maxNodes||combos.length>=maxResults){limited=true;return;}
  if(index===available.length){combos.push({chosen:[...chosen].sort((a,b)=>a.index-b.index),rows});return;}
  const item=available[index];
  for(const section of item.sections){
   if(limited)return;
   const next=section.meetings.map(meeting=>({...meeting,course:item.course.course_code}));
   if(next.some(a=>rows.some(b=>clash(a,b))))continue;
   walk(index+1,[...chosen,{course:item.course,section,index:item.index}],[...rows,...next]);
  }
 }
 walk(0,[],[]);
 const kinds=[['compact','أقل أيام دوام','يجمع محاضراتك في أقل عدد من الأيام'],['gaps','أقل فراغات','يقلل وقت الانتظار بين المحاضرات'],['morning','جدول صباحي','يقدم الشعب المبكرة قدر الإمكان'],['late','جدول متأخر','يتجنب المحاضرات الصباحية قدر الإمكان'],['balanced','جدول متوازن','توازن بين الأيام والفراغات']];
 const used=new Set(),proposals=[];
 for(const [kind,title,description] of kinds){
  const best=[...combos].sort((a,b)=>score(a.rows,kind)-score(b.rows,kind)).find(item=>!used.has(item.chosen.map(x=>`${x.course.course_code}:${x.section.section_no}`).join('|')));
  if(best){used.add(best.chosen.map(x=>`${x.course.course_code}:${x.section.section_no}`).join('|'));proposals.push({...best,kind,title,description});}
 }
 return {proposals,limited,visited,reason:proposals.length?'ok':limited?'search_limit':'conflict'};
}

// Save the generated schedule alongside existing profiles. A failed write
// restores all touched keys; no current schedule is deliberately overwritten.
export function saveGeneratedProfile(storage,rows,name,id,now=new Date().toISOString()){
 if(!Array.isArray(rows)||!rows.length||!validMeetings(rows))throw new Error('invalid_schedule');
 const keys=['uon-v44-schedule-profiles','uon-v44-active-schedule','uon-v7-schedule'];
 const previous=keys.map(key=>storage.getItem(key));
 const legacy=JSON.parse(previous[2]||'[]');if(!Array.isArray(legacy))throw new Error('invalid_saved_schedule');
 const store=previous[0]?JSON.parse(previous[0]):{version:1,profiles:[{id:`previous-${id}`,name:'جدول الفصل الحالي',rows:legacy,createdAt:now,updatedAt:now}],settings:{reminderMinutes:0}};
 if(!Array.isArray(store.profiles)||!store.profiles.length||store.profiles.some(p=>!p?.id||!Array.isArray(p.rows)))throw new Error('invalid_saved_profiles');
 const current=store.profiles.find(p=>p.id===previous[1])||store.profiles[0];
 current.rows=legacy;current.updatedAt=now;
 store.profiles.push({id,name,rows,createdAt:now,updatedAt:now});
 try{storage.setItem(keys[0],JSON.stringify(store));storage.setItem(keys[1],id);storage.setItem(keys[2],JSON.stringify(rows));}
 catch(error){for(let i=0;i<keys.length;i++)try{previous[i]===null?storage.removeItem(keys[i]):storage.setItem(keys[i],previous[i]);}catch{}throw error;}
 return id;
}
