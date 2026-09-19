import test from 'node:test';
import assert from 'node:assert/strict';
import { courseClasses, courseHref, normalizeCourseCode } from '../js/student-workspace.js';

test('a course shows only its own locally saved classes, including spaced codes', () => {
  const course={code:'ENGL150',name_ar:'اللغة الإنجليزية',name_en:'English Language I'};
  const rows=[
    {course:'ENGL 150 — English Language I',day:'الأحد'},
    {course:'English Language I',day:'الثلاثاء'},
    {course_code:'ENGL151',course:'English Language I',day:'الأربعاء'},
    {course:'ENGL1500',day:'الخميس'},
    {course:'INFS205',day:'الاثنين'}
  ];
  assert.deepEqual(courseClasses(rows,course),rows.slice(0,2));
  assert.deepEqual(courseClasses(rows,{code:''}),[]);
  assert.deepEqual(courseClasses(null,course),[]);
});
test('course links normalize supported codes and reject arbitrary URLs or markup', () => {
  assert.equal(courseHref('engl 150'),'course.html?code=ENGL150');
  assert.equal(normalizeCourseCode('STAT-101'),'STAT101');
  for(const value of ['https://example.com','<script>','ENGL150&x=1','English 1',''])assert.equal(courseHref(value),'');
});
