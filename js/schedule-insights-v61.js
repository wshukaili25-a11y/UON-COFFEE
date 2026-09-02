import {esc} from './core.js?v=61.0.0';

const STORAGE_KEY='uon-v7-schedule';
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const DAY_START=8*60,DAY_END=18*60;
let refreshTimer=null;

function readRows(){try{const rows=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}}
function minutes(value){const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));return m?Number(m[1])*60+Number(m[2]):0}
function time(total){const hour24=Math.floor(total/60),minute=String(total%60).padStart(2,'0'),hour12=hour24%12||12;return `${hour12}:${minute} ${hour24<12?'ص':'م'}`}
function duration(total){const h=Math.floor(total/60),m=total%60;return [h?`${h}س`:'',m?`${m}د`:''].filter(Boolean).join(' ')||'0د'}
function rowsFor(day){return readRows().filter(row=>row.day===day).map(row=>({...row,startMin:minutes(row.start),endMin:minutes(row.end)})).filter(row=>row.endMin>row.startMin).sort((a,b)=>a.startMin-b.startMin)}

function conflicts(){
 const out=[];
 for(const day of DAYS){const rows=rowsFor(day);for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){if(rows[j].startMin>=rows[i].endMin)break;if(rows[j].startMin<rows[i].endMin&&rows[j].endMin>rows[i].startMin)out.push({day,a:rows[i],b:rows[j],start:Math.max(rows[i].startMin,rows[j].startMin),end:Math.min(rows[i].endMin,rows[j].endMin)})}}
 return out;
}
function freeWindows(day,minGap){
 const rows=rowsFor(day);let cursor=DAY_START;const output=[];
 for(const row of rows){const start=Math.max(DAY_START,row.startMin),end=Math.min(DAY_END,row.endMin);if(end<=DAY_START||start>=DAY_END)continue;if(start-cursor>=minGap)output.push({day,start:cursor,end:start,duration:start-cursor});cursor=Math.max(cursor,end)}
 if(DAY_END-cursor>=minGap)output.push({day,start:cursor,end:DAY_END,duration:DAY_END-cursor});
 return output;
}
function dayLoad(day){const rows=rowsFor(day);return rows.reduce((sum,row)=>sum+(row.endMin-row.startMin),0)}
function allFree(minGap){return DAYS.flatMap(day=>freeWindows(day,minGap)).sort((a,b)=>b.duration-a.duration||DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||a.start-b.start)}
function activeDays(){return DAYS.filter(day=>rowsFor(day).length)}

function inject(){
 if(document.querySelector('#scheduleInsights61'))return;
 const shell=document.querySelector('.schedule-shell');if(!shell)return;
 const card=document.createElement('section');card.id='scheduleInsights61';card.className='card schedule61-insights';
 card.innerHTML=`<div class="schedule61-head"><div><span class="badge">Smart Schedule</span><h2>تحليل الجدول</h2><p>اكتشاف التعارضات والفترات الفاضية واقتراح أفضل وقت للمذاكرة.</p></div><label>أقل مدة للفراغ<select id="schedule61MinGap"><option value="30">30 دقيقة</option><option value="45" selected>45 دقيقة</option><option value="60">ساعة</option><option value="90">ساعة ونصف</option><option value="120">ساعتان</option></select></label></div><div id="schedule61Metrics" class="schedule61-metrics"></div><div id="schedule61Recommendation" class="schedule61-recommendation"></div><div class="schedule61-panels"><section class="schedule61-panel"><h3>⚠️ التعارضات</h3><div id="schedule61Conflicts" class="schedule61-list"></div></section><section class="schedule61-panel"><h3>🕒 أوقات الفراغ</h3><div id="schedule61Free" class="schedule61-list"></div></section></div>`;
 const board=document.querySelector('.schedule-board-card');if(board)board.before(card);else shell.append(card);
 document.querySelector('#schedule61MinGap')?.addEventListener('change',render);
 render();
 const week=document.querySelector('#week');if(week)new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(render,180)}).observe(week,{childList:true,subtree:true});
 window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)render()});
}

function render(){
 const metrics=document.querySelector('#schedule61Metrics');if(!metrics)return;
 const minGap=Number(document.querySelector('#schedule61MinGap')?.value||45);const clashes=conflicts(),free=allFree(minGap),active=activeDays();
 const loads=active.map(day=>({day,minutes:dayLoad(day)})).sort((a,b)=>b.minutes-a.minutes);const busiest=loads[0]||null,lightest=loads.at(-1)||null;
 metrics.innerHTML=`<article class="schedule61-metric"><span>تعارضات</span><strong>${clashes.length}</strong></article><article class="schedule61-metric"><span>أطول فراغ</span><strong>${free[0]?duration(free[0].duration):'—'}</strong></article><article class="schedule61-metric"><span>أثقل يوم</span><strong>${busiest?esc(busiest.day):'—'}</strong></article><article class="schedule61-metric"><span>أخف يوم دوام</span><strong>${lightest?esc(lightest.day):'—'}</strong></article>`;
 const conflictBox=document.querySelector('#schedule61Conflicts');conflictBox.innerHTML=clashes.length?clashes.slice(0,6).map(item=>`<div class="schedule61-item is-conflict"><strong>${esc(item.day)} • ${esc(item.a.course||'مادة')} × ${esc(item.b.course||'مادة')}</strong><span>${time(item.start)} – ${time(item.end)}</span></div>`).join(''):'<div class="schedule61-empty">ما فيه تعارضات في جدولك ✅</div>';
 const freeBox=document.querySelector('#schedule61Free');freeBox.innerHTML=free.length?free.slice(0,8).map(item=>`<div class="schedule61-item"><strong>${esc(item.day)} • ${time(item.start)} – ${time(item.end)}</strong><span>${duration(item.duration)}</span></div>`).join(''):`<div class="schedule61-empty">ما فيه فراغات بطول ${duration(minGap)} ضمن 8 ص – 6 م.</div>`;
 const recommendation=document.querySelector('#schedule61Recommendation');
 if(!readRows().length)recommendation.innerHTML='<strong>ابدأ بإضافة موادك.</strong> بعدها بنحلل الجدول تلقائيًا.';
 else if(clashes.length)recommendation.innerHTML=`<strong>عندك ${clashes.length} تعارض${clashes.length>1?'ات':''}.</strong> عدّل الأوقات المتداخلة أولًا قبل اعتماد الجدول.`;
 else{const preferred=free.find(item=>rowsFor(item.day).length)||free[0];recommendation.innerHTML=preferred?`<strong>وقت مذاكرة مقترح:</strong> ${esc(preferred.day)} من ${time(preferred.start)} إلى ${time(preferred.end)} (${duration(preferred.duration)}).`:'<strong>جدولك متقارب.</strong> ما لقينا فترة طويلة حسب المدة المختارة.'}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
