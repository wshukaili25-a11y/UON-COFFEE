import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'https://www.uonhub.space';
const db=createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-admin-password,x-telegram-bot-api-secret-token'}});
async function telegram(method:string,body:any){
 const result=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const text=await result.text();
 if(!result.ok)throw new Error(text);
 return text?JSON.parse(text):{};
}
const send=(chatId:string,text:string,keyboard?:any[])=>telegram('sendMessage',{chat_id:chatId,text,reply_markup:keyboard?{inline_keyboard:keyboard}:undefined});
const edit=(chatId:string,messageId:number,text:string,keyboard:any[])=>telegram('editMessageText',{chat_id:chatId,message_id:messageId,text,reply_markup:{inline_keyboard:keyboard}});

async function forward(req:Request,payload:any){
 const headers:any={'content-type':'application/json','x-telegram-bot-api-secret-token':req.headers.get('x-telegram-bot-api-secret-token')||SECRET};
 for(const key of ['authorization','apikey','x-admin-password','origin']){const value=req.headers.get(key);if(value)headers[key]=value}
 return fetch(`${SUPABASE_URL}/functions/v1/telegram-admin-full`,{method:'POST',headers,body:JSON.stringify(payload)});
}
async function getAdmin(sender:string){
 const {data,error}=await db.from('telegram_admins').select('id,chat_id,name,role,permissions,active').eq('chat_id',sender).eq('active',true).maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('غير مصرح لك');
 return data;
}
function can(admin:any,permission:string){return admin?.role==='owner'||admin?.role==='admin'||admin?.permissions?.all===true||admin?.permissions?.[permission]===true}
function audit(admin:any,action:string,targetId='',details:any={}){
 db.from('bot_audit_log').insert({admin_chat_id:String(admin?.chat_id||''),admin_name:admin?.name||'',action,target_type:'platform_features',target_id:targetId,details,success:true}).then(()=>{}).catch(()=>{});
}
const statusIcon=(status:string)=>status==='active'?'🟢':status==='maintenance'?'🛠':status==='coming_soon'?'🟡':'🔴';
const statusLabel=(status:string)=>status==='active'?'تشغيل':status==='maintenance'?'صيانة':status==='coming_soon'?'قريبًا':'إيقاف';

async function servicesMenu(chatId:string,messageId:number){
 const {data,error}=await db.from('platform_features').select('key,name,status,is_visible,sort_order').order('sort_order');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.is_visible?'👁':'🙈'} ${statusIcon(item.status)} ${item.name}`,
  callback_data:`service:view:${item.key}`
 }]);
 rows.push([{text:'🔧 صيانة الموقع بالكامل',callback_data:'maintenance:menu'}],[{text:'⬅️ الرئيسية',callback_data:'home'}]);
 await edit(chatId,messageId,'الخدمات وحالاتها\n👁 ظاهرة · 🙈 مخفية',rows);
}
async function serviceView(chatId:string,messageId:number,key:string){
 const {data,error}=await db.from('platform_features').select('key,name,status,is_visible').eq('key',key).single();
 if(error)throw error;
 await edit(chatId,messageId,`${data.name}\nالحالة: ${statusLabel(data.status)}\nالظهور في الموقع: ${data.is_visible?'ظاهر':'مخفي'}`,[
  [{text:'🟢 تشغيل',callback_data:`service:set:${key}:active`},{text:'🔴 إيقاف',callback_data:`service:set:${key}:disabled`}],
  [{text:'🟡 قريبًا',callback_data:`service:set:${key}:coming_soon`},{text:'🛠 صيانة',callback_data:`service:set:${key}:maintenance`}],
  [{text:data.is_visible?'🙈 إخفاء من الموقع':'👁 إظهار في الموقع',callback_data:`sv:${key}:${data.is_visible?'0':'1'}`}],
  [{text:'⬅️ الخدمات',callback_data:'services'}]
 ]);
}
async function setServiceStatus(admin:any,chatId:string,messageId:number,key:string,status:string){
 if(!can(admin,'services'))throw new Error('ليس لديك صلاحية تعديل الخدمات');
 if(!['active','disabled','coming_soon','maintenance'].includes(status))throw new Error('حالة غير صالحة');
 const {error}=await db.from('platform_features').update({status,updated_at:new Date().toISOString()}).eq('key',key);
 if(error)throw error;
 audit(admin,'feature_status_changed',key,{status});
 await serviceView(chatId,messageId,key);
}
async function setServiceVisibility(admin:any,chatId:string,messageId:number,key:string,visible:boolean){
 if(!can(admin,'services'))throw new Error('ليس لديك صلاحية إظهار وإخفاء الخدمات');
 const {error}=await db.from('platform_features').update({is_visible:visible,updated_at:new Date().toISOString()}).eq('key',key);
 if(error)throw error;
 audit(admin,'feature_visibility_changed',key,{is_visible:visible});
 await serviceView(chatId,messageId,key);
}

async function syncCourses(admin:any,chatId:string){
 if(!can(admin,'courses'))throw new Error('ليس لديك صلاحية مزامنة المقررات');
 await send(chatId,'⏳ بدأت مزامنة الخطط الرسمية...\nسأرسل لك النتيجة في رسالة جديدة.');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),25000);
 let result:Response;
 try{
  result=await fetch(`${SUPABASE_URL}/functions/v1/sync-study-plans`,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},body:JSON.stringify({source:'telegram',requested_by:chatId}),signal:controller.signal});
 }finally{clearTimeout(timer)}
 const raw=await result.text();
 let payload:any={};
 try{payload=raw?JSON.parse(raw):{}}catch{payload={error:raw||'استجابة غير صالحة'}}
 if(!result.ok||payload?.ok===false)throw new Error(payload?.error||`فشلت المزامنة (${result.status})`);
 audit(admin,'courses_official_sync','courses',payload);
 await send(chatId,`✅ اكتملت مزامنة الخطط الرسمية\n\n📄 الصفحات المفحوصة: ${payload.pages||0}\n📎 الملفات المكتشفة: ${payload.documents||0}\n🧾 الصفوف المستخرجة: ${payload.parsedRows||0}\n➕ الجديدة: ${payload.inserted||0}\n✏️ المحدثة: ${payload.updated||0}\n♻️ المتجاهلة: ${payload.duplicates||0}\n⚠️ أخطاء القراءة: ${payload.failed||0}\n⚠️ أخطاء الحفظ: ${payload.writeErrors||0}`,[ [{text:'📚 عرض المواد',callback_data:'course:list:0'}],[{text:'⬅️ مركز المقررات',callback_data:'courses:menu'}] ]);
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-admin-password,x-telegram-bot-api-secret-token'}});
 let payload:any;
 try{payload=await req.json()}catch{return json({ok:false,error:'invalid_json'},400)}
 const callback=payload?.callback_query;
 const data=String(callback?.data||'');
 const intercepted=data==='services'||data.startsWith('service:view:')||data.startsWith('service:set:')||data.startsWith('sv:')||data==='course:sync:official';
 if(!intercepted)return forward(req,payload);
 if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return json({ok:false,error:'unauthorized'},401);
 const chatId=String(callback?.message?.chat?.id||'');
 const sender=String(callback?.from?.id||'');
 const messageId=Number(callback?.message?.message_id||0);
 try{await telegram('answerCallbackQuery',{callback_query_id:callback.id})}catch{}
 try{
  const admin=await getAdmin(sender);
  if(data==='services')await servicesMenu(chatId,messageId);
  else if(data.startsWith('service:view:'))await serviceView(chatId,messageId,data.split(':').slice(2).join(':'));
  else if(data.startsWith('service:set:')){
   const parts=data.split(':');
   await setServiceStatus(admin,chatId,messageId,parts[2],parts[3]);
  }else if(data.startsWith('sv:')){
   const parts=data.split(':');
   await setServiceVisibility(admin,chatId,messageId,parts[1],parts[2]==='1');
  }else if(data==='course:sync:official')await syncCourses(admin,chatId);
  return json({ok:true});
 }catch(error){
  const message=String((error as Error)?.message||error);
  await send(chatId,`❌ تعذر تنفيذ العملية\n${message.slice(0,800)}`).catch(()=>{});
  return json({ok:true,error:message});
 }
});
