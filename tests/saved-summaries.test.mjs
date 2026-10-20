import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SAVED_SUMMARIES_KEY,readSavedSummaries,toggleSavedSummary} from '../js/saved-summaries.js';
function memory(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}}
test('save, reload and remove only the chosen summary',()=>{const storage=memory();toggleSavedSummary(storage,'a');toggleSavedSummary(storage,'b');assert.deepEqual([...readSavedSummaries(storage)],['a','b']);toggleSavedSummary(storage,'a');assert.deepEqual([...readSavedSummaries(storage)],['b'])});
test('another tab save is preserved by the next update',()=>{const storage=memory();const old=readSavedSummaries(storage);toggleSavedSummary(storage,'other-tab');assert.equal(old.size,0);assert.deepEqual([...toggleSavedSummary(storage,'this-tab')],['other-tab','this-tab'])});
test('corrupt storage and duplicates are handled safely',()=>{const storage=memory();storage.setItem(SAVED_SUMMARIES_KEY,'{');assert.equal(readSavedSummaries(storage).size,0);storage.setItem(SAVED_SUMMARIES_KEY,JSON.stringify({version:1,ids:['a','a',null,12,'']}));assert.deepEqual([...readSavedSummaries(storage)],['a'])});
test('failed writes are reported instead of claiming a saved file',()=>{const storage={getItem:()=>null,setItem(){throw Error('quota')}};assert.throws(()=>toggleSavedSummary(storage,'a'),/quota/);assert.equal(readSavedSummaries(storage).size,0)});
test('saved filter combines with search and clears to all files',()=>{
 const s=fs.readFileSync(new URL('../js/summaries.js',import.meta.url),'utf8');
 const render=s.slice(s.indexOf('function render(){'),s.indexOf('\nif(search)search.value'));
 const clear=s.slice(s.indexOf('function clearAllFilters(){'),s.indexOf('\nif(search){search.oninput'));
 const ctx={loading:false,loadFailed:false,search:{value:''},collegeFilter:{value:''},typeFilter:{value:''},savedOnly:true,savedIds:new Set(['a','deleted-id']),rows:[{id:'a',title:'Math'},{id:'b',title:'English'}],normalizeSearch:v=>String(v||'').toLowerCase(),searchableText:x=>x.title.toLowerCase(),normalizedType:()=>'',syncSavedFilter(){},resultStatus:{},items:{},card:x=>x.id,t:a=>a};
 vm.createContext(ctx);vm.runInContext(render+'\n'+clear+'\nfunction renderNow(){render()}',ctx);
 vm.runInContext('render()',ctx);assert.equal(ctx.items.innerHTML,'a');
 ctx.search.value='English';vm.runInContext('render()',ctx);assert.match(ctx.items.innerHTML,/data-reset-filters/);
 vm.runInContext('clearAllFilters()',ctx);assert.equal(ctx.items.innerHTML,'ab');assert.equal(ctx.savedOnly,false);
 assert.ok(!s.includes('class="sum-meta"'));
});
