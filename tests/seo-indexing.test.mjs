// Guards against shipping preview-only "noindex" to public pages again
// (it happened on 2026-10-18 and hid the homepage from Google for weeks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const PUBLIC = ['index.html','courses.html','course.html','summaries.html','groups.html','schedule.html','gpa.html','academic-calendar.html','university-guide.html','support-centers.html','useful-sites.html','tools.html','search.html','ratings.html','projects.html','confessions.html','feedback.html','about.html','tasks.html','study-focus.html'];

test('public pages are indexable', () => {
  for (const file of PUBLIC) {
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/i, `${file} must not be noindex`);
  }
});

test('canonical URLs use the primary www domain', () => {
  for (const file of PUBLIC) {
    const m = readFileSync(file, 'utf8').match(/rel="canonical" href="([^"]+)"/);
    if (m) assert.match(m[1], /^https:\/\/www\.uonhub\.space\//, file);
  }
});

test('sitemap lists www URLs for existing public pages and courses', () => {
  const xml = readFileSync('sitemap.xml', 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.length > 100);
  for (const loc of locs) {
    const url = new URL(loc);
    assert.equal(url.host, 'www.uonhub.space');
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    assert.ok(existsSync(file), `${loc} → ${file} exists`);
    assert.ok(PUBLIC.includes(file), `${file} is a public page`);
  }
  assert.match(readFileSync('robots.txt', 'utf8'), /Sitemap: https:\/\/www\.uonhub\.space\/sitemap\.xml/);
});
