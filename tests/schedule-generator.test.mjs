import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTime,normalizeExtraction,generateProposals,validMeetings,saveGeneratedProfile} from '../js/schedule-generator.js';
import {fetchScheduleParser} from '../js/schedule-eduwave-transport-v3.js';
const meeting=(start,end,day='الأحد')=>({day,start,end,room:'QA'});
const course=(code,sections)=>({course_code:code,sections:sections.map((meetings,i)=>({section_no:String(i+1),selected:true,meetings}))});

test('strict time parsing handles noon, midnight and Arabic digits without guessing',()=>{
 assert.equal(normalizeTime('١٢:٣٠ م'),'12:30');assert.equal(normalizeTime('12:30 AM'),'00:30');
 assert.equal(normalizeTime('1.30 PM'),'13:30');
 for(const value of ['25:00','13:00 PM','00:30 AM','9:90','about 9:30',''])assert.equal(normalizeTime(value),'');
});
test('incomplete or self-conflicting sections cannot produce a partial false-safe schedule',()=>{
 const input={courses:[{course_code:'QA101',sections:[{section_no:'1',meetings:[meeting('08:00','10:00'),meeting('09:00','11:00')]},{section_no:'2',meetings:[meeting('08:00','09:00'),meeting('','11:00')]}]}]};
 const normalized=normalizeExtraction(input);assert.equal(normalized[0].sections.length,2);
 assert.ok(normalized[0].sections.every(s=>!s.valid&&!s.selected));
 assert.equal(generateProposals([course('QA101',[input.courses[0].sections[0].meetings])]).reason,'missing_sections');
});
test('every proposal contains one section of every course and no overlaps; adjacent classes are allowed',()=>{
 const result=generateProposals([course('QA101',[[meeting('08:00','09:00')],[meeting('10:00','11:00')]]),course('QB101',[[meeting('09:00','10:00')],[meeting('08:30','09:30')]])]);
 assert.ok(result.proposals.length>=2);
 for(const p of result.proposals){assert.equal(p.chosen.length,2);assert.ok(validMeetings(p.rows));}
});
test('a genuine conflict, missing selection, duplicate course and a search limit are distinct',()=>{
 const a=course('QA101',[[meeting('08:00','10:00')]]),b=course('QB101',[[meeting('09:00','11:00')]]);
 assert.equal(generateProposals([a,b]).reason,'conflict');
 assert.equal(generateProposals([a,a]).reason,'course_codes');
 assert.equal(generateProposals([a],{maxNodes:1}).reason,'search_limit');
 a.sections[0].selected=false;assert.equal(generateProposals([a]).reason,'missing_sections');
});
test('large option sets stop at a bounded search budget and label incomplete exploration',()=>{
 const input=Array.from({length:8},(_,i)=>course(`QA${100+i}`,Array.from({length:10},()=>[meeting(`${String(i+8).padStart(2,'0')}:00`,`${String(i+9).padStart(2,'0')}:00`)])));
 const result=generateProposals(input,{maxNodes:100,maxResults:1000});assert.ok(result.limited);assert.ok(result.visited<=101);assert.ok(result.proposals.length);
});
const keys=['uon-v44-schedule-profiles','uon-v44-active-schedule','uon-v7-schedule'];
function storageFixture(failAt=0){
 const old=[{course:'OLD101',...meeting('08:00','09:00')}];
 const map=new Map([[keys[0],JSON.stringify({version:1,profiles:[{id:'old',name:'Original',rows:old}],settings:{reminderMinutes:30}})],[keys[1],'old'],[keys[2],JSON.stringify(old)]]);let writes=0;
 return {map,old,getItem:key=>map.get(key)??null,setItem(key,value){if(++writes===failAt)throw new Error('QuotaExceededError');map.set(key,value)},removeItem:key=>map.delete(key)};
}
test('saving a generated profile preserves the previous schedule and preferences',()=>{
 const s=storageFixture(),rows=[{course:'NEW101',...meeting('10:00','11:00')}];
 saveGeneratedProfile(s,rows,'New','new','2026-09-19');const stored=JSON.parse(s.getItem(keys[0]));
 assert.deepEqual(stored.profiles[0].rows,s.old);assert.equal(stored.settings.reminderMinutes,30);assert.equal(stored.profiles.length,2);assert.equal(s.getItem(keys[1]),'new');
});
test('failed persistence restores all original schedule keys',()=>{
 for(const failAt of [1,2,3]){const s=storageFixture(failAt),before=new Map(s.map);assert.throws(()=>saveGeneratedProfile(s,[{course:'NEW101',...meeting('10:00','11:00')}],'New','new'));assert.deepEqual(s.map,before);}
});
test('malformed existing profiles are never replaced by a generated profile',()=>{
 const s=storageFixture();s.map.set(keys[0],'{bad');const before=new Map(s.map);assert.throws(()=>saveGeneratedProfile(s,[meeting('10:00','11:00')],'New','new'));assert.deepEqual(s.map,before);
});
test('parser transport propagates cancellation and never changes global fetch',async()=>{
 const original=globalThis.fetch,controller=new AbortController();
 const pending=fetchScheduleParser({images:[]},{signal:controller.signal,fetcher:async(url,init)=>{assert.equal(url,'/api/schedule-parser');return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));}});
 controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(globalThis.fetch,original);
});
test('non-JSON gateway errors and malformed success responses are actionable',async()=>{
 await assert.rejects(fetchScheduleParser({}, {fetcher:async()=>new Response('large',{status:413})}),/images_too_large/);
 await assert.rejects(fetchScheduleParser({}, {fetcher:async()=>Response.json({})}),/invalid_parser_response/);
 const payload={courses:[],term:'2026-Fall'};assert.deepEqual(await fetchScheduleParser({}, {fetcher:async()=>Response.json(payload)}),payload);
});
