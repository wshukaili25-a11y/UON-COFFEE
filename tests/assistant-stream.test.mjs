import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {readSSE} from '../supabase/functions/uon-ai-chat-v64/stream.mjs';
import {officialURL,textFromHTML,searchLinks,searchTerm,liveUniversitySearch} from '../supabase/functions/uon-ai-chat-v64/live-search.mjs';
const bytes=text=>new TextEncoder().encode(text);
const body=text=>new ReadableStream({start(c){for(const b of bytes(text))c.enqueue(new Uint8Array([b]));c.close();}});
test('SSE retains Arabic across byte boundaries and multiple frames',async()=>{
 const got=[];await readSSE(body('data: {"text":"هلا"}\r\n\r\ndata: {"text":"عُمان"}\n\n'),x=>got.push(x.text));assert.deepEqual(got,['هلا','عُمان']);
});
test('client displays progressive text but requires final metadata and rejects interrupted streams',async()=>{
 const box={window:{},TextDecoder,Uint8Array,Error};vm.createContext(box);vm.runInContext(readFileSync('js/assistant-stream.js','utf8'),box);
 const seen=[];const r=new Response(body('data: {"type":"text","text":"هلا"}\n\ndata: {"type":"done","status":200,"data":{"answer":"هلا!","request_id":"id","links":[{"url":"https://www.unizwa.edu.om/"}]}}\n\n'),{headers:{'content-type':'text/event-stream'}});
 const result=await box.window.readUonAIResponse(r,t=>seen.push(t));assert.deepEqual(seen,['هلا']);assert.equal(result.request_id,'id');assert.equal(result.links.length,1);
 await assert.rejects(box.window.readUonAIResponse(new Response(body('data: {"type":"text","text":"partial"}\n\n'),{headers:{'content-type':'text/event-stream'}})),/incomplete_stream/);
 await assert.rejects(box.window.readUonAIResponse(new Response(body('data: {"type":"done","status":429,"data":{"error":"rate_limited"}}\n\n'),{headers:{'content-type':'text/event-stream'}})),/rate_limited/);
});
test('official search rejects external redirects, credentials and unsafe destinations',()=>{
 for(const url of ['https://evil.test/index.php','https://www.unizwa.edu.om.evil.test/index.php','http://www.unizwa.edu.om/index.php','https://x@www.unizwa.edu.om/index.php','https://www.unizwa.edu.om:8443/index.php','https://www.unizwa.edu.om/admin.php'])assert.equal(officialURL(url),null,url);
 assert.equal(officialURL('program_details.php?programid=22'),'https://www.unizwa.edu.om/program_details.php?programid=22');
});
test('search matches education mathematics ahead of other mathematics programmes',()=>{
 const html='<li class="searchli"><a href=program_details.php?programid=13>B.Sc Mathematics بكالوريوس رياضيات</a><li class="searchli"><a href=program_details.php?programid=22>B.Ed Mathematics تربية الرياضيات</a><li class="searchli"><a href="https://evil.test/index.php">تربية الرياضيات</a>';
 assert.match(searchLinks(html,'رسوم تربية الرياضيات')[0].url,/programid=22/);assert.equal(searchTerm('كم رسوم تربية الرياضيات؟'),'Mathematics');
 assert.equal(textFromHTML('<script>bad()</script><style>bad</style><td>84</td><td>ر.ع</td>'),'84 | ر.ع |');
});
test('live search only publishes fetched official pages, not snippets',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push([url,opts.redirect]);return new Response(url.includes('search.php')?'<li class="searchli"><a href=program_details.php?programid=22>تربية الرياضيات</a>':'<!-- End of header --><h1>تربية الرياضيات</h1><p>قيمة الساعة المعتمدة 84 ريال عماني، إجمالي الساعات 135، إجمالي تكلفة البرنامج 13580 ريال عماني.</p>',{headers:{'content-type':'text/html; charset=utf-8'}});};
 try{const rows=await liveUniversitySearch('رسوم تربية الرياضيات');assert.equal(rows.length,1);assert.equal(rows[0].live,true);assert.match(rows[0].description,/84/);assert.equal(calls.length,2);assert.ok(calls.every(x=>x[1]==='error'));}finally{globalThis.fetch=original;}
});
test('official page cache reuses follow-up fetches, preserves check time and refuses expired data on failure',async()=>{
 // Fresh module instance isolates the cache from the other fixture.
 const {liveUniversitySearch:search}=await import('../supabase/functions/uon-ai-chat-v64/live-search.mjs?cache-test');
 const original=globalThis.fetch,originalNow=Date.now;let now=1000000,calls=0,offline=false;
 Date.now=()=>now;
 globalThis.fetch=async url=>{calls++;if(offline)throw Error('offline');return new Response(url.includes('search.php')?'<li class="searchli"><a href=program_details.php?programid=22>تربية الرياضيات</a>':'<!-- End of header --><h1>تربية الرياضيات</h1><p>معلومات رسمية عن البرنامج وعدد الساعات المعتمدة وخطة الدراسة ورسوم البرنامج من صفحة الجامعة.</p>',{headers:{'content-type':'text/html; charset=utf-8'}});};
 try{
  const first=await search('رسوم تربية الرياضيات');assert.equal(first.length,1);assert.equal(calls,2);assert.equal(first[0].cached,false);
  now+=1000;const follow=await search('تخصص تربية الرياضيات — وكم الساعات؟');assert.equal(calls,2);assert.equal(follow[0].cached,true);assert.equal(follow[0].checked_at,first[0].checked_at);
  // Returned metadata must not let one request modify the cached HTML.
  follow[0].description='changed';assert.notEqual((await search('تربية الرياضيات'))[0].description,'changed');
  const aborted=new AbortController();aborted.abort();assert.deepEqual(await search('تربية الرياضيات',aborted.signal),[]);assert.equal(calls,2);
  now+=300001;offline=true;assert.deepEqual(await search('تربية الرياضيات'),[]);assert.equal(calls,3);
  offline=false;const refreshed=await search('تربية الرياضيات');assert.equal(calls,5);assert.notEqual(refreshed[0].checked_at,first[0].checked_at);
 }finally{globalThis.fetch=original;Date.now=originalNow;}
});
