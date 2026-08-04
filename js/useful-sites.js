import {get,esc,enforceUonMaintenance,watchUonMaintenance,applyFeatureStates,trackEvent} from './core.js?v=44.0.1';

const fallback=[
 {title_ar:'البوابة الأكاديمية',title_en:'Academic Portal',description_ar:'التسجيل والدرجات والخدمات الأكاديمية',description_en:'Registration, grades and academic services',category:'university',url:'https://portal.unizwa.edu.om/',icon:'🎓'},
 {title_ar:'مودل جامعة نزوى',title_en:'University of Nizwa Moodle',description_ar:'المقررات والواجبات والمحتوى الإلكتروني',description_en:'Courses, assignments and learning content',category:'university',url:'https://moodle.unizwa.edu.om/login/',icon:'🖥️'},
 {title_ar:'الموقع الرسمي لجامعة نزوى',title_en:'University of Nizwa',description_ar:'الكليات والبرامج والأخبار الرسمية',description_en:'Official colleges, programs and news',category:'university',url:'https://www.unizwa.edu.om/',icon:'🏛️'},
 {title_ar:'iLovePDF',title_en:'iLovePDF',description_ar:'ضغط ودمج وتحويل ملفات PDF',description_en:'Compress, merge and convert PDF files',category:'files',url:'https://www.ilovepdf.com/',icon:'📄'},
 {title_ar:'Wolfram Alpha',title_en:'Wolfram Alpha',description_ar:'حسابات علمية ورياضية',description_en:'Scientific and math computation',category:'math',url:'https://www.wolframalpha.com/',icon:'📊'},
 {title_ar:'ChatPDF',title_en:'ChatPDF',description_ar:'تلخيص ومحادثة ملفات PDF',description_en:'Summarize and chat with PDFs',category:'ai',url:'https://www.chatpdf.com/',icon:'🤖'}
];

const categories={
 all:{ar:'الكل',en:'All',icon:'✦'},
 university:{ar:'جامعة نزوى',en:'University',icon:'🏛️'},
 ai:{ar:'الذكاء الاصطناعي',en:'AI',icon:'🤖'},
 writing:{ar:'الكتابة والترجمة',en:'Writing & Translation',icon:'✍️'},
 academic:{ar:'الدراسة والتحقق',en:'Study & Integrity',icon:'🎓'},
 math:{ar:'الرياضيات',en:'Math',icon:'📐'},
 files:{ar:'PDF والملفات',en:'PDF & Files',icon:'📄'},
 design:{ar:'التصميم والعروض',en:'Design & Presentations',icon:'🎨'},
 productivity:{ar:'الإنتاجية',en:'Productivity',icon:'⚡'},
 utilities:{ar:'أدوات متنوعة',en:'Utilities',icon:'🧰'},
 books:{ar:'المكتبات والكتب',en:'Libraries & Books',icon:'📚'},
 general:{ar:'أخرى',en:'Other',icon:'🔗'}
};
const categoryOrder=['university','ai','writing','academic','math','files','design','productivity','utilities','books','general'];
const language=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const t=(ar,en)=>language()==='en'?en:ar;

let rows=[];
let active='all';
let query='';

const filters=document.querySelector('#siteFilters');
const grid=document.querySelector('#usefulSites');
const search=document.querySelector('#usefulSearch');
const count=document.querySelector('#usefulCount');

function normalizedUrl(value){
 try{
  const url=new URL(value);
  return `${url.hostname.replace(/^www\./,'')}${url.pathname.replace(/\/+$/,'')}${url.search}`.toLowerCase();
 }catch{return String(value||'').trim().toLowerCase()}
}
function host(value){try{return new URL(value).hostname.replace(/^www\./,'')}catch{return''}}
function isOfficial(item){
 const hostname=host(item.url);
 return item.category==='university'&&(hostname==='unizwa.edu.om'||hostname.endsWith('.unizwa.edu.om'));
}
function name(item){return language()==='en'?(item.title_en||item.title_ar):(item.title_ar||item.title_en)}
function description(item){return language()==='en'?(item.description_en||item.description_ar||''):(item.description_ar||item.description_en||'')}
function categoryLabel(key){const item=categories[key]||categories.general;return language()==='en'?item.en:item.ar}
function categoryIcon(key){return (categories[key]||categories.general).icon}
function dedupe(items){
 const map=new Map();
 [...items].sort((a,b)=>(Number(a.sort_order)||100)-(Number(b.sort_order)||100)).forEach(item=>{
  const key=normalizedUrl(item.url);
  if(!key)return;
  const current=map.get(key);
  if(!current||description(item).length>description(current).length)map.set(key,item);
 });
 return [...map.values()];
}

function renderFilters(){
 if(!filters)return;
 const available=[...new Set(rows.map(item=>item.category||'general'))].sort((a,b)=>categoryOrder.indexOf(a)-categoryOrder.indexOf(b));
 const keys=['all',...available];
 filters.innerHTML=keys.map(key=>{
  const total=key==='all'?rows.length:rows.filter(item=>(item.category||'general')===key).length;
  return `<button type="button" class="${active===key?'active':''}" data-category="${esc(key)}"><span>${categoryIcon(key)}</span>${esc(categoryLabel(key))}<small>${total}</small></button>`;
 }).join('');
 filters.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
  active=button.dataset.category||'all';
  renderFilters();
  render();
 }));
}

function matches(item){
 if(active!=='all'&&(item.category||'general')!==active)return false;
 if(!query)return true;
 const haystack=`${name(item)} ${description(item)} ${item.category||''} ${host(item.url)}`.toLocaleLowerCase(language()==='en'?'en':'ar');
 return haystack.includes(query);
}

function render(){
 if(!grid)return;
 const filtered=rows.filter(matches);
 if(count)count.textContent=t(`${filtered.length} موقع وأداة`,`${filtered.length} resources`);
 grid.innerHTML=filtered.length?filtered.map(item=>{
  const official=isOfficial(item);
  const badge=official?t('مصدر رسمي','Official source'):categoryLabel(item.category||'general');
  return `<a class="useful46-card" target="_blank" rel="noopener noreferrer" href="${esc(item.url)}" data-resource-title="${esc(name(item))}">
   <span class="useful46-icon">${esc(item.icon||'🔗')}</span>
   <div class="useful46-body">
    <h3>${esc(name(item))}</h3>
    <p>${esc(description(item))}</p>
    <div class="useful46-meta"><span class="useful46-badge${official?' official':''}">${esc(badge)}</span><span class="useful46-host">${esc(host(item.url))}</span></div>
   </div>
   <b class="useful46-open">↗</b>
  </a>`;
 }).join(''):`<div class="useful46-empty">${t('ما حصلنا موقع أو أداة مطابقة. جرّب كلمة ثانية.','No matching resource. Try another search.')}</div>`;
 grid.querySelectorAll('[data-resource-title]').forEach(link=>link.addEventListener('click',()=>trackEvent('useful_site_open',{title:link.dataset.resourceTitle,category:active})));
}

async function load(){
 try{rows=await get('useful_sites','select=*&active=eq.true&order=sort_order.asc,title_ar.asc')}
 catch{rows=fallback}
 if(!rows?.length)rows=fallback;
 rows=dedupe(rows).sort((a,b)=>{
  const categoryDiff=categoryOrder.indexOf(a.category||'general')-categoryOrder.indexOf(b.category||'general');
  return categoryDiff||Number(a.sort_order||100)-Number(b.sort_order||100)||name(a).localeCompare(name(b));
 });
 renderFilters();
 render();
}

search?.addEventListener('input',()=>{
 query=search.value.trim().toLocaleLowerCase(language()==='en'?'en':'ar');
 render();
});

try{await enforceUonMaintenance()}catch{}
try{watchUonMaintenance()}catch{}
try{await applyFeatureStates(document)}catch{}
load();
trackEvent('feature_open',{feature:'useful-sites-v46'});
