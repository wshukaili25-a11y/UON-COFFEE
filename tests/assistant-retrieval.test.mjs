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
