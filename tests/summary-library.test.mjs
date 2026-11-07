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
  const f = { q: 'INFS205', college: 'كلية العلوم الصحية', type: 'exam', sort: 'popular' };
  assert.deepEqual(readFilters(writeFilters('', f)), f);
  assert.equal(writeFilters('?id=7', { q: '', college: '', type: '', sort: 'newest' }), '?id=7');
  assert.deepEqual(readFilters('?type=evil&sort=drop'), { q: '', college: '', type: '', sort: 'newest' });
});

test('request CTA only for a single course code', () => {
  assert.equal(queryCourseCode('infs 205'), 'INFS205');
  assert.equal(queryCourseCode('ملخص رياضيات'), '');
  assert.equal(queryCourseCode('INFS205 MATH101'), '');
});
