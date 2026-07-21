
import {$,setupNav,toast} from './ui.js';setupNav();
const grades={'A':4.00,'A-':3.70,'B+':3.30,'B':3.00,'B-':2.70,'C+':2.30,'C':2.00,'C-':1.70,'D+':1.30,'D':1.00,'F':0.00};
const body=$('#courseRows');
function options(selected='A'){return Object.entries(grades).map(([g,p])=>`<option value="${g}" ${g===selected?'selected':''}>${g} — ${p.toFixed(2)}</option>`).join('')}
function addRow(data={name:'',hours:3,grade:'A'}){
 const tr=document.createElement('tr');
 tr.innerHTML=`<td><input class="course-name" value="${data.name||''}" placeholder="اسم أو رمز المادة"></td>
 <td><input class="course-hours" type="number" min="0.5" max="9" step="0.5" value="${data.hours||3}"></td>
 <td><select class="course-grade">${options(data.grade)}</select></td>
 <td class="course-points">0.00</td>
 <td><button class="icon-btn remove-course" title="حذف"><i class="fas fa-times"></i></button></td>`;
 tr.querySelector('.remove-course').onclick=()=>{tr.remove();calculate()};
 tr.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',calculate));
 body.append(tr);calculate();
}
function rowsData(){return [...body.rows].map(r=>({name:r.querySelector('.course-name').value,hours:Number(r.querySelector('.course-hours').value)||0,grade:r.querySelector('.course-grade').value}))}
function calculate(){
 let points=0,hours=0;
 [...body.rows].forEach(r=>{
  const h=Number(r.querySelector('.course-hours').value)||0;
  const g=r.querySelector('.course-grade').value;
  const p=h*(grades[g]??0);hours+=h;points+=p;
  r.querySelector('.course-points').textContent=p.toFixed(2);
 });
 const semester=hours?points/hours:0;
 const current=Math.max(0,Math.min(4,Number($('#currentGpa').value)||0));
 const previousHours=Math.max(0,Number($('#completedHours').value)||0);
 const total=previousHours+hours;
 const cumulative=total?((current*previousHours)+points)/total:semester;
 $('#semesterGpa').textContent=semester.toFixed(2);$('#semesterHours').textContent=`${hours} ساعة`;
 $('#semesterPoints').textContent=points.toFixed(2);$('#cumulativeGpa').textContent=cumulative.toFixed(2);$('#totalHours').textContent=`${total} ساعة`;
 const target=Math.max(0,Math.min(4,Number($('#targetGpa').value)||0));
 const future=Math.max(1,Number($('#futureHours').value)||15);
 const needed=((target*(total+future))-(cumulative*total))/future;
 const advice=$('#targetAdvice');
 if(!total){advice.textContent='أضف بياناتك الحالية أو مواد الفصل لمعرفة المعدل المطلوب.';advice.className='gpa-advice'}
 else if(needed<=0){advice.textContent=`أنت متجاوز هدف ${target.toFixed(2)} حاليًا ✅`;advice.className='gpa-advice success'}
 else if(needed>4){advice.textContent=`الوصول إلى ${target.toFixed(2)} خلال ${future} ساعة غير ممكن حسابيًا. زِد عدد الساعات المستقبلية أو غيّر الهدف.`;advice.className='gpa-advice danger'}
 else{advice.textContent=`تحتاج معدلًا يقارب ${needed.toFixed(2)} في الساعات القادمة (${future} ساعة) للوصول إلى ${target.toFixed(2)}.`;advice.className='gpa-advice warning'}
}
function save(){localStorage.setItem('uon-gpa-state',JSON.stringify({courses:rowsData(),currentGpa:$('#currentGpa').value,completedHours:$('#completedHours').value,targetGpa:$('#targetGpa').value,futureHours:$('#futureHours').value}));toast('تم حفظ بيانات المعدل')}
function load(){try{const s=JSON.parse(localStorage.getItem('uon-gpa-state')||'null');if(s){$('#currentGpa').value=s.currentGpa||0;$('#completedHours').value=s.completedHours||0;$('#targetGpa').value=s.targetGpa||3;$('#futureHours').value=s.futureHours||15;(s.courses||[]).forEach(addRow);return}}catch{};addRow();addRow();addRow()}
$('#addCourse').onclick=()=>addRow();$('#saveGpa').onclick=save;$('#clearCourses').onclick=()=>{if(confirm('مسح جميع المواد؟')){body.innerHTML='';localStorage.removeItem('uon-gpa-state');addRow()}};
['currentGpa','completedHours','targetGpa','futureHours'].forEach(id=>$('#'+id).addEventListener('input',calculate));load();calculate();
