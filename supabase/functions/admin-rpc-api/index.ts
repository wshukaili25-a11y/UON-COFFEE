import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const ALLOWED_ORIGINS=new Set([
 'https://uonhub.space',
 'https://www.uonhub.space'
]);

const ADMIN_RPCS=new Set([
 'uon_admin_announcement',
 'uon_admin_catalog_action',
 'uon_admin_import_course_sections',
 'uon_admin_moderate',
 'uon_admin_pending_counts',
 'uon_admin_pending_exam_questions',
 'uon_admin_pending_marketplace',
 'uon_admin_save_site_settings',
 'uon_admin_set_feature',
 'uon_admin_set_tool',
 'uon_security_dashboard'
]);

function requestOrigin(req:Request){
 const origin=req.headers.get('origin')||'';
 if(ALLOWED_ORIGINS.has(origin))return origin;
 try{
  const host=new URL(origin).hostname;
  if(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-')))return origin;
 }catch{}
 return 'https://uonhub.space';
}

function corsHeaders(req:Request){
 return {
  'Access-Control-Allow-Origin':requestOrigin(req),
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-admin-password',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Max-Age':'86400',
  'Vary':'Origin'
 };
}

function reply(req:Request,body:unknown,status=200){
 return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(req),'content-type':'application/json'}});
}

async function authorized(req:Request){
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(bearer&&bearer===SERVICE_ROLE_KEY)return true;
 const password=req.headers.get('x-admin-password')||'';
 if(!password)return false;
 const {data,error}=await db.rpc('uon_admin_authorized',{p_password:password});
 return !error&&data===true;
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 try{
  if(!(await authorized(req)))return reply(req,{ok:false,error:'unauthorized'},401);
  const body=await req.json().catch(()=>({}));
  if(body.action!=='rpc')return reply(req,{ok:false,error:'unknown_action'},400);
  const name=String(body.name||'').trim();
  if(!ADMIN_RPCS.has(name))return reply(req,{ok:false,error:'rpc_not_allowed'},403);
  const args=body.args&&typeof body.args==='object'&&!Array.isArray(body.args)?body.args:{};
  const {data,error}=await db.rpc(name,args);
  if(error)throw error;
  return reply(req,{ok:true,data});
 }catch(error){
  const message=String((error as Error)?.message||error);
  const clientError=/invalid|required|not allowed|unauthorized|unknown/i.test(message);
  return reply(req,{ok:false,error:message},clientError?400:500);
 }
});
