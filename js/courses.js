import{$,get,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent,debounce,installErrorCapture}from'./core.js?v=39.0.0';

installErrorCapture();
enforceUonMaintenance();
watchUonMaintenance();

const state={courses:[],colleges:[],departments:[],programs:[],links:[],search:'',collegeId:'',departmentId:'',programId:'',sort:'code',view:localStorage.getItem('uon_course_view')||'grid'};
const text=value=>String(value??'').trim();
const normalize=value=>text(value).toLowerCase();
const nameAr=row=>text(row?.name_ar||row?.name_en||row?.name);
const nameEn=row=>text(row?.name_en||row?.name_ar||row?.name);
const programLabel=row=>text(row?.degree_ar)?`${nameAr(row)} — ${text(row.degree_ar)}`:nameAr(row);
const requirementLabels={university:'متطلب جامعة',college:'متطلب كلية',major:'متطلب تخصص',elective:'اختياري',service:'مقرر خدمة',multiple:'يختلف حسب البرنامج'};
const byOrder=(a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999)||nameAr(a).localeCompare(nameAr(b),'ar');

function optionList(rows,label){return `<option value="">${esc(label)}</option>`+rows.map(row=>`<option value="${esc(row.id)}">${esc(programLabel(row))}</option>`).join('')}
async function read(table,query){const rows=await get(table,query);return Array.isArray(rows)?rows:[]}
function selectedCollege(){return state.colleges.find(row=>row.id===state.collegeId)}
function selectedDepartment(){return state.departments.find(row=>row.id===state.departmentId)}
function selectedProgram(){return state.programs.find(row=>row.id===state.programId)}

function refreshAcademicFilters(){
 const departments=state.departments.filter(row=>!state.collegeId||row.college_id===state.collegeId).sort(byOrder);
 $('#courseDepartment').innerHTML=optionList(departments,'كل الأقسام');
 $('#courseDepartment').disabled=!state.collegeId;
 if(state.departmentId&&!departments.some(row=>row.id===state.departmentId))state.departmentId='';
 $('#courseDepartment').value=state.departmentId;
 const programs=state.programs.filter(row=>(!state.collegeId||row.college_id===state.collegeId)&&(!state.departmentId||row.department_id===state.departmentId)).sort(byOrder);
 $('#courseProgram').innerHTML=optionList(programs,'كل التخصصات');
 $('#courseProgram').disabled=!state.collegeId;
 if(state.programId&&!programs.some(row=>row.id===state.programId))state.programId='';
 $('#courseProgram').value=state.programId;
}
function academicProgramIds(){
 if(state.programId)return new Set([state.programId]);
 if(state.departmentId)return new Set(state.programs.filter(row=>row.department_id===state.departmentId).map(row=>row.id));
 if(state.collegeId)return new Set(state.programs.filter(row=>row.college_id===state.collegeId).map(row=>row.id));
 return null;
}
function linkedCourseCodes(){
 const ids=academicProgramIds();
 if(!ids)return null;
 return new Set(state.links.filter(row=>ids.has(row.program_id)).map(row=>text(row.course_code).toUpperCase()));
}
function requirementTypeFor(course){
 const ids=academicProgramIds(),code=text(course.code).toUpperCase();
 if(!ids)return course.requirement_type||'';
 const types=new Set(state.links.filter(row=>ids.has(row.program_id)&&text(row.course_code).toUpperCase()===code).map(row=>text(row.requirement_type)).filter(Boolean));
 if(types.size===1)return[...types][0];
 if(types.size>1)return'multiple';
 return course.requirement_type||'';
}
function directAcademicMatch(course){
 const college=selectedCollege(),department=selectedDepartment();
 const collegeValues=[course.college_ar,course.college,course.college_en].map(normalize).filter(Boolean);
 const departmentValues=[course.department_ar,course.department,course.department_en].map(normalize).filter(Boolean);
 const collegeMatch=!college||collegeValues.includes(normalize(college.name_ar))||collegeValues.includes(normalize(college.name_en));
 const departmentMatch=!department||departmentValues.includes(normalize(department.name_ar))||departmentValues.includes(normalize(department.name_en));
 return collegeMatch&&departmentMatch&&(collegeValues.length>0||departmentValues.length>0);
}
function visibleCourses(){
 const query=normalize(state.search),linked=linkedCourseCodes(),academicFilter=Boolean(state.collegeId||state.departmentId||state.programId);
 return state.courses.filter(course=>{
  const code=text(course.code).toUpperCase();
  const searchMatch=!query||normalize([code,course.name_ar,course.name_en,course.description,requirementLabels[course.requirement_type]].join(' ')).includes(query);
  const academicMatch=!academicFilter||Boolean(linked?.has(code))||(!state.programId&&directAcademicMatch(course));
  return searchMatch&&academicMatch;
 }).sort((a,b)=>state.sort==='name'?nameAr(a).localeCompare(nameAr(b),'ar'):state.sort==='hours'?Number(b.credit_hours||0)-Number(a.credit_hours||0):text(a.code).localeCompare(text(b.code),'en'));
}
function render(){
 const rows=visibleCourses(),linked=linkedCourseCodes(),academicFilter=Boolean(state.collegeId||state.departmentId||state.programId);
 $('#courseCount').textContent=`${rows.length} مقرر`;
 const context=[];
 if(selectedCollege())context.push(nameAr(selectedCollege()));
 if(selectedDepartment())context.push(nameAr(selectedDepartment()));
 if(selectedProgram())context.push(programLabel(selectedProgram()));
 if(academicFilter&&linked?.size===0)context.push('لا توجد مقررات مربوطة بهذا الاختيار حتى الآن');
 $('#courseHint').textContent=context.length?` · ${context.join(' — ')}`:'';
 const catalog=$('#courseCards');
 catalog.classList.toggle('list-view',state.view==='list');
 $('#gridView').classList.toggle('active',state.view==='grid');
 $('#listView').classList.toggle('active',state.view==='list');
 catalog.innerHTML=rows.length?rows.map(course=>{
  const code=text(course.code).toUpperCase(),title=nameAr(course)||nameEn(course)||code,subtitle=nameEn(course)!==title?nameEn(course):'',type=requirementLabels[requirementTypeFor(course)]||'';
  return `<article class="v31-course-card"><a href="course.html?code=${encodeURIComponent(code)}"><div class="v31-course-card-head"><span class="v31-course-code">${esc(code)}</span><span class="v31-course-hours">${esc(course.credit_hours??'—')} ساعات</span></div>${type?`<span class="v31-course-college">${esc(type)}</span>`:''}<h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</a><footer><a class="btn primary" href="course.html?code=${encodeURIComponent(code)}">فتح المقرر</a></footer></article>`;
 }).join(''):`<div class="course-empty"><strong>ما حصلنا مقررات مطابقة</strong><span>${academicFilter?'ما تم ربط مقررات بهذا الاختيار حتى الآن.':'غيّر البحث أو الفلاتر وجرب مرة ثانية.'}</span></div>`;
}
async function load(){
 try{
  const [courses,colleges,departments,programs,links]=await Promise.all([
   read('courses','select=*&active=eq.true&order=code.asc'),
   read('academic_colleges','select=*&active=eq.true&order=sort_order.asc'),
   read('academic_departments','select=*&active=eq.true&order=sort_order.asc'),
   read('academic_programs','select=*&active=eq.true&order=sort_order.asc'),
   read('course_programs','select=course_code,program_id,requirement_type,semester_no')
  ]);
  Object.assign(state,{courses,colleges,departments,programs,links});
  $('#courseCollege').innerHTML=optionList(state.colleges.sort(byOrder),'كل الكليات');
  refreshAcademicFilters();render();trackEvent('page_view',{page:'courses',courses:courses.length,programs:programs.length});
 }catch(error){
  console.error('[courses] load failed',error);
  $('#courseCount').textContent='تعذر تحميل المقررات';$('#courseHint').textContent='';
  $('#courseCards').innerHTML=`<div class="course-empty"><strong>${esc(error.message||'حدث خطأ غير متوقع')}</strong><button class="btn primary" id="retryCourses" type="button">إعادة المحاولة</button></div>`;
  $('#retryCourses')?.addEventListener('click',load);
 }
}

$('#courseSearch')?.addEventListener('input',debounce(event=>{state.search=event.target.value;render()},180));
$('#courseCollege')?.addEventListener('change',event=>{state.collegeId=event.target.value;state.departmentId='';state.programId='';refreshAcademicFilters();render()});
$('#courseDepartment')?.addEventListener('change',event=>{state.departmentId=event.target.value;state.programId='';refreshAcademicFilters();render()});
$('#courseProgram')?.addEventListener('change',event=>{state.programId=event.target.value;render()});
$('#courseSort')?.addEventListener('change',event=>{state.sort=event.target.value;render()});
$('#gridView')?.addEventListener('click',()=>{state.view='grid';localStorage.setItem('uon_course_view','grid');render()});
$('#listView')?.addEventListener('click',()=>{state.view='list';localStorage.setItem('uon_course_view','list');render()});
load();
