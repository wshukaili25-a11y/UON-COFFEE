import{
 setupNav,enforceUonMaintenance,watchUonMaintenance,$,toast,trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

setupNav();enforceUonMaintenance();watchUonMaintenance();installErrorCapture();

const grades={A:4,'A-':3.7,'B+':3.3,B:3,'B-':2.7,'C+':2.3,C:2,'C-':1.7,'D+':1.3,D:1,F:0};
const STORAGE_KEY='uon_gpa_calculator_v39';
const body=$('#courses');
const options=(selected='A',blank=false)=>`${blank?'<option value="">—</option>':''}`+Object.keys(grades).map(grade=>`<option value="${grade}" ${grade===selected?'selected':''}>${grade}</option>`).join('');
const number=(value,min=0,max=Infinity)=>Math.min(max,Math.max(min,Number(value)||0));

function createRow(data={}){
 const row=document.createElement('tr');
 row.innerHTML=`<td><input class="code" maxlength="20" placeholder="STAT101" value="${String(data.code||'').replace(/["<>]/g,'')}"></td><td><input class="hrs" type="number" min="0.5" max="12" step="0.5" value="${number(data.hours||3,.5,12)}"></td><td><select class="new">${options(data.newGrade||'A')}</select></td><td><select class="repeat"><option value="no" ${data.repeated?'':'selected'}>لا</option><option value="yes" ${data.repeated?'selected':''}>نعم</option></select></td><td><select class="old" ${data.repeated?'':'disabled'}>${options(data.oldGrade||'F',true)}</select></td><td class="net">0.00</td><td><button class="icon-btn" type="button" aria-label="حذف المادة">✕</button></td>`;
 row.querySelector('button').addEventListener('click',()=>{row.remove();if(!body.rows.length)createRow();calculate()});
 row.querySelector('.repeat').addEventListener('change',event=>{
  const old=row.querySelector('.old');old.disabled=event.target.value!=='yes';if(old.disabled)old.value='';else if(!old.value)old.value='F';calculate();
 });
 row.querySelectorAll('input,select').forEach(element=>element.addEventListener('input',calculate));
 body.append(row);calculate();
}
function serializeRows(){
 return [...body.rows].map(row=>({
  code:row.querySelector('.code').value.trim().toUpperCase(),hours:number(row.querySelector('.hrs').value,.5,12),
  newGrade:row.querySelector('.new').value,repeated:row.querySelector('.repeat').value==='yes',oldGrade:row.querySelector('.old').value||'F'
 }));
}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({currentGpa:number($('#currentGpa').value,0,4),previousHours:number($('#previousHours').value,0,999),courses:serializeRows()}))}catch{}
}
function calculate(){
 const oldGpa=number($('#currentGpa').value,0,4),oldHours=number($('#previousHours').value,0,999);
 let semesterPoints=0,semesterHours=0,repeatedOldPoints=0,newNonRepeatedHours=0,netPoints=0;
 [...body.rows].forEach(row=>{
  const hours=number(row.querySelector('.hrs').value,.5,12);
  const newGrade=row.querySelector('.new').value;
  const repeated=row.querySelector('.repeat').value==='yes';
  const oldGrade=row.querySelector('.old').value;
  const newPoints=hours*(grades[newGrade]??0);
  const oldPoints=repeated&&oldGrade?hours*(grades[oldGrade]??0):0;
  const net=newPoints-oldPoints;
  row.querySelector('.net').textContent=net.toFixed(2);
  semesterPoints+=newPoints;semesterHours+=hours;repeatedOldPoints+=oldPoints;netPoints+=net;
  if(!repeated)newNonRepeatedHours+=hours;
 });
 const semesterGpa=semesterHours?semesterPoints/semesterHours:0;
 const cumulativeHours=oldHours+newNonRepeatedHours;
 const cumulativePoints=(oldGpa*oldHours)-repeatedOldPoints+semesterPoints;
 const cumulativeGpa=cumulativeHours?cumulativePoints/cumulativeHours:0;
 $('#semesterGpa').textContent=Math.max(0,Math.min(4,semesterGpa)).toFixed(2);
 $('#cumulativeGpa').textContent=Math.max(0,Math.min(4,cumulativeGpa)).toFixed(2);
 $('#netPoints').textContent=netPoints.toFixed(2);
 $('#totalSemesterHours').textContent=semesterHours.toFixed(1);
 $('#newTotalHours').textContent=cumulativeHours.toFixed(1);
 save();
}
function restore(){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
 $('#currentGpa').value=saved?.currentGpa??0;
 $('#previousHours').value=saved?.previousHours??0;
 const courses=Array.isArray(saved?.courses)&&saved.courses.length?saved.courses:[{},{},{}];
 courses.slice(0,20).forEach(createRow);
 calculate();
}
$('#addCourse')?.addEventListener('click',()=>{createRow();trackEvent('gpa_course_added',{})});
$('#clear')?.addEventListener('click',()=>{
 if(!confirm('مسح بيانات الحاسبة؟'))return;
 body.innerHTML='';localStorage.removeItem(STORAGE_KEY);$('#currentGpa').value=0;$('#previousHours').value=0;createRow();calculate();toast('تم مسح الحاسبة');
});
['currentGpa','previousHours'].forEach(id=>$('#'+id)?.addEventListener('input',calculate));
restore();trackEvent('page_view',{page:'gpa'});
