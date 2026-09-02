import {toast,esc,enforceUonMaintenance,watchUonMaintenance} from './core.js?v=62.0.0';
import {STUDY_ACTIVE_KEY,addStudySession,formatStudyDuration,readStudySessions,readStudySettings,saveStudySettings,scheduleCourses,studyStats} from './study-focus-data.js?v=62.0.0';

await enforceUonMaintenance();watchUonMaintenance();
const $=selector=>document.querySelector(selector);
const timer=$('#focusTimer'),statusNode=$('#focusStatus'),ring=$('#focusRing'),course=$('#focusCourse'),kind=$('#focusKind');
const startBtn=$('#focusStart'),pauseBtn=$('#focusPause'),finishBtn=$('#focusFinish'),resetBtn=$('#focusReset');
let tick=null;
let state=readActive();
let settings=readStudySettings();

function readActive(){try{const value=JSON.parse(localStorage.getItem(STUDY_ACTIVE_KEY)||'null');return value&&typeof value==='object'?value:null}catch{return null}}
function saveActive(){if(state)localStorage.setItem(STUDY_ACTIVE_KEY,JSON.stringify(state));else localStorage.removeItem(STUDY_ACTIVE_KEY)}
function formatClock(seconds){const safe=Math.max(0,Math.ceil(Number(seconds)||0)),m=Math.floor(safe/60),s=safe%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function durationSeconds(){return Math.max(300,Math.min(7200,Number($('#focusMinutesCustom')?.value||25)*60))}
function remainingSeconds(){if(!state)return durationSeconds();if(state.running&&state.targetAt)return Math.max(0,Math.ceil((Number(state.targetAt)-Date.now())/1000));return Math.max(0,Number(state.remainingSeconds)||0)}
function fillCourses(){const values=scheduleCourses();course.innerHTML=`<option value="">عام</option>${values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;course.value=state?.course||settings.lastCourse||''}
function syncSettings(){settings=saveStudySettings({focusMinutes:Number($('#focusMinutesCustom').value)||25,breakMinutes:Number($('#breakMinutes').value)||5,autoBreak:$('#autoBreak').checked,lastCourse:course.value})}
function syncPresetButtons(){document.querySelectorAll('[data-focus-minutes]').forEach(button=>button.classList.toggle('active',Number(button.dataset.focusMinutes)===Number($('#focusMinutesCustom').value)))}
function renderStats(){const stats=studyStats();$('#focusToday').textContent=formatStudyDuration(stats.todayMinutes);$('#focusWeek').textContent=formatStudyDuration(stats.weekMinutes);$('#focusTodaySessions').textContent=String(stats.todaySessions);$('#focusWeekSessions').textContent=String(stats.weekSessions);$('#focusCourseStats').innerHTML=stats.topCourses.length?stats.topCourses.map(item=>`<div class="focus-course-stat"><strong>${esc(item.course)}</strong><span>${formatStudyDuration(item.minutes)}</span></div>`).join(''):'<div class="muted">ابدأ أول جلسة وبتظهر إحصائيات المواد هنا.</div>';const rows=readStudySessions().slice(0,6);$('#focusHistory').innerHTML=rows.length?rows.map(row=>`<article><div><strong>${esc(row.course||'عام')}</strong><small>${new Date(row.ended_at).toLocaleDateString('ar-OM',{timeZone:'Asia/Muscat',day:'numeric',month:'short'})}</small></div><span>${formatStudyDuration(row.duration_minutes)}</span></article>`).join(''):'<div class="muted">لا توجد جلسات محفوظة بعد.</div>'}
function render(){const total=state?.totalSeconds||durationSeconds(),remaining=remainingSeconds(),progress=total?Math.min(100,Math.max(0,((total-remaining)/total)*100)):0;timer.textContent=formatClock(remaining);ring?.style.setProperty('--progress',`${progress}%`);const running=Boolean(state?.running);statusNode.textContent=running?'مركز الآن':state?'متوقف مؤقتًا':'جاهز';startBtn.textContent=state?(running?'شغّال':'متابعة'):'ابدأ';startBtn.disabled=running;pauseBtn.disabled=!running;finishBtn.disabled=!state;resetBtn.disabled=!state;document.title=state?`${formatClock(remaining)} · وضع المذاكرة | UON Hub`:'وضع المذاكرة | UON Hub';if(state&&remaining<=0)completeSession()}
function begin(){syncSettings();if(!state){const total=durationSeconds();state={id:crypto.randomUUID(),course:course.value,kind:kind.value,totalSeconds:total,remainingSeconds:total,startedAt:new Date().toISOString(),running:false,targetAt:null}}state.course=course.value;state.kind=kind.value;state.running=true;state.targetAt=Date.now()+Math.max(1,remainingSeconds())*1000;saveActive();startTicker();render()}
function pause(){if(!state?.running)return;state.remainingSeconds=remainingSeconds();state.running=false;state.targetAt=null;saveActive();stopTicker();render()}
function reset(){if(!state)return;if(!confirm('إلغاء جلسة المذاكرة الحالية؟'))return;state=null;saveActive();stopTicker();render();toast('تم إلغاء الجلسة')}
function elapsedMinutes(){if(!state)return 0;const elapsed=Math.max(0,(Number(state.totalSeconds)||0)-remainingSeconds());return Math.max(1,Math.round(elapsed/60))}
function saveCurrent({completed=false}={}){if(!state)return null;const minutes=completed?Math.max(1,Math.round((Number(state.totalSeconds)||0)/60)):elapsedMinutes();const item=addStudySession({course:state.course,durationMinutes:minutes,startedAt:state.startedAt,endedAt:new Date().toISOString(),kind:state.kind});state=null;saveActive();stopTicker();renderStats();render();return item}
function finish(){if(!state)return;const elapsed=Math.max(0,(Number(state.totalSeconds)||0)-remainingSeconds());if(elapsed<60&&!confirm('الجلسة أقل من دقيقة. تريد حفظها؟'))return;saveCurrent();toast('تم حفظ جلسة المذاكرة ✅')}
function completeSession(){if(!state)return;const item=saveCurrent({completed:true});if(item&&'Notification'in window&&Notification.permission==='granted'){try{new Notification('خلصت جلسة المذاكرة 🎉',{body:`${item.course||'جلسة عامة'} • ${formatStudyDuration(item.duration_minutes)}`,icon:'/assets/icons/icon-192.png',tag:`focus-${item.id}`})}catch{}}const breakMinutes=settings.breakMinutes||5;$('#focusTip').textContent=settings.autoBreak?`ممتاز 👏 خذ استراحة ${breakMinutes} دقائق قبل الجلسة التالية.`:'ممتاز 👏 تم تسجيل الجلسة. خذ استراحة قصيرة قبل ما تبدأ مرة ثانية.';toast('خلصت الجلسة 🎉')}
function startTicker(){stopTicker();tick=setInterval(render,1000)}
function stopTicker(){if(tick){clearInterval(tick);tick=null}}

$('#focusMinutesCustom').value=String(settings.focusMinutes||25);$('#breakMinutes').value=String(settings.breakMinutes||5);$('#autoBreak').checked=Boolean(settings.autoBreak);fillCourses();if(state){course.value=state.course||'';kind.value=state.kind||'focus';$('#focusMinutesCustom').value=String(Math.round((state.totalSeconds||1500)/60))}
syncPresetButtons();renderStats();render();if(state?.running)startTicker();

document.querySelectorAll('[data-focus-minutes]').forEach(button=>button.addEventListener('click',()=>{if(state){toast('أنهِ أو ألغِ الجلسة الحالية أولًا',true);return}$('#focusMinutesCustom').value=button.dataset.focusMinutes;syncPresetButtons();syncSettings();render()}));
$('#focusMinutesCustom').addEventListener('change',()=>{if(state){$('#focusMinutesCustom').value=String(Math.round((state.totalSeconds||1500)/60));return}syncPresetButtons();syncSettings();render()});
$('#breakMinutes').addEventListener('change',syncSettings);$('#autoBreak').addEventListener('change',syncSettings);course.addEventListener('change',syncSettings);
startBtn.addEventListener('click',begin);pauseBtn.addEventListener('click',pause);finishBtn.addEventListener('click',finish);resetBtn.addEventListener('click',reset);
window.addEventListener('pagehide',()=>{if(state?.running){state.remainingSeconds=remainingSeconds();state.targetAt=Date.now()+state.remainingSeconds*1000;saveActive()}});