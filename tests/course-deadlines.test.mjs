import test from 'node:test';
import assert from 'node:assert/strict';
import { courseDeadlines, nextExamWindow, daysUntil, countdownLabel, addExamHref } from '../js/course-deadlines.js';

const now = new Date(2026, 10, 6, 18, 0);

test('course deadlines: this course, open, upcoming, soonest first', () => {
  const tasks = [
    { id: 1, title: 'اختبار INFS 205', course: '', due: new Date(2026,10,18,9).toISOString(), done: false },
    { id: 2, title: 'Quiz', course: 'infs-205', due: new Date(2026,10,10,9).toISOString(), done: false },
    { id: 3, title: 'Old', course: 'INFS205', due: new Date(2026,10,1,9).toISOString(), done: false },
    { id: 4, title: 'Done', course: 'INFS205', due: new Date(2026,10,12,9).toISOString(), done: true },
    { id: 5, title: 'Other', course: 'MATH101', due: new Date(2026,10,9,9).toISOString(), done: false },
    { id: 6, title: 'No date', course: 'INFS205', due: null, done: false },
  ];
  assert.deepEqual(courseDeadlines(tasks, 'INFS205', now).map(t => t.id), [2, 1]);
  assert.deepEqual(courseDeadlines(tasks, '', now), []);
});

test('next exam window includes an ongoing window', () => {
  const events = [
    { kind: 'exam', title: 'A', start: '2026-10-11', end: '2026-10-15' },
    { kind: 'exam', title: 'B', start: '2026-11-15', end: '2026-11-19' },
    { kind: 'registration', title: 'R', start: '2026-11-08', end: '2026-11-09' },
  ];
  assert.equal(nextExamWindow(events, now).title, 'B');
  assert.equal(nextExamWindow(events, new Date(2026, 10, 17, 10)).title, 'B');
  assert.equal(nextExamWindow(events, new Date('2027-02-01')), null);
});

test('countdown labels and prefilled task link', () => {
  assert.equal(daysUntil('2026-11-15', now), 9);
  assert.equal(countdownLabel(0), 'اليوم');
  assert.equal(countdownLabel(1), 'بكرة');
  assert.equal(countdownLabel(9), 'بعد 9 أيام');
  assert.equal(countdownLabel(14), 'بعد 14 يوم');
  const url = new URL(addExamHref('INFS205'), 'https://uonhub.space/');
  assert.equal(url.pathname, '/tasks.html');
  assert.equal(url.searchParams.get('course'), 'INFS205');
  assert.equal(url.searchParams.get('priority'), 'high');
});
