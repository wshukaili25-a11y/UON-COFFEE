import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=readFileSync(new URL('../supabase/functions/uon-ai-chat-v64/index.ts',import.meta.url),'utf8');
test('successful generation reuses discovery cache across requests',async()=>{
 const functions=['modelState','markSuccess'].map(name=>source.split('\n').find(line=>line.startsWith(`async function ${name}(`))).join('\n');
 let discoveries=0,writes=0;
 const sandbox={Date,AbortSignal,GEMINI_API_KEY:'test',MODEL_TTL:600000,MODEL_PRIORITY:['model-a'],CONFIG_PRIMARY:'model-a',CONFIG_FALLBACK:'model-b',blockedModels:async()=>new Set(),
 fetch:async()=>{discoveries++;return {ok:true,json:async()=>({models:[{name:'models/model-a',supportedGenerationMethods:['generateContent']}]})}},
 db:{from:()=>({upsert:async()=>{writes++;}})}};
 vm.createContext(sandbox);
 vm.runInContext(stripTypeScriptTypes('let modelCache=null;'+functions+';globalThis.run=async()=>{const first=await modelState();await markSuccess(first.selected);return [first,await modelState()]};'),sandbox);
 const [first,next]=await sandbox.run();assert.equal(first,next);assert.equal(discoveries,1);assert.equal(writes,1);
});
test('gateway TypeScript parses after the update',()=>{assert.ok(stripTypeScriptTypes(source));});

test('configured model wins over automatic ranking and quarantined models are excluded',async()=>{
 const fn=source.split('\n').find(line=>line.startsWith('async function modelState('));
 const sandbox={Date,AbortSignal,GEMINI_API_KEY:'test',MODEL_TTL:600000,MODEL_PRIORITY:['unstable','fast','backup'],CONFIG_PRIMARY:'fast',CONFIG_FALLBACK:'backup',blockedModels:async()=>new Set(['unstable']),fetch:async()=>({ok:true,json:async()=>({models:['unstable','fast','backup'].map(name=>({name,supportedGenerationMethods:['generateContent']}))})})};
 vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes('let modelCache=null;'+fn),sandbox);
 const state=await sandbox.modelState();assert.equal(state.selected,'fast');assert.equal(state.fallback,'backup');
});
test('discovery failure never retries quarantined configured models',async()=>{
 const fn=source.split('\n').find(line=>line.startsWith('async function modelState('));
 const sandbox={Date,AbortSignal,GEMINI_API_KEY:'test',MODEL_TTL:600000,MODEL_PRIORITY:[],CONFIG_PRIMARY:'bad-a',CONFIG_FALLBACK:'bad-b',blockedModels:async()=>new Set(['bad-a','bad-b']),fetch:async()=>{throw Error('offline')}};
 vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes('let modelCache=null;'+fn),sandbox);
 const state=await sandbox.modelState();assert.equal(state.selected,'');assert.equal(state.fallback,'');
});
test('both rate limits run concurrently and either limit can deny the request',async()=>{
 const fn=source.split('\n').find(line=>line.startsWith('async function enforceRateLimit('));
 const pending=[];const sandbox={RATE_CLIENT_LIMIT:12,RATE_IP_LIMIT:30,SERVICE_ROLE_KEY:'private',uuid:()=>true,clientIp:()=> 'test-ip',digest:async()=> 'ip-hash',rateHit:(key)=>new Promise(resolve=>pending.push({key,resolve}))};
 vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(fn),sandbox);
 const result=sandbox.enforceRateLimit({headers:{get:()=>null}},{client_token:'test'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,2);
 pending[0].resolve({allowed:true,count:1});pending[1].resolve({allowed:false,count:31,retry_after:45});
 const outcome=await result;assert.equal(outcome.allowed,false);assert.equal(outcome.type,'ip');assert.equal(outcome.retry_after,45);
});
test('background telemetry is registered with runtime and does not delay the response',async()=>{
 const fn=source.slice(source.indexOf('async function background('),source.indexOf('const SUPABASE_URL='));
 let registered;let finish;const pending=new Promise(resolve=>{finish=resolve});
 const sandbox={console,EdgeRuntime:{waitUntil:task=>{registered=task}}};vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(fn),sandbox);
 await sandbox.background(pending);assert.ok(registered);finish();await registered;
});

test('conversation persistence inserts both turns atomically and preserves chronological order',async()=>{
 const fn=source.slice(source.indexOf('async function save('),source.indexOf('\nasync function learn'));
 let inserted,updated=0;
 const sandbox={Date,db:{from:name=>name==='uon_ai_messages'?{insert:async rows=>{inserted=rows;return {error:null}}}:{update:()=>({eq:async()=>{updated++}})}}};
 vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(fn),sandbox);
 await sandbox.save('cid','question','answer','rid');assert.equal(inserted.length,2);assert.equal(inserted[0].role,'user');assert.equal(inserted[1].role,'assistant');assert.ok(inserted[0].created_at<inserted[1].created_at);assert.equal(inserted[1].request_id,'rid');assert.equal(updated,1);
});
