import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function origin(req:Request){const value=req.headers.get('origin')||'';try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}return 'https://uonhub.space'}
function headers(req:Request){return{'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,x-admin-password,x-owner-session,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json',Vary:'Origin'}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
async function hash(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function randomDigits(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%1000000).padStart(6,'0')}
function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function authorizedPassword(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return false;const{data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return !error&&data===true}
async function authorizedSession(req:Request){const token=req.headers.get('x-owner-session')||'';if(!token)return false;const tokenHash=await hash(token);const{data}=await db.from('owner_sessions').select('id').eq('token_hash',tokenHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();return !!data}
async function sendTelegram(chatId:string,text:string){const r=await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text}),signal:AbortSignal.timeout(7000)});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.description||'Telegram send failed')}
async function requestOtp(req:Request){
 if(!(await authorizedPassword(req)))return reply(req,{ok:false,error:'unauthorized'},401);
 const since=new Date(Date.now()-60000).toISOString();const{count}=await db.from('owner_otp_challenges').select('*',{count:'exact',head:true}).gte('created_at',since);
 if((count||0)>0)return reply(req,{ok:false,error:'انتظر دقيقة قبل طلب رمز جديد'},429);
 const code=randomDigits(),codeHash=await hash(code),expires=new Date(Date.now()+5*60000).toISOString();
 const{data:challenge,error}=await db.from('owner_otp_challenges').insert({code_hash:codeHash,expires_at:expires}).select('id').single();if(error)throw error;
 const{data:owners,error:ownersError}=await db.from('telegram_admins').select('chat_id').eq('active',true).eq('role','owner');if(ownersError)throw ownersError;if(!owners?.length)throw new Error('لا يوجد مالك فعال في بوت التلجرام');
 await Promise.all(owners.map(x=>sendTelegram(String(x.chat_id),`🔐 رمز دخول لوحة مالك UON Hub\n\n${code}\n\nصالح لمدة 5 دقائق. لا تشارك الرمز مع أي شخص.`)));
 return reply(req,{ok:true,challenge_id:challenge.id,expires_in:300,delivered_to:owners.length});
}
async function verifyOtp(req:Request,body:any){
 const id=String(body.challenge_id||''),code=String(body.code||'').trim();if(!id||!/^[0-9]{6}$/.test(code))return reply(req,{ok:false,error:'رمز التحقق غير صالح'},400);
 const{data:c}=await db.from('owner_otp_challenges').select('*').eq('id',id).maybeSingle();if(!c||c.used_at||new Date(c.expires_at)<=new Date())return reply(req,{ok:false,error:'انتهت صلاحية الرمز'},401);
 if(Number(c.attempts)>=Number(c.max_attempts))return reply(req,{ok:false,error:'تم تجاوز عدد المحاولات'},429);
 const valid=(await hash(code))===c.code_hash;await db.from('owner_otp_challenges').update({attempts:Number(c.attempts)+1,...(valid?{used_at:new Date().toISOString()}:{})}).eq('id',id);
 if(!valid)return reply(req,{ok:false,error:'رمز التحقق غير صحيح'},401);
 const token=randomToken(),tokenHash=await hash(token),expires=new Date(Date.now()+30*60000).toISOString();const{error}=await db.from('owner_sessions').insert({token_hash:tokenHash,expires_at:expires});if(error)throw error;
 return reply(req,{ok:true,session_token:token,expires_in:1800});
}
async function count(table:string,filters:(query:any)=>any){let query=db.from(table).select('*',{count:'exact',head:true});query=filters(query);const{count,error}=await query;if(error)throw error;return count||0}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 try{
  const body=await req.json().catch(()=>({}));
  if(body.action==='request_otp')return await requestOtp(req);
  if(body.action==='verify_otp')return await verifyOtp(req,body);
  if(body.action==='logout'){const token=req.headers.get('x-owner-session')||'';if(token)await db.from('owner_sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',await hash(token));return reply(req,{ok:true})}
  if(!(await authorizedSession(req)))return reply(req,{ok:false,error:'otp_required'},401);
  const days=Math.min(90,Math.max(1,Number(body.days)||7));const{data,error}=await db.rpc('uon_owner_dashboard_v42',{p_days:days});if(error)throw error;const since=new Date(Date.now()-days*86400000).toISOString();
  const[summaries,groups,ratings,projects,requests,reports,searchRows]=await Promise.all([count('summaries',q=>q.eq('approved',false)),count('whatsapp_groups',q=>q.eq('approved',false)),count('rating_submissions',q=>q.eq('status','pending')),count('student_projects',q=>q.eq('status','pending')),count('course_requests',q=>q.eq('status','pending')),count('content_reports',q=>q.eq('status','pending')),db.from('usage_events').select('metadata').eq('event_type','search').gte('created_at',since).limit(5000)]);
  const searchMap=new Map<string,number>();for(const row of searchRows.data||[]){const value=String(row.metadata?.query||row.metadata?.term||'').trim();if(value)searchMap.set(value,(searchMap.get(value)||0)+1)}
  data.pending_breakdown={ملخصات:summaries,مجموعات:groups,تقييمات:ratings,مشاريع:projects,'طلبات مقررات':requests,بلاغات:reports};data.top_searches=[...searchMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([query,total])=>({query,total}));return reply(req,{ok:true,data});
 }catch(error){return reply(req,{ok:false,error:String((error as Error)?.message||error)},500)}
});
