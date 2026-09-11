import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'supabase','migrations');
const errors=[];
const warnings=[];

if(!fs.existsSync(dir)){
  console.error('Supabase migration audit: migrations directory is missing');
  process.exit(1);
}

const files=fs.readdirSync(dir)
  .filter(name=>name.endsWith('.sql'))
  .sort();

// Historical files already present before the v67 release. Do not rename these
// until production migration history has been read and reconciled explicitly.
const allowedLegacyNon14=new Set([
  '20260729_ai_supervisor_v24.sql',
  '202608040530_security_ui_cleanup.sql',
  '20260804_owner_session_security.sql',
  '20260805_ai_moderator_analytics_foundation.sql',
  '20260827_contact_numbers.sql',
]);

const allowedLegacyDuplicates=new Map([
  ['20260903122500',new Set([
    '20260903122500_bound_public_read_rpc_inputs.sql',
    '20260903122500_qa_performance_index_cleanup.sql',
  ])],
  ['20260903152500',new Set([
    '20260903152500_restore_course_request_frontend_compatibility.sql',
    '20260903152500_secure_broken_link_report_submission.sql',
  ])],
  ['20260903153500',new Set([
    '20260903153500_fix_public_announcement_targeting.sql',
    '20260903153500_restore_rate_limited_platform_feedback.sql',
  ])],
]);

const byVersion=new Map();
const parsed=[];
for(const file of files){
  const match=file.match(/^(\d+)_/);
  if(!match){
    errors.push(`${file}: migration filename must begin with a numeric version followed by _`);
    continue;
  }
  const version=match[1];
  parsed.push({file,version});
  if(!byVersion.has(version))byVersion.set(version,[]);
  byVersion.get(version).push(file);

  if(version.length!==14){
    if(allowedLegacyNon14.has(file)){
      warnings.push(`${file}: legacy ${version.length}-digit migration version retained pending production-history reconciliation.`);
    }else{
      errors.push(`${file}: new migration version must use exactly 14 digits (YYYYMMDDHHMMSS); found ${version.length}.`);
    }
  }
}

for(const [version,names] of byVersion){
  if(names.length<2)continue;
  const allowed=allowedLegacyDuplicates.get(version);
  const exactAllowed=allowed && names.length===allowed.size && names.every(name=>allowed.has(name));
  if(exactAllowed){
    warnings.push(`${version}: legacy duplicate migration version retained pending production-history reconciliation: ${names.join(', ')}`);
  }else{
    errors.push(`${version}: duplicate migration version is not allowed: ${names.join(', ')}`);
  }
}

// Mixed-length prefix collisions are especially dangerous for migration tools:
// e.g. an 8-digit date version and a timestamp version beginning with that date.
for(let i=0;i<parsed.length;i++){
  for(let j=i+1;j<parsed.length;j++){
    const a=parsed[i];
    const b=parsed[j];
    if(a.version===b.version)continue;
    const short=a.version.length<b.version.length?a:b;
    const long=short===a?b:a;
    if(!long.version.startsWith(short.version))continue;
    const knownLegacy=short.file==='20260804_owner_session_security.sql' &&
      (
        long.file==='20260804043000_reorganize_student_tools_v46.sql' ||
        long.file==='20260804043100_reorganize_student_tools_v46_note.sql' ||
        long.file==='202608040530_security_ui_cleanup.sql'
      );
    if(knownLegacy){
      warnings.push(`Legacy mixed-version prefix collision retained: ${short.file} <-> ${long.file}`);
    }else{
      errors.push(`Mixed-version prefix collision: ${short.file} <-> ${long.file}`);
    }
  }
}

console.log(`Supabase migration audit: ${files.length} SQL migration files scanned`);
if(warnings.length){
  console.log(`\nKnown migration-history debt (${warnings.length}):`);
  for(const item of warnings)console.log(`- ${item}`);
}
if(errors.length){
  console.error(`\nMigration blockers (${errors.length}):`);
  for(const item of errors)console.error(`- ${item}`);
  process.exit(1);
}
console.log('\nSupabase migration audit passed (legacy debt explicitly allowlisted) ✅');
