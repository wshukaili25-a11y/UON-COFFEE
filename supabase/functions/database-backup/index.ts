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

const tables=[
 'site_settings','platform_features','courses','course_resources','course_requests',
 'summaries','whatsapp_groups','student_projects','rating_submissions','confessions',
 'site_announcements','site_notifications','university_programs','tools_items',
 'academic_calendar_events','feature_suggestions','broken_link_reports',
 'telegram_admins','admin_roles','import_sources'
];

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});
 let requested_by='';
 try{requested_by=(await req.json().catch(()=>({})))?.requested_by||''}catch{}

 const {data:run,error}=await db.from('backup_runs')
  .insert({status:'running',requested_by}).select().single();
 if(error)return reply({ok:false,error:error.message},500);

 try{
  const payload:any={
   version:'15.0',
   created_at:new Date().toISOString(),
   tables:{}
  };
  const counts:any={};

  for(const table of tables){
   const {data,error}=await db.from(table).select('*');
   if(error){
    if(error.code==='42P01')continue;
    throw error;
   }
   payload.tables[table]=data||[];
   counts[table]=(data||[]).length;
  }

  const path=`backups/v15-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const {error:uploadError}=await db.storage.from('uon-backups').upload(path,blob,{
   contentType:'application/json',upsert:false
  });
  if(uploadError)throw uploadError;

  await db.from('backup_runs').update({
   status:'completed',file_path:path,row_counts:counts,
   completed_at:new Date().toISOString()
  }).eq('id',run.id);

  return reply({ok:true,run_id:run.id,path,counts});
 }catch(error){
  await db.from('backup_runs').update({
   status:'failed',error:String(error?.message||error),
   completed_at:new Date().toISOString()
  }).eq('id',run.id);
  return reply({ok:false,error:String(error?.message||error)},500);
 }
});
