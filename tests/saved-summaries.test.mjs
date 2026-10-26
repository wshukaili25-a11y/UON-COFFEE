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
 const ctx={loadMore:null,PAGE_SIZE:24,matches:[],visibleCount:0,loading:false,loadFailed:false,search:{value:''},collegeFilter:{value:''},typeFilter:{value:''},savedOnly:true,savedIds:new Set(['a','deleted-id']),rows:[{id:'a',title:'Math'},{id:'b',title:'English'}],normalizeSearch:v=>String(v||'').toLowerCase(),searchableText:x=>x.title.toLowerCase(),normalizedType:()=>'',syncSavedFilter(){},resultStatus:{},items:{},card:x=>x.id,t:a=>a};
 vm.createContext(ctx);vm.runInContext(render+'\n'+clear+'\nfunction renderNow(){render()}',ctx);
 vm.runInContext('render()',ctx);assert.equal(ctx.items.innerHTML,'a');
 ctx.search.value='English';vm.runInContext('render()',ctx);assert.match(ctx.items.innerHTML,/data-reset-filters/);
 vm.runInContext('clearAllFilters()',ctx);assert.equal(ctx.items.innerHTML,'ab');assert.equal(ctx.savedOnly,false);
 assert.ok(!s.includes('class="sum-meta"'));
});
test('progressive results append without duplicates and search includes undisplayed files',()=>{
 const source=fs.readFileSync(new URL('../js/summaries.js',import.meta.url),'utf8');
 const rendering=source.slice(source.indexOf('function render(){'),source.indexOf('\nif(search)search.value'));
 let focused=false;
 const ctx={loadMore:{hidden:true},PAGE_SIZE:24,matches:[],visibleCount:0,loading:false,loadFailed:false,search:{value:''},collegeFilter:{value:''},typeFilter:{value:''},savedOnly:false,savedIds:new Set(),rows:Array.from({length:53},(_,i)=>({id:String(i),title:`course-${i}`})),normalizeSearch:v=>String(v||'').toLowerCase(),searchableText:x=>x.title,normalizedType:()=>'',syncSavedFilter(){},resultStatus:{},items:{innerHTML:'',insertAdjacentHTML(position,html){assert.equal(position,'beforeend');this.innerHTML+=html},querySelectorAll(){return Array.from({length:53},()=>({querySelector:()=>({focus:()=>{focused=true}})}))}},card:x=>`[${x.id}]`,t:a=>a};
 vm.createContext(ctx);vm.runInContext(rendering,ctx);vm.runInContext('render()',ctx);
 assert.equal(ctx.visibleCount,24);assert.equal(ctx.loadMore.hidden,false);
 vm.runInContext('showMore();showMore();showMore()',ctx);
 assert.equal(ctx.items.innerHTML,ctx.rows.map(ctx.card).join(''));assert.equal(ctx.visibleCount,53);assert.equal(ctx.loadMore.hidden,true);assert.equal(focused,true);
 ctx.search.value='course-52';vm.runInContext('render()',ctx);assert.equal(ctx.items.innerHTML,'[52]');assert.equal(ctx.visibleCount,1);
 ctx.search.value='';vm.runInContext('render()',ctx);assert.equal(ctx.visibleCount,24);assert.equal(ctx.loadMore.hidden,false);
 ctx.savedOnly=true;ctx.savedIds=new Set(['52']);vm.runInContext('render()',ctx);assert.equal(ctx.items.innerHTML,'[52]');
 ctx.search.value='no-match';vm.runInContext('render()',ctx);assert.equal(ctx.loadMore.hidden,true);assert.equal(ctx.visibleCount,0);
});
