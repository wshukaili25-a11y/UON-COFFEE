const RECENT_KEY = 'uon_recent_courses_v1';
export function normalizeCourseCode(value) {
  const code = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
  return /^[A-Z]{2,10}\d{2,4}[A-Z]?$/.test(code) ? code : '';
}
export function courseHref(value) {
  const code = normalizeCourseCode(value);
  return code ? `course.html?code=${encodeURIComponent(code)}` : '';
}
export function recentCourses() {
  try {
    const rows = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(rows) ? rows.filter(row => row && normalizeCourseCode(row.code)).slice(0, 6) : [];
  } catch { return []; }
}
export function rememberCourse(course) {
  const code = normalizeCourseCode(course?.code);
  if (!code) return;
  const row = {code, name_ar: String(course.name_ar || '').slice(0, 160), name_en: String(course.name_en || '').slice(0, 160)};
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([row, ...recentCourses().filter(item => item.code !== code)].slice(0, 6))); } catch { /* Browsing still works without storage. */ }
}
export function courseClasses(rows, course) {
  const code = normalizeCourseCode(course?.code);
  if (!code || !Array.isArray(rows)) return [];
  const normalizeName = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const names = [course.name_ar, course.name_en].map(normalizeName).filter(Boolean);
  return rows.filter(row => {
    if (!row) return false;
    const raw = `${row.course_code || row.code || ''} ${row.course || ''}`;
    const codes = raw.toUpperCase().match(/\b[A-Z]{2,10}[ -]*\d{2,4}[A-Z]?\b/g) || [];
    // An explicit different code wins over a shared or ambiguous course name.
    return codes.length ? codes.some(value => normalizeCourseCode(value) === code) : names.includes(normalizeName(row.course));
  });
}
export function mountStudentDock(active, en = false) {
  if (document.querySelector('.uon-student-dock')) return;
  const links = [
    ['home', 'index.html', '⌂', en ? 'Home' : 'الرئيسية', ''],
    ['courses', 'courses.html', '▤', en ? 'Courses' : 'المواد', 'courses'],
    ['schedule', 'schedule.html', '▦', en ? 'Schedule' : 'جدولي', 'schedule'],
    ['assistant', 'assistant.html', '✦', 'UON AI', 'assistant']
  ];
  const nav = document.createElement('nav');
  nav.className = 'uon-student-dock';
  nav.setAttribute('aria-label', en ? 'Student navigation' : 'تنقل الطالب');
  for (const [key, href, icon, label, feature] of links) {
    const a = document.createElement('a');
    a.href = href;
    if (key === active) a.setAttribute('aria-current', 'page');
    if (feature) a.dataset.feature = feature;
    const mark = document.createElement('span');
    mark.textContent = icon;
    mark.setAttribute('aria-hidden', 'true');
    a.append(mark, document.createTextNode(label));
    nav.append(a);
  }
  document.body.append(nav);
  document.body.classList.add('has-student-dock');
}
