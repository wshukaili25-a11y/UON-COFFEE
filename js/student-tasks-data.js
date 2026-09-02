export const STUDENT_TASKS_KEY='uon_student_tasks_v61';

function readJson(){try{return JSON.parse(localStorage.getItem(STUDENT_TASKS_KEY)||'[]')}catch{return[]}}
function normalize(task){
 if(!task||typeof task!=='object')return null;
 const title=String(task.title||'').trim();if(!title)return null;
 const due=task.due?new Date(task.due):null;if(due&&Number.isNaN(due.getTime()))return null;
 return {id:String(task.id||crypto.randomUUID()),title,course:String(task.course||'').trim(),due:due?due.toISOString():null,priority:['low','normal','high'].includes(task.priority)?task.priority:'normal',notes:String(task.notes||'').trim(),done:Boolean(task.done),created_at:task.created_at||new Date().toISOString(),completed_at:task.completed_at||null};
}
export function readStudentTasks(){const rows=readJson();return Array.isArray(rows)?rows.map(normalize).filter(Boolean):[]}
export function writeStudentTasks(rows){localStorage.setItem(STUDENT_TASKS_KEY,JSON.stringify((Array.isArray(rows)?rows:[]).map(normalize).filter(Boolean).slice(0,250)))}
export function saveStudentTask(task){const rows=readStudentTasks();const item=normalize(task);if(!item)return null;const index=rows.findIndex(row=>row.id===item.id);if(index>=0)rows[index]=item;else rows.unshift(item);writeStudentTasks(rows);return item}
export function removeStudentTask(id){const rows=readStudentTasks().filter(row=>row.id!==id);writeStudentTasks(rows);return rows}
export function toggleStudentTask(id){const rows=readStudentTasks();const task=rows.find(row=>row.id===id);if(!task)return null;task.done=!task.done;task.completed_at=task.done?new Date().toISOString():null;writeStudentTasks(rows);return task}
export function taskDueState(task,now=new Date()){
 if(task.done)return 'done';if(!task.due)return 'undated';const due=new Date(task.due);const todayStart=new Date(now);todayStart.setHours(0,0,0,0);const tomorrow=new Date(todayStart);tomorrow.setDate(tomorrow.getDate()+1);const afterTomorrow=new Date(tomorrow);afterTomorrow.setDate(afterTomorrow.getDate()+1);
 if(due<now)return 'overdue';if(due<tomorrow)return 'today';if(due<afterTomorrow)return 'tomorrow';return 'upcoming';
}
export function nextStudentTask(now=new Date()){return readStudentTasks().filter(task=>!task.done).sort((a,b)=>{if(!a.due&&!b.due)return 0;if(!a.due)return 1;if(!b.due)return-1;return new Date(a.due)-new Date(b.due)})[0]||null}
export function formatTaskDue(task){if(!task?.due)return 'بدون موعد';return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(task.due))}
export function hoursUntilTask(task,now=new Date()){if(!task?.due)return null;return (new Date(task.due)-now)/3600000}
