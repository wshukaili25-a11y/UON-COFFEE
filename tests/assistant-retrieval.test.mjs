import test from 'node:test';
import assert from 'node:assert/strict';
import { relevantContext, retrievalQuestion, serviceTopic, cleanAnswerLinks } from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
import { placementSources, directServiceAnswer } from '../supabase/functions/uon-ai-chat-v64/services.mjs';

const schedules=[{type:'بيانات شعب EduWave',title:'INFS205 — مقدمة لأمن الكمبيوتر · شعبة 2',description:'بيانات مؤكدة من جدول اعتمده طالب • القاعة: 17A',url:'/schedule.html',score:121}];
const anjiz={type:'مركز دعم',title:'مركز أنجز',description:'دعم مخصص لطلاب السنة التأسيسية',url:'https://portal.unizwa.edu.om/twc/',official:false,score:46};
const masalik={...anjiz,title:'مركز تعزيز مسالك التعلم'};
const unrelated={type:'مبنى',title:'مبنى 20-A — المكتبة',description:'Library الحرم المبدئي',url:'https://www.unizwa.edu.om/',score:180};

test('missing model link destinations do not render broken Markdown',()=>{
  assert.equal(cleanAnswerLinks('المصدر: [تفاصيل المقرر]()'),'المصدر: تفاصيل المقرر');
  assert.equal(cleanAnswerLinks('[المصدر](https://www.unizwa.edu.om/)'),'[المصدر](https://www.unizwa.edu.om/)');
});

test('high-scoring schedules and buildings cannot displace the named support centre',()=>{
  for(const q of ['كيف أحجز موعد في مركز أنجز؟ عطِني رابط الحجز.','أريد حجز انجاز','Anjiz booking link']){
    const rows=relevantContext(q,[...schedules,unrelated,masalik,anjiz]);
    assert.equal(rows.length,1,q);assert.equal(rows[0].title,anjiz.title);
    assert.equal(directServiceAnswer(q,rows).sources[0].url,anjiz.url);
  }
  assert.equal(relevantContext('حجز مسالك التعلم',[anjiz,masalik])[0].title,masalik.title);
});
test('placement enquiries return the personal enquiry entry point without inventing a slot',()=>{
  const q='هلا، كيف أعرف موعد وقاعة اختبار تحديد المستوى في جامعة نزوى؟ أريد الرابط الرسمي.';
  const rows=relevantContext(q,[...schedules,unrelated,...placementSources(q)]);
  assert.equal(rows.length,2);
  const answer=directServiceAnswer(q,rows);
  assert.equal(answer.sources[0].url,'https://portal.unizwa.edu.om/info/fiexam.php');
  assert.match(answer.answer,/لا ترسل رقمك/);
  assert.equal(directServiceAnswer('ما تقسيم درجات تحديد المستوى؟',rows),null);
});
test('unknown topics and model memories do not become verified evidence',()=>{
  assert.deepEqual(relevantContext('وين مركز الروبوتات؟',[...schedules,unrelated,anjiz]),[]);
  assert.deepEqual(relevantContext('موعد الاختبارات',[{type:'ذاكرة UON AI',title:'موعد الاختبارات',description:'Previous model answer',score:200}]),[]);
  assert.equal(directServiceAnswer('من مدير مركز أنجز؟',[anjiz]),null);
});
test('a link follow-up retains the service and new service questions replace it',()=>{
  const h=[{role:'user',content:'كيف أحجز أنجز؟'},{role:'assistant',content:'حجز أنجز'}];
  assert.equal(serviceTopic(retrievalQuestion('عطني الرابط',h)),'anjiz');
  assert.equal(serviceTopic(retrievalQuestion('وين اختبار تحديد المستوى؟',h)),'placement');
});

test('successive short follow-ups preserve the topic, even with an intervening thanks',()=>{
 const h=[{role:'user',content:'خدمات مركز أنجز'},{role:'assistant',content:'خدمات الدعم'},
 {role:'user',content:'كيف أحجز؟'},{role:'assistant',content:'من البوابة'},
 {role:'user',content:'عطني الرابط'},{role:'assistant',content:'رابط الحجز'},
 {role:'user',content:'شكرا 👋'},{role:'assistant',content:'العفو'}];
 for(const q of ['كيف احجز؟','وضح أكثر','الرابط الرسمي'])assert.match(retrievalQuestion(q,h),/خدمات مركز أنجز/);
 assert.equal(retrievalQuestion('وين مسالك التعلم؟',h),'وين مسالك التعلم؟');
 assert.equal(retrievalQuestion('عطني الرابط',[]),'عطني الرابط');
});

import {intent,calendarContext} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
test('registration dates for next term are calendar questions, not a schedule request',()=>{
 assert.equal(intent('متى التسجيل للفصل القادم؟'),'calendar');
 assert.equal(intent('وش اسجل الفصل الجاي؟'),'plan');
});
test('tuition cannot be grounded in generic programme descriptions or staff contacts',()=>{
 const rows=[{type:'معلومة رسمية',title:'تخصص تربية الرياضيات',description:'تعريف بالبرنامج',official:true},{type:'موظف جامعة نزوى',title:'موظف التسجيل',description:'التسجيل للفصل القادم',official:true}];
 assert.deepEqual(relevantContext('كم رسوم تخصص تربية الرياضيات؟',rows),[]);
 assert.deepEqual(relevantContext('متى التسجيل للفصل القادم؟',[rows[1]]),[]);
 const priced={type:'معلومة رسمية',title:'رسوم تربية الرياضيات',description:'رسوم البرنامج موضحة في الجدول'};
 assert.equal(relevantContext('كم رسوم تربية الرياضيات؟',[priced]).length,1);
});
test('upcoming calendar context excludes past events and keeps provenance honest',()=>{
 const events=[{title:'التسجيل القديم',event_type:'registration',start_date:'2026-08-30',end_date:'2026-09-03'},{title:'التسجيل لفصل الربيع',event_type:'registration',start_date:'2026-12-13',end_date:'2026-12-17'},{title:'اختبار',event_type:'exam',start_date:'2026-10-18',end_date:'2026-10-22'}];
 const rows=calendarContext('متى التسجيل للفصل القادم؟',events,'2026-10-15');
 assert.equal(rows.length,1);assert.equal(rows[0].title,'التسجيل لفصل الربيع');assert.equal(rows[0].official,false);assert.match(rows[0].description,/2026-12-13/);
 assert.equal(calendarContext('اختبار تحديد المستوى',events,'2026-10-15').length,0);
 assert.equal(calendarContext('متى التسجيل في 2026؟',events,'2026-10-15').length,2);
});
test('expired retrieved records cannot support an answer',()=>{
 assert.deepEqual(relevantContext('رسوم الرياضيات',[{title:'رسوم الرياضيات',description:'رسوم قديمة',expires_at:'2020-01-01'}]),[]);
});

test('calendar retrieval uses date-filtered events rather than unfiltered legacy rows or buildings',()=>{
 const rows=[{type:'تقويم أكاديمي',title:'فترة التسجيل الثانية',description:'التسجيل 2026-08-30 2026-09-03'}, {type:'مبنى',title:'مبنى التسجيل',description:'التسجيل للفصل القادم'}, {type:'معلومة رسمية',title:'التقويم الأكاديمي الرسمي',description:'روابط التقويم الرسمي',official:true}];
 const result=relevantContext('متى التسجيل للفصل القادم؟',rows);assert.equal(result.length,1);assert.equal(result[0].title,'التقويم الأكاديمي الرسمي');
});
