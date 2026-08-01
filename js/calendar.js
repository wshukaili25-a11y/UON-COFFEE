import{
 get,$,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent,toast,
 installErrorCapture,getSetting
}from'./core.js?v=39.0.0';

enforceUonMaintenance();watchUonMaintenance();installErrorCapture();

let rows=[];
const labels={registration:'التسجيل',study:'الدراسة',exam:'الاختبارات',holiday:'إجازة',other:'موعد'};
const officialFallback='https://www.unizwa.edu.om/index.php?contentid=1071&lang=ar';

function safeUrl(value){
 try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}
}
function parseLocalDate(value){
 const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(!match)return null;
 const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
 return Number.isNaN(date.getTime())?null:date;
}
function ymd(value){
 const date=value instanceof Date?value:parseLocalDate(value);
 if(!date)return'';
 return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
}
function nextDay(value){
 const date=parseLocalDate(value);if(!date)return null;
 date.setDate(date.getDate()+1);return date;
}
function escapeIcs(value){return String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function formatDate(value,options={day:'numeric',month:'short'}){
 const date=parseLocalDate(value);return date?date.toLocaleDateString('ar-OM',options):'—';
}
async function loadOfficialCalendar(){
 const url=safeUrl(await getSetting('official_calendar_url',officialFallback))||officialFallback;
 const card=$('#officialCalendarCard');if(!card)return;
 card.innerHTML=`<div class="section-head"><div><span class="badge">المصدر الرسمي</span><h3>التقويم الأكاديمي لجامعة نزوى</h3><p>راجع النسخة الرسمية قبل الاعتماد على أي موعد، لأن المواعيد قد تتغير.</p></div><a class="btn primary" target="_blank" rel="noopener noreferrer" href="${esc(url)}">فتح التقويم الرسمي ↗</a></div>`;
}
function downloadEvent(row){
 const start=ymd(row.start_date);if(!start)return toast('تاريخ الموعد غير صالح',true);
 const inclusiveEnd=row.end_date||row.start_date;
 const end=ymd(nextDay(inclusiveEnd));
 const id=String(row.id||crypto.randomUUID()).replace(/[^a-zA-Z0-9-]/g,'');
 const content=[
  'BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','PRODID:-//UON Hub//Academic Calendar//AR',
  'BEGIN:VEVENT',`UID:${id}@uonhub.space`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,
  `DTSTART;VALUE=DATE:${start}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${escapeIcs(row.title||'موعد أكاديمي')}`,
  `DESCRIPTION:${escapeIcs(row.description||'')}`,'TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR'
 ].join('\r\n');
 const blob=new Blob([content],{type:'text/calendar;charset=utf-8'});
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`uon-event-${String(row.start_date).slice(0,10)}.ics`;link.click();
 setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('تم تجهيز الموعد للتقويم');trackEvent('calendar_event_export',{type:row.event_type||'other'});
}
function filteredRows(){
 const type=$('#calendarType')?.value||'',period=$('#calendarPeriod')?.value||'upcoming',query=($('#calendarSearch')?.value||'').toLowerCase().trim();
 const today=new Date();today.setHours(0,0,0,0);
 return rows.filter(item=>{
  const end=parseLocalDate(item.end_date||item.start_date),upcoming=end?end>=today:true;
  const periodMatch=period==='all'||(period==='upcoming'&&upcoming)||(period==='past'&&!upcoming);
  const haystack=`${item.title||''} ${item.description||''}`.toLowerCase();
  return (!type||item.event_type===type)&&periodMatch&&(!query||haystack.includes(query));
 });
}
function render(){
 const list=filteredRows();
 $('#calendarCount').textContent=list.length;
 $('#calendarList').innerHTML=list.length?list.map((item,index)=>`<article class="timeline-item card"><div class="timeline-date"><strong>${formatDate(item.start_date)}</strong><small>${item.end_date&&item.end_date!==item.start_date?`إلى ${formatDate(item.end_date)}`:''}</small></div><div><span class="badge">${esc(labels[item.event_type]||'موعد')}</span><h3>${esc(item.title||'موعد أكاديمي')}</h3><p>${esc(item.description||'')}</p><button class="btn calendar-add" type="button" data-index="${index}">إضافة للتقويم</button></div></article>`).join(''):'<div class="empty">لا توجد مواعيد مطابقة.</div>';
 $('#calendarList').querySelectorAll('[data-index]').forEach(button=>button.addEventListener('click',()=>downloadEvent(list[Number(button.dataset.index)])));
}
async function load(){
 $('#calendarList').innerHTML='<div class="empty">جاري تحميل المواعيد...</div>';
 try{rows=await get('academic_calendar_events','select=*&active=eq.true&order=start_date.asc&limit=500')}catch(error){console.warn('Calendar load failed',error);rows=[];toast('تعذر تحميل بعض المواعيد',true)}
 await loadOfficialCalendar();render();trackEvent('page_view',{page:'calendar',events:rows.length});
}
['calendarType','calendarPeriod'].forEach(id=>$('#'+id)?.addEventListener('change',render));
$('#calendarSearch')?.addEventListener('input',render);
load();
