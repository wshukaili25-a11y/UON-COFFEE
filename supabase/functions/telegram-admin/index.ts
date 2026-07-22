
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'https://uon-coffee.vercel.app';
const db=createClient(URL,KEY);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(text='ok',status=200)=>new Response(text,{status,headers:cors});

async function telegram(method:string,body:any){
 const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 });
 const text=await r.text();
 if(!r.ok)throw new Error(text);
 return JSON.parse(text);
}
async function getAdmin(chatId:string){
 const {data,error}=await db.from('telegram_admins').select('*').eq('chat_id',chatId).eq('active',true).maybeSingle();
 if(error)throw error;return data;
}
const isOwner=(a:any)=>a?.role==='owner';

function mainMenu(a:any){
 const rows:any[]=[
  [{text:'📊 الإحصائيات',callback_data:'stats'},{text:'🕓 المعلقة',callback_data:'pending'}],
  [{text:'🛠 خدمات الموقع',callback_data:'features'}],
  [{text:'🔧 الصيانة',callback_data:'maintenance'}]
 ];
 if(isOwner(a))rows.push([{text:'👥 المشرفون',callback_data:'admins'}]);
 rows.push([{text:'🌐 لوحة الموقع',url:`${SITE}/admin.html?v=9.3`}]);
 return {inline_keyboard:rows};
}
async function sendHome(chatId:string,a:any){
 await telegram('sendMessage',{chat_id:chatId,text:`لوحة UON Hub\nمرحبًا ${a.name||'مشرف'}`,reply_markup:mainMenu(a)});
}
async function edit(chatId:string,messageId:number,text:string,keyboard:any){
 await telegram('editMessageText',{chat_id:chatId,message_id:messageId,text,reply_markup:keyboard});
}
async function featuresMenu(){
 const {data,error}=await db.from('platform_features').select('*').order('sort_order');
 if(error)throw error;
 return {text:'خدمات الموقع',keyboard:{inline_keyboard:[
  ...(data||[]).map((x:any)=>[{text:`${x.status==='active'?'🟢':'🔴'} ${x.name}`,callback_data:`feature:${x.key}`}]),
  [{text:'⬅️ رجوع',callback_data:'home'}]
 ]}};
}
async function featureMenu(key:string){
 const {data,error}=await db.from('platform_features').select('*').eq('key',key).single();
 if(error)throw error;
 return {text:`${data.name}\nالحالة الحالية: ${data.status}`,keyboard:{inline_keyboard:[
  [{text:'🟢 تشغيل',callback_data:`setf:${key}:active`},{text:'🔴 إيقاف',callback_data:`setf:${key}:disabled`}],
  [{text:'🟡 قريبًا',callback_data:`setf:${key}:coming_soon`},{text:'🛠 صيانة',callback_data:`setf:${key}:maintenance`}],
  [{text:'⬅️ الخدمات',callback_data:'features'}]
 ]}};
}
async function adminsMenu(){
 const {data,error}=await db.from('telegram_admins').select('*').order('created_at');
 if(error)throw error;
 const rows=(data||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.name} — ${x.role}`,callback_data:`admin:${x.id}`}]);
 rows.push([{text:'➕ إضافة مشرف',callback_data:'adminadd'}],[{text:'⬅️ رجوع',callback_data:'home'}]);
 return {text:'المشرفون',keyboard:{inline_keyboard:rows}};
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response('',204);
 try{
  const payload=await req.json();

  if(payload.source==='web-submit')return response();

  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return response('unauthorized',401);

  const cb=payload.callback_query;
  const msg=payload.message;
  const chatId=String(cb?.message?.chat?.id||msg?.chat?.id||'');
  const a=await getAdmin(chatId);
  if(!a)return response();

  if(msg){
   const text=String(msg.text||'').trim();
   const {data:conv}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();

   if(conv?.state==='await_chat_id'){
    if(!/^-?\d+$/.test(text)){await telegram('sendMessage',{chat_id:chatId,text:'أرسل Chat ID رقميًا'});return response()}
    await db.from('telegram_conversations').upsert({chat_id:chatId,state:'await_name',data:{new_chat_id:text},updated_at:new Date().toISOString()});
    await telegram('sendMessage',{chat_id:chatId,text:'أرسل اسم المشرف'});return response()
   }
   if(conv?.state==='await_name'){
    await db.from('telegram_conversations').upsert({chat_id:chatId,state:'await_role',data:{...conv.data,name:text},updated_at:new Date().toISOString()});
    await telegram('sendMessage',{chat_id:chatId,text:'اختر الدور',reply_markup:{inline_keyboard:[[
     {text:'مشرف كامل',callback_data:'role:admin'},
     {text:'مراجع',callback_data:'role:moderator'}
    ]]}});return response()
   }

   if(text==='/start'||text==='/menu')await sendHome(chatId,a);
   else if(text==='/health'){
    const {data,error}=await db.rpc('uon_public_state');
    await telegram('sendMessage',{chat_id:chatId,text:error?`خطأ: ${error.message}`:`البوت يعمل ✅\nالصيانة: ${data.maintenance_enabled?'مفعلة':'متوقفة'}\nآخر تحديث: ${data.updated_at}`});
   }else await sendHome(chatId,a);
   return response();
  }

  if(cb){
   await telegram('answerCallbackQuery',{callback_query_id:cb.id}).catch(()=>{});
   const data=String(cb.data),mid=cb.message.message_id;

   try{
    if(data==='home')await edit(chatId,mid,'لوحة UON Hub',mainMenu(a));
    else if(data==='features'){const x=await featuresMenu();await edit(chatId,mid,x.text,x.keyboard)}
    else if(data.startsWith('feature:')){const x=await featureMenu(data.split(':')[1]);await edit(chatId,mid,x.text,x.keyboard)}
    else if(data.startsWith('setf:')){
     const [,key,status]=data.split(':');
     const {data:state,error}=await db.rpc('uon_set_feature_state',{p_key:key,p_status:status});
     if(error)throw error;
     const x=await featureMenu(key);await edit(chatId,mid,`${x.text}\nتم الحفظ ✅`,x.keyboard);
    }
    else if(data==='maintenance'){
     const {data:state,error}=await db.rpc('uon_public_state');if(error)throw error;
     await edit(chatId,mid,`الصيانة: ${state.maintenance_enabled?'مفعلة':'متوقفة'}`,{inline_keyboard:[
      [{text:'🟢 تشغيل',callback_data:'maint:on'},{text:'🔴 إيقاف',callback_data:'maint:off'}],
      [{text:'⬅️ رجوع',callback_data:'home'}]
     ]});
    }
    else if(data.startsWith('maint:')){
     const on=data.endsWith(':on');
     const {data:state,error}=await db.rpc('uon_set_maintenance',{p_enabled:on});if(error)throw error;
     await edit(chatId,mid,`تم ${state.maintenance_enabled?'تشغيل':'إيقاف'} الصيانة فعليًا ✅`,{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
    }
    else if(data==='admins'){
     if(!isOwner(a))throw new Error('للمالك فقط');
     const x=await adminsMenu();await edit(chatId,mid,x.text,x.keyboard);
    }
    else if(data==='adminadd'){
     if(!isOwner(a))throw new Error('للمالك فقط');
     await db.from('telegram_conversations').upsert({chat_id:chatId,state:'await_chat_id',data:{},updated_at:new Date().toISOString()});
     await edit(chatId,mid,'أرسل Chat ID للمشرف الجديد',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'admins'}]]});
    }
    else if(data.startsWith('role:')){
     if(!isOwner(a))throw new Error('للمالك فقط');
     const role=data.split(':')[1];
     const {data:conv,error:cerror}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).single();
     if(cerror||conv.state!=='await_role')throw new Error('انتهت جلسة الإضافة');
     const permissions=role==='admin'?{moderate:true,features:true,maintenance:true,announcements:true}:{moderate:true};
     const {error}=await db.from('telegram_admins').insert({name:conv.data.name,chat_id:conv.data.new_chat_id,role,permissions,active:true,notifications_enabled:true});
     if(error)throw error;
     await db.from('telegram_conversations').delete().eq('chat_id',chatId);
     const x=await adminsMenu();await edit(chatId,mid,`تمت الإضافة ✅\n${x.text}`,x.keyboard);
    }
    else if(data==='stats'){
     const {data:state}=await db.rpc('uon_public_state');
     await edit(chatId,mid,`الصيانة: ${state?.maintenance_enabled?'مفعلة':'متوقفة'}\nالخدمات: ${Object.keys(state?.features||{}).length}`,{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
    }
    else if(data==='pending')await edit(chatId,mid,'مركز المراجعة متاح من لوحة الموقع حاليًا',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
   }catch(error){
    await telegram('sendMessage',{chat_id:chatId,text:`تعذر تنفيذ العملية:\n${String(error?.message||error)}`}).catch(()=>{});
   }
  }
  return response();
 }catch(error){
  console.error(error);return response(String(error),500);
 }
});
