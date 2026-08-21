const EVENTS = [
  { icon:'📝', title:'فترة التسجيل الثانية', start:'2026-08-30', end:'2026-09-03' },
  { icon:'🎓', title:'بداية الدراسة + أسبوع الحذف والإضافة', start:'2026-09-06', end:'2026-09-06' },
  { icon:'➕', title:'فترة الحذف والإضافة', start:'2026-09-06', end:'2026-09-10' },
  { icon:'👋', title:'أسبوع التهيئة للطلبة الجدد', start:'2026-09-20', end:'2026-09-24' },
  { icon:'📝', title:'الاختبار الأول – الأسبوع الأول', start:'2026-10-11', end:'2026-10-15' },
  { icon:'📝', title:'الاختبار الأول – الأسبوع الثاني', start:'2026-10-18', end:'2026-10-22' },
  { icon:'📋', title:'الاختبار الثاني – الأسبوع الأول', start:'2026-11-15', end:'2026-11-19' },
  { icon:'📋', title:'الاختبار الثاني – الأسبوع الثاني', start:'2026-11-29', end:'2026-12-03' },
  { icon:'📚', title:'فترة التسجيل الأولى لفصل الربيع', start:'2026-12-13', end:'2026-12-17' },
  { icon:'⚠️', title:'آخر يوم للانسحاب بدرجة (W)', start:'2026-12-10', end:'2026-12-10' },
  { icon:'⚠️', title:'آخر يوم للانسحاب بدرجة (WF)', start:'2026-12-17', end:'2026-12-17' },
  { icon:'🏫', title:'آخر يوم للدراسة', start:'2026-12-24', end:'2026-12-24' },
  { icon:'🏆', title:'الاختبارات النهائية', start:'2026-12-27', end:'2027-01-07' }
];

const dateFrom = value => new Date(`${value}T00:00:00+04:00`);
const formatDate = new Intl.DateTimeFormat('ar-OM', { day:'numeric', month:'long', year:'numeric' });
const ymd = value => value.replace(/-/g, '');
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
const dateText = (start, end) => start === end ? formatDate.format(dateFrom(start)) : `${formatDate.format(dateFrom(start))} – ${formatDate.format(dateFrom(end))}`;
const nextDay = value => { const d = dateFrom(value); d.setDate(d.getDate() + 1); return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`; };

function makeICS(items) {
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UON Hub//Academic Calendar 2026 2027//AR',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:UON Hub - التقويم الأكاديمي 2026/2027','X-WR-TIMEZONE:Asia/Muscat'
  ];
  items.forEach((event, index) => lines.push(
    'BEGIN:VEVENT',
    `UID:uonhub-academic-2026-${index}@uonhub.space`,
    'DTSTAMP:20260821T000000Z',
    `DTSTART;VALUE=DATE:${ymd(event.start)}`,
    `DTEND;VALUE=DATE:${nextDay(event.end)}`,
    `SUMMARY:${event.title}`,
    'DESCRIPTION:UON Hub - التقويم الأكاديمي للفصل الدراسي الأول 2026/2027',
    'END:VEVENT'
  ));
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function downloadCalendar(items = EVENTS) {
  const blob = new Blob([makeICS(items)], { type:'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = items.length === EVENTS.length ? 'UON-Hub-Academic-Calendar-2026-2027.ics' : 'UON-Hub-Academic-Event.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2800);
}

function renderCalendar() {
  const list = document.querySelector('#calendarList');
  if (!list) return;
  list.innerHTML = EVENTS.map((event, index) => `
    <article class="calendar-event">
      <div class="calendar-icon">${event.icon}</div>
      <div>
        <h3>${esc(event.title)}</h3>
        <p class="calendar-date">${esc(dateText(event.start, event.end))}</p>
      </div>
      <button class="btn calendar-add" type="button" data-calendar-index="${index}">📅 إضافة للتقويم</button>
    </article>`).join('');

  list.querySelectorAll('[data-calendar-index]').forEach(button => {
    button.addEventListener('click', () => downloadCalendar([EVENTS[Number(button.dataset.calendarIndex)]]));
  });

  document.querySelector('#downloadAll')?.addEventListener('click', () => {
    downloadCalendar();
    toast('تم تجهيز جميع مواعيد الفصل للتقويم 📅');
  });

  document.querySelector('#shareCalendar')?.addEventListener('click', async () => {
    const blob = new Blob([makeICS(EVENTS)], { type:'text/calendar' });
    const file = new File([blob], 'UON-Hub-Academic-Calendar-2026-2027.ics', { type:'text/calendar' });
    if (navigator.share && navigator.canShare?.({ files:[file] })) {
      try {
        await navigator.share({ title:'التقويم الأكاديمي 2026/2027', text:'التقويم الأكاديمي من UON Hub', files:[file] });
      } catch (_) {}
    } else {
      downloadCalendar();
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderCalendar);
else renderCalendar();
