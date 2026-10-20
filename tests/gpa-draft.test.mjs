import test from 'node:test';
import assert from 'node:assert/strict';
import {readGpaDraft,writeGpaDraft} from '../js/gpa-draft.js';
const draft=()=>({version:1,currentGpa:'2.5',previousHours:'30',courses:[{code:'INFS205',hours:'3',grade:'A',previousGrade:'F',repeated:true}]});
function memory(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}}
test('restores previous GPA, credits and repeated-course inputs',()=>{const storage=memory();assert.equal(writeGpaDraft(storage,draft()),true);assert.deepEqual(readGpaDraft(storage),draft())});
test('corrupt or unsupported stored data falls back safely',()=>{for(const value of ['{','null','{"version":2}','{"version":1,"courses":null}'])assert.equal(readGpaDraft({getItem:()=>value}),null)});
test('unavailable storage does not interrupt calculation',()=>{const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('quota')}};assert.equal(readGpaDraft(blocked),null);assert.equal(writeGpaDraft(blocked,draft()),false)});
test('invalid values do not overwrite a previously saved draft',()=>{const storage=memory();writeGpaDraft(storage,draft());for(const bad of [{...draft(),currentGpa:'5'},{...draft(),previousHours:'-1'},{...draft(),courses:[{...draft().courses[0],grade:'unknown'}]}])assert.equal(writeGpaDraft(storage,bad),false);assert.deepEqual(readGpaDraft(storage),draft())});
test('cleared courses and partially empty input survive a reload',()=>{const storage=memory(),empty={version:1,currentGpa:'',previousHours:'',courses:[]};assert.equal(writeGpaDraft(storage,empty),true);assert.deepEqual(readGpaDraft(storage),empty)});
