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

import {intent,resolveStaff,selectionIndex,staffCard} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
const directory=[{id:1,full_name:'Dr. Abdullah Saif Al-Ghafri',email:'ghafri@example.org',phone:'25446415',office_location:"'''' 25"},{id:2,full_name:'Dr. Abdullah Al Hatmi',email:'hatmi@example.org',office_location:'Building 4'},{id:3,full_name:'Dr. Abdullah Sulieman Al-Kindi',email:'kindi@example.org'}];
const choices=[{role:'user',content:'الدكتور عبدالله'},{role:'assistant',content:'أي واحد تقصد؟',staff_ids:['1','2','3']}];
test('Omani and English ordinal corrections use the displayed candidate order',()=>{
 for(const q of ['الثاني','لا أقصد الثاني','قصدي الثاني','second','the second','2','٢'])assert.equal(resolveStaff(q,choices,directory).rows[0].id,2,q);
 assert.equal(selectionIndex('ما موعد الاختبار الثاني؟'),-1);
});
test('a missing or forged selection does not invent a person',()=>{
 assert.equal(resolveStaff('السادس',choices,directory).needsSelection,true);
 assert.equal(resolveStaff('الثاني',[{role:'assistant',staff_ids:['999','998']}],directory).rows.length,0);
});
test('multiple follow-ups retain the selected doctor and current requested field',()=>{
 const h=[...choices,{role:'user',content:'الثاني'},{role:'assistant',content:'Dr. Abdullah Al Hatmi',staff_ids:['2']}];
 for(const q of ['رقمه؟','وين مكتبه؟','ايميله؟','عطني رقمه'])assert.equal(resolveStaff(q,h,directory).rows[0].email,'hatmi@example.org');
 assert.equal(resolveStaff('أقصد عبدالله الغافري',h,directory).rows[0].id,1);
});
test('an ambiguous follow-up asks rather than guessing a candidate',()=>{
 const r=resolveStaff('ايميله؟',choices,directory);assert.equal(r.needsSelection,true);assert.equal(r.selected,false);assert.equal(r.rows.length,3);
});
test('cards omit corrupted source fields but retain valid professional contacts',()=>{
 const card=staffCard(directory[0]);assert.equal(card.office,'');assert.equal(card.email,'ghafri@example.org');assert.equal(staffCard(directory[1]).office,'Building 4');
});
test('question routes preserve calculators and distinguish staff, course, dates and ordinary chat',()=>{
 for(const [q,r] of [['احسب معدلي','gpa'],['وش اسجل الفصل الجاي','plan'],['متى اختبار تحديد المستوى','calendar'],['متطلبات INFS205','course'],['دكتور عبدالله','people'],['هلا كيفك','chat'],['لائحة الغياب','policy']])assert.equal(intent(q),r,q);
});
test('history carries only bounded directory identifiers, never arbitrary client metadata',()=>{
 const h=conversationHistory([{role:'assistant',content:'names',staff_ids:[1,'2','invalid',-1],secret:'ignore'}],'next');assert.deepEqual(h[0].staff_ids,['1','2']);assert.equal(h[0].secret,undefined);
});
import {relevantContext} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
test('course facts exclude other course codes and unapproved OCR records',()=>{
 const rows=[{title:'INFS205 — Security',description:'confirmed'},{title:'INFS201 — Business',description:'confirmed'},{title:'INFS205 — section 2',description:'بيانات غير معتمدة بعد'}];
 assert.deepEqual(relevantContext('وش مادة INFS205؟',rows),[rows[0]]);
 assert.deepEqual(relevantContext('INFS-205',rows),[rows[0]]);
 assert.deepEqual(relevantContext('INFS999',rows),[]);
});

import {staffLookupMode} from '../supabase/functions/uon-ai-chat-v64/conversation.mjs';
const collisionDirectory=[...directory,{id:415,full_name:'Dr.Quazi Mohammad Imranul Haq'}];
test('reported حياك regression and ordinary messages never resolve to a phonetic staff match',()=>{
 assert.equal(rankStaff('حياك',collisionDirectory)[0].id,415,'fixture reproduces the original collision');
 for(const q of ['حياك','حياك الله','الله يحييك','هلا والله','مرحبتين','صباح الخير','مساء النور','شخبارك','كيف امورك','تمام','زين','اوكي','يعطيك العافية','مشكور','مع السلامة','حق','حياك يا صاحبي','hello','thanks']) {
  for (const h of [[],choices]) assert.deepEqual(resolveStaff(q,h,collisionDirectory).rows,[],q);
 }
 assert.equal(staffLookupMode('حياك',choices),null);
});
test('fuzzy matching requires staff intent or a name correction in staff context',()=>{
 assert.deepEqual(resolveStaff('عبدالله الغافري',[],directory).rows,[]);
 assert.equal(resolveStaff('دكتور عبدالله الغافري',[],directory).rows[0].id,1);
 assert.equal(resolveStaff('هلا عطني ايميل الدكتور عبدالله الغافري',[],directory).rows[0].id,1);
 assert.equal(resolveStaff('أقصد عبدالله الغافري',choices,directory).rows[0].id,1);
 assert.equal(resolveStaff('Abdullah Saif Al-Ghafri',[],directory).rows[0].id,1);
 assert.deepEqual(resolveStaff('Haq',[],collisionDirectory).rows,[]);
});
