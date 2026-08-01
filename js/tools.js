import{
 setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,toast,esc,
 applyFeatureStates,trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

setupNav();
enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

let rows=[];
let categories=[];
const platformFeatures=new Set([
 'confessions','useful-sites','assistant','schedule','summaries','gpa','university-guide',
 'groups','projects','ratings','courses','calendar','feedback'
]);
const fallbackTools=[
 {id:'summaries',category_id:'platform',name:'الملخصات والاختبارات',description:'ملفات مرتبة ومقيّمة حسب المادة.',url:'summaries.html',emoji:'📚'},
 {id:'groups',category_id:'platform',name:'المجموعات والمجتمع',description:'مجموعات المواد ومجتمع طلاب جامعة نزوى.',url:'groups.html',emoji:'💬'},
 {id:'ratings',category_id:'platform',name:'التقييمات',description:'تجارب الطلاب مع الدكاترة والمقررات.',url:'ratings.html',emoji:'⭐'},
 {id:'confessions',category_id:'platform',name:'اعترافات الطلاب',description:'اكتب اعترافك بشكل مجهول وتفاعل مع الطلاب.',url:'confessions.html',emoji:'👀'},
 {id:'university-guide',category_id:'platform',name:'دليل الجامعة',description:'الكليات والأقسام والتخصصات.',url:'university-guide.html',emoji:'🎓'},
 {id:'assistant',category_id:'platform',name:'مساعد UON AI',description:'اسأل عن الجامعة والمقررات والخدمات.',url:'assistant.html',emoji:'AI'},
 {id:'gpa',category_id:'platform',name:'حاسبة المعدل',description:'احسب المعدل الفصلي والتراكمي.',url:'gpa.html',emoji:'🧮'},
 {id:'schedule',category_id:'platform',name:'الجدول الدراسي',description:'رتب جدولك الأسبوعي بسهولة.',url:'schedule.html',emoji:'📅'}
];

function safeHref(value){
 const raw=String(value||'').trim();
 if(!raw)return'';
 if(/^(?:[a-z0-9-]+\.html(?:[?#].*)?|\/?(?:[a-z0-9/_-]+)(?:[?#].*)?)$/i.test(raw))return raw.replace(/^\//,'');
 try{
  const url=new URL(raw);
  return url.protocol==='https:'?url.href:'';
 }catch{return''}
}
function inferFeature(item){
 if(platformFeatures.has(item.id))return item.id;
 const path=safeHref(item.url).split(/[?#]/)[0].split('/').pop()||'';
 const map={
  'confessions.html':'confessions','useful-sites.html':'useful-sites','assistant.html':'assistant',
  'schedule.html':'schedule','summaries.html':'summaries','gpa.html':'gpa',
  'university-guide.html':'university-guide','groups.html':'groups','projects.html':'projects',
  'ratings.html':'ratings','courses.html':'courses','calendar.html':'calendar','feedback.html':'feedback'
 };
 return map[path]||'';
}
function canonicalize(source){
 const sorted=[...source].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||String(a.name||'').localeCompare(String(b.name||''),'ar'));
 const seenFeatures=new Set();
 const seenUrls=new Set();
 const seenNames=new Set();
 const result=[];
 for(const item of sorted){
  if(item.id==='tools-library')continue;
  const url=safeHref(item.url);
  if(!url)continue;
  const feature=inferFeature(item);
  const normalizedUrl=url.toLowerCase().replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'');
  const normalizedName=String(item.name||'').trim().toLowerCase();
  if(feature&&seenFeatures.has(feature))continue;
  if(seenUrls.has(normalizedUrl)||seenNames.has(normalizedName))continue;
  if(feature)seenFeatures.add(feature);
  seenUrls.add(normalizedUrl);
  seenNames.add(normalizedName);
  result.push({...item,url,feature});
 }
 for(const item of fallbackTools){
  if(!seenFeatures.has(item.id)){
   result.unshift({...item,feature:item.id,status:'active',featured:true});
   seenFeatures.add(item.id);
  }
 }
 return result;
}
function toolStatus(item){
 if(item.feature)return 'active';
 if(item.status)return item.status;
 if(item.coming_soon)return 'coming_soon';
 if(item.disabled)return 'disabled';
 return 'active';
}
function toolCard(item){
 const status=toolStatus(item);
 const featureAttr=item.feature?` data-feature="${esc(item.feature)}"`:'';
 const body=`<span class="tool-icon">${esc(item.emoji||'🧰')}</span><h3>${esc(item.name||'أداة')}</h3><p>${esc(item.description||'')}</p>`;
 if(item.feature){
  return `<a class="card feature-card" href="${esc(item.url)}"${featureAttr}>${body}<b>فتح</b></a>`;
 }
 if(status!=='active'){
  const label=status==='maintenance'?'صيانة':status==='coming_soon'?'قريبًا':'متوقفة';
  return `<article class="card feature-card feature-unavailable" data-status="${esc(status)}">${body}<span class="badge">${label}</span></article>`;
 }
 const external=/^https:/i.test(item.url);
 return `<a class="card feature-card" href="${esc(item.url)}"${external?' target="_blank" rel="noopener noreferrer"':''}>${body}<b>فتح</b></a>`;
}
async function render(){
 const query=($('#search')?.value||'').trim().toLowerCase();
 const category=$('#category')?.value||'';
 const filtered=rows.filter(item=>{
  const haystack=`${item.name||''} ${item.description||''}`.toLowerCase();
  return (!category||item.category_id===category)&&haystack.includes(query);
 });
 $('#items').innerHTML=filtered.length?filtered.map(toolCard).join(''):'<div class="empty">لا توجد أدوات مطابقة</div>';
 await applyFeatureStates($('#items'));
}
function buildCategories(){
 const used=new Set(rows.map(item=>item.category_id).filter(Boolean));
 const unique=[];
 const names=new Set();
 for(const category of categories){
  const name=String(category.name||'').trim();
  if(!used.has(category.id)||names.has(name))continue;
  names.add(name);
  unique.push(category);
 }
 if(used.has('platform')&&!unique.some(item=>item.id==='platform'))unique.unshift({id:'platform',name:'خدمات الموقع'});
 $('#category').innerHTML='<option value="">كل التصنيفات</option>'+unique.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
}
async function load(){
 try{
  const [itemsData,categoriesData]=await Promise.all([
   get('tools_items','select=*&order=featured.desc,name.asc'),
   get('tools_categories','select=*&order=sort_order.asc,name.asc')
  ]);
  rows=canonicalize(itemsData||[]);
  categories=categoriesData||[];
  buildCategories();
 }catch(error){
  console.warn('Tools data load failed',error);
  rows=canonicalize([]);
  categories=[];
  buildCategories();
  toast('تعذر تحميل بعض الأدوات الخارجية، والخدمات الأساسية ما زالت متاحة',true);
 }finally{
  await render();
  trackEvent('page_view',{page:'tools',count:rows.length});
 }
}

$('#search')?.addEventListener('input',render);
$('#category')?.addEventListener('change',render);
$('#items')?.addEventListener('click',event=>{
 const card=event.target.closest('a.feature-card');
 if(card)trackEvent('tool_open',{href:card.getAttribute('href')||''});
});
load();
