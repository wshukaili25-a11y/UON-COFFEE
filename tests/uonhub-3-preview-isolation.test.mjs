import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const preview = readFileSync(new URL('../uonhub-3-preview.html', import.meta.url), 'utf8');
const forbidden = [
  /irkhvydgxpseflggbeqq/i,
  /supabase\.co/i,
  /\/functions\/v1\//i,
  /\bsb_(?:publishable|secret)_/i,
  /\/api\/(?:schedule-parser|ai-chat|uon-ai)/i,
  /<script\b[^>]*\bsrc\s*=/i,
  /<form\b/i
];

test('UON Hub 3 concept preview has no production API or Supabase references', () => {
  for (const pattern of forbidden) {
    assert.doesNotMatch(preview, pattern, 'Preview must stay static until staging is isolated');
  }
});
test('UON Hub 3 preview is Arabic-first, responsive and explicitly experimental', () => {
  assert.match(preview, /<html\s+lang="ar"\s+dir="rtl">/);
  assert.match(preview, /name="viewport"/);
  assert.match(preview, /noindex,nofollow/);
  assert.match(preview, /prefers-reduced-motion/);
  assert.match(preview, /تجريبي/);
  assert.match(preview, /غير تابع رسميًا/);
});
