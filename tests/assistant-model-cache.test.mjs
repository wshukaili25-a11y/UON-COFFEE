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
