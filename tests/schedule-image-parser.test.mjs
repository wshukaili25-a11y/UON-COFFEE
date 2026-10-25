import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const src=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/uon-schedule-image-parser/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/,''));
const course={courses:[{course_code:'TEST101',sections:[{section_no:'1',meetings:[{day:'Sun',start:'09:00 AM',end:'09:50 AM'}]}]}]};
async function run(responses,{origin='https://uonhub.space',key='public',images=1}={}){
 let handler,active=0,maxActive=0;const calls=[],writes=[];
 vm.runInNewContext(src,{URL,Request,Response,AbortController,setTimeout,clearTimeout,console:{warn(){},error(){}},Deno:{env:{get:k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',GEMINI_API_KEY:'server-only',SUPABASE_PUBLISHABLE_KEYS:'{"default":"public"}'})[k]},serve:h=>handler=h},createClient:()=>({rpc:async(name,args)=>{writes.push(name);return {data:true,error:null}}}),fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,0));active--;const r=responses.shift();if(r instanceof Error)throw r;return new Response(JSON.stringify(r?.body??{candidates:[{content:{parts:[{thought:true,text:'not json'},{text:JSON.stringify(course)}]}}]}),{status:r?.status??200});}});
 const res=await handler(new Request('https://example.test',{method:'POST',headers:{origin,apikey:key,'content-type':'application/json'},body:JSON.stringify({session_id:'11111111-1111-4111-8111-111111111111',client_token:'22222222-2222-4222-8222-222222222222',images:Array.from({length:images},()=> 'data:image/png;base64,YQ=='),save_knowledge:false})}));
 return {status:res.status,data:await res.json(),calls,writes,maxActive};
}
let r=await run([{status:503},{status:200}]);assert.equal(r.status,200);assert.equal(r.calls.length,2);assert.equal(r.data.model,'gemini-3.8-flash');assert.equal(r.data.courses[0].sections[0].meetings[0].start,'09:00');assert(!r.writes.includes('uon_ingest_schedule_extraction'));
r=await run([{status:200}],{origin:'https://uon-preview.vercel.app'});assert.equal(r.status,200);assert.equal(r.calls[0].body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
r=await run([{status:401}]);assert.equal(r.status,502);assert.equal(r.calls.length,1);assert(!JSON.stringify(r.data).includes('server-only'));
const abort=()=>Object.assign(new Error('aborted'),{name:'AbortError'});r=await run([abort(),abort()]);assert.equal(r.status,504);
const empty={body:{candidates:[{content:{parts:[{text:'{"courses":[]}' }]}}]}};r=await run([empty,empty]);assert.equal(r.status,422);
r=await run([],{key:'wrong'});assert.equal(r.status,401);assert.equal(r.calls.length,0);
r=await run([],{origin:'https://evil.test'});assert.equal(r.status,403);assert.equal(r.calls.length,0);
r=await run([{},{},{},{}],{images:4});assert.equal(r.status,200);assert.equal(r.calls.length,4);assert.equal(r.maxActive,3);assert.equal(r.data.images_read,4);
r=await run([{}, {status:401}],{images:2});assert.equal(r.status,502);assert.equal(r.data.images_read,1);assert(!r.writes.includes('uon_ingest_schedule_extraction'));
console.log('9 parser checks passed, including bounded concurrency and rejecting incomplete batches.');
