import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
};
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'content-type':'application/json'}
});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});

 try{
  const body=await req.json();
  const {data:backup,error:backupError}=await db.from('backup_runs')
   .select('*').eq('id',body.backup_run_id).eq('status','completed').single();
  if(backupError)throw backupError;

  const {data:run,error:runError}=await db.from('restore_runs').insert({
   backup_path:backup.file_path,status:'running',requested_by:body.requested_by||''
  }).select().single();
  if(runError)throw runError;

  try{
   const {data:file,error:downloadError}=await db.storage.from('uon-backups').download(backup.file_path);
   if(downloadError)throw downloadError;

   const payload=JSON.parse(await file.text());
   const results:any={};

   for(const [table,rows] of Object.entries(payload.tables||{}) as any){
    if(!Array.isArray(rows)||rows.length===0)continue;
    const {error}=await db.from(table).upsert(rows);
    if(error){
     results[table]={ok:false,error:error.message};
    }else{
     results[table]={ok:true,rows:rows.length};
    }
   }

   const failed=Object.values(results).some((x:any)=>x.ok===false);
   await db.from('restore_runs').update({
    status:failed?'completed_with_errors':'completed',
    completed_at:new Date().toISOString(),
    error:failed?JSON.stringify(results):null
   }).eq('id',run.id);

   return reply({ok:!failed,run_id:run.id,results},failed?207:200);
  }catch(error){
   await db.from('restore_runs').update({
    status:'failed',error:String(error?.message||error),
    completed_at:new Date().toISOString()
   }).eq('id',run.id);
   throw error;
  }
 }catch(error){
  return reply({ok:false,error:String(error?.message||error)},500);
 }
});
