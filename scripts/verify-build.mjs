import { access, readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';

const modules = new Set([
  'js/core.js','js/pwa-init.js','js/tool-registry-v44.js','js/platform-experience-v44.js',
  'js/tools.js','js/tools-primary-v46.js','js/useful-sites.js','js/search.js','js/go.js',
  'js/tool-preview-v44.js','js/schedule-profile-boot-v44.js','js/schedule.js',
  'js/schedule-extras-v44.js','js/tools-control-v44.js','sw.js',
  'js/admin-v30.js','js/admin-edge-v30.js','js/admin-operations-v31.js','js/admin-courses-v323.js',
  'js/owner-dashboard.js','js/owner-sessions-v48.js','js/telegram-bot-control-fix.js',
  'js/assistant.js','js/assistant-history.js','js/contact-directory.js','js/support-centers.js'
]);

const rootEntries=await readdir(process.cwd(),{withFileTypes:true});
const htmlFiles=rootEntries.filter(entry=>entry.isFile()&&entry.name.endsWith('.html')).map(entry=>entry.name).sort();

const requiredFiles = [
  ...htmlFiles,
  'css/admin-v53.css','css/student-tools-v53.css','css/community-v53.css',
  'css/tool-registry-v44.css','css/tools-control-v44.css','css/tool-preview-v44.css',
  'css/schedule-extras-v44.css','css/tools-primary-v46.css','css/useful-sites-v46.css','css/support-centers.css'
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

const localPathForRef = (htmlFile, rawRef) => {
  const cleanRef = rawRef.split('#')[0].split('?')[0];
  if (!cleanRef || cleanRef.endsWith('/')) return null;
  return cleanRef.startsWith('/')
    ? resolve(process.cwd(), `.${cleanRef}`)
    : resolve(process.cwd(), dirname(htmlFile), cleanRef);
};

const repoRelativeRef=(htmlFile,rawRef)=>{
 const localPath=localPathForRef(htmlFile,rawRef);
 return localPath?relative(process.cwd(),localPath).replaceAll('\\','/'):null;
};

const socialImageLocalRef = rawRef => {
  const value = String(rawRef || '').trim();
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return null;
  try {
    const url = new URL(value, 'https://uonhub.space/');
    if (!['uonhub.space','www.uonhub.space'].includes(url.hostname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
};

const htmlLocalRefs = new Map();
for (const htmlFile of htmlFiles) {
  let html = '';
  try { html = await readFile(htmlFile, 'utf8'); }
  catch { continue; }

  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);
  htmlLocalRefs.set(htmlFile, refs.filter(ref => !ignoredRef(ref)));

  for (const rawRef of refs) {
    if (ignoredRef(rawRef)) continue;
    const localPath = localPathForRef(htmlFile, rawRef);
    if (!localPath) continue;
    try { await access(localPath); }
    catch { failures.push(`${htmlFile}\nmissing local reference: ${rawRef}`); }
    const modulePath=repoRelativeRef(htmlFile,rawRef);
    if(modulePath&&/\.(?:m?js)$/i.test(modulePath))modules.add(modulePath);
  }

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key !== 'og:image' && key !== 'twitter:image') continue;
    const rawRef = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    const localRef = socialImageLocalRef(rawRef);
    if (!localRef) continue;
    const localPath = localPathForRef(htmlFile, localRef);
    if (!localPath) continue;
    try { await access(localPath); }
    catch { failures.push(`${htmlFile}\nmissing social image reference: ${rawRef}`); }
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
for (const [htmlFile,refs] of htmlLocalRefs.entries()) {
  for (const rawRef of refs) {
    const cleanRef = rawRef.split('#')[0].split('?')[0];
    if (!cleanRef.endsWith('.css')) continue;
    const normalized = repoRelativeRef(htmlFile,rawRef);
    if(normalized)styleEntries.add(normalized);
  }
}
for (const file of styleEntries) await verifyStyleImports(file);

if (failures.length) {
  console.error(`Production verification failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`Production verification passed (${htmlFiles.length} HTML pages, ${modules.size} entry modules, ${checkedModules.size} modules checked, ${checkedStyles.size} styles checked, ${requiredFiles.length} required files, local HTML and social-image references checked).`);
