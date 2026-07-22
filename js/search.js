
import {get,$,esc,toast,debounce,enforceUonMaintenance,watchUonMaintenance} from './core.js';

await enforceUonMaintenance();
watchUonMaintenance();

const input=$('#globalSearch');
const results=$('#searchResults');
const meta=$('#searchMeta');

const fallbackSources=[
 {table:'summaries',select:'id,title,subject,college,url,description',filter:'approved=eq.true',type:'ملخص',page:'summaries.html'},
 {table:'whatsapp_groups',select:'id,subject,course_code,college,link',filter:'approved=eq.true',type:'مجموعة',page:'groups.html'},
 {table:'student_projects',select:'id,title,major,description,url',filter:'status=eq.approved',type:'مشروع',page:'projects.html'},
 {table:'university_programs',select:'id,name_ar,name_en,college,degree,official_url',filter:'active=eq.true',type:'برنامج',page:'university-guide.html'},
 {table:'tools_items',select:'id,name,description,url,status',filter:'status=eq.active',type:'أداة',page:'tools.html'}
];

function card(item){
 return `<a class="list-row search-result" href="${esc(item.page||item.url||'#')}">
  <div>
   <span class="badge">${esc(item.type||item.source_table||'نتيجة')}</span>
   <strong>${esc(item.title||'نتيجة')}</strong>
   <small>${esc(item.body||item.description||'')}</small>
  </div>
  <span>←</span>
 </a>`;
}

async function indexedSearch(q){
 const safe=q.replace(/[%(),]/g,' ').trim();
 if(!safe)return [];
 try{
  const rows=await get('search_index',`select=*&active=eq.true&or=(title.ilike.*${encodeURIComponent(safe)}*,body.ilike.*${encodeURIComponent(safe)}*)&order=updated_at.desc&limit=80`);
  return rows.map(x=>({...x,type:x.source_table,page:x.url||'#'}));
 }catch{
  return [];
 }
}

async function fallbackSearch(q){
 const needle=q.toLowerCase();
 const all=[];

 for(const source of fallbackSources){
  try{
   const rows=await get(source.table,`select=${source.select}&${source.filter}&limit=150`);
   for(const row of rows){
    const text=Object.values(row).join(' ').toLowerCase();
    if(!text.includes(needle))continue;

    all.push({
     type:source.type,
     page:source.page,
     title:row.title||row.subject||row.name_ar||row.name||'نتيجة',
     body:row.college||row.major||row.description||row.degree||''
    });
   }
  }catch(error){
   console.warn(source.table,error);
  }
 }
 return all;
}

async function run(){
 const q=input.value.trim();
 if(q.length<2){
  results.innerHTML='<div class="empty">اكتب حرفين على الأقل</div>';
  meta.textContent='';
  return;
 }

 results.innerHTML='<div class="empty">جاري البحث...</div>';
 const start=performance.now();

 let rows=await indexedSearch(q);
 if(!rows.length)rows=await fallbackSearch(q);

 const ms=Math.round(performance.now()-start);
 meta.textContent=`${rows.length} نتيجة خلال ${ms}ms`;
 results.innerHTML=rows.length?rows.map(card).join(''):'<div class="empty">لا توجد نتائج مطابقة</div>';
}

const params=new URLSearchParams(location.search);
if(params.get('q')){
 input.value=params.get('q');
 run();
}

$('#searchBtn').onclick=run;
input.addEventListener('input',debounce(()=>{if(input.value.trim().length>=2)run()},450));
input.addEventListener('keydown',event=>{if(event.key==='Enter')run()});
