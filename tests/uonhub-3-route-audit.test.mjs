import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../uonhub-3-preview.html',import.meta.url),'utf8');
const manifest=readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
const routes=['api/ai-chat.js','api/uon-ai.js','api/schedule-parser.js'];
const sources=Object.fromEntries(routes.map(p=>[p,readFileSync(new URL('../'+p,import.meta.url),'utf8')]));

test('experimental preview is standalone and does not load production scripts',()=>{
  assert.doesNotMatch(page,/<script\b/i);
  assert.doesNotMatch(page,/<iframe\b/i);
  assert.doesNotMatch(page,/\bfetch\s*\(/i);
  assert.doesNotMatch(page,/XMLHttpRequest/i);
  assert.doesNotMatch(page,/navigator\.serviceWorker/i);
});
test('retired AI Vercel routes remain disabled',()=>{
  for(const route of ['api/ai-chat.js','api/uon-ai.js']){
    assert.match(sources[route],/AI_ROUTE_RETIRED/);
    assert.match(sources[route],/410/);
  }
});
test('audit detects production-bound schedule proxy before staging rollout',()=>{
  assert.match(sources['api/schedule-parser.js'],/irkhvydgxpseflggbeqq\.supabase\.co/);
  assert.match(manifest,/irkhvydgxpseflggbeqq\.supabase\.co/);
});
