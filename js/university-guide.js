import{
 setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,toast,esc,
 trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

setupNav();
enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

const state={colleges:[],departments:[],programs:[],search:'',collegeId:'',degree:''};
const text=value=>String(value??'').trim();
const normalize=value=>text(value).toLowerCase();
const safeUrl=value=>{
 try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}
};
const collegeName=id=>state.colleges.find(row=>row.id===id)?.name_ar||'';
const departmentName=id=>state.departments.find(row=>row.id===id)?.name_ar||'';
const sortByOrder=(a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999)||text(a.name_ar).localeCompare(text(b.name_ar),'ar');

function buildFilters(){
 $('#collegeFilter').innerHTML='<option value="">كل الكليات</option>'+state.colleges.map(row=>`<option value="${esc(row.id)}">${esc(row.name_ar)}</option>`).join('');
 const degrees=[...new Set(state.programs.map(row=>text(row.degree_ar)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 $('#degreeFilter').innerHTML='<option value="">كل الدرجات</option>'+degrees.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
 $('#collegeTabs').innerHTML=`<button type="button" class="active" data-college-tab="">كل الكليات</button>`+state.colleges.map(row=>`<button type="button" data-college-tab="${esc(row.id)}">${esc(row.name_ar)}</button>`).join('');
 $('#collegeTabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-college-tab]');if(!button)return;
  state.collegeId=button.dataset.collegeTab||'';
  $('#collegeFilter').value=state.collegeId;
  document.querySelectorAll('[data-college-tab]').forEach(item=>item.classList.toggle('active',item===button));
  render();
 });
}
function filteredPrograms(){
 const query=normalize(state.search);
 return state.programs.filter(program=>{
  const haystack=normalize([program.name_ar,program.name_en,program.degree_ar,program.degree_en,collegeName(program.college_id),departmentName(program.department_id)].join(' '));
  return (!state.collegeId||program.college_id===state.collegeId)&&(!state.degree||text(program.degree_ar)===state.degree)&&(!query||haystack.includes(query));
 }).sort((a,b)=>{
  const collegeCompare=collegeName(a.college_id).localeCompare(collegeName(b.college_id),'ar');
  if(collegeCompare)return collegeCompare;
  const departmentCompare=departmentName(a.department_id).localeCompare(departmentName(b.department_id),'ar');
  return departmentCompare||sortByOrder(a,b);
 });
}
function programCard(program){
 const official=safeUrl(program.official_url);
 return `<article class="guide-program-card"><div class="guide-program-main"><span class="guide-degree">${esc(program.degree_ar||'برنامج أكاديمي')}</span><h3>${esc(program.name_ar)}</h3>${program.name_en&&program.name_en!==program.name_ar?`<p dir="ltr">${esc(program.name_en)}</p>`:''}<small>${esc(departmentName(program.department_id)||'برنامج أكاديمي')} • ${esc(collegeName(program.college_id))}</small></div>${official?`<a class="btn" href="${esc(official)}" target="_blank" rel="noopener noreferrer">المصدر الرسمي</a>`:''}</article>`;
}
function render(){
 const programs=filteredPrograms();
 $('#collegeCount').textContent=state.colleges.length;
 $('#programCount').textContent=programs.length;
 $('#degreeCount').textContent=new Set(programs.map(row=>row.degree_ar).filter(Boolean)).size;
 const target=$('#items');
 if(!programs.length){target.innerHTML='<div class="empty">لا توجد برامج مطابقة للبحث.</div>';return}
 const grouped=new Map();
 programs.forEach(program=>{
  const key=`${program.college_id}:${program.department_id||''}`;
  if(!grouped.has(key))grouped.set(key,{college:collegeName(program.college_id),department:departmentName(program.department_id),items:[]});
  grouped.get(key).items.push(program);
 });
 target.innerHTML=[...grouped.values()].map(group=>`<section class="guide-program-group"><header><span>${esc(group.college)}</span><h2>${esc(group.department||'برامج الكلية')}</h2><b>${group.items.length} برنامج</b></header><div>${group.items.map(programCard).join('')}</div></section>`).join('');
}
async function load(){
 $('#items').innerHTML='<div class="empty">جاري تحميل دليل الجامعة...</div>';
 try{
  const [colleges,departments,programs]=await Promise.all([
   get('academic_colleges','select=*&active=eq.true&order=sort_order.asc'),
   get('academic_departments','select=*&active=eq.true&order=sort_order.asc'),
   get('academic_programs','select=*&active=eq.true&order=sort_order.asc')
  ]);
  state.colleges=(colleges||[]).sort(sortByOrder);
  state.departments=(departments||[]).sort(sortByOrder);
  state.programs=(programs||[]).filter(row=>row.college_id&&text(row.name_ar));
  buildFilters();render();
  trackEvent('page_view',{page:'university-guide',programs:state.programs.length});
 }catch(error){
  console.error(error);
  $('#items').innerHTML='<div class="empty">تعذر تحميل دليل الجامعة حاليًا.</div>';
  toast(error.message||'تعذر تحميل الدليل',true);
 }
}
$('#search')?.addEventListener('input',event=>{state.search=event.target.value;render()});
$('#collegeFilter')?.addEventListener('change',event=>{
 state.collegeId=event.target.value;
 document.querySelectorAll('[data-college-tab]').forEach(item=>item.classList.toggle('active',item.dataset.collegeTab===state.collegeId));
 render();
});
$('#degreeFilter')?.addEventListener('change',event=>{state.degree=event.target.value;render()});
load();
