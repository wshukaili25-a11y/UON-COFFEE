
import {$,get,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();

const form=$('#assistantForm');
const input=$('#question');
const output=$('#answer');

async function searchPlatform(q){
 const safe=q.toLowerCase();
 const sources=[
  ['university_programs','select=name_ar,name_en,college,degree,official_url&active=eq.true','برنامج'],
  ['summaries','select=title,subject,college,url,description&approved=eq.true','ملخص'],
  ['whatsapp_groups','select=subject,course_code,college,link&approved=eq.true','مجموعة'],
  ['academic_calendar_events','select=title,description,start_date,end_date,event_type&active=eq.true','موعد'],
  ['tools_items','select=name,description,url,status&status=eq.active','أداة']
 ];
 const matches=[];
 for(const [table,query,type] of sources){
  try{
   const rows=await get(table,query+'&limit=100');
   rows.forEach(x=>{const text=Object.values(x).join(' ').toLowerCase();if(text.includes(safe))matches.push({type,title:x.title||x.subject||x.name_ar||x.name,desc:x.description||x.college||x.degree||x.course_code||'',url:x.url||x.link||x.official_url||''})});
  }catch{}
 }
 return matches.slice(0,12);
}

form.onsubmit=async event=>{
 event.preventDefault();const q=input.value.trim();if(!q)return;
 output.innerHTML='<div class="empty">جاري البحث في بيانات المنصة...</div>';
 trackEvent('assistant_question',{query:q.slice(0,100)});
 const rows=await searchPlatform(q);
 output.innerHTML=rows.length?`<div class="assistant-answer"><p>لقيت لك النتائج التالية داخل UON Hub:</p>${rows.map(x=>`<a class="list-row" href="${esc(x.url||'#')}" target="${x.url?'_blank':'_self'}"><div><span class="badge">${esc(x.type)}</span><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></div><span>←</span></a>`).join('')}</div>`:'<div class="empty">ما حصلت نتيجة مباشرة. جرّب اسم المادة أو رمزها أو اسم البرنامج.</div>';
};

document.querySelectorAll('[data-prompt]').forEach(button=>{
 button.addEventListener('click',()=>{
  const field=document.querySelector('#question');
  field.value=button.dataset.prompt;
  field.focus();
 });
});
