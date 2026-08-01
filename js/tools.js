import {setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,toast,esc} from './core.js?v=34.0.2';
import {applyFeatureStates as applyV175States} from './core.js?v=34.0.2';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();

let rows=[];
let cats=[];

const fixedTools=[
 {feature:'confessions',href:'confessions.html',icon:'👀',title:'الرسائل المجهولة',description:'أنشئ رابطك واستقبل رسائل مجهولة وردّ على ما تختاره.'},
 {feature:'useful-sites',href:'useful-sites.html',icon:'🔗',title:'مواقع مهمة ومفيدة',description:'مواقع الجامعة وأدوات دراسية مختارة.'},
 {feature:'assistant',href:'assistant.html',icon:'AI',title:'مساعد UON AI',description:'اسأل عن المقررات والخدمات ودليل الجامعة.'}
];

function fixedCard(item){
 return `<a class="card feature-card" href="${esc(item.href)}" data-feature="${esc(item.feature)}"><span class="tool-icon">${item.icon}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><b>فتح</b></a>`;
}

function render(){
 const q=($('#search')?.value||'').trim().toLowerCase();
 const c=$('#category')?.value||'';
 const dynamic=rows.filter(x=>(!c||x.category_id===c)&&`${x.name||''} ${x.description||''}`.toLowerCase().includes(q));
 const fixed=fixedTools.filter(x=>!c&&`${x.title} ${x.description}`.toLowerCase().includes(q));
 const dynamicHtml=dynamic.map(x=>`<article class="card feature-card" data-feature="${esc(x.feature_key||'')}" data-status="${esc(x.status||'active')}"><i>${esc(x.emoji||'🧰')}</i><h3>${esc(x.name)}</h3><p>${esc(x.description||'')}</p>${(x.status||'active')==='active'?`<a class="btn" target="_blank" rel="noopener" href="${esc(x.url)}">فتح</a>`:`<span class="badge">${x.status==='maintenance'?'صيانة':x.status==='coming_soon'?'قريبًا':'متوقفة'}</span>`}</article>`).join('');
 const fixedHtml=fixed.map(fixedCard).join('');
 $('#items').innerHTML=(fixedHtml+dynamicHtml)||'<div class="empty">لا توجد أدوات</div>';
 applyV175States($('#items'));
}

async function load(){
 try{
  [rows,cats]=await Promise.all([
   get('tools_items','select=*&order=featured.desc,name.asc'),
   get('tools_categories','select=*&order=sort_order.asc')
  ]);
  $('#category').innerHTML='<option value="">كل التصنيفات</option>'+cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 }catch(error){
  console.warn('Tools data load failed',error);
  toast('تعذر تحميل بعض الأدوات، لكن الأدوات الأساسية ما زالت متاحة',true);
 }finally{
  render();
 }
}

$('#search').oninput=render;
$('#category').onchange=render;
render();
load();
