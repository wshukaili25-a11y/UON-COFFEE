// Home "exam season" card: shown when a university exam window is close or running.
// Pure model builder (testable) + a small renderer.
import { courseDeadlines, nextExamWindow, daysUntil, countdownLabel, addExamHref } from './course-deadlines.js?v=1.0.0';

export const LEAD_DAYS = 14;

export function examSeasonModel({ events = [], tasks = [], recent = [], now = new Date(), en = false } = {}) {
  const win = nextExamWindow(events, now);
  if (!win) return null;
  const toStart = daysUntil(win.start, now);
  if (toStart > LEAD_DAYS) return null;
  const ongoing = toStart <= 0;
  const courses = (Array.isArray(recent) ? recent : []).slice(0, 4).map(row => {
    const code = String(row.code || '').toUpperCase();
    const next = courseDeadlines(tasks, code, now, 1)[0] || null;
    return {
      code,
      name: en ? (row.name_en || row.name_ar || '') : (row.name_ar || row.name_en || ''),
      next: next ? { title: next.title, due: next.due, label: countdownLabel(daysUntil(next.due, now), en), soon: daysUntil(next.due, now) <= 2 } : null,
      filesHref: `summaries.html?q=${encodeURIComponent(code)}&type=exam`,
      courseHref: `course.html?code=${encodeURIComponent(code)}`,
      addHref: addExamHref(code, en),
    };
  });
  return {
    title: win.title,
    ongoing,
    countdown: ongoing ? (en ? 'Happening now' : 'جارية الآن') : countdownLabel(toStart, en),
    courses,
  };
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function renderExamSeason(node, model, en = false) {
  if (!node) return;
  if (!model) { node.hidden = true; node.innerHTML = ''; return; }
  const t = (ar, english) => (en ? english : ar);
  const list = model.courses.length
    ? `<div class="exam-season-list">${model.courses.map(c => `<article class="exam-season-course${c.next?.soon ? ' is-soon' : ''}">
        <a class="exam-season-code" href="${esc(c.courseHref)}"><b dir="ltr">${esc(c.code)}</b><span>${esc(c.name)}</span></a>
        <p>${c.next ? `${esc(c.next.title)} — <strong>${esc(c.next.label)}</strong>` : esc(t('ما سجّلت موعد اختبار لهذه المادة', 'No exam date saved yet'))}</p>
        <div class="exam-season-actions"><a href="${esc(c.filesHref)}">📝 ${esc(t('اختبارات سابقة', 'Past exams'))}</a><a href="${esc(c.addHref)}">＋ ${esc(t('أضف موعد', 'Add date'))}</a></div>
      </article>`).join('')}</div>`
    : `<p class="exam-season-empty">${esc(t('افتح صفحة مادتك مرة وحدة، وبتظهر هنا مع اختباراتها السابقة وموعد اختبارك.', 'Open your course pages once and they will show up here with past exams and your exam dates.'))}</p>
       <div class="exam-season-actions"><a href="courses.html">${esc(t('ابحث عن موادك', 'Find your courses'))}</a><a href="summaries.html?type=exam">📝 ${esc(t('مكتبة الاختبارات السابقة', 'Past exams library'))}</a></div>`;
  node.innerHTML = `<div class="uon-rd-container exam-season-card">
      <div class="exam-season-head"><span class="exam-season-kicker">${esc(t('موسم الاختبارات', 'Exam season'))}</span>
      <h2>${esc(model.title)} <span class="exam-season-count">${esc(model.countdown)}</span></h2></div>${list}</div>`;
  node.hidden = false;
}
