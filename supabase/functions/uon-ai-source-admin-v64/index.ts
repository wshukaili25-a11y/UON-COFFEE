import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno:any;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLIC_KEY=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const GOOGLE_MAPS_API_KEY=Deno.env.get('GOOGLE_MAPS_API_KEY')||'';
const CONNECTOR_SECRET=Deno.env.get('UON_AI_CONNECTOR_SECRET')||'';
const GOOGLE_OAUTH_CLIENT_ID=Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')||'';
const GOOGLE_OAUTH_CLIENT_SECRET=Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')||'';
const GOOGLE_SERVICE_ACCOUNT_JSON=Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')||'';
const GEMINI_API_KEY=Deno.env.get('GEMINI_API_KEY')||'';
const GEMINI_PRIMARY_MODEL=Deno.env.get('GEMINI_PRIMARY_MODEL')||'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODEL=Deno.env.get('GEMINI_FALLBACK_MODEL')||'gemini-3.1-flash-lite';
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const SYNC_URL=`${SUPABASE_URL}/functions/v1/uon-ai-source-sync-v64`;
const CHAT_URL=`${SUPABASE_URL}/functions/v1/uon-ai-chat-v64`;
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function origin(req:Request){const v=req.headers.get('origin')||'';try{const h=new URL(v).hostname;if(allowed.has(v)||(h.endsWith('.vercel.app')&&(h.startsWith('uon-')||h.startsWith('uon-hub-'))))return v}catch{}return'https://uonhub.space'}
function headers(req:Request){return{'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,x-admin-password','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin'}}
function out(req:Request,b:any,s=200){return new Response(JSON.stringify(b),{status:s,headers:headers(req)})}
const clean=(v:any,n=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
async function admin(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return{ok:false,password};const{data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return{ok:!error&&data===true,password}}
const PROVIDERS=new Set(['university_page','google_drive','google_calendar_public']);
async function googleAuthReady(){try{const r=await fetch(`${SUPABASE_URL}/auth/v1/settings`,{headers:PUBLIC_KEY?{apikey:PUBLIC_KEY}:{},signal:AbortSignal.timeout(5000)});const data=await r.json().catch(()=>({}));return r.ok&&data?.external?.google===true}catch{return false}}
async function geminiRuntime(){if(!GEMINI_API_KEY)return null;try{const r=await fetch(CHAT_URL,{method:'POST',headers:{'content-type':'application/json',...(PUBLIC_KEY?{apikey:PUBLIC_KEY,Authorization:`Bearer ${PUBLIC_KEY}`}:{})},body:JSON.stringify({action:'gemini-health'}),signal:AbortSignal.timeout(9000)});const data=await r.json().catch(()=>({}));return r.ok?data:null}catch{return null}}
async function healthData(){const [googleAuth,gemini,chunks,activeChunks,hiddenParents]=await Promise.all([
 googleAuthReady(),
 geminiRuntime(),
 db.from('uon_ai_knowledge').select('*',{count:'exact',head:true}).eq('source_provider','university_page').contains('metadata',{derived_chunk:true}),
 db.from('uon_ai_knowledge').select('*',{count:'exact',head:true}).eq('source_provider','university_page').eq('active',true).contains('metadata',{derived_chunk:true}),
 db.from('uon_ai_knowledge').select('*',{count:'exact',head:true}).eq('source_provider','university_page').eq('active',false).contains('metadata',{chunked:true})
]);return{
 google_auth_enabled:googleAuth,
 google_maps_live_configured:Boolean(GOOGLE_MAPS_API_KEY&&CONNECTOR_SECRET),
 google_oauth_refresh_configured:Boolean(GOOGLE_OAUTH_CLIENT_ID&&GOOGLE_OAUTH_CLIENT_SECRET),
 google_drive_service_account_configured:Boolean(GOOGLE_SERVICE_ACCOUNT_JSON),
 gemini_api_configured:gemini?.configured??Boolean(GEMINI_API_KEY),
 gemini_runtime_ready:Boolean(gemini?.configured&&gemini?.selected),
 gemini_primary_model:gemini?.selected||GEMINI_PRIMARY_MODEL,
 gemini_fallback_model:gemini?.fallback||GEMINI_FALLBACK_MODEL,
 gemini_preferred_model:gemini?.preferred||'',
 gemini_preferred_available:Boolean(gemini?.preferred_available),
 gemini_available_count:Number(gemini?.available_count||0),
 gemini_discovery:clean(gemini?.discovery,80)||'not_checked',
 gemini_quarantined:Array.isArray(gemini?.quarantined)?gemini.quarantined.slice(0,8):[],
 university_chunks:Number(chunks.count||0),
 active_university_chunks:Number(activeChunks.count||0),
 hidden_university_parents:Number(hiddenParents.count||0)
}}
async function listData(){const[{data:sources},{data:runs},{data:pending},{count:pendingCount},health]=await Promise.all([
 db.from('import_sources').select('*').order('provider').order('source_name'),
 db.from('uon_ai_source_sync_runs').select('*').order('started_at',{ascending:false}).limit(40),
 db.from('uon_ai_knowledge').select('id,title,category,source_url,source_title,source_provider,source_external_id,confidence,fetched_at,updated_at,metadata').eq('verification_status','pending').order('updated_at',{ascending:false}).limit(80),
 db.from('uon_ai_knowledge').select('*',{count:'exact',head:true}).eq('verification_status','pending'),
 healthData()
]);return{sources:sources||[],runs:runs||[],pending:pending||[],pending_count:pendingCount||0,health}}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});if(req.method!=='POST')return out(req,{error:'method_not_allowed'},405);const auth=await admin(req);if(!auth.ok)return out(req,{error:'unauthorized'},401);try{const b=await req.json().catch(()=>({})),action=clean(b.action,50)||'list';
 if(action==='list')return out(req,{ok:true,...await listData()});
 if(action==='save-source'){const provider=clean(b.provider,80);if(!PROVIDERS.has(provider))return out(req,{error:'invalid_provider'},400);const sourceId=clean(b.source_id,240),sourceName=clean(b.source_name,240),sourceUrl=clean(b.source_url,1000);if(!sourceId||!sourceName)return out(req,{error:'source_id_and_name_required'},400);const payload={provider,source_id:sourceId,source_name:sourceName,source_url:sourceUrl||null,source_type:clean(b.source_type,80)||'external',active:b.active!==false,trust_level:Math.max(0,Math.min(100,Number(b.trust_level)||70)),refresh_minutes:Math.max(15,Math.min(43200,Number(b.refresh_minutes)||1440)),allow_auto_publish:Boolean(b.allow_auto_publish),settings:typeof b.settings==='object'&&b.settings?b.settings:{},next_sync_at:new Date().toISOString(),updated_at:new Date().toISOString()};const{data,error}=await db.from('import_sources').upsert(payload,{onConflict:'provider,source_id'}).select().single();if(error)throw error;return out(req,{ok:true,source:data})}
 if(action==='toggle-source'){const id=clean(b.id,100);const{data,error}=await db.from('import_sources').update({active:Boolean(b.active),updated_at:new Date().toISOString(),next_sync_at:b.active?new Date().toISOString():null}).eq('id',id).select().single();if(error)throw error;return out(req,{ok:true,source:data})}
 if(action==='review'){const id=clean(b.id,100),decision=b.decision==='approve'?'approved':'rejected';const patch=decision==='approved'?{verification_status:'approved',active:true,last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}:{verification_status:'rejected',active:false,last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()};const{data,error}=await db.from('uon_ai_knowledge').update(patch).eq('id',id).select('id,title,verification_status,active').single();if(error)throw error;return out(req,{ok:true,item:data})}
 if(action==='sync'){const body:any={action:b.source_id?'sync-source':'sync-due',limit:Math.max(1,Math.min(8,Number(b.limit)||4))};if(b.source_id)body.source_id=clean(b.source_id,100);const r=await fetch(SYNC_URL,{method:'POST',headers:{'content-type':'application/json','x-admin-password':auth.password},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});const text=await r.text();let data:any={};try{data=JSON.parse(text)}catch{}return out(req,{ok:r.ok,sync:data},r.ok?200:400)}
 return out(req,{error:'unknown_action'},400)
 }catch(e){console.error('uon-ai-source-admin-v64',e);return out(req,{error:clean((e as Error)?.message||e,900)},400)}});