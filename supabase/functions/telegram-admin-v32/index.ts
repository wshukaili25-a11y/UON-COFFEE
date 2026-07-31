import {SECRET,KEY,SUPABASE_URL,json,forward,getAdmin,getConv,clearConv,canCourses,ack,send,audit,db,edit} from './lib.ts';
import {textFlow,callbackFlow} from './course-flow.ts';
declare const Deno:any;

const canFeatures=(admin:any)=>!!admin&&(admin.role==='owner'||admin.role==='admin'||admin.permissions?.all===true||admin.permissions?.features===true);
const statusIcon=(status:string)=>status==='active'?'🟢':status==='maintenance'?'🛠':status==='coming_soon'?'🟡':'🔴';
const statusLabel=(status:string)=>status==='active'?'مُشغلة':status==='maintenance'?'صيانة':status==='coming_soon'?'قريبًا':'متوقفة';

async function featureServicesMenu(chatId:string,messageId:number){
 const {data,error}=await db.from('platform_features').select('key,name,status,is_visible,sort_order').order('sort_order').order('key');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.is_visible===false?'🙈':'👁'} ${statusIcon(item.status)} ${item.name}`,
  callback_data:`service:view:${item.key}`
 }]);
 rows.push(
  [{text:'🔧 صيانة الموقع بالكامل',callback_data:'maintenance:menu'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 );
 await edit(chatId,messageId,'الخدمات وحالاتها\n\n👁 ظاهرة في الموقع · 🙈 مخفية من الموقع',rows);
}

async function featureServiceView(chatId:string,messageId:number,key:string){
 const {data,error}=await db.from('platform_features').select('key,name,status,is_visible').eq('key',key).single();
 if(error)throw error;
 await edit(chatId,messageId,`${data.name}\n\nحالة التشغيل: ${statusLabel(data.status)}\nالظهور في الموقع: ${data.is_visible===false?'مخفية 🙈':'ظاهرة 👁'}`, [
  [{text:'🟢 تشغيل',callback_data:`service:set:${key}:active`},{text:'🔴 إيقاف',callback_data:`service:set:${key}:disabled`}],
  [{text:'🟡 قريبًا',callback_data:`service:set:${key}:coming_soon`},{text:'🛠 صيانة',callback_data:`service:set:${key}:maintenance`}],
  [{text:'👁 إظهار في الموقع',callback_data:`service:visible:${key}:1`},{text:'🙈 إخفاء من الموقع',callback_data:`service:visible:${key}:0`}],
  [{text:'⬅️ الخدمات',callback_data:'services'}]
 ]);
}

async function recordFeatureAudit(admin:any,action:string,key:string,details:any){
 await db.from('bot_audit_log').insert({
  admin_chat_id:String(admin?.chat_id||''),admin_name:admin?.name||'',action,
  target_type:'platform_feature',target_id:key,details,success:true
 });
}

Deno.serve(async(req:Request)=>{
 try{
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return json({ok:false,error:'unauthorized'},401);

  const raw=await req.text();
  let update:any;
  try{update=JSON.parse(raw)}catch{return json({ok:false,error:'invalid_json'},400)}

  const callback=update.callback_query;
  const message=update.message;
  const chatId=String(callback?.message?.chat?.id||message?.chat?.id||'');
  const senderId=String(callback?.from?.id||message?.from?.id||'');
  if(!chatId||!senderId)return forward(raw,req);

  const admin=await getAdmin(senderId);
  if(!admin)return json({ok:true});

  if(message){
   const conv=await getConv(chatId);
   const text=String(message.text||'').trim();
   const command=['/start','/menu','/cancel'].includes(text.split('@')[0]);
   if(conv?.state?.startsWith('v32_course_')&&command){
    await clearConv(chatId);
    return forward(raw,req);
   }
   if(conv?.state?.startsWith('v32_course_')){
    if(!canCourses(admin)){await clearConv(chatId);return json({ok:true})}
    if(!text){await send(chatId,'أرسل قيمة نصية لإكمال العملية.');return json({ok:true})}
    await textFlow(chatId,admin,text,conv);
    return json({ok:true});
   }
   return forward(raw,req);
  }

  if(callback){
   const data=String(callback.data||'');
   const conv=await getConv(chatId);
   if(data==='courses:menu'&&conv?.state?.startsWith('v32_course_')){
    await clearConv(chatId);
    return forward(raw,req);
   }

   const featureIntercept=data==='services'||data.startsWith('service:view:')||data.startsWith('service:set:')||data.startsWith('service:visible:');
   if(featureIntercept){
    await ack(callback.id);
    if(!canFeatures(admin)){
     await ack(callback.id,'ليس لديك صلاحية إدارة الخدمات',true);
     return json({ok:true});
    }
    try{
     if(data==='services')await featureServicesMenu(chatId,callback.message.message_id);
     else if(data.startsWith('service:view:'))await featureServiceView(chatId,callback.message.message_id,data.slice('service:view:'.length));
     else if(data.startsWith('service:set:')){
      const parts=data.split(':');
      const key=parts[2],status=parts[3];
      const {error}=await db.rpc('uon_set_feature_state',{p_key:key,p_status:status});
      if(error)throw error;
      await recordFeatureAudit(admin,'feature_status_changed',key,{status});
      await featureServiceView(chatId,callback.message.message_id,key);
     }else if(data.startsWith('service:visible:')){
      const parts=data.split(':');
      const key=parts[2],visible=parts[3]==='1';
      const {error}=await db.rpc('uon_set_feature_visibility',{p_key:key,p_visible:visible});
      if(error)throw error;
      await recordFeatureAudit(admin,visible?'feature_shown':'feature_hidden',key,{visible});
      await featureServiceView(chatId,callback.message.message_id,key);
     }
    }catch(error){
     const message=String((error as Error).message||error).slice(0,180);
     await ack(callback.id,message,true);
     try{await send(chatId,`تعذر إكمال العملية: ${message}`)}catch{}
    }
    return json({ok:true});
   }

   const intercept=data==='course:add:start'||data==='course:sync:official'||data.startsWith('course:view:')||data.startsWith('course:deleteask:')||data.startsWith('v32c:');
   if(!intercept)return forward(raw,req);
   await ack(callback.id);
   if(!canCourses(admin)){await clearConv(chatId);return json({ok:true})}
   try{
    if(data==='course:sync:official'){
     if(admin.role!=='owner'){
      await ack(callback.id,'فحص الخطط الرسمية للمالك فقط',true);
      return json({ok:true});
     }
     const result=await fetch(`${SUPABASE_URL}/functions/v1/sync-study-plans`,{
      method:'POST',
      headers:{authorization:`Bearer ${KEY}`,'content-type':'application/json'},
      body:JSON.stringify({source:'telegram-v32-review',requested_by:chatId}),
      signal:AbortSignal.timeout(45000)
     });
     const payload=await result.json().catch(()=>({}));
     if(!result.ok||payload.ok===false)throw new Error(payload.error||'فشل فحص الخطط الرسمية');
     audit(admin,'official_plan_discovery','',{
      pages:payload.pages||0,
      discovered:payload.discovered||0,
      modern_documents:payload.modern_documents||0,
      read_only:true
     });
     await send(chatId,`تم فحص روابط الخطط الرسمية ✅\n\nالصفحات المفحوصة: ${payload.pages||0}\nالروابط المكتشفة: ${payload.discovered||0}\nالخطط الحديثة: ${payload.modern_documents||0}\n\n🔒 الفحص للقراءة فقط، ولا يتم إضافة أو تعديل أي مقرر قبل المراجعة.`,[[{text:'⬅️ مركز المقررات',callback_data:'courses:menu'}]]);
     return json({ok:true});
    }
    await callbackFlow(chatId,callback.message.message_id,admin,data);
   }catch(error){
    const message=String((error as Error).message||error).slice(0,180);
    await ack(callback.id,message,true);
    try{await send(chatId,`تعذر إكمال العملية: ${message}`)}catch{}
   }
   return json({ok:true});
  }

  return forward(raw,req);
 }catch(error){
  return json({ok:false,error:String((error as Error).message||error)},500);
 }
});
