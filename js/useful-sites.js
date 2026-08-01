import{
 get,esc,enforceUonMaintenance,watchUonMaintenance,applyFeatureStates,
 trackEvent,installErrorCapture,toast
}from'./core.js?v=39.0.0';

enforceUonMaintenance();watchUonMaintenance();installErrorCapture();

const officialFallback=[
 {title_ar:'الموقع الرسمي لجامعة نزوى',title_en:'University of Nizwa',description_ar:'الأخبار والكليات والبرامج والخدمات الرسمية',description_en:'Official university website',category:'university',url:'https://www.unizwa.edu.om/',icon:'🏛️'},
 {title_ar:'البوابة الأكاديمية',title_en:'Academic Portal',description_ar:'التسجيل والدرجات والخدمات الأكاديمية',description_en:'Registration and academic services',category:'university',url:'https://portal.unizwa.edu.om/',icon:'🎓'},
 {title_ar:'نظام التعلم الإلكتروني',title_en:'Moodle',description_ar:'المقررات والواجبات والمحتوى الإلكتروني',description_en:'Courses and assignments',category:'university',url:'https://elearn.unizwa.edu.om/',icon:'🖥️'}
];
const categories={all:['الكل','All'],university:['جامعة نزوى','University'],math:['رياضيات','Math'],files:['PDF والملفات','PDF & Files'],ai:['الذكاء الاصطناعي','Artificial Intelligence'],academic:['أدوات الدراسة','Study Tools'],books:['المكتبات والكتب','Libraries & Books'],general:['أخرى','Other']};
let rows=[],active='all';
const language=()=>localStorage.getItem('uon_language')||'ar';
const safeUrl=value=>{
 try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}
};
function cleanRows(source){
 const seen=new Set();
 return (source||[]).filter(item=>item&&safeUrl(item.url)&&String(item.title_ar||item.title_en||'').trim()).filter(item=>{
  const key=safeUrl(item.url).replace(/\/$/,'').toLowerCase();if(seen.has(key))return false;seen.add(key);return true;
 });
}
function renderFilters(){
 const available=['all',...new Set(rows.map(item=>item.category||'general'))];
 $('#siteFilters').innerHTML=available.map(key=>`<button type="button" class="${active===key?'active':''}" data-category="${esc(key)}">${esc(categories[key]?.[language()==='ar'?0:1]||key)}</button>`).join('');
 $('#siteFilters').querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{active=button.dataset.category;renderFilters();render()}));
}
function render(){
 const query=($('#siteSearch')?.value||'').trim().toLowerCase();
 const filtered=rows.filter(item=>{
  const categoryMatch=active==='all'||(item.category||'general')===active;
  const haystack=`${item.title_ar||''} ${item.title_en||''} ${item.description_ar||''} ${item.description_en||''}`.toLowerCase();
  return categoryMatch&&(!query||haystack.includes(query));
 });
 $('#siteCount').textContent=filtered.length;
 $('#usefulSites').innerHTML=filtered.length?filtered.map(item=>{
  const title=language()==='ar'?(item.title_ar||item.title_en):(item.title_en||item.title_ar);
  const description=language()==='ar'?(item.description_ar||''):(item.description_en||item.description_ar||'');
  return `<a class="v175-site-card" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(item.url))}" data-useful-site="${esc(item.id||title)}"><span>${esc(item.icon||'🔗')}</span><div><h3>${esc(title)}</h3><p>${esc(description)}</p></div><b>↗</b></a>`;
 }).join(''):'<div class="empty">لا توجد روابط مطابقة.</div>';
}
async function load(){
 $('#usefulSites').innerHTML='<div class="empty">جاري تحميل الروابط...</div>';
 try{rows=cleanRows(await get('useful_sites','select=*&active=eq.true&order=sort_order.asc,title_ar.asc&limit=300'))}
 catch(error){console.warn('Useful sites load failed',error);rows=[];toast('تعذر تحميل بعض الروابط',true)}
 if(!rows.length)rows=cleanRows(officialFallback);
 renderFilters();render();await applyFeatureStates(document);trackEvent('page_view',{page:'useful-sites',count:rows.length});
}
$('#siteSearch')?.addEventListener('input',render);
$('#usefulSites')?.addEventListener('click',event=>{
 const link=event.target.closest('[data-useful-site]');if(link)trackEvent('useful_site_open',{id:link.dataset.usefulSite});
});
load();
