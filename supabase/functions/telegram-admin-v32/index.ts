import {SECRET,KEY,SUPABASE_URL,json,forward,getAdmin,getConv,clearConv,canCourses,ack,send,audit} from './lib.ts';
import {textFlow,callbackFlow} from './course-flow.ts';
declare const Deno:any;

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
