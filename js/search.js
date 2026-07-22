import {startMaintenanceWatcher} from './core.js';

import {setupNav,enforceMaintenance,$,get,esc,toast} from './core.js';
await enforceMaintenance();startMaintenanceWatcher();
const sources=[
 ['summaries','title,subject,college,url','approved=eq.true','ملخص','summaries.html'],
 ['whatsapp_groups','subject,course_code,college,link','approved=eq.true','مجموعة','groups.html'],
 ['student_projects','title,major,description,url','status=eq.approved','مشروع','projects.html'],
 ['university_programs','name_ar,name_en,college,official_url','active=eq.true','برنامج','university-guide.html'],
 ['tools_items','name,description,url,status','status=eq.active','أداة','tools.html']
];
async function run(){
 const q=$('#globalSearch').value.trim().toLowerCase();if(q.length<2)return toast('اكتب حرفين على الأقل',true);
 $('#searchResults').innerHTML='<div class="empty">جاري البحث...</div>';const all=[];
 for(const [table,select,filter,label,page] of sources){try{const rows=await get(table,`select=${select}&${filter}&limit=100`);for(const x of rows){const text=Object.values(x).join(' ').toLowerCase();if(text.includes(q))all.push({label,page,title:x.title||x.subject||x.name_ar||x.name||'نتيجة',desc:x.college||x.major||x.description||''})}}catch(e){console.warn(table,e)}}
 $('#searchResults').innerHTML=all.length?all.map(x=>`<a class="list-row" href="${x.page}"><div><span class="badge">${esc(x.label)}</span><strong style="display:block;margin-top:5px">${esc(x.title)}</strong><small>${esc(x.desc)}</small></div><span>←</span></a>`).join(''):'<div class="empty">لا توجد نتائج</div>';
}
$('#searchBtn').onclick=run;$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
