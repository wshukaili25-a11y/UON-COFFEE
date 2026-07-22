import {get,$,esc,debounce,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';

await enforceUonMaintenance();
watchUonMaintenance();

const input=$('#globalSearch');
const results=$('#searchResults');
const meta=$('#searchMeta');

const sources=[
 {table:'courses',query:'select=code,name_ar,name_en,college,description&active=eq.true',type:'مقرر',url:x=>`course.html?code=${encodeURIComponent(x.code)}`,title:x=>`${x.code} — ${x.name_ar}`,body:x=>x.college||''},
 {table:'summaries',query:'select=id,title,subject,course_code,college,url,description&approved=eq.true',type:'ملخص',url:x=>x.url||'#',title:x=>x.title||x.subject||'ملخص',body:x=>[x.course_code,x.college].filter(Boolean).join(' • ')},
 {table:'whatsapp_groups',query:'select=id,subject,course_code,college,link&approved=eq.true',type:'مجموعة واتساب',url:x=>x.link||'#',title:x=>x.subject||'مجموعة',body:x=>[x.course_code,x.college].filter(Boolean).join(' • ')},
 {table:'rating_submissions',query:'select=id,target_name,course_code,overall,comment&status=eq.approved',type:'تقييم',url:x=>'ratings.html',title:x=>x.target_name||x.course_code||'تقييم',body:x=>`${x.overall||0}/5 ${x.comment||''}`},
 {table:'university_programs',query:'select=name_ar,name_en,college,degree,official_url&active=eq.true',type:'برنامج',url:x=>x.official_url||'university-guide.html',title:x=>x.name_ar||x.name_en,body:x=>[x.college,x.degree].filter(Boolean).join(' • ')}
];

function matches(item,q){
 return Object.values(item).join(' ').toLowerCase().includes(q.toLowerCase());
}

function renderCard(item){
 return `<a class="v16-search-result" href="${esc(item.url)}" target="${item.url.startsWith('http')?'_blank':'_self'}">
  <span>${esc(item.type)}</span>
  <div><strong>${esc(item.title)}</strong><small>${esc(item.body||'')}</small></div>
  <b>←</b>
 </a>`;
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
 const found=[];

 for(const source of sources){
  try{
   const rows=await get(source.table,source.query+'&limit=300');
   rows.filter(row=>matches(row,q)).slice(0,12).forEach(row=>found.push({
    type:source.type,
    title:source.title(row),
    body:source.body(row),
    url:source.url(row)
   }));
  }catch{}
 }

 const grouped={};
 found.forEach(item=>{
  if(!grouped[item.type])grouped[item.type]=[];
  grouped[item.type].push(item);
 });

 meta.textContent=`${found.length} نتيجة خلال ${Math.round(performance.now()-start)}ms`;
 results.innerHTML=found.length?Object.entries(grouped).map(([type,items])=>`
  <section class="v16-search-group">
   <h3>${esc(type)}</h3>
   <div>${items.map(renderCard).join('')}</div>
  </section>`).join(''):'<div class="empty">لا توجد نتائج مطابقة</div>';

 trackEvent('search',{query:q,results:found.length});
}

const params=new URLSearchParams(location.search);
if(params.get('q')){
 input.value=params.get('q');
 run();
}

$('#searchBtn').onclick=run;
input.addEventListener('input',debounce(()=>{if(input.value.trim().length>=2)run()},350));
input.addEventListener('keydown',event=>{if(event.key==='Enter')run()});
