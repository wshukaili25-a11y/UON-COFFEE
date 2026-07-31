import {get,rpc,esc,toast} from './core.js?v=32.1.0';

const section=document.querySelector('#sec-courses-admin');
if(!section)throw new Error('COURSE_ADMIN_SECTION_MISSING');

const emptyHealth={active:0,linked:0,unlinked:0,inactive:0,quarantined:0,unlinked_rows:[],quarantine_rows:[]};
const state={colleges:[],departments:[],programs:[],courses:[],links:[],health:{...emptyHealth},editingId:'',search:'',view:'active'};
const password=()=>sessionStorage.getItem('uon_admin_password')||'';
const field=id=>section.querySelector(`#${id}`);
const optionRows=(rows,label)=>`<option value="">${label}</option>`+rows.map(row=>`<option value="${esc(row.id)}">${esc(row.name_ar||row.name_en||row.id)}</option>`).join('');

section.innerHTML=`
 <div class="section-head"><div><h2>إدارة المقررات</h2><p>إضافة وتعديل المقرر وربطه بالكلية والقسم والتخصصات من مكان واحد.</p></div><button class="btn" id="courseAdminRefresh" type="button">تحديث</button></div>
 <div class="grid grid-2">
  <form id="courseV32Form" class="card form-card">
   <input id="courseV32Id" type="hidden">
   <div class="form-grid">
    <label>رمز المقرر<input id="courseV32Code" maxlength="30" required placeholder="STAT101"></label>
    <label>الساعات<input id="courseV32Hours" type="number" min="0" max="12" value="3"></label>
    <label>الاسم العربي<input id="courseV32NameAr" required></label>
    <label>الاسم الإنجليزي<input id="courseV32NameEn" dir="ltr"></label>
    <label>الكلية<select id="courseV32College" required><option value="">جاري التحميل…</option></select></label>
    <label>القسم<select id="courseV32Department" required disabled><option value="">اختر الكلية أولًا</option></select></label>
    <label>نوع المتطلب<select id="courseV32Requirement"><option value="university">متطلب جامعة</option><option value="college">متطلب كلية</option><option value="major" selected>متطلب تخصص</option><option value="elective">اختياري</option></select></label>
    <label>المستوى<input id="courseV32Level" type="number" min="1" max="20"></label>
   </div>
   <label>التخصصات المرتبطة<select id="courseV32Programs" multiple size="9" disabled></select><small class="muted">يمكن اختيار أكثر من تخصص. في الجوال اضغط على كل تخصص لإضافته أو إزالته.</small></label>
   <label>رابط المصدر الرسمي<input id="courseV32Source" type="url" dir="ltr" placeholder="https://..."></label>
   <label>الوصف<textarea id="courseV32Description" rows="4"></textarea></label>
   <label class="check-row"><input id="courseV32Active" type="checkbox" checked> المقرر نشط ويظهر للطلاب</label>
   <div class="row"><button class="btn primary" id="courseV32Save" type="submit">حفظ المقرر</button><button class="btn" id="courseV32Reset" type="button">تفريغ</button></div>
  </form>
  <div class="card form-card">
   <h3>حالة بيانات المقررات</h3>
   <div id="courseV32Stats" class="grid grid-2"></div>
   <p class="notice">السجلات المعزولة ناتجة عن استيراد قديم التقط كلمات وأرقامًا كأنها رموز مقررات. لا تظهر للطلاب، وتبقى نسختها محفوظة للمراجعة.</p>
  </div>
 </div>
 <div class="card form-card" style="margin-top:18px">
  <div class="section-head"><div><h3>مراجعة المقررات</h3><p id="courseV32Count" class="muted"></p></div><input id="courseV32Search" type="search" placeholder="بحث بالرمز أو الاسم"></div>
  <div class="row" id="courseV32Views" style="margin-bottom:14px;flex-wrap:wrap">
   <button class="btn" type="button" data-course-v32-view="active">النشطة</button>
   <button class="btn" type="button" data-course-v32-view="unlinked">بدون ربط</button>
   <button class="btn" type="button" data-course-v32-view="inactive">المتوقفة</button>
   <button class="btn" type="button" data-course-v32-view="quarantine">المعزولة</button>
  </div>
  <div id="courseV32List" class="list"></div>
 </div>`;

function selectedValues(select){return [...select.selectedOptions].map(option=>option.value).filter(Boolean)}
function quarantineIds(){return new Set((state.health.quarantine_rows||[]).map(row=>row.source_course_id))}

function refreshDepartmentOptions(selected=''){
 const collegeId=field('courseV32College').value;
 const rows=state.departments.filter(row=>row.college_id===collegeId);
 field('courseV32Department').disabled=!collegeId;
 field('courseV32Department').innerHTML=optionRows(rows,collegeId?'اختر القسم':'اختر الكلية أولًا');
 if(selected&&rows.some(row=>row.id===selected))field('courseV32Department').value=selected;
 refreshProgramOptions();
}

function refreshProgramOptions(selected=[]){
 const collegeId=field('courseV32College').value;
 const departmentId=field('courseV32Department').value;
 const rows=state.programs.filter(row=>(!collegeId||row.college_id===collegeId)&&(!departmentId||row.department_id===departmentId));
 const select=field('courseV32Programs');
 select.disabled=!departmentId;
 select.innerHTML=rows.length?rows.map(row=>`<option value="${esc(row.id)}" ${selected.includes(row.id)?'selected':''}>${esc(row.name_ar||row.name_en)}</option>`).join(''):'<option value="">لا توجد تخصصات في هذا القسم</option>';
}

function resetForm(){
 state.editingId='';
 field('courseV32Form')?.reset?.();
 field('courseV32Id').value='';
 field('courseV32Active').checked=true;
 field('courseV32Hours').value='3';
 field('courseV32Requirement').value='major';
 field('courseV32Department').innerHTML='<option value="">اختر الكلية أولًا</option>';
 field('courseV32Department').disabled=true;
 field('courseV32Programs').innerHTML='';
 field('courseV32Programs').disabled=true;
 field('courseV32Save').textContent='حفظ المقرر';
}

function renderStats(){
 const h=state.health||emptyHealth;
 field('courseV32Stats').innerHTML=`
  <div class="card stat"><span>نشطة</span><strong>${h.active||0}</strong></div>
  <div class="card stat"><span>مرتبطة</span><strong>${h.linked||0}</strong></div>
  <div class="card stat"><span>بدون ربط</span><strong>${h.unlinked||0}</strong></div>
  <div class="card stat"><span>معزولة</span><strong>${h.quarantined||0}</strong></div>
  <div class="card stat"><span>التخصصات</span><strong>${state.programs.length}</strong></div>
  <div class="card stat"><span>متوقفة</span><strong>${h.inactive||0}</strong></div>`;
}

function renderViewButtons(){
 section.querySelectorAll('[data-course-v32-view]').forEach(button=>{
  const active=button.dataset.courseV32View===state.view;
  button.classList.toggle('primary',active);
  const counts={active:state.health.active,unlinked:state.health.unlinked,inactive:Math.max(0,(state.health.inactive||0)-(state.health.quarantined||0)),quarantine:state.health.quarantined};
  const labels={active:'النشطة',unlinked:'بدون ربط',inactive:'المتوقفة',quarantine:'المعزولة'};
  button.textContent=`${labels[button.dataset.courseV32View]} (${counts[button.dataset.courseV32View]||0})`;
 });
}

function regularRows(){
 const q=state.search.trim().toLowerCase(),isolated=quarantineIds();
 let rows=state.courses;
 if(state.view==='active')rows=rows.filter(row=>row.active!==false);
 if(state.view==='unlinked')rows=rows.filter(row=>row.active!==false&&!state.links.some(link=>link.course_code===row.code));
 if(state.view==='inactive')rows=rows.filter(row=>row.active===false&&!isolated.has(row.id));
 return rows.filter(row=>!q||`${row.code} ${row.name_ar||''} ${row.name_en||''} ${row.college_ar||row.college||''} ${row.department_ar||row.department||''}`.toLowerCase().includes(q));
}

function renderQuarantine(){
 const q=state.search.trim().toLowerCase();
 const rows=(state.health.quarantine_rows||[]).filter(row=>!q||`${row.course_code||''} ${row.name_ar||''} ${row.name_en||''} ${row.reason||''}`.toLowerCase().includes(q));
 field('courseV32Count').textContent=`${rows.length} سجل معزول`;
 field('courseV32List').innerHTML=rows.length?rows.map(row=>{
  const reason=row.reason==='corrupted_import_text'?'نص تالف من ملف مستورد':'رمز لا يطابق صيغة المقررات';
  return `<div class="list-row"><div><strong>${esc(row.course_code||'بدون رمز')} — ${esc(row.name_ar||row.name_en||'سجل غير صالح')}</strong><small>${esc(reason)}</small><small>عُزل في ${new Date(row.quarantined_at).toLocaleString('ar-OM')}</small></div><span class="badge">معزول</span></div>`;
 }).join(''):'<div class="empty">لا توجد سجلات معزولة مطابقة</div>';
}

function renderList(){
 renderViewButtons();
 if(state.view==='quarantine'){renderQuarantine();return}
 const rows=regularRows();
 const labels={active:'مقرر نشط',unlinked:'مقرر يحتاج ربطًا',inactive:'مقرر متوقف'};
 field('courseV32Count').textContent=`${rows.length} ${labels[state.view]||'مقرر'}`;
 field('courseV32List').innerHTML=rows.length?rows.map(row=>{
  const programIds=state.links.filter(link=>link.course_code===row.code).map(link=>link.program_id);
  const programNames=state.programs.filter(program=>programIds.includes(program.id)).map(program=>program.name_ar);
  const needsLink=!programNames.length;
  return `<div class="list-row"><div><strong>${esc(row.code)} — ${esc(row.name_ar||row.name_en||'')}</strong><small>${esc(row.college_ar||row.college||'بدون كلية')} • ${esc(row.department_ar||row.department||'بدون قسم')} • ${Number(row.credit_hours||0)} ساعات • ${row.active===false?'متوقف':'نشط'}</small><small>${needsLink?'غير مرتبط بتخصص':esc(programNames.join('، '))}</small></div><div class="actions"><button class="btn ${needsLink?'primary':''}" type="button" data-v32-course-edit="${esc(row.id)}">${needsLink?'ربط الآن':'تعديل'}</button><button class="btn danger" type="button" data-v32-course-delete="${esc(row.id)}">حذف</button></div></div>`;
 }).join(''):'<div class="empty">لا توجد مقررات في هذا القسم</div>';
 section.querySelectorAll('[data-v32-course-edit]').forEach(button=>button.onclick=()=>editCourse(button.dataset.v32CourseEdit));
 section.querySelectorAll('[data-v32-course-delete]').forEach(button=>button.onclick=()=>deleteCourse(button.dataset.v32CourseDelete,button));
}

function editCourse(id){
 const row=state.courses.find(course=>course.id===id);if(!row)return;
 state.editingId=id;field('courseV32Id').value=id;field('courseV32Code').value=row.code||'';field('courseV32NameAr').value=row.name_ar||'';field('courseV32NameEn').value=row.name_en||'';field('courseV32Hours').value=row.credit_hours??'';field('courseV32Level').value=row.level??'';field('courseV32Description').value=row.description||'';field('courseV32Source').value=row.source_url||'';field('courseV32Requirement').value=row.requirement_type||'major';field('courseV32Active').checked=row.active!==false;
 const college=state.colleges.find(item=>item.name_ar===(row.college_ar||row.college)||item.name_en===row.college_en);
 const department=state.departments.find(item=>item.college_id===college?.id&&(item.name_ar===(row.department_ar||row.department)||item.name_en===row.department_en));
 field('courseV32College').value=college?.id||'';
 refreshDepartmentOptions(department?.id||'');
 const selected=state.links.filter(link=>link.course_code===row.code).map(link=>link.program_id);
 refreshProgramOptions(selected);
 field('courseV32Save').textContent='حفظ التعديلات';
 field('courseV32Code').scrollIntoView({behavior:'smooth',block:'center'});
}

async function deleteCourse(id,button){
 const row=state.courses.find(course=>course.id===id);if(!row||!confirm(`حذف المقرر ${row.code}؟`))return;
 button.disabled=true;
 try{await rpc('uon_admin_delete_course',{p_password:password(),p_course_id:id});toast('تم حذف المقرر');await loadData();resetForm()}catch(error){toast(error.message,true)}finally{button.disabled=false}
}

async function saveCourse(event){
 event.preventDefault();
 const button=field('courseV32Save');button.disabled=true;
 try{
  const payload={code:field('courseV32Code').value.trim().toUpperCase(),name_ar:field('courseV32NameAr').value.trim(),name_en:field('courseV32NameEn').value.trim(),credit_hours:field('courseV32Hours').value,level:field('courseV32Level').value,college_id:field('courseV32College').value,department_id:field('courseV32Department').value,description:field('courseV32Description').value.trim(),requirement_type:field('courseV32Requirement').value,source_url:field('courseV32Source').value.trim(),active:field('courseV32Active').checked};
  if(!payload.college_id||!payload.department_id)throw new Error('اختر الكلية والقسم');
  const programIds=selectedValues(field('courseV32Programs'));
  if(state.programs.some(row=>row.department_id===payload.department_id)&&!programIds.length)throw new Error('اختر تخصصًا واحدًا على الأقل');
  await rpc('uon_admin_save_course',{p_password:password(),p_course_id:state.editingId||null,p_payload:payload,p_program_ids:programIds});
  toast(state.editingId?'تم تحديث المقرر':'تمت إضافة المقرر');resetForm();await loadData();
 }catch(error){toast(error.message,true)}finally{button.disabled=false}
}

async function loadData(){
 if(!password()){field('courseV32List').innerHTML='<div class="empty">سجّل الدخول لعرض المقررات</div>';return}
 try{
  const [colleges,departments,programs,courses,links,health]=await Promise.all([
   get('academic_colleges','select=*&active=eq.true&order=sort_order.asc'),
   get('academic_departments','select=*&active=eq.true&order=sort_order.asc'),
   get('academic_programs','select=*&active=eq.true&order=sort_order.asc'),
   get('courses','select=*&order=code.asc'),
   get('course_programs','select=course_code,program_id,requirement_type'),
   rpc('uon_admin_course_health',{p_password:password()})
  ]);
  Object.assign(state,{colleges,departments,programs,courses,links,health:health||{...emptyHealth}});
  field('courseV32College').innerHTML=optionRows(colleges,'اختر الكلية');
  renderStats();renderList();
 }catch(error){field('courseV32List').innerHTML=`<div class="empty">${esc(error.message)}</div>`;toast(error.message,true)}
}

field('courseV32College').onchange=()=>refreshDepartmentOptions();
field('courseV32Department').onchange=()=>refreshProgramOptions();
field('courseV32Form').onsubmit=saveCourse;
field('courseV32Reset').onclick=resetForm;
field('courseAdminRefresh').onclick=loadData;
field('courseV32Search').oninput=event=>{state.search=event.target.value;renderList()};
section.querySelectorAll('[data-course-v32-view]').forEach(button=>button.onclick=()=>{state.view=button.dataset.courseV32View;renderList()});
document.querySelector('[data-section="courses-admin"]')?.addEventListener('click',loadData);
if(password())loadData();