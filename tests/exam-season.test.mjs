import test from 'node:test';
import assert from 'node:assert/strict';
import { examSeasonModel, LEAD_DAYS } from '../js/exam-season.js';

const events = [{ kind: 'exam', title: 'الاختبار الثاني – الأسبوع الأول', start: '2026-11-15', end: '2026-11-19' }];
const recent = [{ code: 'COMP101', name_ar: 'مهارات الحاسوب', name_en: 'Computer Skills' }, { code: 'engl150', name_en: 'English Language I' }];

test('hidden when the next exam window is far away or absent', () => {
  assert.equal(examSeasonModel({ events, recent, now: new Date(2026, 9, 20) }), null);
  assert.equal(examSeasonModel({ events: [], recent, now: new Date(2026, 10, 7) }), null);
  assert.ok(LEAD_DAYS >= 7);
});

test('shows countdown, per-course past-exam links and saved exam', () => {
  const tasks = [{ title: 'اختبار COMP101', course: 'COMP101', due: new Date(2026, 10, 16, 9).toISOString(), done: false }];
  const m = examSeasonModel({ events, tasks, recent, now: new Date(2026, 10, 7, 12) });
  assert.equal(m.countdown, 'بعد 8 أيام');
  assert.equal(m.courses.length, 2);
  assert.equal(m.courses[0].filesHref, 'summaries.html?q=COMP101&type=exam');
  assert.equal(m.courses[0].next.label, 'بعد 9 أيام');
  assert.equal(m.courses[1].code, 'ENGL150');
  assert.equal(m.courses[1].next, null);
  assert.match(m.courses[1].addHref, /^tasks\.html\?/);
});

test('ongoing window says happening now', () => {
  const m = examSeasonModel({ events, recent: [], now: new Date(2026, 10, 17), en: true });
  assert.equal(m.countdown, 'Happening now');
  assert.deepEqual(m.courses, []);
});
