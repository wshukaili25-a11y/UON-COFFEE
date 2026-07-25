import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
};
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const restoreOrder=[
 'site_settings','platform_features','tools_items','courses','university_programs',
 'academic_calendar_events','site_announcements','site_notifications','import_sources',
 'summaries','whatsapp_groups','student_projects','rating_submissions','confessions',
 'course_resources','course_requests','feature_suggestions','broken_link_reports',
 'telegram_admins','admin_roles'
];

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});
 let runId='';
 try{
  const body=await req.json().catch(()=>({}));
  const backupId=body.backup_run_id||body.backup_id;
  if(!backupId)return reply({ok:false,error:'backup_run_id is required'},400);

  const {data:backup,error:backupError}=await db.from('backup_runs')
   .select('*').eq('id',backupId).eq('status','completed').single();
  if(backupError)throw backupError;
  const backupPath=backup.file_path||backup.backup_path;
  if(!backupPath)throw new Error('Backup file path is missing');

  const {data:run,error:runError}=await db.from('restore_runs').insert({
   backup_path:backupPath,status:'running',requested_by:String(body.requested_by||'')
  }).select().single();
  if(runError)throw runError;
  runId=run.id;

  const {data:file,error:downloadError}=await db.storage.from('uon-backups').download(backupPath);
  if(downloadError)throw downloadError;
  const payload=JSON.parse(await file.text());
  const tables=payload.tables||{};
  const results:any={};
  const names=[...restoreOrder,...Object.keys(tables).filter((x:string)=>!restoreOrder.includes(x))];

  for(const table of names){
   const rows=tables[table];
   if(!Array.isArray(rows)||rows.length===0)continue;
   // Upsert in small chunks to avoid request size/time limits.
   let restored=0;
   for(let i=0;i<rows.length;i+=250){
    const chunk=rows.slice(i,i+250);
    const {error}=await db.from(table).upsert(chunk,{onConflict:'id'});
    if(error){results[table]={ok:false,error:error.message,restored};break;}
    restored+=chunk.length;
   }
   if(!results[table])results[table]={ok:true,rows:restored};
  }

  const failed=Object.values(results).some((x:any)=>x.ok===false);
  await db.from('restore_runs').update({
   status:failed?'completed_with_errors':'completed',completed_at:new Date().toISOString(),
   error:failed?JSON.stringify(results):null
  }).eq('id',runId);
  return reply({ok:!failed,run_id:runId,results},failed?207:200);
 }catch(error){
  if(runId)await db.from('restore_runs').update({status:'failed',error:String(error?.message||error),completed_at:new Date().toISOString()}).eq('id',runId);
  return reply({ok:false,error:String(error?.message||error)},500);
 }
});
