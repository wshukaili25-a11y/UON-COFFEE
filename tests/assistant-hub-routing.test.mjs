import test from 'node:test';
import assert from 'node:assert/strict';
import { intent, staffLookupMode } from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
import { hubSources } from '../supabase/functions/uon-ai-chat-v64/services.mjs';

test('leadership titles route to staff lookup', () => {
  for (const q of ['من مدير مركز أنجز؟','مين مديرة القبول والتسجيل','منسق قسم الحاسب','who is the director of anjiz']) assert.equal(intent(q),'people',q);
  assert.equal(staffLookupMode('من مدير مركز أنجز؟',[]),'explicit');
  assert.notEqual(intent('كيف أعرف مرشدي الأكاديمي؟'),'people');
  assert.equal(intent('كيف أحجز في مركز أنجز؟'),'general');
});

test('UON Hub tool cards for study files and timetable', () => {
  assert.equal(hubSources('اريد شروحات')[0].url,'/summaries.html');
  assert.equal(hubSources('ملخصات INFS205')[0].url,'/summaries.html');
  assert.equal(hubSources('كيف أسجل المقررات؟')[0].url,'/schedule.html');
  assert.equal(hubSources('من مدير مركز أنجز؟').length,0);
  assert.equal(hubSources('هلا كيفك').length,0);
  for (const row of hubSources('ملخصات وجدول')) assert.equal(row.official,false);
});

test('hub cards stay out of unrelated questions', () => {
  assert.equal(hubSources('متى جدول الاختبارات النهائية؟').length,0);
  assert.equal(hubSources('اشرح لي قانون نيوتن').length,0);
  assert.equal(hubSources('ساعدني أرتب جدولي بدون تعارض')[0].url,'/schedule.html');
});
