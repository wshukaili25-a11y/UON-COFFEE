import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function origin(req:Request){const value=req.headers.get('origin')||'';try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}return 'https://uonhub.space'}
function headers(req:Request){return{'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,x-admin-password,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json',Vary:'Origin'}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
async function authorized(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return false;const{data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return !error&&data===true}
async function count(table:string,filters:(query:any)=>any){let query=db.from(table).select('*',{count:'exact',head:true});query=filters(query);const{count,error}=await query;if(error)throw error;return count||0}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 if(!(await authorized(req)))return reply(req,{ok:false,error:'unauthorized'},401);
 try{
  const body=await req.json().catch(()=>({}));
  const days=Math.min(90,Math.max(1,Number(body.days)||7));
  const{data,error}=await db.rpc('uon_owner_dashboard_v42',{p_days:days});if(error)throw error;
  const since=new Date(Date.now()-days*86400000).toISOString();
  const [summaries,groups,ratings,projects,requests,reports,searchRows]=await Promise.all([
   count('summaries',q=>q.eq('approved',false)),
   count('whatsapp_groups',q=>q.eq('approved',false)),
   count('rating_submissions',q=>q.eq('status','pending')),
   count('student_projects',q=>q.eq('status','pending')),
   count('course_requests',q=>q.eq('status','pending')),
   count('content_reports',q=>q.eq('status','pending')),
   db.from('usage_events').select('metadata').eq('event_type','search').gte('created_at',since).limit(5000)
  ]);
  const searchMap=new Map<string,number>();
  for(const row of searchRows.data||[]){const value=String(row.metadata?.query||row.metadata?.term||'').trim();if(value)searchMap.set(value,(searchMap.get(value)||0)+1)}
  data.pending_breakdown={ملخصات:summaries,مجموعات:groups,تقييمات:ratings,مشاريع:projects,'طلبات مقررات':requests,بلاغات:reports};
  data.top_searches=[...searchMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([query,total])=>({query,total}));
  return reply(req,{ok:true,data});
 }catch(error){return reply(req,{ok:false,error:String((error as Error)?.message||error)},500)}
});
