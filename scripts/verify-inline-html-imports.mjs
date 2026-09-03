import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const root = process.cwd();
const htmlFiles = (await readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name)
  .sort();

const failures = [];
let checked = 0;

function localPathForRef(htmlFile, rawRef) {
  const cleanRef = String(rawRef || '').split('#')[0].split('?')[0];
  if (!cleanRef || (!cleanRef.startsWith('.') && !cleanRef.startsWith('/'))) return null;
  return cleanRef.startsWith('/')
    ? resolve(root, `.${cleanRef}`)
    : resolve(root, dirname(htmlFile), cleanRef);
}

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const refs = new Set();

  for (const match of html.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) refs.add(match[1]);
  for (const match of html.matchAll(/\bimport\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g)) refs.add(match[1]);

  for (const rawRef of refs) {
    const localPath = localPathForRef(htmlFile, rawRef);
    if (!localPath) continue;
    checked += 1;
    try {
      await access(localPath);
    } catch {
      failures.push(`${htmlFile}\nmissing inline module import: ${rawRef}\nresolved: ${relative(root, localPath).replaceAll('\\', '/')}`);
    }
  }
}

if (failures.length) {
  console.error(`Inline HTML import verification failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`Inline HTML import verification passed (${htmlFiles.length} HTML pages, ${checked} local inline imports checked).`);
