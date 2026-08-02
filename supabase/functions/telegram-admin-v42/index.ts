import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'https://uonhub.space';
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const SELF=`${SUPABASE_URL}/functions/v1/telegram-admin-v42`;
const LEGACY=`${SUPABASE_URL}/functions/v1/telegram-admin`;
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function cors(req:Request){
 const value=req.headers.get('origin')||'';
 try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}
 return 'https://www.uonhub.space';
}
function responseHeaders(req:Request){return{'content-type':'application/json','Access-Control-Allow-Origin':cors(req),'Access-Control-Allow-Headers':'content-type,x-admin-password,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:responseHeaders(req)})}
async function tg(method:string,body:any){const response=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw new Error(data.description||`Telegram ${response.status}`);return data}
async function authorizedPassword(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return false;const{data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return !error&&data===true}
async function getAdmin(chatId:string){const{data}=await db.from('telegram_admins').select('chat_id,name,role,permissions,active').eq('chat_id',chatId).eq('active',true).maybeSingle();return data}
function menu(){return[[{text:'📊 لوحة المالك',callback_data:'v42:dashboard'}],[{text:'🕓 الطلبات والبلاغات',callback_data:'v42:pending'}],[{text:'🛠 حالة الخدمات',callback_data:'v42:services'}],[{text:'📘 مركز المقررات والبحث',callback_data:'v42:courses'}],[{text:'📤 الرفع والاستيراد',callback_data:'v42:uploads'}],[{text:'🤖 إدارة UON AI',callback_data:'ai:menu'}],[{text:'🗂 إدارة المحتوى',callback_data:'manage:menu'}],[{text:'💾 النسخ والصلاحيات',callback_data:'backup:menu'}],[{text:'🌐 لوحة الإدارة',url:`${SITE}/admin.html`},{text:'📈 Dashboard',url:`${SITE}/owner-dashboard.html`}]]}
async function sendHome(chatId:string,messageId?:number){const body:any={chat_id:chatId,text:'لوحة إدارة UON Hub V42\n\nتم ترتيب الأقسام وربط مركز المقررات والبحث والرفع والبلاغات الجديدة.',reply_markup:{inline_keyboard:menu()}};if(messageId){body.message_id=messageId;delete body.chat_id;body.chat_id=chatId;return tg('editMessageText',body)}return tg('sendMessage',body)}
async function dashboard(chatId:string,messageId:number){const{data,error}=await db.rpc('uon_owner_dashboard_v42',{p_days:7});if(error)throw error;const t=data?.totals||{},p=data?.period||{};const text=`📊 لوحة المالك — آخر 7 أيام\n\n👁 الأحداث: ${p.events||0}\n👤 الجلسات: ${p.sessions||0}\n📘 المقررات: ${t.courses||0}\n📚 الملخصات: ${t.summaries||0}\n💬 المجموعات: ${t.groups||0}\n🚨 البلاغات المعلقة: ${t.pending_reports||0}`;return tg('editMessageText',{chat_id:chatId,message_id:messageId,text,reply_markup:{inline_keyboard:[[{text:'🔄 تحديث',callback_data:'v42:dashboard'}],[{text:'📈 فتح Dashboard',url:`${SITE}/owner-dashboard.html`}],[{text:'⬅️ الرئيسية',callback_data:'v42:home'}]]}})}
async function pending(chatId:string,messageId:number){const count=async(table:string,column:string,value:any)=>{const{count}=await db.from(table).select('*',{head:true,count:'exact'}).eq(column,value);return count||0};const[s,g,r,p,c,x]=await Promise.all([count('summaries','approved',false),count('whatsapp_groups','approved',false),count('rating_submissions','status','pending'),count('student_projects','status','pending'),count('course_requests','status','pending'),count('content_reports','status','pending')]);const text=`🕓 الطلبات والبلاغات\n\n📚 ملخصات: ${s}\n💬 مجموعات: ${g}\n⭐ تقييمات: ${r}\n💡 مشاريع: ${p}\n📘 طلبات مقررات: ${c}\n🚨 بلاغات: ${x}`;return tg('editMessageText',{chat_id:chatId,message_id:messageId,text,reply_markup:{inline_keyboard:[[{text:'فتح مركز المراجعة القديم',callback_data:'pending:menu'}],[{text:'🚨 البلاغات',callback_data:'p:list:x:0'}],[{text:'⬅️ الرئيسية',callback_data:'v42:home'}]]}})}
async function services(chatId:string,messageId:number){const{data}=await db.from('platform_features').select('key,name,status,is_visible').order('sort_order');const lines=(data||[]).map((x:any)=>`${x.is_visible===false?'🙈':x.status==='active'?'✅':'⚠️'} ${x.name||x.key} — ${x.is_visible===false?'مخفي':x.status}`).join('\n');return tg('editMessageText',{chat_id:chatId,message_id:messageId,text:`🛠 حالة الخدمات\n\n${lines||'لا توجد بيانات'}`,reply_markup:{inline_keyboard:[[{text:'إدارة التشغيل والإخفاء',callback_data:'services'}],[{text:'⬅️ الرئيسية',callback_data:'v42:home'}]]}})}
async function courses(chatId:string,messageId:number){return tg('editMessageText',{chat_id:chatId,message_id:messageId,text:'📘 مركز المقررات والبحث\n\nالوصول السريع للمقررات، البحث العالمي، والملفات المرتبطة بكل مادة.',reply_markup:{inline_keyboard:[[{text:'📘 المقررات',url:`${SITE}/courses.html`},{text:'🔎 البحث العالمي',url:`${SITE}/search.html`}],[{text:'🧭 إدارة المقررات',callback_data:'courses:menu'}],[{text:'⬅️ الرئيسية',callback_data:'v42:home'}]]}})}
async function uploads(chatId:string,messageId:number){return tg('editMessageText',{chat_id:chatId,message_id:messageId,text:'📤 الرفع والاستيراد\n\nرفع PDF احترافي، استيراد Drive وTelegram، وجميع الملفات تدخل للمراجعة قبل النشر.',reply_markup:{inline_keyboard:[[{text:'📤 رفع ملف دراسي',url:`${SITE}/upload-summary.html`}],[{text:'🗂 إدارة المحتوى',callback_data:'manage:menu'}],[{text:'⬅️ الرئيسية',callback_data:'v42:home'}]]}})}
async function forward(req:Request,body:any){return fetch(LEGACY,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':SECRET,Authorization:`Bearer ${SERVICE_ROLE_KEY}`},body:JSON.stringify(body)})}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:responseHeaders(req)});
 const body=await req.json().catch(()=>({}));
 if(body.action==='activate'||body.action==='rollback'){
  if(!(await authorizedPassword(req)))return json(req,{ok:false,error:'unauthorized'},401);
  try{const url=body.action==='activate'?SELF:LEGACY;const result=await tg('setWebhook',{url,secret_token:SECRET,drop_pending_updates:false,allowed_updates:['message','callback_query']});return json(req,{ok:true,action:body.action,url,result})}
  catch(error){return json(req,{ok:false,error:String((error as Error)?.message||error)},500)}
 }
 if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return json(req,{ok:false,error:'forbidden'},403);
 const chatId=String(body.message?.chat?.id||body.callback_query?.message?.chat?.id||'');if(!chatId)return json(req,{ok:true});const admin=await getAdmin(chatId);if(!admin)return json(req,{ok:true});
 const callback=String(body.callback_query?.data||'');const messageId=Number(body.callback_query?.message?.message_id||0);
 try{
  if(body.callback_query)await tg('answerCallbackQuery',{callback_query_id:body.callback_query.id}).catch(()=>{});
  if(body.message?.text==='/start'||body.message?.text==='/menu'||callback==='v42:home'){await sendHome(chatId,messageId||undefined);return json(req,{ok:true})}
  if(callback==='v42:dashboard'){await dashboard(chatId,messageId);return json(req,{ok:true})}
  if(callback==='v42:pending'){await pending(chatId,messageId);return json(req,{ok:true})}
  if(callback==='v42:services'){await services(chatId,messageId);return json(req,{ok:true})}
  if(callback==='v42:courses'){await courses(chatId,messageId);return json(req,{ok:true})}
  if(callback==='v42:uploads'){await uploads(chatId,messageId);return json(req,{ok:true})}
  return await forward(req,body);
 }catch(error){await tg('sendMessage',{chat_id:chatId,text:`تعذر تنفيذ العملية: ${String((error as Error)?.message||error).slice(0,300)}`}).catch(()=>{});return json(req,{ok:false,error:String((error as Error)?.message||error)},500)}
});
