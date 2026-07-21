
import {$,setupNav} from './ui.js';setupNav();const grades={A:4,'A-':3.7,'B+':3.3,B:3,'B-':2.7,'C+':2.3,C:2,D:1,F:0};const body=$('#courseRows');
function row(){const tr=document.createElement('tr');tr.innerHTML=`<td><input placeholder="اسم المادة"></td><td><input type="number" min="1" max="6" value="3"></td><td><select>${Object.keys(grades).map(g=>`<option>${g}</option>`).join('')}</select></td><td><button class="outline-btn">حذف</button></td>`;tr.querySelector('button').onclick=()=>{tr.remove();calc()};tr.querySelectorAll('input,select').forEach(x=>x.oninput=calc);body.append(tr);calc()}
function calc(){let pts=0,h=0;[...body.rows].forEach(r=>{const hrs=Number(r.cells[1].querySelector('input').value)||0;const g=r.cells[2].querySelector('select').value;h+=hrs;pts+=hrs*grades[g]});$('#gpaResult').textContent=h?(pts/h).toFixed(2):'0.00'}
$('#addCourse').onclick=row;$('#clearCourses').onclick=()=>{body.innerHTML='';row()};row();row();row();
