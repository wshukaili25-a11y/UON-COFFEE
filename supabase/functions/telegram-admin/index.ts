
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
 if(isOwner(a))rows.push([{text:'🏫 مراكز الدعم',callback_data:'centersctl'}]);if(isOwner(a))rows.push([{text:'💾 النسخ والاستعادة',callback_data:'backupsctl'},{text:'📊 تقرير اليوم',callback_data:'dailyreport'}]);if(isOwner(a))rows.push([{text:'📘 نادي المواد',callback_data:'coursesctl'}]);if(isOwner(a))rows.push([{text:'🔗 الروابط الرسمية',callback_data:'socials'},{text:'🔔 إشعار جديد',callback_data:'newnotify'}]);rows.push([{text:'🌐 لوحة الموقع',url:`${SITE}/admin.html?v=9.3`}]);
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
 const rows=(data||[]).map((x:any)=>[
  {text:`${x.active?'🟢':'🔴'} ${x.name} — ${x.role}`,callback_data:`admin:${x.id}`}
 ]);
 rows.push([{text:'➕ إضافة مشرف',callback_data:'adminadd'}],[{text:'⬅️ رجوع',callback_data:'home'}]);
 return {text:'المشرفون',keyboard:{inline_keyboard:rows}};
}
async function adminMenu(id:string){
 const {data,error}=await db.from('telegram_admins').select('*').eq('id',id).single();
 if(error)throw error;
 return {
  text:`الاسم: ${data.name}
Chat ID: ${data.chat_id}
الدور: ${data.role}
الحالة: ${data.active?'نشط':'متوقف'}`,
  keyboard:{inline_keyboard:[
   [{text:data.active?'🔴 إيقاف':'🟢 تفعيل',callback_data:`admintoggle:${id}:${data.active?'off':'on'}`}],
   [{text:'🗑 حذف المشرف',callback_data:`admindelete:${id}`}],
   [{text:'⬅️ المشرفون',callback_data:'admins'}]
  ]}
 };
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

   if(conv?.state?.startsWith('center_edit_')){
    const parts=conv.state.split('_');
    const center=parts[2],field=parts.slice(3).join('_');
    await db.from('site_settings').upsert({key:`${center}_${field}`,value:text,updated_at:new Date().toISOString()});
    await db.from('telegram_conversations').delete().eq('chat_id',chatId);
    await telegram('sendMessage',{chat_id:chatId,text:'تم تحديث بيانات المركز ✅'});return response()
   }
   if(conv?.state==='course_add_code'){
    await db.from('telegram_conversations').upsert({chat_id:chatId,state:'course_add_name',data:{code:text.toUpperCase()},updated_at:new Date().toISOString()});
    await telegram('sendMessage',{chat_id:chatId,text:'أرسل اسم المادة بالعربي'});return response()
   }
   if(conv?.state==='course_add_name'){
    await db.from('telegram_conversations').upsert({chat_id:chatId,state:'course_add_college',data:{...conv.data,name_ar:text},updated_at:new Date().toISOString()});
    await telegram('sendMessage',{chat_id:chatId,text:'أرسل اسم الكلية'});return response()
   }
   if(conv?.state==='course_add_college'){
    const {error}=await db.from('courses').insert({code:conv.data.code,name_ar:conv.data.name_ar,college:text,active:true,status:'approved'});
    if(error)throw error;
    await db.from('telegram_conversations').delete().eq('chat_id',chatId);
    await telegram('sendMessage',{chat_id:chatId,text:'تمت إضافة المادة ✅'});return response()
   }
   if(conv?.state==='course_edit_name'){
    const {error}=await db.from('courses').update({name_ar:text,updated_at:new Date().toISOString()}).eq('id',conv.data.course_id);
    if(error)throw error;
    await db.from('telegram_conversations').delete().eq('chat_id',chatId);
    await telegram('sendMessage',{chat_id:chatId,text:'تم تعديل اسم المادة ✅'});return response()
   }
   if(conv?.state==='await_social_whatsapp'){
    await db.from('site_settings').upsert({key:'whatsapp_channel_url',value:text,updated_at:new Date().toISOString()});
    await db.from('telegram_conversations').delete().eq('chat_id',chatId);
    await telegram('sendMessage',{chat_id:chatId,text:'تم تحديث قناة واتساب ✅'});return response()
   }
   if(conv?.state==='await_social_instagram'){
    await db.from('site_settings').upsert({key:'instagram_url',value:text,updated_at:new Date().toISOString()});
    await db.from('telegram_conversations').delete().eq('chat_id',chatId);
    await telegram('sendMessage',{chat_id:chatId,text:'تم تحديث حساب إنستغرام ✅'});return response()
   }
   if(conv?.state==='await_notification_title'){
    await db.from('telegram_conversations').upsert({chat_id:chatId,state:'await_notification_body',data:{title:text},updated_at:new Date().toISOString()});
    await telegram('sendMessage',{chat_id:chatId,text:'أرسل نص الإشعار'});return response()
   }
   if(conv?.state==='await_notification_body'){
    const {error}=await db.from('site_notifications').insert({title:conv.data.title,body:text,icon:'🔔',active:true});
    if(error)throw error;await db.from('telegram_conversations').delete().eq('chat_id',chatId);
    await telegram('sendMessage',{chat_id:chatId,text:'تم نشر الإشعار في الموقع ✅'});return response()
   }
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
    
    else if(data.startsWith('admin:')){
     if(!isOwner(a))throw new Error('للمالك فقط');
     const x=await adminMenu(data.split(':')[1]);
     await edit(chatId,mid,x.text,x.keyboard);
    }
    else if(data.startsWith('admintoggle:')){
     if(!isOwner(a))throw new Error('للمالك فقط');
     const [,id,state]=data.split(':');
     const {data:target,error:readError}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(readError)throw readError;
     if(target.chat_id===chatId&&state==='off')throw new Error('لا يمكنك إيقاف حسابك الحالي');
     const {error}=await db.from('telegram_admins').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     if(error)throw error;
     const x=await adminMenu(id);
     await edit(chatId,mid,`تم تحديث المشرف ✅\n${x.text}`,x.keyboard);
    }
    else if(data.startsWith('admindelete:')){
     if(!isOwner(a))throw new Error('للمالك فقط');
     const id=data.split(':')[1];
     const {data:target,error:readError}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(readError)throw readError;
     if(target.chat_id===chatId)throw new Error('لا يمكنك حذف حسابك الحالي');
     const {error}=await db.from('telegram_admins').delete().eq('id',id);
     if(error)throw error;
     const x=await adminsMenu();
     await edit(chatId,mid,`تم حذف ${target.name} ✅\n${x.text}`,x.keyboard);
    }

    else if(data==='centersctl'){
     await edit(chatId,mid,'اختر المركز',{inline_keyboard:[
      [{text:'مركز أنجز',callback_data:'center:anjiz'},{text:'مسالك التعلم',callback_data:'center:masalik'}],
      [{text:'⬅️ رجوع',callback_data:'home'}]
     ]});
    }
    else if(data.startsWith('center:')){
     const c=data.split(':')[1];
     const label=c==='anjiz'?'مركز أنجز':'مركز مسالك التعلم';
     await edit(chatId,mid,label,{inline_keyboard:[
      [{text:'تعديل العنوان',callback_data:`centeredit:${c}:title`}],
      [{text:'تعديل الوصف',callback_data:`centeredit:${c}:description`}],
      [{text:'تعديل رابط الحجز',callback_data:`centeredit:${c}:booking_url`}],
      [{text:'تعديل رابط الصورة',callback_data:`centeredit:${c}:image_url`}],
      [{text:'تعديل نص الزر',callback_data:`centeredit:${c}:cta`}],
      [{text:'⬅️ رجوع',callback_data:'centersctl'}]
     ]});
    }
    else if(data.startsWith('centeredit:')){
     const[,c,field]=data.split(':');
     await db.from('telegram_conversations').upsert({chat_id:chatId,state:`center_edit_${c}_${field}`,data:{},updated_at:new Date().toISOString()});
     await edit(chatId,mid,'أرسل القيمة الجديدة',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:`center:${c}`}]]});
    }
    else if(data==='dailyreport'){
     const r=await fetch(`${URL}/functions/v1/daily-report`,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},body:'{}'});
     if(!r.ok)throw new Error(await r.text());
     await edit(chatId,mid,'تم إرسال التقرير اليومي ✅',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
    }
    else if(data==='backupsctl'){
     const {data:rows}=await db.from('backup_runs').select('*').eq('status','completed').order('created_at',{ascending:false}).limit(8);
     const keys=(rows||[]).map((x:any)=>[{text:`💾 ${new Date(x.created_at).toLocaleDateString('ar')}`,callback_data:`restore:${x.id}`}]);
     keys.unshift([{text:'➕ إنشاء نسخة الآن',callback_data:'backupnow'}]);keys.push([{text:'⬅️ رجوع',callback_data:'home'}]);
     await edit(chatId,mid,'النسخ الاحتياطية\nاختر نسخة لعرض خيار الاستعادة',{inline_keyboard:keys});
    }
    else if(data==='backupnow'){
     const r=await fetch(`${URL}/functions/v1/database-backup`,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},body:'{}'});if(!r.ok)throw new Error(await r.text());
     await edit(chatId,mid,'تم إنشاء نسخة احتياطية ✅',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'backupsctl'}]]});
    }
    else if(data.startsWith('restore:')){
     const id=data.split(':')[1];const {data:b,error}=await db.from('backup_runs').select('*').eq('id',id).single();if(error)throw error;
     await edit(chatId,mid,`استعادة النسخة:\n${b.file_path}\n\n⚠️ ستستبدل بيانات الجداول الموجودة.`,{inline_keyboard:[[{text:'تأكيد الاستعادة',callback_data:`restoreconfirm:${id}`}],[{text:'إلغاء',callback_data:'backupsctl'}]]});
    }
    else if(data.startsWith('restoreconfirm:')){
     const id=data.split(':')[1];const {data:b,error}=await db.from('backup_runs').select('*').eq('id',id).single();if(error)throw error;
     const {data:file,error:down}=await db.storage.from('uon-backups').download(b.file_path);if(down)throw down;
     const payload=JSON.parse(await file.text());const run=(await db.from('restore_runs').insert({backup_path:b.file_path,status:'running'}).select().single()).data;
     for(const [table,rows] of Object.entries(payload.tables||{}) as any){if(!Array.isArray(rows)||!rows.length)continue;const {error:e}=await db.from(table).upsert(rows);if(e)throw new Error(`${table}: ${e.message}`)}
     await db.from('restore_runs').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',run.id);
     await edit(chatId,mid,'اكتملت الاستعادة ✅',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'backupsctl'}]]});
    }
    else if(data==='coursesctl'){
     const {data:state,error}=await db.rpc('uon_public_state');if(error)throw error;
     const current=state.features?.courses||'active';
     await edit(chatId,mid,`نادي المواد\nالحالة الحالية: ${current}`,{inline_keyboard:[
      [{text:'🟢 تشغيل',callback_data:'coursefeature:active'},{text:'🔴 إيقاف',callback_data:'coursefeature:disabled'}],
      [{text:'🟡 قريبًا',callback_data:'coursefeature:coming_soon'},{text:'🛠 صيانة',callback_data:'coursefeature:maintenance'}],
      [{text:'➕ إضافة مادة',callback_data:'courseadd'},{text:'📚 إدارة المواد',callback_data:'courselist:0'}],
      [{text:'🕓 طلبات المواد',callback_data:'courserequests:0'}],
      [{text:'⬅️ رجوع',callback_data:'home'}]
     ]});
    }
    else if(data.startsWith('coursefeature:')){
     const status=data.split(':')[1];
     const {error}=await db.rpc('uon_set_feature_state',{p_key:'courses',p_status:status});
     if(error)throw error;
     await edit(chatId,mid,`تم تحديث نادي المواد إلى: ${status} ✅`,{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'coursesctl'}]]});
    }
    else if(data==='courseadd'){
     await db.from('telegram_conversations').upsert({chat_id:chatId,state:'course_add_code',data:{},updated_at:new Date().toISOString()});
     await edit(chatId,mid,'أرسل رمز المادة مثل STAT101',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'coursesctl'}]]});
    }
    else if(data.startsWith('courselist:')){
     const page=Number(data.split(':')[1]||0);
     const {data:rows,error}=await db.from('courses').select('id,code,name_ar,active').order('code').range(page*8,page*8+7);
     if(error)throw error;
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.code} — ${x.name_ar}`,callback_data:`course:${x.id}`}]);
     keyboard.push([{text:'⬅️ رجوع',callback_data:'coursesctl'}]);
     await edit(chatId,mid,'اختر المادة',{inline_keyboard:keyboard});
    }
    else if(data.startsWith('course:')){
     const id=data.split(':')[1];
     const {data:c,error}=await db.from('courses').select('*').eq('id',id).single();if(error)throw error;
     await edit(chatId,mid,`${c.code} — ${c.name_ar}\n${c.college||''}`,{inline_keyboard:[
      [{text:'✏️ تعديل الاسم',callback_data:`courseedit:${id}`},{text:c.active?'🔴 إيقاف':'🟢 تفعيل',callback_data:`coursetoggle:${id}:${c.active?'off':'on'}`}],
      [{text:'🗑 حذف',callback_data:`coursedelete:${id}`}],
      [{text:'⬅️ المواد',callback_data:'courselist:0'}]
     ]});
    }
    else if(data.startsWith('courseedit:')){
     const id=data.split(':')[1];
     await db.from('telegram_conversations').upsert({chat_id:chatId,state:'course_edit_name',data:{course_id:id},updated_at:new Date().toISOString()});
     await edit(chatId,mid,'أرسل الاسم الجديد للمادة',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:`course:${id}`}]]});
    }
    else if(data.startsWith('coursetoggle:')){
     const[,id,state]=data.split(':');
     const {error}=await db.from('courses').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
     await edit(chatId,mid,'تم تحديث حالة المادة ✅',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:`course:${id}`}]]});
    }
    else if(data.startsWith('coursedelete:')){
     const id=data.split(':')[1];
     const {error}=await db.from('courses').delete().eq('id',id);if(error)throw error;
     await edit(chatId,mid,'تم حذف المادة ✅',{inline_keyboard:[[{text:'⬅️ المواد',callback_data:'courselist:0'}]]});
    }
    else if(data.startsWith('courserequests:')){
     const page=Number(data.split(':')[1]||0);
     const {data:rows,error}=await db.from('course_requests').select('*').eq('status','pending').order('created_at').range(page*6,page*6+5);
     if(error)throw error;
     const keyboard=(rows||[]).map((x:any)=>[
      {text:`✅ ${x.code||x.name_ar||'طلب'}`,callback_data:`courseaccept:${x.id}`},
      {text:'❌',callback_data:`coursereject:${x.id}`}
     ]);
     keyboard.push([{text:'⬅️ رجوع',callback_data:'coursesctl'}]);
     await edit(chatId,mid,(rows||[]).length?'طلبات المواد المعلقة':'لا توجد طلبات معلقة',{inline_keyboard:keyboard});
    }
    else if(data.startsWith('courseaccept:')){
     const id=data.split(':')[1];
     const {data:r,error}=await db.from('course_requests').select('*').eq('id',id).single();if(error)throw error;
     if(r.request_type==='add'){
      const {error:e}=await db.from('courses').insert({code:r.code,name_ar:r.name_ar,name_en:r.name_en,college:r.college,department:r.department,credit_hours:r.credit_hours,description:r.description,active:true,status:'approved'});if(e)throw e;
     }else if(r.request_type==='edit'&&r.course_id){
      const {error:e}=await db.from('courses').update({name_ar:r.name_ar,name_en:r.name_en,college:r.college,department:r.department,credit_hours:r.credit_hours,description:r.description,updated_at:new Date().toISOString()}).eq('id',r.course_id);if(e)throw e;
     }else if(r.request_type==='delete'&&r.course_id){
      const {error:e}=await db.from('courses').delete().eq('id',r.course_id);if(e)throw e;
     }
     await db.from('course_requests').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',id);
     await edit(chatId,mid,'تم قبول الطلب ✅',{inline_keyboard:[[{text:'⬅️ الطلبات',callback_data:'courserequests:0'}]]});
    }
    else if(data.startsWith('coursereject:')){
     const id=data.split(':')[1];
     await db.from('course_requests').update({status:'rejected',reviewed_at:new Date().toISOString()}).eq('id',id);
     await edit(chatId,mid,'تم رفض الطلب',{inline_keyboard:[[{text:'⬅️ الطلبات',callback_data:'courserequests:0'}]]});
    }
    else if(data==='socials'){
     if(!isOwner(a))throw new Error('للمالك فقط');
     await edit(chatId,mid,'اختر الرابط الذي تريد تعديله',{inline_keyboard:[[{text:'واتساب',callback_data:'social:whatsapp'},{text:'إنستغرام',callback_data:'social:instagram'}],[{text:'⬅️ رجوع',callback_data:'home'}]]});
    }
    else if(data.startsWith('social:')){
     const type=data.split(':')[1];
     await db.from('telegram_conversations').upsert({chat_id:chatId,state:type==='whatsapp'?'await_social_whatsapp':'await_social_instagram',data:{},updated_at:new Date().toISOString()});
     await edit(chatId,mid,`أرسل رابط ${type==='whatsapp'?'قناة واتساب':'حساب إنستغرام'}`,{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'socials'}]]});
    }
    else if(data==='newnotify'){
     if(!isOwner(a))throw new Error('للمالك فقط');
     await db.from('telegram_conversations').upsert({chat_id:chatId,state:'await_notification_title',data:{},updated_at:new Date().toISOString()});
     await edit(chatId,mid,'أرسل عنوان الإشعار',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
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
