import {nextClass,currentAcademicPulse,formatClassTime} from './student-pulse.js?v=61.1.0';
import {nextStudentTask,formatTaskDue,taskDueState} from './student-tasks-data.js?v=61.1.0';

function addStyle(){if(document.querySelector('link[data-home-student-pulse]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/home-student-pulse.css?v=61.1.0';link.dataset.homeStudentPulse='1';document.head.append(link)}
function dayLabel(delta,day){return delta===0?'اليوم':delta===1?'بكرة':day||'قريبًا'}
function mount(){
 const home=document.querySelector('main.home37');if(!home)return false;
 addStyle();
 const actions=document.querySelector('.nav-actions');
 if(actions&&!actions.querySelector('.uon-my-dashboard-nav')){const a=document.createElement('a');a.href='user-dashboard.html';a.className='btn uon-my-dashboard-nav';a.textContent='لوحتي';actions.prepend(a)}
 if(home.querySelector('.home-student-pulse'))return true;
 const klass=nextClass(),task=nextStudentTask(),academic=currentAcademicPulse();
 const section=document.createElement('section');section.className='home-student-pulse';
 const classText=!klass?'أضف جدولك وبتظهر لك المحاضرة القادمة هنا':klass.state==='now'?`${klass.course} الآن إلى ${formatClassTime(klass.end)}${klass.room?` • ${klass.room}`:''}`:`${klass.course} • ${dayLabel(klass.deltaDays,klass.day)} ${formatClassTime(klass.start)}${klass.room?` • ${klass.room}`:''}`;
 const taskState=task?taskDueState(task):null;
 const taskText=!task?'ما عندك مهام مفتوحة 🎉':`${task.title}${task.course?` • ${task.course}`:''}${task.due?` • ${formatTaskDue(task)}`:' • بدون موعد'}`;
 const academicText=!academic?'لا يوجد موعد قريب ضمن التقويم الحالي':academic.state==='active'?`${academic.title} • جاري الآن`:academic.daysUntilStart===1?`${academic.title} • بكرة`:academic.daysUntilStart===0?`${academic.title} • اليوم`:`${academic.title} • بعد ${academic.daysUntilStart} أيام`;
 section.innerHTML=`<div class="h37-container"><a class="home-pulse-card" href="schedule.html"><span>🎓</span><div><strong>محاضرتك القادمة</strong><small>${classText}</small></div></a><a class="home-pulse-card is-task ${taskState==='overdue'?'is-urgent':''}" href="tasks.html"><span>${taskState==='overdue'?'⚠️':'✅'}</span><div><strong>أقرب مهمة</strong><small>${taskText}</small></div></a><a class="home-pulse-card" href="academic-calendar.html"><span>${academic?.icon||'📅'}</span><div><strong>الموعد الأكاديمي</strong><small>${academicText}</small></div></a><a class="home-pulse-open" href="user-dashboard.html">فتح لوحتي</a></div>`;
 const hero=home.querySelector('.h37-hero');hero?.after(section);return true;
}
if(!mount()){
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),8000);
}