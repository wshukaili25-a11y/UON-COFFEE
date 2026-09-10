import { readdir } from 'node:fs/promises';

const url='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-migration-history-read-v67';
const files=(await readdir('supabase/migrations')).filter((name)=>name.endsWith('.sql')).sort();
const local=files.map((file)=>{
  const match=file.match(/^(\d+)_?(.*)\.sql$/i);
  return match?{file,version:match[1],name:match[2]}:{file,version:'',name:file.replace(/\.sql$/i,'')};
});
const normalize=(value)=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

try {
  const response=await fetch(url,{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data?.ok||!Array.isArray(data.migrations)){
    console.log(`UON_MIGRATION_COMPARE status=${response.status} error=${JSON.stringify(data).slice(0,1000)}`);
    process.exitCode=1;
  } else {
    const remote=data.migrations.map((row)=>({version:String(row.version||''),name:String(row.name||'')}));
    const localVersions=new Set(local.map((x)=>x.version).filter(Boolean));
    const remoteVersions=new Set(remote.map((x)=>x.version));
    const localByName=new Map();
    for(const row of local){
      const key=normalize(row.name);
      if(!localByName.has(key)) localByName.set(key,[]);
      localByName.get(key).push(row);
    }
    const remoteByName=new Map();
    for(const row of remote){
      const key=normalize(row.name);
      if(!remoteByName.has(key)) remoteByName.set(key,[]);
      remoteByName.get(key).push(row);
    }

    const remoteOnly=remote.filter((r)=>!localVersions.has(r.version));
    const localOnly=local.filter((l)=>l.version&&!remoteVersions.has(l.version));
    const sameNameDifferentVersion=[];
    for(const r of remoteOnly){
      const matches=localByName.get(normalize(r.name))||[];
      for(const l of matches){
        if(l.version!==r.version) sameNameDifferentVersion.push({name:r.name,remote:r.version,local:l.version,file:l.file});
      }
    }
    const remoteOnlyNoNameMatch=remoteOnly.filter((r)=>!(localByName.get(normalize(r.name))||[]).length);
    const localOnlyNoNameMatch=localOnly.filter((l)=>!(remoteByName.get(normalize(l.name))||[]).length);
    const duplicateLocalVersions=[...new Set(local.map((x)=>x.version).filter((v,i,a)=>v&&a.indexOf(v)!==i))].map((version)=>({version,files:local.filter((x)=>x.version===version).map((x)=>x.file)}));

    console.log(`UON_MIGRATION_COMPARE remote_count=${remote.length} local_count=${local.length}`);
    console.log(`UON_MIGRATION_COMPARE_COUNTS remote_only=${remoteOnly.length} local_only=${localOnly.length} same_name_different_version=${sameNameDifferentVersion.length} remote_only_no_name_match=${remoteOnlyNoNameMatch.length} local_only_no_name_match=${localOnlyNoNameMatch.length} duplicate_local_versions=${duplicateLocalVersions.length}`);
    console.log(`UON_MIGRATION_VERSION_MISMATCHES ${JSON.stringify(sameNameDifferentVersion)}`);
    console.log(`UON_MIGRATION_REMOTE_ONLY_NO_NAME_MATCH ${JSON.stringify(remoteOnlyNoNameMatch)}`);
    console.log(`UON_MIGRATION_LOCAL_ONLY_NO_NAME_MATCH ${JSON.stringify(localOnlyNoNameMatch)}`);
    console.log(`UON_MIGRATION_DUPLICATE_LOCAL_VERSIONS ${JSON.stringify(duplicateLocalVersions)}`);
  }
} catch (error) {
  console.log(`UON_MIGRATION_COMPARE_ERROR ${String(error?.stack||error)}`);
  process.exitCode=1;
}
