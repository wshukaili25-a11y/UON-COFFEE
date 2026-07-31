import {SECRET,SELF_FUNCTION,json,telegram,forward,getAdmin,getConv,canCourses,ack,send} from './lib.ts';
import {textFlow,callbackFlow} from './course-flow.ts';
declare const Deno:any;
Deno.serve(async(req:Request)=>{
 try{
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return json({ok:false,error:'unauthorized'},401);
  const raw=await req.text();let u:any;try{u=JSON.parse(raw)}catch{return json({ok:false,error:'invalid_json'},400)}
  const cb=u.callback_query,m=u.message,chatId=String(cb?.message?.chat?.id||m?.chat?.id||''),sender=String(cb?.from?.id||m?.from?.id||'');
  if(!chatId||!sender)return forward(raw,req);const admin=await getAdmin(sender);if(!admin)return json({ok:true});
  if(m){const conv=await getConv(chatId);if(conv?.state?.startsWith('v32_course_')){if(!canCourses(admin))return json({ok:true});const text=String(m.text||'').trim();if(!text){await send(chatId,'أرسل قيمة نصية لإكمال العملية.');return json({ok:true})}await textFlow(chatId,admin,text,conv);return json({ok:true})}return forward(raw,req)}
  if(cb){const data=String(cb.data||''),intercept=data==='course:add:start'||data.startsWith('course:view:')||data.startsWith('course:deleteask:')||data.startsWith('v32c:');if(!intercept)return forward(raw,req);await ack(cb.id);if(!canCourses(admin)){await ack(cb.id,'ليس لديك صلاحية إدارة المقررات',true);return json({ok:true})}try{await callbackFlow(chatId,cb.message.message_id,admin,data)}catch(e){const t=String((e as Error).message||e).slice(0,180);await ack(cb.id,t,true);try{await send(chatId,`تعذر إكمال العملية: ${t}`)}catch{}}return json({ok:true})}
  return forward(raw,req);
 }catch(e){return json({ok:false,error:String((e as Error).message||e)},500)}
});