import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const modules=[
 'js/core.js',
 'js/pwa-init.js',
 'js/tool-registry-v44.js',
 'js/platform-experience-v44.js',
 'js/tools.js',
 'js/search.js',
 'js/go.js',
 'js/schedule-profile-boot-v44.js',
 'js/schedule.js',
 'js/schedule-extras-v44.js',
 'js/tools-control-v44.js',
 'sw.js'
];

const failures=[];
for(const file of modules){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(result.status!==0)failures.push(`${file}\n${result.stderr||result.stdout}`);
}

for(const file of ['vercel.json','manifest.webmanifest','package.json']){
 try{JSON.parse(await readFile(file,'utf8'))}
 catch(error){failures.push(`${file}\n${error.message}`)}
}

const requiredFiles=['tools-control.html','go.html','schedule.html','css/tool-registry-v44.css','css/tools-control-v44.css','css/schedule-extras-v44.css'];
for(const file of requiredFiles){
 try{
  const content=await readFile(file,'utf8');
  if(!content.trim())throw new Error('file is empty');
 }catch(error){failures.push(`${file}\n${error.message}`)}
}

if(failures.length){
 console.error(`V44 verification failed:\n\n${failures.join('\n\n')}`);
 process.exit(1);
}
console.log(`V44 verification passed (${modules.length} modules).`);
