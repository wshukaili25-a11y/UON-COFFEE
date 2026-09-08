import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const skipDirs=new Set(['.git','node_modules','.vercel']);
const textExt=new Set(['.html','.js','.mjs','.css']);
const assetExt=/\.(?:html?|js|mjs|css|json|webmanifest|png|jpe?g|svg|webp|ico|pdf)$/i;
const errors=[];
const warnings=[];

function walk(dir){
 const out=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(skipDirs.has(entry.name))continue;
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...walk(full));
  else out.push(full);
 }
 return out;
}
const files=walk(root);
const rel=f=>path.relative(root,f).split(path.sep).join('/');
const exists=p=>fs.existsSync(path.join(root,p));

function localTarget(from,value){
 if(!value)return null;
 let raw=String(value).trim();
 if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|tel:|data:|blob:|javascript:|wss?:|\/\/)/i.test(raw))return null;
 raw=raw.split('#')[0].split('?')[0];
 if(!raw||raw==='/'||raw==='.')return null;
 let target;
 if(raw.startsWith('/'))target=raw.replace(/^\/+/, '');
 else target=path.posix.normalize(path.posix.join(path.posix.dirname(from),raw));
 if(target.startsWith('../'))return null;
 return target;
}

const pwaInitPath=path.join(root,'js/pwa-init.js');
const pwaInitText=fs.existsSync(pwaInitPath)?fs.readFileSync(pwaInitPath,'utf8'):'';
const autoShellPaths=new Set();
const autoShellMatch=pwaInitText.match(/AUTO_SHELL_PATHS\s*=\s*new Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
if(autoShellMatch){
 for(const match of autoShellMatch[1].matchAll(/["']([^"']+)["']/g))autoShellPaths.add(match[1]);
}
function hasLegacyIdentityBridge(from,text){
 const pathname='/'+path.posix.basename(from);
 const directBridge=/uon-identity-bridge-v1\.css/i.test(text);
 const explicitShell=/setupV14Shell/.test(text);
 const autoShell=autoShellPaths.has(pathname)&&/pwa-init\.js/i.test(text);
 return directBridge||explicitShell||autoShell;
}
function hasDirectPublicTableWrite(text){
 const fetchCalls=[...text.matchAll(/fetch\s*\(([\s\S]{0,1400}?)\)\s*(?:;|\n|\}|$)/g)].map(match=>match[1]);
 return fetchCalls.some(call=>/rest\/v1\/(?!rpc(?:\/|['"?]))[A-Za-z0-9_?-]+/i.test(call)&&/method\s*:\s*["'](?:POST|PATCH|DELETE)["']/i.test(call));
}

for(const file of files){
 const ext=path.extname(file).toLowerCase();
 if(!textExt.has(ext))continue;
 const from=rel(file);
 const text=fs.readFileSync(file,'utf8');
 if(ext==='.html'){
  for(const match of text.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){
   const target=localTarget(from,match[1]);
   if(!target||!assetExt.test(target))continue;
   if(!exists(target))errors.push(`${from}: missing local reference -> ${match[1]} (${target})`);
  }
  const oldU=(text.match(/class=["'][^"']*brand-mark[^"']*["'][^>]*>\s*U\s*</gi)||[]).length;
  const adminLike=/(?:^|\/)(?:admin|owner-dashboard|tools-control|reset|security-test)/i.test(from);
  if(oldU&&!adminLike&&!hasLegacyIdentityBridge(from,text))warnings.push(`${from}: ${oldU} legacy U brand marker(s) without a verified identity bridge.`);
 }
 if(ext==='.js'||ext==='.mjs'){
  const patterns=[/\bfrom\s*["']([^"']+)["']/g,/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g];
  for(const pattern of patterns)for(const match of text.matchAll(pattern)){
   const spec=match[1];
   if(!spec.startsWith('.')&&!spec.startsWith('/'))continue;
   const target=localTarget(from,spec);
   if(!target)continue;
   if(!exists(target))errors.push(`${from}: missing JS import -> ${spec} (${target})`);
  }
 }
 if(!/(?:^|\/)(?:admin|owner-dashboard|tools-control|admin-|supabase\/functions)/i.test(from)&&/functions\/v1\/telegram-admin(?:['"/?]|$)/.test(text))warnings.push(`${from}: direct telegram-admin reference found; verify it is not a public notification path.`);
 const publicFile=!/(?:^|\/)(?:admin|owner-dashboard|tools-control|supabase\/functions)/i.test(from);
 if(publicFile&&hasDirectPublicTableWrite(text))warnings.push(`${from}: direct public PostgREST write detected; confirm RLS/RPC safety.`);
}

function readVersion(file,regex,label){
 const full=path.join(root,file);
 if(!fs.existsSync(full)){errors.push(`${file}: missing ${label}`);return null}
 const text=fs.readFileSync(full,'utf8');
 const m=text.match(regex);
 if(!m){errors.push(`${file}: could not detect ${label}`);return null}
 return m[1];
}
const appVersion=readVersion('js/pwa-init.js',/APP_VERSION\s*=\s*['"]([^'"]+)['"]/,'APP_VERSION');
const swVersion=readVersion('sw.js',/VERSION\s*=\s*['"]([^'"]+)['"]/,'service worker VERSION');
if(appVersion&&swVersion&&appVersion!==swVersion)errors.push(`PWA version mismatch: pwa-init=${appVersion}, sw=${swVersion}`);

console.log(`UON Hub release audit: ${files.length} files scanned`);
if(appVersion&&swVersion)console.log(`PWA version: ${appVersion}`);
if(autoShellPaths.size)console.log(`Unified legacy shell paths: ${autoShellPaths.size}`);
if(warnings.length){
 console.log(`\nWarnings (${warnings.length}):`);
 for(const item of warnings)console.log(`- ${item}`);
}
if(errors.length){
 console.error(`\nRelease blockers (${errors.length}):`);
 for(const item of errors)console.error(`- ${item}`);
 process.exit(1);
}
console.log('\nRelease audit passed ✅');
