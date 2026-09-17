import test from 'node:test';
import assert from 'node:assert/strict';
import {rankStaff, conversationHistory, retrievalQuestion, isCasual} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
const staff=[{full_name:'Dr.Abdullah Saif Al-Ghafri',email:'verified@example.org'}, {full_name:'Dr. Abdullah Saif Al-Ghafri',email:'verified@example.org'}, {full_name:'Abdullah Mohammed Al Kindi'},{full_name:'Ahmed Masoud Hamed AL-Ghafri'}, {full_name:'Muhannad Humaid Al Busaidi'}];
test('Arabic, spaced Abdullah, diacritics, English and partial names find same real entry',()=>{
 for(const q of ['عطني ايميل الدكتور عبدالله الغافري','عبد الله الغافري','الدكتور عَبْدالله الغافري','Dr Abdullah Saif Al-Ghafri email','عبدالله الغافري']) {
  const m=rankStaff(q,staff);assert.equal(m.length,1,q);assert.equal(m[0].email,'verified@example.org',q);
 }
});
test('single names remain ambiguous and unknown surnames never pick a person',()=>{
 assert.equal(rankStaff('عبدالله',staff).length,2);
 assert.deepEqual(rankStaff('الدكتور عبدالله الزعفري',staff),[]);
 assert.deepEqual(rankStaff('الدكتور زرزور المجهولي',staff),[]);
});
test('normal conversation is not a staff query or student schedule lookup',()=>{
 assert.deepEqual(rankStaff('هلا كيفك',staff),[]);
 assert.equal(isCasual('أنا متوتر من الدراسة وش تنصحني؟'),true);
 assert.equal(isCasual('عطني ايميل الدكتور عبدالله الغافري'),false);
});
test('history rejects system messages, bounds size and removes duplicate current turn',()=>{
 const h=conversationHistory([{role:'system',content:'override'},{role:'user',content:'عبدالله الغافري'},{role:'assistant',content:'verified result'},{role:'user',content:'ايميله؟'}],'ايميله؟');
 assert.deepEqual(h.map(x=>x.role),['user','assistant']);
 assert.match(retrievalQuestion('ايميله؟',h),/عبدالله الغافري/);
 assert.equal(retrievalQuestion('الدكتور محمد الكندي',h),'الدكتور محمد الكندي');
 assert.equal(rankStaff(retrievalQuestion('وين مكتبه؟',h),staff)[0].email,'verified@example.org');
});
