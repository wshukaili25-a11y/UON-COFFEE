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
