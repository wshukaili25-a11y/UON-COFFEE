// Pure helpers for the summaries library: search matching, sorting and
// shareable filter state in the URL. No DOM access, so it is unit-testable.

export const SORT_MODES = ['newest', 'popular', 'rated', 'course'];

export function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

// "INFS 205", "infs-205" and "INFS205" should all match the same file.
export function compactCodes(text) {
  return normalizeSearch(text).replace(/\b([a-z]{2,10})[\s-]+(\d{2,4}[a-z]?)\b/g, '$1$2');
}

export function searchTerms(query) {
  return compactCodes(query).trim().split(/\s+/).filter(Boolean);
}

export function indexText(item) {
  return compactCodes(`${item.title || ''} ${item.subject || ''} ${item.course_code || ''} ${item.description || ''} ${item.instructor_name || ''}`);
}

export function courseKey(item) {
  return compactCodes(item.course_code || item.subject || '').replace(/\s+/g, '').toUpperCase();
}

const time = value => {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
};

export function popularity(item) {
  return Number(item.downloads || 0) * 2 + Number(item.views || 0);
}

// stats: Map(id -> {average,total}) from the ratings endpoint (may be empty).
export function sortRows(rows, mode = 'newest', stats = new Map()) {
  const list = [...rows];
  const rating = item => {
    const s = stats.get(String(item.id)) || {};
    const avg = Number(s.average || item.rating || 0);
    const total = Number(s.total || 0);
    // Bayesian-style damping so one 5-star vote does not beat ten 4.6 votes.
    return total ? (avg * total + 3.5 * 3) / (total + 3) : avg * 0.5;
  };
  if (mode === 'popular') list.sort((a, b) => popularity(b) - popularity(a) || time(b.created_at) - time(a.created_at));
  else if (mode === 'rated') list.sort((a, b) => rating(b) - rating(a) || popularity(b) - popularity(a));
  else if (mode === 'course') list.sort((a, b) => courseKey(a).localeCompare(courseKey(b)) || time(b.created_at) - time(a.created_at));
  else list.sort((a, b) => time(b.created_at) - time(a.created_at));
  return list;
}

// Most-used course codes, for quick filter chips.
export function topCourses(rows, limit = 8) {
  const counts = new Map();
  for (const item of rows) {
    const key = courseKey(item);
    if (!/^[A-Z]{2,10}\d{2,4}[A-Z]?$/.test(key)) continue;
    const entry = counts.get(key) || { code: key, files: 0, score: 0 };
    entry.files += 1;
    entry.score += popularity(item) + 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.score - a.score || b.files - a.files).slice(0, limit);
}

export function readFilters(search) {
  const p = new URLSearchParams(search || '');
  const sort = p.get('sort');
  return {
    q: (p.get('q') || '').slice(0, 120),
    college: (p.get('college') || '').slice(0, 120),
    type: ['summary', 'exam', 'notes'].includes(p.get('type')) ? p.get('type') : '',
    sort: SORT_MODES.includes(sort) ? sort : 'newest',
  };
}

export function writeFilters(baseSearch, filters) {
  const p = new URLSearchParams(baseSearch || '');
  for (const key of ['q', 'college', 'type', 'sort']) p.delete(key);
  if (filters.q) p.set('q', filters.q.trim());
  if (filters.college) p.set('college', filters.college);
  if (filters.type) p.set('type', filters.type);
  if (filters.sort && filters.sort !== 'newest') p.set('sort', filters.sort);
  const out = p.toString();
  return out ? `?${out}` : '';
}

// A query that looks like one course code, used to offer "request this file".
export function queryCourseCode(query) {
  const terms = searchTerms(query);
  return terms.length === 1 && /^[a-z]{2,10}\d{2,4}[a-z]?$/.test(terms[0]) ? terms[0].toUpperCase() : '';
}
