import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';

const modules = [
  'js/core.js','js/pwa-init.js','js/tool-registry-v44.js','js/platform-experience-v44.js',
  'js/tools.js','js/tools-primary-v46.js','js/useful-sites.js','js/search.js','js/go.js',
  'js/tool-preview-v44.js','js/schedule-profile-boot-v44.js','js/schedule.js',
  'js/schedule-extras-v44.js','js/tools-control-v44.js','sw.js',
  'js/admin-v30.js','js/admin-edge-v30.js','js/admin-operations-v31.js','js/admin-courses-v323.js',
  'js/owner-dashboard.js','js/owner-sessions-v48.js','js/telegram-bot-control-fix.js',
  'js/questions.js','js/marketplace.js','js/assistant.js','js/assistant-history.js'
];

const htmlFiles = [
  'index.html','admin.html','owner-dashboard.html','questions.html','marketplace.html','assistant.html',
  'tools-control.html','tool-preview.html','go.html','schedule.html','tools.html','useful-sites.html',
  'academic-calendar.html','summaries.html','groups.html','projects.html','ratings.html','gpa.html',
  'university-guide.html','feedback.html','confessions.html','about.html','status.html','offline.html',
  'maintenance.html','coming-soon.html','upload-summary.html','user-dashboard.html','course.html','courses.html'
];

const requiredFiles = [
  ...htmlFiles,
  'css/admin-v53.css','css/student-tools-v53.css','css/community-v53.css',
  'css/tool-registry-v44.css','css/tools-control-v44.css','css/tool-preview-v44.css',
  'css/schedule-extras-v44.css','css/tools-primary-v46.css','css/useful-sites-v46.css'
];

const failures = [];

for (const file of ['vercel.json','manifest.webmanifest','package.json']) {
  try { JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { failures.push(`${file}\n${error.message}`); }
}

for (const file of requiredFiles) {
  try {
    const content = await readFile(file, 'utf8');
    if (!content.trim()) throw new Error('file is empty');
  } catch (error) { failures.push(`${file}\n${error.message}`); }
}

const ignoredRef = value =>
  !value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:') ||
  value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//') ||
  value.startsWith('tel:') || value.startsWith('mailto:') || value.startsWith('javascript:');

const htmlLocalRefs = new Map();
for (const htmlFile of htmlFiles) {
  let html = '';
  try { html = await readFile(htmlFile, 'utf8'); }
  catch { continue; }

  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);
  htmlLocalRefs.set(htmlFile, refs.filter(ref => !ignoredRef(ref)));

  for (const rawRef of refs) {
    if (ignoredRef(rawRef)) continue;
    const cleanRef = rawRef.split('#')[0].split('?')[0];
    if (!cleanRef || cleanRef.endsWith('/')) continue;

    const localPath = cleanRef.startsWith('/')
      ? resolve(process.cwd(), `.${cleanRef}`)
      : resolve(process.cwd(), dirname(htmlFile), cleanRef);

    try { await access(localPath); }
    catch { failures.push(`${htmlFile}\nmissing local reference: ${rawRef}`); }
  }
}

const checkedModules = new Set();
async function verifyModuleImports(file) {
  const normalized = file.replaceAll('\\','/');
  if (checkedModules.has(normalized)) return;
  checkedModules.add(normalized);

  let source = '';
  try { source = await readFile(normalized, 'utf8'); }
  catch (error) {
    failures.push(`${normalized}\n${error.message}`);
    return;
  }

  const syntax = spawnSync(process.execPath, ['--check', normalized], { encoding: 'utf8' });
  if (syntax.status !== 0) failures.push(`${normalized}\n${syntax.stderr || syntax.stdout}`);

  const refs = new Set();
  for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g)) refs.add(match[1]);
  for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) refs.add(match[1]);

  for (const rawRef of refs) {
    if (!rawRef.startsWith('.') && !rawRef.startsWith('/')) continue;
    const cleanRef = rawRef.split('#')[0].split('?')[0];
    const localPath = cleanRef.startsWith('/')
      ? resolve(process.cwd(), `.${cleanRef}`)
      : resolve(process.cwd(), dirname(normalized), cleanRef);
    const displayPath = relative(process.cwd(), localPath).replaceAll('\\','/');

    try { await access(localPath); }
    catch {
      failures.push(`${normalized}\nmissing local import: ${rawRef}`);
      continue;
    }

    if (/\.(?:m?js)$/i.test(cleanRef)) await verifyModuleImports(displayPath);
  }
}

for (const file of modules) await verifyModuleImports(file);

const checkedStyles = new Set();
async function verifyStyleImports(file) {
  const normalized = file.replaceAll('\\','/');
  if (checkedStyles.has(normalized)) return;
  checkedStyles.add(normalized);

  let source = '';
  try { source = await readFile(normalized, 'utf8'); }
  catch (error) {
    failures.push(`${normalized}\n${error.message}`);
    return;
  }

  for (const match of source.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)) {
    const rawRef = match[1];
    if (ignoredRef(rawRef)) continue;
    const cleanRef = rawRef.split('#')[0].split('?')[0];
    const localPath = cleanRef.startsWith('/')
      ? resolve(process.cwd(), `.${cleanRef}`)
      : resolve(process.cwd(), dirname(normalized), cleanRef);
    const displayPath = relative(process.cwd(), localPath).replaceAll('\\','/');

    try { await access(localPath); }
    catch {
      failures.push(`${normalized}\nmissing local css import: ${rawRef}`);
      continue;
    }
    if (/\.css$/i.test(cleanRef)) await verifyStyleImports(displayPath);
  }
}

const styleEntries = new Set(requiredFiles.filter(file => file.endsWith('.css')));
for (const refs of htmlLocalRefs.values()) {
  for (const rawRef of refs) {
    const cleanRef = rawRef.split('#')[0].split('?')[0];
    if (!cleanRef.endsWith('.css')) continue;
    const normalized = cleanRef.startsWith('/') ? cleanRef.slice(1) : cleanRef;
    styleEntries.add(normalized);
  }
}
for (const file of styleEntries) await verifyStyleImports(file);

if (failures.length) {
  console.error(`Production verification failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`Production verification passed (${modules.length} entry modules, ${checkedModules.size} modules checked, ${checkedStyles.size} styles checked, ${requiredFiles.length} required files, local HTML references checked).`);
