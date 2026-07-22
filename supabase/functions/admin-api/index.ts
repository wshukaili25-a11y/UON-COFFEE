
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});
 try{
  const body=await req.json();
  if(body.action==='health'){
   const checks:any={database:'ok'};
   const {data:state,error}=await db.rpc('uon_public_state');
   if(error)throw error;
   checks.maintenance=state.maintenance_enabled?'maintenance':'active';
   checks.features=Object.keys(state.features||{}).length;

   const {data:backup}=await db.from('backup_runs').select('status,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle();
   checks.backup=backup||null;

   return reply({ok:true,checks});
  }

  if(body.action==='reindex'){
   const r=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/search-reindex`,{
    method:'POST',
    headers:{Authorization:`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,'content-type':'application/json'},
    body:'{}'
   });
   return new Response(await r.text(),{status:r.status,headers:{...cors,'content-type':'application/json'}});
  }

  return reply({ok:false,error:'unknown action'},400);
 }catch(error){
  return reply({ok:false,error:String(error?.message||error)},500);
 }
});
