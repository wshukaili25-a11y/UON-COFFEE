import test from 'node:test';
import assert from 'node:assert/strict';
import {hubIntent,resolveCourse,resolveProgram,summariesAnswer,groupsAnswer,planAnswer,courseAnswer,searchTerm} from '../supabase/functions/uon-ai-chat-v64/hubdata.mjs';
import {intent} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';

const courses=[
 {code:'COMP101',name_ar:'Computer Skills',name_en:'Computer Skills',credit_hours:3,level:1},
 {code:'PHYS101',name_ar:'General Physics I',name_en:'General Physics I',credit_hours:4,level:1},
 {code:'ENGL150',name_ar:'English Language I',name_en:'English Language I',credit_hours:3,level:1},
 {code:'EDUC113',name_ar:'أصول التربية',name_en:'Foundations of Education',credit_hours:3,level:1},
 {code:'NRSG101',name_ar:'Fundamentals of Nursing',name_en:'Fundamentals of Nursing',credit_hours:3,level:1},
 {code:'NRSG101L',name_ar:'Fundamentals of Nursing Lab',name_en:'Fundamentals of Nursing Lab',credit_hours:2,level:1},
 {code:'HIST150',name_ar:'الحضارة الإسلامية',name_en:'Islamic Civilization',credit_hours:3,level:1},
];
const programs=[
 {id:'p1',name_ar:'تصميم الويب وأمن المعلومات',name_en:'Web Design and Information Security',degree_ar:'بكالوريوس'},
 {id:'p2',name_ar:'نظم المعلومات',name_en:'Information Systems',degree_ar:'بكالوريوس'},
 {id:'p3',name_ar:'التربية في الأحياء',name_en:'Biology Education',degree_ar:'بكالوريوس'},
 {id:'p4',name_ar:'الرياضيات',name_en:'Mathematics',degree_ar:'دبلوم'},
 {id:'p5',name_ar:'الرياضيات',name_en:'Mathematics',degree_ar:'بكالوريوس'},
 {id:'p6',name_ar:'علوم الحاسب',name_en:'Computer Science',degree_ar:'بكالوريوس'},
 {id:'p7',name_ar:'التمريض',name_en:'Nursing',degree_ar:'بكالوريوس'},
];

test('intents from real student questions',()=>{
 assert.ok(hubIntent('اريد ملخصات pdf للانجلش لفل 1').summaries);
 assert.ok(hubIntent('قروب ملخص إنجليزي فاونديشين').groups);
 assert.ok(hubIntent('أريد خطة تخصص تصميم ويب وأمن معلومات').plan);
 assert.ok(!hubIntent('كيف أحجز في مركز أنجز؟').summaries);
});

test('library is not a person lookup',()=>{
 assert.notEqual(intent('وين احصل المكتبة'),'people');
 assert.equal(intent('وين مكتبه الدكتور احمد'),'people');
});

test('course resolution: code, alias, name, lab suffix',()=>{
 assert.equal(resolveCourse('ملخصات comp 101',courses).course.code,'COMP101');
 assert.equal(resolveCourse('ملخص كمبيوتر سكلس',courses).course.code,'COMP101');
 assert.equal(resolveCourse('قروب حضارة',courses).course.code,'HIST150');
 assert.equal(resolveCourse('قروب أصول التربية سكشن ٢',courses).course.code,'EDUC113');
 assert.equal(resolveCourse('fundamentals of nursing lab group',courses).course.code,'NRSG101L');
 assert.equal(resolveCourse('ملخص NRSG١٠١',courses).course.code,'NRSG101');
 assert.equal(resolveCourse('اريد ملخصات انجلش لفل 1',courses).course,null);
});

test('programme resolution prefers the right degree',()=>{
 assert.equal(resolveProgram('أريد خطة تخصص تصميم ويب وأمن معلومات',programs).id,'p1');
 assert.equal(resolveProgram('مواد تخصص تربية احياء',programs).id,'p3');
 assert.equal(resolveProgram('خطة الرياضيات',programs).id,'p5');
 assert.equal(resolveProgram('خطة دبلوم الرياضيات',programs).id,'p4');
 assert.equal(resolveProgram('خطة علوم الحاسوب',programs).id,'p6');
 assert.equal(resolveProgram('خطة التمريض',programs).id,'p7');
 assert.equal(resolveProgram('خطة نظم المعلومات',programs).id,'p2');
 assert.equal(resolveProgram('كيف حالك',programs),null);
});

test('answers carry plain clickable links in the text',()=>{
 const c=courses[0];
 const s=summariesAnswer(c,[{id:'a1',title:'Final review'},{id:'a2',title:'Chapter 1'}]);
 assert.match(s.answer,/https:\/\/www\.uonhub\.space\/summary-viewer\.html\?id=a1/);
 assert.match(s.answer,/course\.html\?code=COMP101/);
 assert.match(summariesAnswer(c,[]).answer,/summaries\.html\?q=COMP101/);
 const g=groupsAnswer(c,[{subject:'COMP101 sec 1',link:'https://chat.whatsapp.com/abc'},{subject:'bad',link:'http://evil'}]);
 assert.match(g.answer,/chat\.whatsapp\.com\/abc/);assert.doesNotMatch(g.answer,/evil/);
 const p=planAnswer(programs[6],[{...courses[4],source_url:'https://www.unizwa.edu.om/program_files/x.doc'},{code:'NRSG220',name_ar:'Adult Health Nursing I',credit_hours:3,level:2}]);
 assert.match(p.answer,/مستوى 100[\s\S]*NRSG101[\s\S]*مستوى 200[\s\S]*NRSG220/);
 assert.match(p.answer,/courses\.html\?program=p7/);assert.match(p.answer,/program_files\/x\.doc/);
 assert.doesNotMatch(p.answer,/\*/);
 assert.match(planAnswer(programs[0],[]).answer,/مو منشورة/);
 assert.match(courseAnswer(courses[3],{summaries:2,groups:5}).answer,/2 ملف · 5 قروب/);
});

test('search term strips request words',()=>{
 assert.equal(searchTerm('اريد ملخصات pdf للانجلش لفل 1'),'انجلش لفل 1');
});

import {stripOpening} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
test('model welcome openers are removed unless the student greeted',()=>{
 assert.equal(stripOpening('أهلاً بك يا غالي. تقدر تقدم من البوابة.','كيف اقدم عذر'),'تقدر تقدم من البوابة.');
 assert.equal(stripOpening('أهلاً بك! بروتوكول TCP موثوق.','اشرح TCP'),'بروتوكول TCP موثوق.');
 assert.equal(stripOpening('مرحباً بك! يمكنك العثور على المكتبة.','وين المكتبة'),'يمكنك العثور على المكتبة.');
 assert.equal(stripOpening('أهلاً وسهلاً! كيف أقدر أساعدك؟','هلا'),'أهلاً وسهلاً! كيف أقدر أساعدك؟');
 assert.equal(stripOpening('أهل الاختصاص يقولون كذا.','سؤال'),'أهل الاختصاص يقولون كذا.');
});
