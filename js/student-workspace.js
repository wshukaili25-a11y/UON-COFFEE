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
// The Studio preview uses page-level Home links instead of a fixed bottom bar.
export function mountStudentDock() {
  document.querySelectorAll('.uon-student-dock').forEach(node => node.remove());
  document.body.classList.remove('has-student-dock');
}
