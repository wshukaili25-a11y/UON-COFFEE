// Course-page exam/deadline helpers. Pure functions over the student's tasks
// (saved on this device) and the published academic calendar.

const compact = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Date-only strings ("2026-11-15") are calendar days in the student's zone, not UTC midnight.
const toDate = value => {
  const m = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
};
const startOfDay = date => { const d = toDate(date); d.setHours(0, 0, 0, 0); return d; };

export function daysUntil(when, now = new Date()) {
  const target = startOfDay(when), today = startOfDay(now);
  return Math.round((target - today) / 86400000);
}

// Open tasks for this course with a future (or today) due date, soonest first.
export function courseDeadlines(tasks, code, now = new Date(), limit = 3) {
  const target = compact(code);
  if (!target) return [];
  const today = startOfDay(now);
  return (Array.isArray(tasks) ? tasks : [])
    .filter(task => task && !task.done && task.due && new Date(task.due) >= today)
    .filter(task => compact(task.course) === target || compact(task.title).includes(target))
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, limit);
}

// The current or next university exam window (e.g. midterm week).
export function nextExamWindow(events, now = new Date()) {
  const today = startOfDay(now);
  return (Array.isArray(events) ? events : [])
    .filter(event => event && event.kind === 'exam' && startOfDay(event.end || event.start) >= today)
    .sort((a, b) => toDate(a.start) - toDate(b.start))[0] || null;
}

export function countdownLabel(days, en = false) {
  if (days <= 0) return en ? 'Today' : 'اليوم';
  if (days === 1) return en ? 'Tomorrow' : 'بكرة';
  if (days === 2) return en ? 'In 2 days' : 'بعد يومين';
  if (days <= 10) return en ? `In ${days} days` : `بعد ${days} أيام`;
  return en ? `In ${days} days` : `بعد ${days} يوم`;
}

export function addExamHref(code, en = false) {
  const p = new URLSearchParams({
    title: en ? `${code} exam` : `اختبار ${code}`,
    course: code,
    priority: 'high',
    notes: en ? 'Exam date, time and room' : 'موعد الاختبار والوقت والقاعة',
  });
  return `tasks.html?${p.toString()}`;
}
