import {toast,esc} from './core.js?v=32.2.1';

const $=selector=>document.querySelector(selector);
const API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/course-admin-api-v32';
const PUBLISHABLE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const state={courses:[],colleges:[],departments:[],programs:[],links:[],quarantine:[],metrics:{},selectedPrograms:new Set(),filter:'all'};
const password=()=>sessionStorage.getItem('uon_admin_password')||'';
const text=value=>String(value??'').trim();
const norm=value=>text(value).toLowerCase();
const codeOf=value=>text(value).toUpperCase();
const byOrder=(a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999)||text(a.name_ar).localeCompare(text(b.name_ar),'ar');
const quarantineReasonLabel=reason=>({invalid_course_code:'رمز لا يطابق صيغة المقررات',corrupted_import_text:'نص تالف من ملف مستورد',invalid_imported_course:'بيانات استيراد غير صالحة'}[text(reason)]||text(reason)||'سجل غير صالح');

async function api(action,payload={}){
 const response=await fetch(API,{
  method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY,'x-admin-password':password()},
  body:JSON.stringify({action,...payload})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error(data.error||`HTTP ${response.status}`);
 return data.data;
}

function injectUi(){
 const section=$('#sec-courses-admin');
 const form=$('#courseAdminForm');
 if(!section||!form||$('#courseAdminMetrics'))return;
 const intro=section.querySelector('.section-head p');
 if(intro)intro.textContent='إضافة وتعديل وربط المقررات بالكليات والأقسام والتخصصات من مصدر أكاديمي واحد.';

 const metrics=document.createElement('div');
 metrics.id='courseAdminMetrics';metrics.className='grid grid-4';metrics.style.marginBottom='18px';
 section.querySelector('.section-head')?.after(metrics);

 const filterBar=document.createElement('div');
 filterBar.className='card form-card';filterBar.style.marginBottom='18px';
 filterBar.innerHTML='<div class="row" id="courseAdminFilters"><button class="btn primary" type="button" data-course-filter="all">الكل</button><button class="btn" type="button" data-course-filter="linked">المرتبطة</button><button class="btn" type="button" data-course-filter="unlinked">غير المرتبطة</button><button class="btn" type="button" data-course-filter="inactive">المتوقفة</button></div>';
 metrics.after(filterBar);

 const oldDepartment=$('#courseDepartmentAdmin');
 if(oldDepartment?.tagName!=='SELECT'){
  const select=document.createElement('select');select.id='courseDepartmentAdmin';select.innerHTML='<option value="">اختر القسم</option>';
  oldDepartment.replaceWith(select);
 }
 const college=$('#courseCollegeAdmin');
 if(college)college.innerHTML='<option value="">اختر الكلية</option>';

 const departmentLabel=$('#courseDepartmentAdmin')?.closest('label');
 const academicFields=document.createElement('div');
 academicFields.id='courseAcademicFields';
 academicFields.innerHTML=`
  <label>نوع المتطلب<select id="courseRequirementAdmin"><option value="major">متطلب تخصص</option><option value="college">متطلب كلية</option><option value="university">متطلب جامعة</option><option value="elective">اختياري</option></select></label>
  <label>الرابط الرسمي<input id="courseSourceUrl" type="url" placeholder="https://www.unizwa.edu.om/..."></label>
  <div class="card" style="padding:14px;margin:10px 0"><div class="section-head"><div><strong>التخصصات المرتبطة</strong><p class="muted" style="margin:4px 0 0">يمكن اختيار أكثر من تخصص.</p></div><button class="btn" id="clearCoursePrograms" type="button">إلغاء التحديد</button></div><div id="courseProgramsAdmin" class="grid grid-2"></div></div>`;
 departmentLabel?.after(academicFields);

 const listCard=$('#coursesAdminList')?.closest('.card');
 if(listCard){
  const quarantine=document.createElement('div');
  quarantine.className='card form-card';quarantine.style.marginTop='18px';
  quarantine.innerHTML='<div class="section-head"><div><h3>السجلات المعزولة</h3><p class="muted">بيانات التقطها الاستيراد القديم ولم تُعرض للطلاب.</p></div><strong id="courseQuarantineCount">0</strong></div><div id="courseQuarantineList" class="list"></div>';
  listCard.after(quarantine);
 }
}

function option(rows,label){return `<option value="">${esc(label)}</option>`+rows.map(row=>`<option value="${esc(row.id)}">${esc(row.name_ar||row.name_en)}</option>`).join('')}
function selectedCollege(){return state.colleges.find(row=>row.id===$('#courseCollegeAdmin')?.value)}
function selectedDepartment(){return state.departments.find(row=>row.id===$('#courseDepartmentAdmin')?.value)}
function programMap(){return new Map(state.programs.map(row=>[row.id,row]))}
function linksFor(code){const key=codeOf(code);return state.links.filter(row=>codeOf(row.course_code)===key)}

function refreshDepartments({preserve=false}={}){
 const collegeId=$('#courseCollegeAdmin')?.value||'';
 const current=preserve?$('#courseDepartmentAdmin')?.value||'':'';
 const rows=state.departments.filter(row=>!collegeId||row.college_id===collegeId).sort(byOrder);
 $('#courseDepartmentAdmin').innerHTML=option(rows,'اختر القسم');
 $('#courseDepartmentAdmin').disabled=!collegeId;
 if(current&&rows.some(row=>row.id===current))$('#courseDepartmentAdmin').value=current;
 refreshPrograms();
}

function refreshPrograms(){
 const collegeId=$('#courseCollegeAdmin')?.value||'';
 const departmentId=$('#courseDepartmentAdmin')?.value||'';
 const rows=state.programs.filter(row=>(!collegeId||row.college_id===collegeId)&&(!departmentId||row.department_id===departmentId)).sort(byOrder);
 const holder=$('#courseProgramsAdmin');
 if(!holder)return;
 const validIds=new Set(rows.map(row=>String(row.id)));
 for(const id of [...state.selectedPrograms])if(!validIds.has(id))state.selectedPrograms.delete(id);
 holder.innerHTML=rows.length?rows.map(row=>`<label class="check-row" style="align-items:flex-start"><input type="checkbox" data-course-program="${esc(row.id)}" ${state.selectedPrograms.has(String(row.id))?'checked':''}><span><strong>${esc(row.name_ar)}</strong><small>${esc(row.degree_ar||row.name_en||'')}</small></span></label>`).join(''):'<div class="empty">اختر الكلية والقسم لعرض التخصصات</div>';
}

function renderMetrics(){
 const m=state.metrics||{};
 const cards=[['كل المقررات',m.total||0],['النشطة',m.active||0],['المرتبطة',m.linked||0],['غير المرتبطة',m.unlinked||0],['السجلات المعزولة',m.quarantined||state.quarantine.length||0]];
 $('#courseAdminMetrics').innerHTML=cards.map(([label,value])=>`<div class="card"><small>${esc(label)}</small><strong style="display:block;font-size:1.7rem;margin-top:6px">${esc(value)}</strong></div>`).join('');
}

function currentRows(){
 const q=norm($('#courseAdminSearch')?.value||'');
 const linkedCodes=new Set(state.links.map(row=>codeOf(row.course_code)));
 return state.courses.filter(course=>{
  const linked=linkedCodes.has(codeOf(course.code));
  const filterMatch=state.filter==='all'||(state.filter==='linked'&&linked)||(state.filter==='unlinked'&&course.active!==false&&!linked)||(state.filter==='inactive'&&course.active===false);
  const searchMatch=!q||norm([course.code,course.name_ar,course.name_en,course.college_ar,course.college,course.department_ar,course.department].join(' ')).includes(q);
  return filterMatch&&searchMatch;
 });
}

function renderCourses(){
 const programs=programMap();
 const rows=currentRows();
 $('#coursesAdminList').innerHTML=rows.length?rows.map(course=>{
  const links=linksFor(course.code);const names=links.map(link=>programs.get(link.program_id)?.name_ar).filter(Boolean);
  const linked=names.length>0;
  const programText=names.length<=3?names.join('، '):`${names.slice(0,3).join('، ')} +${names.length-3}`;
  return `<div class="list-item"><div><strong>${esc(course.code)} — ${esc(course.name_ar)}</strong><small>${esc(course.college_ar||course.college||'بدون كلية')} • ${esc(course.department_ar||course.department||'بدون قسم')} • ${esc(course.credit_hours??'—')} ساعات</small><small>${linked?`✅ ${esc(programText)}`:'⚠️ غير مرتبط بتخصص'} • ${course.active!==false?'نشط':'متوقف'}</small></div><div class="row"><button class="btn" data-course-edit="${esc(course.id)}">تعديل</button><button class="btn" data-course-toggle="${esc(course.id)}" data-active="${course.active!==false?'1':'0'}">${course.active!==false?'إيقاف':'تفعيل'}</button><button class="btn danger" data-course-delete="${esc(course.id)}">حذف</button></div></div>`;
 }).join(''):'<div class="empty">لا توجد مقررات مطابقة</div>';
 document.querySelectorAll('[data-course-filter]').forEach(button=>button.classList.toggle('primary',button.dataset.courseFilter===state.filter));
}

function renderQuarantine(){
 $('#courseQuarantineCount').textContent=String(state.quarantine.length);
 $('#courseQuarantineList').innerHTML=state.quarantine.length?state.quarantine.map(item=>{
  const snapshot=item.snapshot||{};
  return `<div class="list-item"><div><strong>${esc(item.course_code||snapshot.code||'بدون رمز')}</strong><small>${esc(quarantineReasonLabel(item.reason))}</small><small>${esc(snapshot.name_ar||snapshot.name_en||'بيانات استيراد قديمة')} • ${esc(new Date(item.quarantined_at).toLocaleDateString('ar-OM'))}</small></div></div>`;
 }).join(''):'<div class="empty">لا توجد سجلات معزولة</div>';
}

function resetForm(){
 $('#courseAdminForm')?.reset();
 $('#courseEditId').value='';
 $('#courseActive').checked=true;
 $('#courseRequirementAdmin').value='major';
 state.selectedPrograms.clear();
 $('#courseCollegeAdmin').value='';
 refreshDepartments();
 $('#courseCode')?.focus();
}

function inferAcademic(course){
 const links=linksFor(course.code);const programs=programMap();const first=links.map(link=>programs.get(link.program_id)).find(Boolean);
 if(first)return {collegeId:first.college_id||'',departmentId:first.department_id||'',programIds:links.map(link=>String(link.program_id)),requirement:links[0]?.requirement_type||course.requirement_type||'major'};
 const college=state.colleges.find(row=>[course.college_ar,course.college_en,course.college].some(value=>norm(value)===norm(row.name_ar)||norm(value)===norm(row.name_en)));
 const department=state.departments.find(row=>(!college||row.college_id===college.id)&&[course.department_ar,course.department_en,course.department].some(value=>norm(value)===norm(row.name_ar)||norm(value)===norm(row.name_en)));
 return {collegeId:college?.id||'',departmentId:department?.id||'',programIds:[],requirement:course.requirement_type||'major'};
}

function editCourse(id){
 const course=state.courses.find(row=>row.id===id);if(!course)return;
 const academic=inferAcademic(course);
 $('#courseEditId').value=course.id;$('#courseCode').value=course.code;$('#courseNameAr').value=course.name_ar;$('#courseNameEn').value=course.name_en||'';
 $('#courseHours').value=course.credit_hours??'';$('#courseLevel').value=course.level??'';$('#courseDescription').value=course.description||'';$('#courseActive').checked=course.active!==false;
 $('#courseRequirementAdmin').value=academic.requirement;$('#courseSourceUrl').value=course.source_url||'';
 state.selectedPrograms=new Set(academic.programIds);
 $('#courseCollegeAdmin').value=academic.collegeId;refreshDepartments();
 $('#courseDepartmentAdmin').value=academic.departmentId;refreshPrograms();
 $('#courseAdminForm').scrollIntoView({behavior:'smooth',block:'start'});$('#courseCode').focus();
}

function coursePayload(){
 const college=selectedCollege(),department=selectedDepartment();
 return {
  id:$('#courseEditId').value||null,code:$('#courseCode').value,name_ar:$('#courseNameAr').value,name_en:$('#courseNameEn').value,
  college_id:college?.id||null,department_id:department?.id||null,college:college?.name_ar||null,department:department?.name_ar||null,
  credit_hours:$('#courseHours').value,level:$('#courseLevel').value,description:$('#courseDescription').value,active:$('#courseActive').checked,
  requirement_type:$('#courseRequirementAdmin').value,source_url:$('#courseSourceUrl').value
 };
}

async function load(){
 if(!password())return;
 try{
  const data=await api('dashboard');
  Object.assign(state,data);state.selectedPrograms=new Set();
  $('#courseCollegeAdmin').innerHTML=option(state.colleges.sort(byOrder),'اختر الكلية');
  refreshDepartments();renderMetrics();renderCourses();renderQuarantine();
 }catch(error){toast(error.message,true);}
}

function parseCsv(value){
 const lines=value.replace(/^﻿/,'').split(/\r?\n/).filter(line=>line.trim());if(lines.length<2)return[];
 const split=line=>{const out=[];let current='',quoted=false;for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){current+='"';index++;}else quoted=!quoted;}else if(char===','&&!quoted){out.push(current.trim());current='';}else current+=char;}out.push(current.trim());return out;};
 const headers=split(lines.shift()).map(item=>item.toLowerCase());return lines.map(line=>Object.fromEntries(split(line).map((item,index)=>[headers[index],item])));
}

injectUi();
$('#courseCollegeAdmin')?.addEventListener('change',()=>{state.selectedPrograms.clear();refreshDepartments();});
$('#courseDepartmentAdmin')?.addEventListener('change',()=>{state.selectedPrograms.clear();refreshPrograms();});
$('#courseProgramsAdmin')?.addEventListener('change',event=>{const input=event.target.closest('[data-course-program]');if(!input)return;const id=String(input.dataset.courseProgram);if(input.checked)state.selectedPrograms.add(id);else state.selectedPrograms.delete(id);});
$('#clearCoursePrograms')?.addEventListener('click',()=>{state.selectedPrograms.clear();refreshPrograms();});
$('#courseAdminForm')?.addEventListener('submit',async event=>{event.preventDefault();try{const requirement=$('#courseRequirementAdmin').value;const result=await api('save',{course:coursePayload(),program_ids:[...state.selectedPrograms],requirement_type:requirement});toast(`تم حفظ المقرر وربطه بـ ${result.program_count||0} تخصص ✅`);resetForm();await load();}catch(error){toast(error.message,true);}});
$('#courseFormReset')?.addEventListener('click',resetForm);
$('#coursesRefresh')?.addEventListener('click',load);
$('#courseAdminSearch')?.addEventListener('input',renderCourses);
$('#courseAdminFilters')?.addEventListener('click',event=>{const button=event.target.closest('[data-course-filter]');if(!button)return;state.filter=button.dataset.courseFilter;renderCourses();});
$('#courseCsvImport')?.addEventListener('click',async()=>{const file=$('#courseCsv')?.files?.[0];if(!file)return toast('اختر ملف CSV',true);try{const rows=parseCsv(await file.text());const result=await api('bulk',{rows});$('#courseImportResult').textContent=`تم استيراد ${result.imported||0} وتخطي ${result.skipped||0}`;toast('اكتمل استيراد المقررات');await load();}catch(error){toast(error.message,true);}});
document.addEventListener('click',async event=>{
 const edit=event.target.closest('[data-course-edit]'),toggle=event.target.closest('[data-course-toggle]'),remove=event.target.closest('[data-course-delete]');
 if(edit)editCourse(edit.dataset.courseEdit);
 if(toggle){try{await api('toggle',{id:toggle.dataset.courseToggle,active:toggle.dataset.active!=='1'});toast('تم تحديث حالة المقرر');await load();}catch(error){toast(error.message,true);}}
 if(remove){if(!confirm('متأكد من حذف المقرر وروابطه؟'))return;try{await api('delete',{id:remove.dataset.courseDelete});toast('تم حذف المقرر');await load();}catch(error){toast(error.message,true);}}
});
window.addEventListener('uon:admin-ready',load);
setTimeout(()=>{if($('#dashboard')&&!$('#dashboard').hidden)load();},900);
