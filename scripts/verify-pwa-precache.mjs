import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
const match = sw.match(/const\s+PRECACHE\s*=\s*\[([\s\S]*?)\];/);
if (!match) {
  console.error('PWA precache verification failed: PRECACHE array was not found in sw.js');
  process.exit(1);
}

const refs = [...match[1].matchAll(/["'](\/[A-Za-z0-9_./-]+)["']/g)].map(item => item[1]);
const failures = [];

for (const ref of refs) {
  const target = resolve(root, `.${ref}`);
  try {
    await access(target);
  } catch {
    failures.push(ref);
  }
}

if (failures.length) {
  console.error(`PWA precache verification failed. Missing files:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(`PWA precache verification passed (${refs.length} files checked).`);
