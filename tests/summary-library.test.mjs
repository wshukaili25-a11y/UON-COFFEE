import test from 'node:test';
import assert from 'node:assert/strict';
import { compactCodes, searchTerms, indexText, sortRows, topCourses, readFilters, writeFilters, queryCourseCode } from '../js/summary-library.js';

test('course codes match with or without spaces/dashes', () => {
  const idx = indexText({ title: 'Network Security', course_code: 'INFS 205' });
  for (const q of ['INFS205', 'infs 205', 'Infs-205']) assert.ok(searchTerms(q).every(t => idx.includes(t)), q);
  assert.equal(compactCodes('مادة إنجليزي ENGL 101'), 'ماده انجليزي engl101');
});

test('sorting modes', () => {
  const rows = [
    { id: 'a', course_code: 'MATH101', downloads: 1, views: 1, created_at: '2026-10-01' },
    { id: 'b', course_code: 'ENGL101', downloads: 50, views: 10, created_at: '2026-09-01' },
    { id: 'c', course_code: 'BIOL110', downloads: 5, views: 0, created_at: '2026-11-01' },
  ];
  assert.deepEqual(sortRows(rows, 'newest').map(r => r.id), ['c', 'a', 'b']);
  assert.deepEqual(sortRows(rows, 'popular').map(r => r.id), ['b', 'c', 'a']);
  assert.deepEqual(sortRows(rows, 'course').map(r => r.id), ['c', 'b', 'a']);
  const stats = new Map([['a', { average: 5, total: 1 }], ['c', { average: 4.6, total: 10 }]]);
  assert.equal(sortRows(rows, 'rated', stats)[0].id, 'c', 'many good votes beat a single 5');
  assert.equal(rows[0].id, 'a', 'input not mutated');
});

test('top courses ignore non-codes and rank by use', () => {
  const rows = [
    { course_code: 'ENGL101', downloads: 9 }, { course_code: 'ENGL 101', downloads: 1 },
    { course_code: 'MATH101', downloads: 2 }, { subject: 'ملخص عام' },
  ];
  assert.deepEqual(topCourses(rows).map(x => [x.code, x.files]), [['ENGL101', 2], ['MATH101', 1]]);
});

test('filters round-trip through the URL and reject junk', () => {
  const f = { q: 'INFS205', college: 'كلية العلوم الصحية', type: 'exam', sort: 'popular', course: 'MATH212' };
  assert.deepEqual(readFilters(writeFilters('', f)), f);
  assert.equal(writeFilters('?id=7', { q: '', college: '', type: '', sort: 'newest' }), '?id=7');
  assert.deepEqual(readFilters('?type=evil&sort=drop'), { q: '', college: '', type: '', sort: 'newest', course: '' });
});

test('request CTA only for a single course code', () => {
  assert.equal(queryCourseCode('infs 205'), 'INFS205');
  assert.equal(queryCourseCode('ملخص رياضيات'), '');
  assert.equal(queryCourseCode('INFS205 MATH101'), '');
});

test('groupByCourse makes one shelf per course with counts', async () => {
  const { groupByCourse, groupKey } = await import('../js/summary-library.js');
  const rows = [
    { id: 1, course_code: 'MATH212', subject: 'تفاضل وتكامل 2', content_type: 'exam', created_at: '2026-10-01' },
    { id: 2, course_code: 'MATH 212', subject: 'تفاضل وتكامل 2', content_type: 'summary', created_at: '2026-10-03' },
    { id: 3, course_code: null, subject: 'علم الأنسجة', content_type: 'notes', created_at: '2026-09-01' },
    { id: 4, course_code: null, subject: null, content_type: 'summary', created_at: '2026-11-01' },
  ];
  const groups = groupByCourse(rows);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0], { key: 'MATH212', code: 'MATH212', name: 'تفاضل وتكامل 2', files: 2, types: { exam: 1, summary: 1, notes: 0 }, latest: Date.parse('2026-10-03'), score: 0 });
  assert.equal(groups.at(-1).key, '__other__', 'uncategorised files sink to the end');
  assert.equal(groupKey(rows[2]), groupByCourse([rows[2]])[0].key);
});
