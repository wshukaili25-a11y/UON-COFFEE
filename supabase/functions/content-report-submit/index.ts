import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SITE_URL=Deno.env.get('SITE_URL')||'https://uonhub.space';
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const REASONS=new Set(['incorrect','broken_link','duplicate','outdated','inappropriate','privacy','missing','other']);
const PRIORITIES=new Set(['low','normal','high','urgent']);
const LABELS:Record<string,string>={incorrect:'معلومة خاطئة',broken_link:'رابط لا يعمل',duplicate:'محتوى مكرر',outdated:'محتوى قديم',inappropriate:'محتوى غير مناسب',privacy:'بيانات شخصية',missing:'محتوى ناقص',other:'أخرى'};
const ALLOWED=new Set(['https://uonhub.space','https://www.uonhub.space','https://uon-hub.vercel.app']);
function originAllowed(origin:string){if(!origin)return false;if(ALLOWED.has(origin))return true;try{const host=new URL(origin).hostname.toLowerCase();return host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.includes('uon-hub'))}catch{return false}}
function cors(req:Request){const origin=req.headers.get('origin')||'';return{'Access-Control-Allow-Origin':originAllowed(origin)?origin:'https://uonhub.space','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'86400',Vary:'Origin'}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8'}})}
function clean(value:unknown,max:number){return String(value??'').trim().slice(0,max)}
function safePageUrl(value:unknown,origin:string){const u=new URL(clean(value,1500));if(!['http:','https:'].includes(u.protocol))throw new Error('invalid_page_url');if(originAllowed(origin)&&u.origin!==origin)throw new Error('page_origin_mismatch');return u.toString()}
async function digest(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function sendTelegram(chatId:string,text:string,pageUrl:string){const res=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_markup:{inline_keyboard:[[{text:'🔗 فتح الصفحة',url:pageUrl}],[{text:'🛡 فتح لوحة البلاغات',url:`${SITE_URL}/admin.html#content-reports`}]]}}),signal:AbortSignal.timeout(6000)});return res.ok}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 const origin=req.headers.get('origin')||'';if(!originAllowed(origin))return reply(req,{ok:false,error:'origin_not_allowed'},403);
 try{
  const body=await req.json().catch(()=>({}));if(body?.dry_run===true)return reply(req,{ok:true,dry_run:true});
  const reason=clean(body.reason,40),priority=clean(body.priority,20)||'normal',details=clean(body.details,1200),contentTitle=clean(body.content_title,180)||null,pageTitle=clean(body.page_title,220)||null,contact=clean(body.contact,160)||null,courseCode=clean(body.course_code,20).toUpperCase()||null,sourceTable=clean(body.source_table,80)||null,sourceId=clean(body.source_id,120)||null,sourceUrl=clean(body.source_url,1500)||null,sessionId=clean(body.session_id,60)||null;
  if(!REASONS.has(reason))throw new Error('invalid_reason');if(!PRIORITIES.has(priority))throw new Error('invalid_priority');if(details.length<5)throw new Error('details_too_short');
  const pageUrl=safePageUrl(body.page_url,origin);const duplicateKey=await digest([reason,pageUrl,sourceTable,sourceId,details.toLowerCase()].join('|'));
  const cutoff=new Date(Date.now()-120000).toISOString();const{data:duplicate}=await db.from('content_reports').select('id').eq('duplicate_key',duplicateKey).gte('created_at',cutoff).maybeSingle();if(duplicate)return reply(req,{ok:true,id:duplicate.id,duplicate:true});
  const clientContext={user_agent:clean(req.headers.get('user-agent'),400),language:clean(body.language,10),viewport:clean(body.viewport,40),online:body.online!==false,session_id:sessionId};
  const{data:row,error}=await db.from('content_reports').insert({reason,priority,content_title:contentTitle,details,page_url:pageUrl,page_title:pageTitle,status:'pending',contact,course_code:courseCode,source_table:sourceTable,source_id:sourceId,source_url:sourceUrl,report_type:reason,client_context:clientContext,duplicate_key:duplicateKey,session_id:/^[0-9a-f-]{36}$/i.test(sessionId||'')?sessionId:null}).select('id,created_at').single();if(error)throw error;
  const{data:admins}=await db.from('telegram_admins').select('chat_id').eq('active',true).eq('notifications_enabled',true);const icon=priority==='urgent'?'🆘':priority==='high'?'🚨':'⚠️';const message=`${icon} بلاغ محتوى جديد\n\nالأولوية: ${priority}\nالسبب: ${LABELS[reason]}\nالعنوان: ${contentTitle||pageTitle||'بدون عنوان'}${courseCode?`\nالمقرر: ${courseCode}`:''}\nالتفاصيل: ${details}\nالصفحة: ${pageUrl}`;let sent=0;for(const admin of admins||[])if(await sendTelegram(String(admin.chat_id),message,pageUrl).catch(()=>false))sent++;
  return reply(req,{ok:true,id:row.id,sent});
 }catch(error){const message=String((error as Error)?.message||error);return reply(req,{ok:false,error:message},/invalid|too_short|mismatch/i.test(message)?400:500)}
});
