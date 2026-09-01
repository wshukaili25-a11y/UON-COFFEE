import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const modules = [
  'js/core.js','js/pwa-init.js','js/tool-registry-v44.js','js/platform-experience-v44.js',
  'js/tools.js','js/tools-primary-v46.js','js/useful-sites.js','js/search.js','js/go.js',
  'js/tool-preview-v44.js','js/schedule-profile-boot-v44.js','js/schedule.js',
  'js/schedule-extras-v44.js','js/tools-control-v44.js','sw.js',
  'js/admin-v30.js','js/admin-edge-v30.js','js/admin-operations-v31.js','js/admin-courses-v314.js','js/admin-courses-v323.js',
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

for (const file of modules) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}\n${result.stderr || result.stdout}`);
}

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

for (const htmlFile of htmlFiles) {
  let html = '';
  try { html = await readFile(htmlFile, 'utf8'); }
  catch { continue; }

  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);
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

if (failures.length) {
  console.error(`Production verification failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`Production verification passed (${modules.length} modules, ${requiredFiles.length} required files, local HTML references checked).`);
