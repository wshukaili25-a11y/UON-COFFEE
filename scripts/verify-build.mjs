import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const modules = [
  'js/core.js','js/pwa-init.js','js/tool-registry-v44.js','js/platform-experience-v44.js',
  'js/tools.js','js/tools-primary-v46.js','js/useful-sites.js','js/search.js','js/go.js',
  'js/tool-preview-v44.js','js/schedule-profile-boot-v44.js','js/schedule.js',
  'js/schedule-extras-v44.js','js/tools-control-v44.js','sw.js',
  'js/admin-v30.js','js/admin-edge-v30.js','js/admin-operations-v31.js','js/admin-courses-v323.js',
  'js/owner-dashboard.js','js/owner-sessions-v48.js','js/telegram-bot-control-fix.js',
  'js/questions.js','js/marketplace.js','js/assistant.js','js/assistant-history.js'
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

const requiredFiles = [
  'index.html','admin.html','owner-dashboard.html','questions.html','marketplace.html','assistant.html',
  'tools-control.html','tool-preview.html','go.html','schedule.html','tools.html','useful-sites.html',
  'css/admin-v53.css','css/student-tools-v53.css','css/community-v53.css',
  'css/tool-registry-v44.css','css/tools-control-v44.css','css/tool-preview-v44.css',
  'css/schedule-extras-v44.css','css/tools-primary-v46.css','css/useful-sites-v46.css'
];

for (const file of requiredFiles) {
  try {
    const content = await readFile(file, 'utf8');
    if (!content.trim()) throw new Error('file is empty');
  } catch (error) { failures.push(`${file}\n${error.message}`); }
}

if (failures.length) {
  console.error(`Production verification failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`Production verification passed (${modules.length} modules, ${requiredFiles.length} required files).`);
