import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {programmeFields,programmeFacet,directProgrammeAnswer} from '../supabase/functions/uon-ai-chat-v64/programme.mjs';
import {textFromHTML} from '../supabase/functions/uon-ai-chat-v64/live-search.mjs';
const html=`<table><tr><td class=programhead>قيمة الساعة المعتمدة</td><td width=10px></td><td class=programhead>إجمالي الساعات المعتمدة</td><td></td><td class=programhead>تكلفة الفصل الدراسي الواحد</td><td class=programhead>إجمالي التكلفة مع السنة التأسيسية + 2240 ر.ع</td><td class=programhead>مدة الدراسة المتوقعة (15ساعة للفصل ربيع وخريف) بالسنوات</td></tr><tr><td class=programdata>84 ر.ع</td><td></td><td class=programdata>135</td><td></td><td class=programdata>1260 ر.ع</td><td class=programdata>13580 ر.ع</td><td class=programdata>5 إلى 5.5</td></tr></table>`;
const source={title:'بكالوريوس تربية في الرياضيات',url:'https://www.unizwa.edu.om/program_details.php?programid=22',official:true,live:true,programme_fields:programmeFields(html,textFromHTML)};
test('official programme cells retain labels, values and duration assumptions despite spacer cells',()=>{
 assert.equal(source.programme_fields.length,5);
 const r=directProgrammeAnswer('وكم الساعات؟',[source]);assert.match(r.answer,/إجمالي الساعات المعتمدة: 135/);assert.doesNotMatch(r.answer,/13580/);
 assert.match(directProgrammeAnswer('كم مدة الدراسة؟',[source]).answer,/15ساعة.*5 إلى 5.5/);
 assert.match(directProgrammeAnswer('كم الرسوم؟',[source]).answer,/التأسيسية \+ 2240 ر.ع: 13580 ر.ع/);
});
test('incomplete tables and ambiguous programme matches never give a direct numerical answer',()=>{
 assert.deepEqual(programmeFields(html.replace('<td class=programdata>135</td>',''),textFromHTML),[]);
 assert.equal(directProgrammeAnswer('كم الساعات؟',[source,{...source,url:'https://www.unizwa.edu.om/program_details.php?programid=13'}]),null);
 for(const row of [{...source,official:false},{...source,live:false},{...source,url:'https://evil.test/program_details.php?programid=22'}])assert.equal(directProgrammeAnswer('كم الساعات؟',[row]),null);
});
test('calculation, scholarship and admissions questions are not mistaken for a table lookup',()=>{
 for(const q of ['احسب رسوم 12 ساعة','كم الساعات المتبقية لي؟','وش شروط القبول؟','كم الرسوم بعد خصم المنحة؟']) assert.equal(programmeFacet(q),'',q);
 assert.equal(directProgrammeAnswer('كم الساعات؟',[{...source,programme_fields:source.programme_fields.slice(0,1)}]),null);
});
test('gateway answers a retrieved programme fact even when the model is unavailable',async()=>{
 const code=readFileSync(new URL('../supabase/functions/uon-ai-chat-v64/index.ts',import.meta.url),'utf8');
 const fn=code.slice(code.indexOf('async function gemini('),code.indexOf('\nasync function conversation('));
 let searches=0;
 const sandbox={officialPageCache:undefined,programmeFacet,directProgrammeAnswer,greetingReply:()=>null,intent:()=> 'general',staffLookupMode:()=>null,context:async()=>[{title:'generic programme introduction'}],relevantContext:(_,rows)=>rows,liveUniversitySearch:async()=>{searches++;return [source]},directServiceAnswer:()=>null,plainAnswer:(answer,mode,links)=>({answer,mode,links}),GEMINI_API_KEY:'',modelState:()=>{throw Error('must not call the model')}};
 vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(fn),sandbox);
 const result=await sandbox.gemini('وكم الساعات؟','ar',[],'تخصص تربية الرياضيات — وكم الساعات؟');
 assert.match(result.answer,/135/);assert.equal(result.source_cards[0].url,source.url);assert.equal(searches,1);
});
test('provider outages retain retrieved source cards and ask for retry, not a different question',async()=>{
 const code=readFileSync(new URL('../supabase/functions/uon-ai-chat-v64/index.ts',import.meta.url),'utf8');
 const fn=code.slice(code.indexOf('async function gemini('),code.indexOf('\nasync function conversation('));
 const row={...source,programme_fields:[],description:'تفاصيل البرنامج'};
 const sandbox={officialPageCache:undefined,programmeFacet,directProgrammeAnswer,greetingReply:()=>null,intent:()=> 'general',staffLookupMode:()=>null,context:async()=>[row],directServiceAnswer:()=>null,plainAnswer:(answer,mode,links)=>({answer,mode,links}),GEMINI_API_KEY:''};
 vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(fn),sandbox);
 const result=await sandbox.gemini('اشرح البرنامج','ar',[],'اشرح البرنامج');
 assert.equal(result.retryable,true);assert.equal(result.source_cards[0].url,source.url);assert.match(result.answer,/مؤقتًا/);assert.doesNotMatch(result.answer,/الاسم الكامل/);
});
