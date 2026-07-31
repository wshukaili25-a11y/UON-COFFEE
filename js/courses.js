import {checkFeature,installErrorCapture,$,get,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent,debounce,colleges as coreColleges} from './core.js';

await enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

const featureState=await checkFeature('courses');
if(featureState!=='active')throw new Error('COURSES_FEATURE_DISABLED');

const lang=()=>localStorage.getItem('uon_language')||'ar';
const tr=(ar,en)=>lang()==='ar'?ar:en;
const norm=v=>String(v||'').trim().toLowerCase();
const first=(obj,keys)=>{for(const key of keys){const value=obj?.[key];if(value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim()}return''};
const collegeName=r=>first(r,['college_ar','college','college_name_ar','college_name']);
const departmentName=r=>first(r,['department_ar','department','department_name_ar','department_name']);
const programName=r=>first(r,['program_ar','program','major_ar','major','specialization_ar','specialization']);

const state={rows:[],colleges:[],departments:[],programs:[],links:[],query:'',college:'',department:'',program:'',sort:'code'};

const byOrder=(a,b)=>(Number(a.sort_order)||100)-(Number(b.sort_order)||100)||String(lang()==='ar'?(a.name_ar||a.name):(a.name_en||a.name_ar||a.name)).localeCompare(String(lang()==='ar'?(b.name_ar||b.name):(b.name_en||b.name_ar||b.name)),lang());

function opts(rows,label){
 return `<option value="">${label}</option>`+rows.map(x=>`<option value="${esc(String(x.id||x.name_ar||x.name))}">${esc(lang()==='ar'?(x.name_ar||x.name):(x.name_en||x.name_ar||x.name))}</option>`).join('');
}

async function safeGet(table,query='select=*'){
 try{
  const result=await get(table,query);
  return Array.isArray(result)?result:[];
 }catch(error){
  console.warn(`[courses] ${table}`,error);
  return [];
 }
}

async function loadProgramsFallback(){
 try{
  const response=await fetch('./js/university-guide.js?v=25.8.0',{cache:'no-store'});
  if(!response.ok)return [];
  const source=await response.text();
  const start=source.indexOf('const officialPrograms=');
  if(start<0)return [];
  const jsonStart=source.indexOf('[',start);
  const jsonEnd=source.indexOf('];',jsonStart);
  if(jsonStart<0||jsonEnd<0)return [];
  const rows=JSON.parse(source.slice(jsonStart,jsonEnd+1));
  const map=new Map();
  rows.forEach((row,index)=>{
   const college=String(row.college||'').trim();
   const nameAr=String(row.name_ar||row.name_en||'').trim();
   if(!college||!nameAr)return;
   const key=`${college}::${nameAr}`;
   if(!map.has(key))map.set(key,{
    id:key,
    name_ar:nameAr,
    name_en:String(row.name_en||nameAr).trim(),
    college_name_ar:college,
    college_id:college,
    department_id:'',
    sort_order:index+1
   });
  });
  return [...map.values()];
 }catch(error){
  console.warn('[courses] program fallback',error);
  return [];
 }
}

function ensureFallbacks(){
 if(!state.colleges.length){
  state.colleges=coreColleges.map((name,index)=>({id:name,name_ar:name,name_en:name,sort_order:(index+1)*10,active:true}));
 }
 if(!state.departments.length){
  state.departments=state.colleges.flatMap((college,index)=>[
   {id:`${college.id}::university`,college_id:String(college.id),name_ar:'متطلبات الجامعة',name_en:'University Requirements',sort_order:1},
   {id:`${college.id}::college`,college_id:String(college.id),name_ar:'متطلبات الكلية',name_en:'College Requirements',sort_order:2}
  ]);
 }
}

function selectedCollege(){return state.colleges.find(x=>String(x.id||x.name_ar)===state.college)}
function selectedDepartment(){return state.departments.find(x=>String(x.id||x.name_ar)===state.department)}

function refresh(){
 const college=selectedCollege();
 const collegeId=String(college?.id||'');
 const collegeAr=String(college?.name_ar||'');
 const departments=state.departments.filter(x=>!state.college||String(x.college_id||'')===collegeId||String(x.college_name_ar||'')===collegeAr).sort(byOrder);
 $('#courseDepartment').innerHTML=opts(departments,tr('كل الأقسام','All departments'));
 if(state.department&&!departments.some(x=>String(x.id||x.name_ar)===state.department))state.department='';

 const department=selectedDepartment();
 const departmentId=String(department?.id||'');
 const departmentAr=String(department?.name_ar||'');
 const programs=state.programs.filter(x=>{
  const collegeMatch=!state.college||String(x.college_id||'')===collegeId||String(x.college_name_ar||'')===collegeAr;
  const hasDepartment=Boolean(x.department_id||x.department_name_ar);
  const departmentMatch=!state.department||!hasDepartment||String(x.department_id||'')===departmentId||String(x.department_name_ar||'')===departmentAr;
  return collegeMatch&&departmentMatch;
 }).sort(byOrder);
 $('#courseProgram').innerHTML=opts(programs,tr('كل التخصصات','All programs'));
 if(state.program&&!programs.some(x=>String(x.id||x.name_ar)===state.program))state.program='';
}

function filtered(){
 const college=selectedCollege();
 const department=selectedDepartment();
 const selectedProgram=state.programs.find(x=>String(x.id||x.name_ar)===state.program);
 const linkedCodes=state.program?new Set(state.links.filter(x=>String(x.program_id)===state.program).map(x=>String(x.course_code||'').toUpperCase())):null;
 const q=norm(state.query);
 return state.rows.filter(row=>{
  const code=String(row.code||row.course_code||'').toUpperCase();
  const rowCollege=collegeName(row);
  const rowDepartment=departmentName(row);
  const rowProgram=programName(row);
  const collegeMatch=!state.college||!rowCollege||rowCollege===college?.name_ar;
  const departmentMatch=!state.department||!rowDepartment||rowDepartment===department?.name_ar;
  const programMatch=!state.program||linkedCodes?.has(code)||!rowProgram||rowProgram===selectedProgram?.name_ar;
  const searchMatch=!q||norm([code,row.name_ar,row.name_en,rowCollege,rowDepartment,rowProgram].join(' ')).includes(q);
  return searchMatch&&collegeMatch&&departmentMatch&&programMatch;
 }).sort((a,b)=>state.sort==='name'?String(lang()==='ar'?a.name_ar:a.name_en).localeCompare(String(lang()==='ar'?b.name_ar:b.name_en),lang()):state.sort==='hours'?Number(b.credit_hours||b.hours||0)-Number(a.credit_hours||a.hours||0):String(a.code||a.course_code).localeCompare(String(b.code||b.course_code),'en'));
}

function render(){
 const list=filtered();
 $('#courseCount').textContent=tr(`${list.length} مقرر`,`${list.length} courses`);
 $('#courseHint').textContent=state.rows.length?tr(`من أصل ${state.rows.length}`,`of ${state.rows.length}`):'';
 $('#courseCards').innerHTML=list.length?list.map(row=>{
  const code=row.code||row.course_code||'';
  const url=`course.html?code=${encodeURIComponent(code)}`;
  const name=lang()==='ar'?(row.name_ar||row.name_en):(row.name_en||row.name_ar);
  const college=lang()==='ar'?collegeName(row):(row.college_en||collegeName(row));
  return `<article class="v31-course-card"><a href="${url}"><div class="v31-course-card-head"><span class="v31-course-code">${esc(code)}</span><span class="v31-course-hours">${row.credit_hours||row.hours||'—'} ${tr('ساعات','credits')}</span></div><span class="v31-course-college">${esc(college||tr('جامعة نزوى','University of Nizwa'))}</span><h2>${esc(name||code)}</h2><p>${esc(lang()==='ar'?departmentName(row):(row.department_en||departmentName(row)))}</p></a><footer><a class="btn primary" href="${url}">${tr('فتح المقرر','Open course')}</a></footer></article>`;
 }).join(''):`<div class="course-empty"><strong>${tr('ما حصلنا مقررات مطابقة','No matching courses')}</strong></div>`;
}

async function load(){
 const [rows,colleges,departments,dbPrograms,links,fallbackPrograms]=await Promise.all([
  safeGet('courses','select=*&order=code.asc'),
  safeGet('academic_colleges','select=*&order=sort_order.asc'),
  safeGet('academic_departments','select=*&order=sort_order.asc'),
  safeGet('academic_programs','select=*&order=sort_order.asc'),
  safeGet('course_programs','select=course_code,program_id,requirement_type'),
  loadProgramsFallback()
 ]);
 state.rows=rows.filter(x=>x.active!==false&&x.status!=='inactive');
 state.colleges=colleges.filter(x=>x.active!==false);
 state.departments=departments.filter(x=>x.active!==false);
 state.programs=(dbPrograms.length?dbPrograms:fallbackPrograms).filter(x=>x.active!==false);
 state.links=links;
 ensureFallbacks();
 $('#courseCollege').innerHTML=opts(state.colleges.sort(byOrder),tr('كل الكليات','All colleges'));
 refresh();
 render();
 trackEvent('page_view',{page:'courses',count:state.rows.length});
}

$('#courseSearch').addEventListener('input',debounce(event=>{state.query=event.target.value;render()},180));
$('#courseCollege').addEventListener('change',event=>{state.college=event.target.value;state.department='';state.program='';refresh();render()});
$('#courseDepartment').addEventListener('change',event=>{state.department=event.target.value;state.program='';refresh();render()});
$('#courseProgram').addEventListener('change',event=>{state.program=event.target.value;render()});
$('#courseSort').addEventListener('change',event=>{state.sort=event.target.value;render()});

load().catch(error=>{
 $('#courseCount').textContent=tr('تعذر تحميل المقررات','Could not load courses');
 $('#courseCards').innerHTML=`<div class="course-empty"><strong>${esc(error.message)}</strong></div>`;
});
