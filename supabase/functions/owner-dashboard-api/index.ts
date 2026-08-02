import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function origin(req:Request){const value=req.headers.get('origin')||'';try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}return 'https://uonhub.space'}
function headers(req:Request){return{'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,x-admin-password,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json',Vary:'Origin'}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
async function authorized(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return false;const{data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return !error&&data===true}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 if(!(await authorized(req)))return reply(req,{ok:false,error:'unauthorized'},401);
 try{
  const body=await req.json().catch(()=>({}));
  const days=Math.min(90,Math.max(1,Number(body.days)||7));
  const{data,error}=await db.rpc('uon_owner_dashboard_v42',{p_days:days});
  if(error)throw error;
  return reply(req,{ok:true,data});
 }catch(error){return reply(req,{ok:false,error:String((error as Error)?.message||error)},500)}
});
