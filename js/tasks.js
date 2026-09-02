import {esc,toast,trackEvent} from './core.js?v=61.1.0';
import {readStudentTasks,saveStudentTask,removeStudentTask,toggleStudentTask,taskDueState,formatTaskDue} from './student-tasks-data.js?v=61.1.0';

const form=document.querySelector('#taskForm');
const list=document.querySelector('#tasksList');
let filter='open';

function priorityLabel(value){return value==='high'?'عالية':value==='low'?'منخفضة':'عادية'}
function readForm(){
 const dueRaw=document.querySelector('#taskDue')?.value||'';
 const due=dueRaw?new Date(dueRaw).toISOString():null;
 return {id:document.querySelector('#taskId')?.value||crypto.randomUUID(),title:document.querySelector('#taskTitle')?.value.trim()||'',course:document.querySelector('#taskCourse')?.value.trim()||'',due,priority:document.querySelector('#taskPriority')?.value||'normal',notes:document.querySelector('#taskNotes')?.value.trim()||'',done:false,created_at:new Date().toISOString()};
}
function resetForm(){
 form?.reset();
 document.querySelector('#taskId').value='';
 document.querySelector('#taskPriority').value='normal';
 document.querySelector('#taskFormTitle').textContent='إضافة مهمة';
 document.querySelector('#saveTask').textContent='حفظ المهمة';
 document.querySelector('#cancelTaskEdit').hidden=true;
}
function toLocalInput(iso){
 if(!iso)return'';const date=new Date(iso);const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function taskMatches(task){
 const state=taskDueState(task);
 if(filter==='all')return true;if(filter==='done')return task.done;if(filter==='today')return !task.done&&state==='today';if(filter==='upcoming')return !task.done&&['tomorrow','upcoming'].includes(state);return !task.done;
}
function render(){
 const rows=readStudentTasks();
 const open=rows.filter(task=>!task.done),today=open.filter(task=>taskDueState(task)==='today'),overdue=open.filter(task=>taskDueState(task)==='overdue'),done=rows.filter(task=>task.done);
 document.querySelector('#taskOpenCount').textContent=String(open.length);document.querySelector('#taskTodayCount').textContent=String(today.length);document.querySelector('#taskOverdueCount').textContent=String(overdue.length);document.querySelector('#taskDoneCount').textContent=String(done.length);
 const priorityRank={high:0,normal:1,low:2};
 const shown=rows.filter(taskMatches).sort((a,b)=>{if(a.done!==b.done)return a.done?1:-1;if(a.due&&b.due){const diff=new Date(a.due)-new Date(b.due);if(diff)return diff}if(a.due&&!b.due)return-1;if(!a.due&&b.due)return 1;return priorityRank[a.priority]-priorityRank[b.priority]});
 if(!shown.length){list.innerHTML='<div class="tasks-empty">ما فيه مهام في هذا القسم 🎉</div>';return}
 list.innerHTML=shown.map(task=>{const state=taskDueState(task);const stateLabel={overdue:'متأخرة',today:'اليوم',tomorrow:'بكرة',upcoming:'قادمة',undated:'بدون موعد',done:'مكتملة'}[state]||state;return `<article class="task-card ${state==='overdue'?'is-overdue':''} ${task.done?'is-done':''}" data-task-id="${esc(task.id)}"><input class="task-check" type="checkbox" ${task.done?'checked':''} aria-label="تغيير حالة ${esc(task.title)}" data-task-toggle="${esc(task.id)}"><div><h3>${esc(task.title)}</h3><div class="task-meta">${task.course?`<span>📘 ${esc(task.course)}</span>`:''}<span>🕒 ${esc(task.due?formatTaskDue(task):'بدون موعد')}</span><span class="priority-${esc(task.priority)}">${esc(priorityLabel(task.priority))}</span><span>${esc(stateLabel)}</span></div>${task.notes?`<p class="task-notes">${esc(task.notes)}</p>`:''}</div><div class="task-actions"><button class="btn" type="button" data-task-edit="${esc(task.id)}">تعديل</button><button class="btn danger" type="button" data-task-delete="${esc(task.id)}">حذف</button></div></article>`}).join('');
}

form?.addEventListener('submit',event=>{
 event.preventDefault();const data=readForm();if(!data.title){toast('اكتب اسم المهمة',true);return}
 const old=readStudentTasks().find(task=>task.id===data.id);if(old){data.done=old.done;data.created_at=old.created_at;data.completed_at=old.completed_at}
 saveStudentTask(data);trackEvent(old?'task_update':'task_add',{course:data.course||null,has_due:Boolean(data.due),priority:data.priority});toast(old?'تم تحديث المهمة':'تمت إضافة المهمة ✅');resetForm();render();
});
document.querySelector('#cancelTaskEdit')?.addEventListener('click',resetForm);
document.querySelectorAll('[data-task-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.taskFilter;document.querySelectorAll('[data-task-filter]').forEach(b=>b.classList.toggle('active',b===button));render()}));
list?.addEventListener('change',event=>{const input=event.target.closest('[data-task-toggle]');if(!input)return;const task=toggleStudentTask(input.dataset.taskToggle);if(task)trackEvent('task_toggle',{done:task.done});render()});
list?.addEventListener('click',event=>{
 const edit=event.target.closest('[data-task-edit]');const del=event.target.closest('[data-task-delete]');if(!edit&&!del)return;
 if(del){const id=del.dataset.taskDelete;if(confirm('حذف هذه المهمة؟')){removeStudentTask(id);toast('تم حذف المهمة');render()}return}
 const task=readStudentTasks().find(row=>row.id===edit.dataset.taskEdit);if(!task)return;document.querySelector('#taskId').value=task.id;document.querySelector('#taskTitle').value=task.title;document.querySelector('#taskCourse').value=task.course||'';document.querySelector('#taskDue').value=toLocalInput(task.due);document.querySelector('#taskPriority').value=task.priority;document.querySelector('#taskNotes').value=task.notes||'';document.querySelector('#taskFormTitle').textContent='تعديل المهمة';document.querySelector('#saveTask').textContent='حفظ التعديلات';document.querySelector('#cancelTaskEdit').hidden=false;form.scrollIntoView({behavior:'smooth',block:'start'});
});
render();