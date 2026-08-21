const events=[
{icon:'📝',title:'فترة التسجيل الثانية',start:'2026-08-30',end:'2026-09-03'},
{icon:'🎓',title:'بداية الدراسة',start:'2026-09-06',end:'2026-09-06'},
{icon:'➕',title:'فترة الحذف والإضافة',start:'2026-09-06',end:'2026-09-10'},
{icon:'👋',title:'أسبوع التهيئة للطلبة الجدد',start:'2026-09-20',end:'2026-09-24'},
{icon:'📝',title:'الاختبار الأول – الأسبوع الأول',start:'2026-10-11',end:'2026-10-15'},
{icon:'📝',title:'الاختبار الأول – الأسبوع الثاني',start:'2026-10-18',end:'2026-10-22'},
{icon:'📋',title:'الاختبار الثاني – الأسبوع الأول',start:'2026-11-15',end:'2026-11-19'},
{icon:'📋',title:'الاختبار الثاني – الأسبوع الثاني',start:'2026-11-29',end:'2026-12-03'},
{icon:'📚',title:'فترة التسجيل الأولى لفصل الربيع',start:'2026-12-13',end:'2026-12-17'},
{icon:'⚠️',title:'آخر يوم للانسحاب بدرجة (W)',start:'2026-12-10',end:'2026-12-10'},
{icon:'⚠️',title:'آخر يوم للانسحاب بدرجة (WF)',start:'2026-12-17',end:'2026-12-17'},
{icon:'🏫',title:'آخر يوم للدراسة',start:'2026-12-24',end:'2026-12-24'},
{icon:'🏆',title:'الاختبارات النهائية',start:'2026-12-27',end:'2027-01-07'}
];
const list=document.querySelector('#calendarList');
const fmt=new Intl.DateTimeFormat('ar-OM',{day:'numeric',month:'long',year:'numeric'});
const d=s=>new Date(`${s}T00:00:00+04:00`);
const display=(a,b)=>a===b?fmt.format(d(a)):`${fmt.format(d(a))} – ${fmt.format(d(b))}`;
const plusDay=s=>{const x=d(s);x.setDate(x.getDate()+1);return x.toISOString().slice(0,10).replaceAll('-','')};
const ymd=s=>s.replaceAll('-','');
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function icsText(items=events){const stamp='20260821T000000Z';let out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UON Hub//Academic Calendar 2026 2027//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:UON Hub - التقويم الأكاديمي 2026/2027','X-WR-TIMEZONE:Asia/Muscat'];items.forEach((e,i)=>{out.push('BEGIN:VEVENT',`UID:uonhub-academic-2026-${i}@uonhub.space`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${ymd(e.start)}`,`DTEND;VALUE=DATE:${plusDay(e.end)}`,`SUMMARY:${e.title}`,'DESCRIPTION:UON Hub - التقويم الأكاديمي للفصل الدراسي الأول 2026/2027','END:VEVENT')});out.push('END:VCALENDAR');return out.join('\r\n')+'\r\n'}
function download(items=events){const blob=new Blob([icsText(items)],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=items.length===events.length?'UON-Hub-Academic-Calendar-2026-2027.ics':'UON-Hub-Academic-Event.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function toast(msg){const el=document.querySelector('#toast');if(el){el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800)}}
list.innerHTML=events.map((e,i)=>`<article class="calendar-event"><div class="calendar-icon">${e.icon}</div><div><h3>${esc(e.title)}</h3><p class="calendar-date">${esc(display(e.start,e.end))}</p></div><button class="btn calendar-add" type="button" data-index="${i}">📅 إضافة للتقويم</button></article>`).join('');
list.querySelectorAll('[data-index]').forEach(b=>b.addEventListener('click',()=>download([events[Number(b.dataset.index)]])));
document.querySelector('#downloadAll')?.addEventListener('click',()=>{download();toast('تم تجهيز ملف التقويم الكامل 📅')});
document.querySelector('#shareCalendar')?.addEventListener('click',async()=>{const blob=new Blob([icsText()],{type:'text/calendar'});const file=new File([blob],'UON-Hub-Academic-Calendar-2026-2027.ics',{type:'text/calendar'});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:'التقويم الأكاديمي 2026/2027',text:'التقويم الأكاديمي من UON Hub',files:[file]})}catch{}}else download()});