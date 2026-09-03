import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=(Deno.env.get('SITE_URL')||'https://uonhub.space').replace(/\/$/,'');
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const allowedOrigins=new Set(['https://uonhub.space','https://www.uonhub.space']);
function cors(req:Request){const value=req.headers.get('origin')||'';try{const host=new URL(value).hostname;if(allowedOrigins.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}return'https://uonhub.space'}
function headers(req:Request){return{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':cors(req),'Access-Control-Allow-Headers':'content-type,x-admin-password,authorization,apikey,x-telegram-bot-api-secret-token','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'}}
const out=(req:Request,body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(req)});
async function tg(method:string,body:any){const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{data={description:text}}if(!r.ok||data?.ok===false){const message=String(data?.description||text||`Telegram ${r.status}`);if(method==='editMessageText'&&message.toLowerCase().includes('message is not modified'))return{ok:true,unchanged:true};throw new Error(message)}return data}
async function getAdmin(sender:string){if(!sender)return null;const{data}=await db.from('telegram_admins').select('chat_id,name,role,permissions,active').eq('chat_id',sender).eq('active',true).maybeSingle();return data}
async function authorizedPassword(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return false;const{data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return !error&&data===true}

function homeKeyboard(){return[
 [{text:'📊 لوحة المالك',callback_data:'v42:dashboard'}],
 [{text:'🕓 المراجعة',callback_data:'v42:pending'},{text:'🗂 المحتوى',callback_data:'manage:menu'}],
 [{text:'🛠 الأدوات والخدمات',callback_data:'services'},{text:'🔧 صيانة الموقع',callback_data:'maintenance:menu'}],
 [{text:'📘 المقررات',callback_data:'v42:courses'},{text:'🤖 UON AI',callback_data:'v42:aihandoffs'}],
 [{text:'📤 الرفع والاستيراد',callback_data:'v42:uploads'},{text:'☎️ أرقام التواصل',callback_data:'contacts'}],
 [{text:'⚙️ الإعدادات',callback_data:'settings:menu'},{text:'💾 النسخ والصلاحيات',callback_data:'backup:menu'}],
 [{text:'🌐 لوحة الإدارة',url:`${SITE}/admin.html`},{text:'📈 Dashboard',url:`${SITE}/owner-dashboard.html`}]
]}
async function home(chatId:string,messageId=0,name=''){const text=`لوحة إدارة UON Hub${name?`\nمرحبًا ${name} 👋`:''}\n\nاختر القسم المطلوب. الإدارة مرتبة الآن بمسار واحد لكل وظيفة.`;const body:any={chat_id:chatId,text,disable_web_page_preview:true,reply_markup:{inline_keyboard:homeKeyboard()}};if(messageId){body.message_id=messageId;return tg('editMessageText',body)}return tg('sendMessage',body)}
async function help(chatId:string){return tg('sendMessage',{chat_id:chatId,text:'أوامر الإدارة السريعة:\n/menu — القائمة الرئيسية\n/ping — فحص البوت\n/diagnostics — تشخيص الطلبات\n/contacts — إدارة أرقام التواصل\n/groupsreview — مراجعة مجموعات واتساب\n\nباقي الإدارة من الأزرار المرتبة في /menu.',reply_markup:{inline_keyboard:[[{text:'🏠 القائمة الرئيسية',callback_data:'v42:home'}]]}})}

async function forward(req:Request,slug:string,body:any){const h:any={'content-type':'application/json','x-telegram-bot-api-secret-token':SECRET,Authorization:`Bearer ${SERVICE_ROLE_KEY}`};for(const key of ['origin','apikey','x-admin-password']){const value=req.headers.get(key);if(value)h[key]=value}const r=await fetch(`${SUPABASE_URL}/functions/v1/${slug}`,{method:'POST',headers:h,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});return new Response(await r.text(),{status:r.status,headers:headers(req)})}

async function conversationTarget(chatId:string){if(!chatId)return'';const{data}=await db.from('telegram_conversations').select('state').eq('chat_id',chatId).maybeSingle();const state=String(data?.state||'');if(state.startsWith('t44_'))return'telegram-admin-full';if(state.startsWith('cn_'))return'telegram-admin';return''}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return out(req,{ok:false,error:'method_not_allowed'},405);
 const contentLength=Number(req.headers.get('content-length')||0);if(contentLength>256000)return out(req,{ok:false,error:'payload_too_large'},413);
 const body=await req.json().catch(()=>null);if(!body)return out(req,{ok:false,error:'invalid_json'},400);

 if(body.action==='activate'||body.action==='rollback'){
  if(!(await authorizedPassword(req)))return out(req,{ok:false,error:'unauthorized'},401);
  const url=body.action==='activate'?`${SUPABASE_URL}/functions/v1/telegram-admin-v42`:`${SUPABASE_URL}/functions/v1/telegram-admin`;
  try{const result=await tg('setWebhook',{url,secret_token:SECRET,drop_pending_updates:false,allowed_updates:['message','callback_query']});return out(req,{ok:true,action:body.action,url,result})}catch(error){return out(req,{ok:false,error:String((error as Error)?.message||error)},500)}
 }

 if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return out(req,{ok:false,error:'forbidden'},403);
 const callback=body.callback_query;
 const message=body.message;
 const data=String(callback?.data||'');
 const text=String(message?.text||'').trim();
 const sender=String(callback?.from?.id||message?.from?.id||'');
 const chatId=String(callback?.message?.chat?.id||message?.chat?.id||'');
 const messageId=Number(callback?.message?.message_id||0);
 if(!chatId||!sender)return out(req,{ok:true,ignored:true});

 if(text==='/start'||text==='/menu'||data==='v42:home'||data==='home'){
  const admin=await getAdmin(sender);if(!admin)return out(req,{ok:true,ignored:true});
  if(callback)await tg('answerCallbackQuery',{callback_query_id:callback.id}).catch(()=>{});
  try{await home(chatId,messageId,admin.name||'');return out(req,{ok:true,handled:'home'})}catch(error){return out(req,{ok:false,error:String((error as Error)?.message||error)},500)}
 }
 if(text==='/help'){
  const admin=await getAdmin(sender);if(!admin)return out(req,{ok:true,ignored:true});
  try{await help(chatId);return out(req,{ok:true,handled:'help'})}catch(error){return out(req,{ok:false,error:String((error as Error)?.message||error)},500)}
 }

 if(data.startsWith('v42:')||/^\/(?:aireply|contactadd|contactedit|contactdelete)\b/i.test(text))return forward(req,'telegram-admin-modern',body);

 const contactOrGroup=text==='/contacts'||text==='/groupsreview'||text==='📞 أرقام التواصل'||text==='💬 مراجعة المجموعات'||data==='contacts'||data==='groupsreview'||data.startsWith('cn:')||data.startsWith('gr:');
 if(contactOrGroup)return forward(req,'telegram-admin',body);

 if(data==='services'||data.startsWith('t44:')||data==='course:sync:official')return forward(req,'telegram-admin-full',body);

 if(message?.text){const target=await conversationTarget(chatId);if(target)return forward(req,target,body)}

 return forward(req,'telegram-admin-core',body);
});
