import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQuiz,gradeQuiz,savePractice,loadPractice} from '../js/course-practice-data.js';
const question = {prompt:'Which?',options:['A','B','C','D'],answer:2,explanation:'Because C'};
test('grading requires complete answers, handles option zero, and selects only missed questions',()=>{
 const quiz={questions:[{...question,answer:0},question]};
 assert.throws(()=>gradeQuiz(quiz,[0,null]),/incomplete/);
 assert.deepEqual(gradeQuiz(quiz,[0,1]),{correct:1,total:2,wrong:[1]});
 assert.deepEqual(gradeQuiz(quiz,[0,2]),{correct:2,total:2,wrong:[]});
});
test('invalid answer keys, duplicate options, missing text, and oversized banks are rejected',()=>{
 for(const q of [{...question,answer:4},{...question,answer:'2'},{...question,options:['A',' a ','B','C']},{...question,prompt:' '},{...question,options:['A','B']}]) assert.throws(()=>validateQuiz({questions:[q]}));
 assert.throws(()=>validateQuiz({questions:Array(21).fill(question)}));
 assert.throws(()=>validateQuiz({questions:[]}));
});
test('saving is isolated by course and leaves schedules untouched; failure preserves prior quiz',()=>{
 const data=new Map([['uon-v7-schedule','unchanged']]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 savePractice(storage,'COMP101',{questions:[question]});
 savePractice(storage,'MATH101',{questions:[{...question,prompt:'Other'}]});
 assert.equal(loadPractice(storage,'COMP101').questions[0].prompt,'Which?');
 assert.equal(loadPractice(storage,'MATH101').questions[0].prompt,'Other');
 assert.equal(data.get('uon-v7-schedule'),'unchanged');
 const before=new Map(data);
 assert.throws(()=>savePractice({...storage,setItem:()=>{throw Error('quota');}},'COMP101',{questions:[question]}),/quota/);
 assert.deepEqual(data,before);
 assert.throws(()=>savePractice(storage,'../bad',{questions:[question]}),/course/);
});
test('stored malformed quiz is rejected, never silently graded',()=>{
 assert.throws(()=>loadPractice({getItem:()=>'{broken'},'COMP101'));
 assert.throws(()=>loadPractice({getItem:()=>JSON.stringify({version:1,questions:[{...question,answer:null}]})},'COMP101'));
});

import {saveAttempt,exportPractice,parsePracticeBackup,mergePractice} from '../js/course-practice-data.js';
import {inspectFile} from '../js/security-guard-v48.js';
test('file guard admits only schema-valid course backups in the dedicated import context',async()=>{
 const file=new File([exportPractice('COMP101',{questions:[question]})],'backup.json',{type:'application/json'});
 assert.equal((await inspectFile(file)).safe,false);
 assert.equal((await inspectFile(file,{practiceCourse:'COMP101'})).safe,true);
 assert.equal((await inspectFile(file,{practiceCourse:'MATH101'})).safe,false);
 assert.equal((await inspectFile(new File(['{"unexpected":true}'],'bad.json',{type:'application/json'}),{practiceCourse:'COMP101'})).safe,false);
 assert.equal((await inspectFile(new File(['x'.repeat(400001)],'big.json',{type:'application/json'}),{practiceCourse:'COMP101'})).safe,false);
});
test('attempts resume answers and index, including a missed-question subset and completed result',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const bank=savePractice(storage,'COMP101',{questions:[question,{...question,prompt:'Second'}]});
 saveAttempt(storage,'COMP101',bank,{questions:bank.questions,answers:[2,null],index:1,complete:false});
 assert.deepEqual(loadPractice(storage,'COMP101').attempt.answers,[2,null]);
 assert.equal(loadPractice(storage,'COMP101').attempt.index,1);
 saveAttempt(storage,'COMP101',bank,{questions:[bank.questions[1]],answers:[0],index:0,complete:true});
 const attempt=loadPractice(storage,'COMP101').attempt;
 assert.deepEqual(gradeQuiz(attempt,attempt.answers),{correct:0,total:1,wrong:[0]});
 assert.throws(()=>saveAttempt(storage,'COMP101',bank,{questions:bank.questions,answers:[2,null],index:1,complete:true}));
});
test('stale attempts cannot overwrite questions edited in another tab',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const old=savePractice(storage,'COMP101',{questions:[question]});
 savePractice(storage,'COMP101',{questions:[{...question,prompt:'Updated'}]});
 const snapshot=new Map(data);
 assert.throws(()=>saveAttempt(storage,'COMP101',old,{questions:[question],answers:[0],index:0}),/changed/);
 assert.deepEqual(data,snapshot);
});
test('backup round trip excludes attempts, preserves text, merges without duplicates, rejects foreign and oversized files',()=>{
 const quiz={questions:[{...question,prompt:'<script>literal</script> سؤال'}],attempt:{answers:[2]}};
 const backup=exportPractice('COMP101',quiz);
 assert.ok(!backup.includes('attempt'));
 const restored=parsePracticeBackup(backup,'COMP101');
 assert.deepEqual(restored,validateQuiz(quiz));
 assert.equal(mergePractice(restored,restored).questions.length,1);
 assert.equal(mergePractice(restored,{questions:[question]}).questions.length,2);
 assert.throws(()=>parsePracticeBackup(backup,'MATH101'),/course/);
 assert.throws(()=>parsePracticeBackup('x'.repeat(400001),'COMP101'),/size/);
 assert.throws(()=>parsePracticeBackup('{broken','COMP101'));
 assert.throws(()=>parsePracticeBackup(JSON.stringify({version:9,format:'uon-personal-practice'}),'COMP101'),/format/);
 assert.throws(()=>mergePractice({questions:Array.from({length:20},(_,i)=>({...question,prompt:String(i)}))},{questions:[question]}));
});
test('a damaged attempt does not hide valid saved questions',()=>{
 const value={version:1,questions:[question],attempt:{questions:[question],index:99,answers:[null]}};
 const restored=loadPractice({getItem:()=>JSON.stringify(value)},'COMP101');
 assert.equal(restored.questions.length,1);assert.equal(restored.attempt,undefined);
});

import {practiceSummary} from '../js/course-practice-data.js';
test('course overview distinguishes ready questions, an unanswered choice zero, and retry scores',()=>{
 assert.deepEqual(practiceSummary(null),{state:'empty',count:0});
 const bank={questions:[question,{...question,prompt:'Other'}]};
 assert.deepEqual(practiceSummary(bank),{state:'ready',count:2});
 assert.deepEqual(practiceSummary({...bank,attempt:{questions:bank.questions,answers:[0,null],index:1}}),{state:'in_progress',count:2,total:2,answered:1,question:2});
 assert.deepEqual(practiceSummary({...bank,attempt:{questions:[question],answers:[2],index:0,complete:true}}),{state:'complete',count:2,total:1,answered:1,question:1,correct:1});
});
