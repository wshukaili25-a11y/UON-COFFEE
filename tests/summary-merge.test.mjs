import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('merged cards keep internal viewing and sharing alongside saved controls and clean descriptions',()=>{
 const s=fs.readFileSync(new URL('../js/summaries.js',import.meta.url),'utf8');
 const code=s.slice(s.indexOf('function visibleDescription('),s.indexOf('function render(){'));
 const ctx={t:a=>a,safeUrl:x=>x,normalizedType:()=> 'summary',stats:new Map(),ratingModal:null,courseHref:()=>'',esc:x=>String(x),typeLabel:x=>x,savedIds:new Set(['abc']),whatsappShare:(title,url)=>url,URL,location:{href:'https://uonhub.space/summaries.html'}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const html=ctx.card({id:'abc',title:'Course notes',url:'https://example.org/original.pdf',description:'المصدر: https://uoncafe.org/notes/7 | دفعة uoncafe-20261020 | نسخة مستضافة على UON Hub؛ حقوق المحتوى لأصحابه'});
 assert.match(html,/href="summary-viewer.html\?id=abc"/);
 assert.match(html,/https:\/\/uonhub.space\/summary-viewer.html\?id=abc/);
 assert.match(html,/data-save aria-pressed="true"/);
 assert.doesNotMatch(html,/uoncafe|original.pdf|دفعة|نسخة مستضافة/);
 assert.equal(ctx.visibleDescription('ملخص الفصل الأول'),'ملخص الفصل الأول');
});
