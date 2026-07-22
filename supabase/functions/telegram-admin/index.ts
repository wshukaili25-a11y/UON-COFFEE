import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'https://uon-coffee.vercel.app';
const db=createClient(URL,KEY);

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
};

const response=(body:any='ok',status=200)=>new Response(
 typeof body==='string'?body:JSON.stringify(body),
 {status,headers:{...cors,'content-type':'application/json'}}
);

async function telegram(method:string,body:any){
 const result=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(body)
 });
 const text=await result.text();
 if(!result.ok)throw new Error(text);
 return JSON.parse(text);
}

async function getAdmin(chatId:string){
 const {data,error}=await db.from('telegram_admins')
  .select('*').eq('chat_id',chatId).eq('active',true).maybeSingle();
 if(error)throw error;
 if(data)await db.from('telegram_admins').update({last_seen_at:new Date().toISOString()}).eq('id',data.id);
 return data;
}

const isOwner=(admin:any)=>admin?.role==='owner';
const can=(admin:any,permission:string)=>{
 if(isOwner(admin)||admin?.permissions?.all===true)return true;
 if(admin?.role==='admin')return true;
 return admin?.permissions?.[permission]===true;
};

async function audit(admin:any,action:string,targetType='',targetId='',details:any={},success=true,error=''){
 await db.from('bot_audit_log').insert({
  admin_chat_id:String(admin?.chat_id||''),
  admin_name:admin?.name||'',
  action,target_type:targetType,target_id:String(targetId||''),
  details,success,error:error||null
 }).catch(()=>{});
}

async function edit(chatId:string,messageId:number,text:string,inline_keyboard:any[]){
 await telegram('editMessageText',{
  chat_id:chatId,message_id:messageId,text,
  reply_markup:{inline_keyboard}
 });
}

async function send(chatId:string,text:string,inline_keyboard?:any[]){
 await telegram('sendMessage',{
  chat_id:chatId,text,
  reply_markup:inline_keyboard?{inline_keyboard}:undefined
 });
}

async function setConversation(chatId:string,state:string,data:any={}){
 await db.from('telegram_conversations').upsert({
  chat_id:chatId,state,data,updated_at:new Date().toISOString()
 });
}

async function clearConversation(chatId:string){
 await db.from('telegram_conversations').delete().eq('chat_id',chatId);
}

function mainMenu(admin:any){
 const rows:any[]=[
  [{text:'📊 لوحة الإحصائيات',callback_data:'dashboard'}],
  [{text:'🛠 الخدمات والصيانة',callback_data:'services'}],
  [{text:'🕓 الطلبات المعلقة',callback_data:'pending:menu'}],
  [{text:'📘 مركز المقررات',callback_data:'courses:menu'}],
  [{text:'📢 الإعلانات والإشعارات',callback_data:'content:menu'}],
  [{text:'🏫 مراكز الدعم والروابط',callback_data:'settings:menu'}],
 ];
 if(can(admin,'backups'))rows.push([{text:'💾 النسخ والاستعادة',callback_data:'backup:menu'}]);
 if(can(admin,'admins'))rows.push([{text:'👥 المشرفون والصلاحيات',callback_data:'admins:menu'}]);
 rows.push(
  [{text:'📋 سجل العمليات',callback_data:'audit:list'}],
  [{text:'🌐 فتح لوحة الموقع',url:`${SITE}/admin.html?v=15`}],
 );
 return rows;
}

async function home(chatId:string,admin:any,messageId?:number){
 const text=`لوحة إدارة UON Hub V15\nمرحبًا ${admin.name||'مشرف'} 👋\nاختر القسم الذي تريد إدارته.`;
 if(messageId)await edit(chatId,messageId,text,mainMenu(admin));
 else await send(chatId,text,mainMenu(admin));
}

const pendingConfigs:any={
 summaries:{
  title:'الملخصات والاختبارات',status:'approved',pending:false,approve:true,reject:false,
  fields:['title','subject','course_code','college','url']
 },
 whatsapp_groups:{
  title:'مجموعات الواتساب',status:'approved',pending:false,approve:true,reject:false,
  fields:['subject','course_code','college','link']
 },
 rating_submissions:{
  title:'التقييمات',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['target_name','course_code','overall','comment']
 },
 confessions:{
  title:'الاعترافات',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['text','content','created_at']
 },
 student_projects:{
  title:'مشاريع الطلاب',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['title','major','owner_name','url']
 },
 course_requests:{
  title:'طلبات المقررات',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['request_type','code','name_ar','college']
 },
 feature_suggestions:{
  title:'الاقتراحات',status:'status',pending:'pending',approve:'reviewed',reject:'rejected',
  fields:['category','title','details','college','contact']
 },
 broken_link_reports:{
  title:'بلاغات الروابط',status:'status',pending:'pending',approve:'reviewed',reject:'rejected',
  fields:['source_table','source_title','source_url','reason']
 }
};

function displayValue(value:any){
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='object')return JSON.stringify(value);
 return String(value).slice(0,700);
}

async function pendingCounts(){
 const result:any={};
 for(const [table,cfg] of Object.entries(pendingConfigs) as any){
  let query=db.from(table).select('id',{count:'exact',head:true});
  query=typeof cfg.pending==='boolean'
   ?query.eq(cfg.status,cfg.pending)
   :query.eq(cfg.status,cfg.pending);
  const {count}=await query;
  result[table]=count||0;
 }
 return result;
}

async function pendingMenu(chatId:string,mid:number){
 const counts=await pendingCounts();
 const rows=Object.entries(pendingConfigs).map(([table,cfg]:any)=>[
  {text:`${counts[table]?'🟠':'⚪'} ${cfg.title} (${counts[table]||0})`,callback_data:`pending:list:${table}:0`}
 ]);
 rows.push([{text:'⬅️ الرئيسية',callback_data:'home'}]);
 await edit(chatId,mid,'الطلبات والمراجعات المعلقة',rows);
}

async function pendingList(chatId:string,mid:number,table:string,page=0){
 const cfg=pendingConfigs[table];
 if(!cfg)throw new Error('نوع الطلب غير معروف');
 const from=page*7;
 const {data,error}=await db.from(table).select('*')
  .eq(cfg.status,cfg.pending).order('created_at',{ascending:true}).range(from,from+6);
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${displayValue(item[cfg.fields[0]])}`,
  callback_data:`pending:view:${table}:${item.id}:${page}`
 }]);
 if(page>0)rows.push([{text:'السابق',callback_data:`pending:list:${table}:${page-1}`}]);
 if((data||[]).length===7)rows.push([{text:'التالي',callback_data:`pending:list:${table}:${page+1}`}]);
 rows.push([{text:'⬅️ الأقسام',callback_data:'pending:menu'}]);
 await edit(chatId,mid,(data||[]).length?cfg.title:`لا توجد طلبات في ${cfg.title}`,rows);
}

async function pendingView(chatId:string,mid:number,table:string,id:string,page=0){
 const cfg=pendingConfigs[table];
 const {data,error}=await db.from(table).select('*').eq('id',id).single();
 if(error)throw error;
 const lines=cfg.fields.map((field:string)=>`${field}: ${displayValue(data[field])}`).join('\n');
 await edit(chatId,mid,`${cfg.title}\n\n${lines}`,[
  [
   {text:'✅ قبول/مراجعة',callback_data:`pending:approve:${table}:${id}:${page}`},
   {text:'❌ رفض',callback_data:`pending:reject:${table}:${id}:${page}`}
  ],
  [{text:'🗑 حذف نهائي',callback_data:`pending:deleteask:${table}:${id}:${page}`}],
  [{text:'⬅️ القائمة',callback_data:`pending:list:${table}:${page}`}]
 ]);
}

async function approvePending(table:string,id:string){
 const cfg=pendingConfigs[table];
 if(table==='course_requests'){
  const {data:req,error}=await db.from(table).select('*').eq('id',id).single();
  if(error)throw error;
  if(req.request_type==='add'){
   const {error:e}=await db.from('courses').upsert({
    code:req.code,name_ar:req.name_ar,name_en:req.name_en,
    college:req.college,department:req.department,
    credit_hours:req.credit_hours,description:req.description,
    active:true,status:'approved',updated_at:new Date().toISOString()
   },{onConflict:'code'});
   if(e)throw e;
  }else if(req.request_type==='edit'&&req.course_id){
   const {error:e}=await db.from('courses').update({
    name_ar:req.name_ar,name_en:req.name_en,college:req.college,
    department:req.department,credit_hours:req.credit_hours,
    description:req.description,updated_at:new Date().toISOString()
   }).eq('id',req.course_id);
   if(e)throw e;
  }else if(req.request_type==='delete'&&req.course_id){
   const {error:e}=await db.from('courses').delete().eq('id',req.course_id);
   if(e)throw e;
  }
 }
 const {error}=await db.from(table).update({
  [cfg.status]:cfg.approve,
  reviewed_at:new Date().toISOString()
 }).eq('id',id);
 if(error)throw error;
}

async function servicesMenu(chatId:string,mid:number){
 const {data,error}=await db.from('platform_features').select('*').order('sort_order');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.status==='active'?'🟢':item.status==='maintenance'?'🛠':item.status==='coming_soon'?'🟡':'🔴'} ${item.name}`,
  callback_data:`service:view:${item.key}`
 }]);
 rows.push(
  [{text:'🔧 صيانة الموقع بالكامل',callback_data:'maintenance:menu'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 );
 await edit(chatId,mid,'الخدمات وحالاتها',rows);
}

async function serviceView(chatId:string,mid:number,key:string){
 const {data,error}=await db.from('platform_features').select('*').eq('key',key).single();
 if(error)throw error;
 await edit(chatId,mid,`${data.name}\nالحالة الحالية: ${data.status}`,[
  [{text:'🟢 تشغيل',callback_data:`service:set:${key}:active`},{text:'🔴 إيقاف',callback_data:`service:set:${key}:disabled`}],
  [{text:'🟡 قريبًا',callback_data:`service:set:${key}:coming_soon`},{text:'🛠 صيانة',callback_data:`service:set:${key}:maintenance`}],
  [{text:'⬅️ الخدمات',callback_data:'services'}]
 ]);
}

async function maintenanceMenu(chatId:string,mid:number){
 const {data,error}=await db.rpc('uon_public_state');
 if(error)throw error;
 await edit(chatId,mid,`صيانة الموقع\nالحالة: ${data.maintenance_enabled?'مفعلة':'متوقفة'}\nالرسالة: ${data.maintenance_message||'—'}`,[
  [{text:'🛠 تفعيل الصيانة',callback_data:'maintenance:set:on'},{text:'🟢 إيقاف الصيانة',callback_data:'maintenance:set:off'}],
  [{text:'✏️ تعديل رسالة الصيانة',callback_data:'maintenance:message'}],
  [{text:'⬅️ الخدمات',callback_data:'services'}]
 ]);
}

async function coursesMenu(chatId:string,mid:number){
 const {count}=await db.from('courses').select('id',{count:'exact',head:true});
 const {count:pending}=await db.from('course_requests').select('id',{count:'exact',head:true}).eq('status','pending');
 await edit(chatId,mid,`مركز المقررات\nالمواد: ${count||0}\nالطلبات المعلقة: ${pending||0}`,[
  [{text:'➕ إضافة مادة',callback_data:'course:add:start'}],
  [{text:'📚 عرض وإدارة المواد',callback_data:'course:list:0'}],
  [{text:'🕓 طلبات المقررات',callback_data:'pending:list:course_requests:0'}],
  [{text:'⚙️ حالة مركز المقررات',callback_data:'service:view:courses'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}

async function courseList(chatId:string,mid:number,page=0){
 const from=page*8;
 const {data,error}=await db.from('courses').select('*').order('code').range(from,from+7);
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.active?'🟢':'🔴'} ${item.code} — ${item.name_ar}`,
  callback_data:`course:view:${item.id}:${page}`
 }]);
 if(page>0)rows.push([{text:'السابق',callback_data:`course:list:${page-1}`}]);
 if((data||[]).length===8)rows.push([{text:'التالي',callback_data:`course:list:${page+1}`}]);
 rows.push([{text:'⬅️ مركز المقررات',callback_data:'courses:menu'}]);
 await edit(chatId,mid,(data||[]).length?'اختر المادة':'لا توجد مواد',rows);
}

async function courseView(chatId:string,mid:number,id:string,page=0){
 const {data,error}=await db.from('courses').select('*').eq('id',id).single();
 if(error)throw error;
 await edit(chatId,mid,`${data.code} — ${data.name_ar}
الاسم الإنجليزي: ${data.name_en||'—'}
الكلية: ${data.college||'—'}
القسم: ${data.department||'—'}
الساعات: ${data.credit_hours||'—'}
الحالة: ${data.active?'نشطة':'متوقفة'}`,[
  [{text:'✏️ تعديل الاسم',callback_data:`course:edit:${id}:name_ar:${page}`},{text:'🏷 تعديل الرمز',callback_data:`course:edit:${id}:code:${page}`}],
  [{text:'🏫 تعديل الكلية',callback_data:`course:edit:${id}:college:${page}`},{text:'⏱ تعديل الساعات',callback_data:`course:edit:${id}:credit_hours:${page}`}],
  [{text:data.active?'🔴 إيقاف المادة':'🟢 تفعيل المادة',callback_data:`course:toggle:${id}:${data.active?'off':'on'}:${page}`}],
  [{text:'🗑 حذف المادة',callback_data:`course:deleteask:${id}:${page}`}],
  [{text:'⬅️ المواد',callback_data:`course:list:${page}`}]
 ]);
}

async function contentMenu(chatId:string,mid:number){
 await edit(chatId,mid,'الإعلانات والإشعارات',[
  [{text:'🔔 نشر إشعار داخل الموقع',callback_data:'notification:new'}],
  [{text:'📢 إنشاء إعلان',callback_data:'announcement:new'}],
  [{text:'📋 إدارة الإعلانات',callback_data:'announcement:list:0'}],
  [{text:'🗑 إدارة إشعارات الموقع',callback_data:'notification:list:0'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}

async function settingsMenu(chatId:string,mid:number){
 await edit(chatId,mid,'مراكز الدعم والروابط الرسمية',[
  [{text:'🏫 مركز أنجز',callback_data:'center:view:anjiz'},{text:'🎓 مسالك التعلم',callback_data:'center:view:masalik'}],
  [{text:'💬 قناة واتساب',callback_data:'setting:edit:whatsapp_channel_url'}],
  [{text:'📷 حساب إنستغرام',callback_data:'setting:edit:instagram_url'}],
  [{text:'🌐 رابط الموقع',callback_data:'setting:edit:site_url'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}

async function centerView(chatId:string,mid:number,center:string){
 const label=center==='anjiz'?'مركز أنجز':'مركز تعزيز مسالك التعلم';
 await edit(chatId,mid,label,[
  [{text:'✏️ العنوان',callback_data:`setting:edit:${center}_title`}],
  [{text:'📝 الوصف',callback_data:`setting:edit:${center}_description`}],
  [{text:'🔗 رابط الحجز',callback_data:`setting:edit:${center}_booking_url`}],
  [{text:'🖼 رابط الصورة',callback_data:`setting:edit:${center}_image_url`}],
  [{text:'🔘 نص الزر',callback_data:`setting:edit:${center}_cta`}],
  [{text:'⬅️ مراكز الدعم',callback_data:'settings:menu'}]
 ]);
}

async function dashboard(chatId:string,mid:number){
 const since=new Date(Date.now()-86400000).toISOString();
 const week=new Date(Date.now()-7*86400000).toISOString();
 const [
  {data:events},{count:courses},{count:summaries},{count:groups},{count:ratings},
  {count:errors},{count:reports},{count:suggestions},{data:backup},{data:state}
 ]=await Promise.all([
  db.from('usage_events').select('event_type,session_id,metadata').gte('created_at',since),
  db.from('courses').select('id',{count:'exact',head:true}).eq('active',true),
  db.from('summaries').select('id',{count:'exact',head:true}).eq('approved',true),
  db.from('whatsapp_groups').select('id',{count:'exact',head:true}).eq('approved',true),
  db.from('rating_submissions').select('id',{count:'exact',head:true}).eq('status','approved'),
  db.from('system_errors').select('id',{count:'exact',head:true}).gte('created_at',since),
  db.from('broken_link_reports').select('id',{count:'exact',head:true}).eq('status','pending'),
  db.from('feature_suggestions').select('id',{count:'exact',head:true}).eq('status','pending'),
  db.from('backup_runs').select('status,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle(),
  db.rpc('uon_public_state')
 ]);
 const visitors=new Set((events||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
 const courseCounts:any={};
 (events||[]).filter((x:any)=>x.event_type==='course_view').forEach((x:any)=>{
  const code=x.metadata?.code;
  if(code)courseCounts[code]=(courseCounts[code]||0)+1;
 });
 const top=Object.entries(courseCounts).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
  .map(([code,count])=>`${code}: ${count}`).join('\n')||'لا توجد بيانات بعد';
 const text=`📊 إحصائيات UON Hub

👥 الزوار التقريبيون اليوم: ${visitors}
🧭 الأحداث اليوم: ${(events||[]).length}
📘 المواد النشطة: ${courses||0}
📚 الملخصات: ${summaries||0}
💬 المجموعات: ${groups||0}
⭐ التقييمات: ${ratings||0}
💡 الاقتراحات المعلقة: ${suggestions||0}
🔗 بلاغات الروابط: ${reports||0}
⚠️ الأخطاء اليوم: ${errors||0}
🛠 صيانة الموقع: ${state?.maintenance_enabled?'مفعلة':'متوقفة'}
💾 آخر نسخة: ${backup?`${backup.status} — ${new Date(backup.created_at).toLocaleString('ar')}`:'لا توجد'}

🔥 أكثر المواد استخدامًا:
${top}`;
 await edit(chatId,mid,text,[
  [{text:'🔄 تحديث',callback_data:'dashboard'},{text:'📨 إرسال تقرير اليوم',callback_data:'report:send'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}

async function backupMenu(chatId:string,mid:number){
 const {data,error}=await db.from('backup_runs').select('*').order('created_at',{ascending:false}).limit(8);
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.status==='completed'?'✅':item.status==='failed'?'❌':'⏳'} ${new Date(item.created_at).toLocaleString('ar')}`,
  callback_data:`backup:view:${item.id}`
 }]);
 rows.unshift([{text:'➕ إنشاء نسخة الآن',callback_data:'backup:create'}]);
 rows.push([{text:'⬅️ الرئيسية',callback_data:'home'}]);
 await edit(chatId,mid,'النسخ الاحتياطية والاستعادة',rows);
}

async function adminsMenu(chatId:string,mid:number){
 const {data,error}=await db.from('telegram_admins').select('*').order('created_at');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.active?'🟢':'🔴'} ${item.name} — ${item.role}`,
  callback_data:`admin:view:${item.id}`
 }]);
 rows.push([{text:'➕ إضافة مشرف',callback_data:'admin:add:start'}],[{text:'⬅️ الرئيسية',callback_data:'home'}]);
 await edit(chatId,mid,'المشرفون والصلاحيات',rows);
}

async function notifyAdmins(table:string,id:string){
 const cfg=pendingConfigs[table];
 const {data:item}=cfg?await db.from(table).select('*').eq('id',id).maybeSingle():{data:null};
 const {data:admins}=await db.from('telegram_admins').select('chat_id').eq('active',true).eq('notifications_enabled',true);
 const title=cfg?.title||table;
 const label=item?displayValue(item[cfg.fields[0]]):id;
 for(const admin of admins||[]){
  await send(String(admin.chat_id),`🆕 طلب جديد\nالقسم: ${title}\nالعنصر: ${label}`,[
   [{text:'فتح الطلب',callback_data:`pending:view:${table}:${id}:0`}],
   [{text:'الطلبات المعلقة',callback_data:'pending:menu'}]
  ]).catch(()=>{});
 }
}

async function handleConversation(chatId:string,admin:any,text:string,conv:any){
 const state=conv?.state;
 const data=conv?.data||{};

 if(state==='maintenance_message'){
  await db.from('site_settings').upsert({key:'maintenance_message',value:text,updated_at:new Date().toISOString()});
  await clearConversation(chatId);
  await audit(admin,'maintenance_message','site_settings','maintenance_message',{value:text});
  await send(chatId,'تم تحديث رسالة الصيانة ✅');
  return true;
 }

 if(state==='setting_value'){
  await db.from('site_settings').upsert({key:data.key,value:text,updated_at:new Date().toISOString()});
  await clearConversation(chatId);
  await audit(admin,'setting_update','site_settings',data.key,{value:text});
  await send(chatId,'تم حفظ الإعداد ✅');
  return true;
 }

 if(state==='course_add_code'){
  await setConversation(chatId,'course_add_name_ar',{code:text.toUpperCase().replace(/\s+/g,'')});
  await send(chatId,'أرسل اسم المادة بالعربي');
  return true;
 }
 if(state==='course_add_name_ar'){
  await setConversation(chatId,'course_add_name_en',{...data,name_ar:text});
  await send(chatId,'أرسل الاسم بالإنجليزي، أو اكتب - للتخطي');
  return true;
 }
 if(state==='course_add_name_en'){
  await setConversation(chatId,'course_add_college',{...data,name_en:text==='-'?null:text});
  await send(chatId,'أرسل اسم الكلية');
  return true;
 }
 if(state==='course_add_college'){
  await setConversation(chatId,'course_add_hours',{...data,college:text});
  await send(chatId,'أرسل عدد الساعات، أو 0 إذا غير معروف');
  return true;
 }
 if(state==='course_add_hours'){
  const {error}=await db.from('courses').upsert({
   ...data,credit_hours:Number(text)||null,active:true,status:'approved',
   updated_at:new Date().toISOString()
  },{onConflict:'code'});
  if(error)throw error;
  await clearConversation(chatId);
  await audit(admin,'course_create','courses',data.code,data);
  await send(chatId,'تمت إضافة المادة ✅');
  return true;
 }

 if(state==='course_edit_value'){
  const value=data.field==='credit_hours'?Number(text)||null:data.field==='code'?text.toUpperCase().replace(/\s+/g,''):text;
  const {error}=await db.from('courses').update({[data.field]:value,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw error;
  await clearConversation(chatId);
  await audit(admin,'course_update','courses',data.id,{field:data.field,value});
  await send(chatId,'تم تعديل المادة ✅');
  return true;
 }

 if(state==='notification_title'){
  await setConversation(chatId,'notification_body',{title:text});
  await send(chatId,'أرسل نص الإشعار');
  return true;
 }
 if(state==='notification_body'){
  const {error}=await db.from('site_notifications').insert({title:data.title,body:text,icon:'🔔',active:true});
  if(error)throw error;
  await clearConversation(chatId);
  await audit(admin,'notification_create','site_notifications','',{title:data.title});
  await send(chatId,'تم نشر الإشعار داخل الموقع ✅');
  return true;
 }

 if(state==='announcement_title'){
  await setConversation(chatId,'announcement_body',{title:text});
  await send(chatId,'أرسل وصف الإعلان');
  return true;
 }
 if(state==='announcement_body'){
  await setConversation(chatId,'announcement_url',{...data,body:text});
  await send(chatId,'أرسل رابط الزر، أو اكتب - بدون رابط');
  return true;
 }
 if(state==='announcement_url'){
  const {error}=await db.from('site_announcements').insert({
   title:data.title,body:data.body,button_url:text==='-'?null:text,
   active:true,priority:10,starts_at:new Date().toISOString()
  });
  if(error)throw error;
  await clearConversation(chatId);
  await audit(admin,'announcement_create','site_announcements','',{title:data.title});
  await send(chatId,'تم نشر الإعلان ✅');
  return true;
 }

 if(state==='admin_chat_id'){
  if(!/^-?\d+$/.test(text)){
   await send(chatId,'Chat ID يجب أن يكون رقمًا');
   return true;
  }
  await setConversation(chatId,'admin_name',{chat_id:text});
  await send(chatId,'أرسل اسم المشرف');
  return true;
 }
 if(state==='admin_name'){
  await setConversation(chatId,'admin_role',{...data,name:text});
  await send(chatId,'اختر الدور',[
   [{text:'مشرف كامل',callback_data:'admin:add:role:admin'}],
   [{text:'مراجع',callback_data:'admin:add:role:moderator'}],
   [{text:'محرر محتوى',callback_data:'admin:add:role:content'}]
  ]);
  return true;
 }

 return false;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response('',204);

 try{
  const payload=await req.json();

  // Web submissions now notify Telegram admins.
  if(payload?.source==='web-submit'){
   if(payload.table&&payload.id)await notifyAdmins(String(payload.table),String(payload.id));
   return response({ok:true});
  }

  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET){
   return response({ok:false,error:'unauthorized'},401);
  }

  const callback=payload.callback_query;
  const message=payload.message;
  const chatId=String(callback?.message?.chat?.id||message?.chat?.id||'');
  const admin=await getAdmin(chatId);
  if(!admin)return response({ok:true});

  if(message){
   const text=String(message.text||'').trim();
   const {data:conv}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();

   if(conv&&await handleConversation(chatId,admin,text,conv))return response({ok:true});

   if(text==='/start'||text==='/menu')await home(chatId,admin);
   else if(text==='/health'){
    const {data,error}=await db.rpc('uon_public_state');
    await send(chatId,error?`خطأ: ${error.message}`:`البوت يعمل ✅\nالصيانة: ${data.maintenance_enabled?'مفعلة':'متوقفة'}\nالإصدار: V15`);
   }else await home(chatId,admin);
   return response({ok:true});
  }

  if(callback){
   await telegram('answerCallbackQuery',{callback_query_id:callback.id}).catch(()=>{});
   const data=String(callback.data||'');
   const mid=callback.message.message_id;

   try{
    if(data==='home')await home(chatId,admin,mid);
    else if(data==='dashboard')await dashboard(chatId,mid);
    else if(data==='services')await servicesMenu(chatId,mid);
    else if(data.startsWith('service:view:'))await serviceView(chatId,mid,data.split(':')[2]);
    else if(data.startsWith('service:set:')){
     if(!can(admin,'features'))throw new Error('ليس لديك صلاحية إدارة الخدمات');
     const [, ,key,status]=data.split(':');
     const {error}=await db.rpc('uon_set_feature_state',{p_key:key,p_status:status});
     if(error)throw error;
     await audit(admin,'feature_state','platform_features',key,{status});
     await serviceView(chatId,mid,key);
    }
    else if(data==='maintenance:menu')await maintenanceMenu(chatId,mid);
    else if(data.startsWith('maintenance:set:')){
     if(!can(admin,'maintenance'))throw new Error('ليس لديك صلاحية الصيانة');
     const enabled=data.endsWith(':on');
     const {error}=await db.rpc('uon_set_maintenance',{p_enabled:enabled});
     if(error)throw error;
     await audit(admin,'maintenance_toggle','site_settings','maintenance_enabled',{enabled});
     await maintenanceMenu(chatId,mid);
    }
    else if(data==='maintenance:message'){
     await setConversation(chatId,'maintenance_message',{});
     await edit(chatId,mid,'أرسل رسالة الصيانة الجديدة',[[{text:'⬅️ إلغاء',callback_data:'maintenance:menu'}]]);
    }
    else if(data==='pending:menu')await pendingMenu(chatId,mid);
    else if(data.startsWith('pending:list:')){
     const [, ,table,page]=data.split(':');
     await pendingList(chatId,mid,table,Number(page)||0);
    }
    else if(data.startsWith('pending:view:')){
     const [, ,table,id,page]=data.split(':');
     await pendingView(chatId,mid,table,id,Number(page)||0);
    }
    else if(data.startsWith('pending:approve:')){
     if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
     const [, ,table,id,page]=data.split(':');
     await approvePending(table,id);
     await audit(admin,'pending_approve',table,id);
     await pendingList(chatId,mid,table,Number(page)||0);
    }
    else if(data.startsWith('pending:reject:')){
     if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
     const [, ,table,id,page]=data.split(':');
     const cfg=pendingConfigs[table];
     const {error}=await db.from(table).update({[cfg.status]:cfg.reject,reviewed_at:new Date().toISOString()}).eq('id',id);
     if(error)throw error;
     await audit(admin,'pending_reject',table,id);
     await pendingList(chatId,mid,table,Number(page)||0);
    }
    else if(data.startsWith('pending:deleteask:')){
     const [, ,table,id,page]=data.split(':');
     await edit(chatId,mid,'تأكيد الحذف النهائي؟',[
      [{text:'نعم، حذف',callback_data:`pending:delete:${table}:${id}:${page}`}],
      [{text:'إلغاء',callback_data:`pending:view:${table}:${id}:${page}`}]
     ]);
    }
    else if(data.startsWith('pending:delete:')){
     if(!isOwner(admin))throw new Error('الحذف النهائي للمالك فقط');
     const [, ,table,id,page]=data.split(':');
     const {error}=await db.from(table).delete().eq('id',id);
     if(error)throw error;
     await audit(admin,'pending_delete',table,id);
     await pendingList(chatId,mid,table,Number(page)||0);
    }
    else if(data==='courses:menu')await coursesMenu(chatId,mid);
    else if(data==='course:add:start'){
     if(!can(admin,'courses'))throw new Error('ليس لديك صلاحية إدارة المقررات');
     await setConversation(chatId,'course_add_code',{});
     await edit(chatId,mid,'أرسل رمز المادة مثل STAT101',[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]]);
    }
    else if(data.startsWith('course:list:'))await courseList(chatId,mid,Number(data.split(':')[2])||0);
    else if(data.startsWith('course:view:')){
     const [, ,id,page]=data.split(':');
     await courseView(chatId,mid,id,Number(page)||0);
    }
    else if(data.startsWith('course:edit:')){
     if(!can(admin,'courses'))throw new Error('ليس لديك صلاحية إدارة المقررات');
     const [, ,id,field,page]=data.split(':');
     await setConversation(chatId,'course_edit_value',{id,field,page});
     await edit(chatId,mid,'أرسل القيمة الجديدة',[[{text:'⬅️ إلغاء',callback_data:`course:view:${id}:${page}`}]]); 
    }
    else if(data.startsWith('course:toggle:')){
     if(!can(admin,'courses'))throw new Error('ليس لديك صلاحية إدارة المقررات');
     const [, ,id,state,page]=data.split(':');
     const {error}=await db.from('courses').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     if(error)throw error;
     await audit(admin,'course_toggle','courses',id,{active:state==='on'});
     await courseView(chatId,mid,id,Number(page)||0);
    }
    else if(data.startsWith('course:deleteask:')){
     const [, ,id,page]=data.split(':');
     await edit(chatId,mid,'تأكيد حذف المادة؟',[
      [{text:'نعم، حذف',callback_data:`course:delete:${id}:${page}`}],
      [{text:'إلغاء',callback_data:`course:view:${id}:${page}`}]
     ]);
    }
    else if(data.startsWith('course:delete:')){
     if(!isOwner(admin))throw new Error('حذف المواد للمالك فقط');
     const [, ,id,page]=data.split(':');
     const {error}=await db.from('courses').delete().eq('id',id);
     if(error)throw error;
     await audit(admin,'course_delete','courses',id);
     await courseList(chatId,mid,Number(page)||0);
    }
    else if(data==='content:menu')await contentMenu(chatId,mid);
    else if(data==='notification:new'){
     await setConversation(chatId,'notification_title',{});
     await edit(chatId,mid,'أرسل عنوان الإشعار',[[{text:'⬅️ إلغاء',callback_data:'content:menu'}]]);
    }
    else if(data==='announcement:new'){
     await setConversation(chatId,'announcement_title',{});
     await edit(chatId,mid,'أرسل عنوان الإعلان',[[{text:'⬅️ إلغاء',callback_data:'content:menu'}]]);
    }
    else if(data.startsWith('announcement:list:')){
     const page=Number(data.split(':')[2])||0;
     const {data:rows}=await db.from('site_announcements').select('*').order('created_at',{ascending:false}).range(page*7,page*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`announcement:toggle:${x.id}:${x.active?'off':'on'}:${page}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,(rows||[]).length?'اضغط الإعلان لتغيير حالته':'لا توجد إعلانات',keyboard);
    }
    else if(data.startsWith('announcement:toggle:')){
     const [, ,id,state,page]=data.split(':');
     await db.from('site_announcements').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     await audit(admin,'announcement_toggle','site_announcements',id,{active:state==='on'});
     const p=Number(page)||0;
     const {data:rows}=await db.from('site_announcements').select('*').order('created_at',{ascending:false}).range(p*7,p*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`announcement:toggle:${x.id}:${x.active?'off':'on'}:${p}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,'تم تحديث الإعلان ✅',keyboard);
    }
    else if(data.startsWith('notification:list:')){
     const page=Number(data.split(':')[2])||0;
     const {data:rows}=await db.from('site_notifications').select('*').order('created_at',{ascending:false}).range(page*7,page*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`notification:toggle:${x.id}:${x.active?'off':'on'}:${page}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,(rows||[]).length?'اضغط الإشعار لتغيير حالته':'لا توجد إشعارات',keyboard);
    }
    else if(data.startsWith('notification:toggle:')){
     const [, ,id,state,page]=data.split(':');
     await db.from('site_notifications').update({active:state==='on'}).eq('id',id);
     await audit(admin,'notification_toggle','site_notifications',id,{active:state==='on'});
     await contentMenu(chatId,mid);
    }
    else if(data==='settings:menu')await settingsMenu(chatId,mid);
    else if(data.startsWith('center:view:'))await centerView(chatId,mid,data.split(':')[2]);
    else if(data.startsWith('setting:edit:')){
     const key=data.split(':').slice(2).join(':');
     await setConversation(chatId,'setting_value',{key});
     await edit(chatId,mid,`أرسل القيمة الجديدة لـ ${key}`,[[{text:'⬅️ إلغاء',callback_data:'settings:menu'}]]);
    }
    else if(data==='backup:menu')await backupMenu(chatId,mid);
    else if(data==='backup:create'){
     if(!can(admin,'backups'))throw new Error('ليس لديك صلاحية النسخ');
     const result=await fetch(`${URL}/functions/v1/database-backup`,{
      method:'POST',
      headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},
      body:JSON.stringify({requested_by:chatId})
     });
     if(!result.ok)throw new Error(await result.text());
     await audit(admin,'backup_create','backup_runs','');
     await backupMenu(chatId,mid);
    }
    else if(data.startsWith('backup:view:')){
     const id=data.split(':')[2];
     const {data:item,error}=await db.from('backup_runs').select('*').eq('id',id).single();
     if(error)throw error;
     await edit(chatId,mid,`النسخة الاحتياطية
الحالة: ${item.status}
التاريخ: ${new Date(item.created_at).toLocaleString('ar')}
الملف: ${item.file_path||'—'}`,[
      [{text:'♻️ استعادة هذه النسخة',callback_data:`backup:restoreask:${id}`}],
      [{text:'⬅️ النسخ',callback_data:'backup:menu'}]
     ]);
    }
    else if(data.startsWith('backup:restoreask:')){
     if(!isOwner(admin))throw new Error('الاستعادة للمالك فقط');
     const id=data.split(':')[2];
     await edit(chatId,mid,'⚠️ تأكيد الاستعادة؟ ستتم مزامنة بيانات النسخة مع الجداول الحالية.',[
      [{text:'تأكيد الاستعادة',callback_data:`backup:restore:${id}`}],
      [{text:'إلغاء',callback_data:`backup:view:${id}`}]
     ]);
    }
    else if(data.startsWith('backup:restore:')){
     if(!isOwner(admin))throw new Error('الاستعادة للمالك فقط');
     const id=data.split(':')[2];
     const result=await fetch(`${URL}/functions/v1/database-restore`,{
      method:'POST',
      headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},
      body:JSON.stringify({backup_run_id:id,requested_by:chatId})
     });
     if(!result.ok)throw new Error(await result.text());
     await audit(admin,'backup_restore','backup_runs',id);
     await edit(chatId,mid,'اكتملت الاستعادة ✅',[[{text:'⬅️ النسخ',callback_data:'backup:menu'}]]);
    }
    else if(data==='report:send'){
     const result=await fetch(`${URL}/functions/v1/daily-report`,{
      method:'POST',
      headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},
      body:JSON.stringify({chat_id:chatId})
     });
     if(!result.ok)throw new Error(await result.text());
     await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'تم إرسال التقرير'}).catch(()=>{});
    }
    else if(data==='admins:menu'){
     if(!can(admin,'admins'))throw new Error('ليس لديك صلاحية إدارة المشرفين');
     await adminsMenu(chatId,mid);
    }
    else if(data==='admin:add:start'){
     if(!isOwner(admin))throw new Error('إضافة المشرفين للمالك فقط');
     await setConversation(chatId,'admin_chat_id',{});
     await edit(chatId,mid,'أرسل Chat ID للمشرف الجديد',[[{text:'⬅️ إلغاء',callback_data:'admins:menu'}]]);
    }
    else if(data.startsWith('admin:add:role:')){
     if(!isOwner(admin))throw new Error('إضافة المشرفين للمالك فقط');
     const role=data.split(':')[3];
     const {data:conv}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).single();
     const permissions=role==='admin'
      ?{moderate:true,features:true,maintenance:true,courses:true,announcements:true,backups:true}
      :role==='content'
       ?{moderate:true,courses:true,announcements:true}
       :{moderate:true};
     const {error}=await db.from('telegram_admins').upsert({
      chat_id:conv.data.chat_id,name:conv.data.name,role,permissions,active:true,notifications_enabled:true,
      updated_at:new Date().toISOString()
     },{onConflict:'chat_id'});
     if(error)throw error;
     await clearConversation(chatId);
     await audit(admin,'admin_create','telegram_admins',conv.data.chat_id,{role});
     await adminsMenu(chatId,mid);
    }
    else if(data.startsWith('admin:view:')){
     const id=data.split(':')[2];
     const {data:item,error}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(error)throw error;
     await edit(chatId,mid,`${item.name}
Chat ID: ${item.chat_id}
الدور: ${item.role}
الحالة: ${item.active?'نشط':'متوقف'}`,[
      [{text:item.active?'🔴 إيقاف':'🟢 تفعيل',callback_data:`admin:toggle:${id}:${item.active?'off':'on'}`}],
      [{text:'🗑 حذف',callback_data:`admin:deleteask:${id}`}],
      [{text:'⬅️ المشرفون',callback_data:'admins:menu'}]
     ]);
    }
    else if(data.startsWith('admin:toggle:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const [, ,id,state]=data.split(':');
     const {data:item}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(item.chat_id===chatId&&state==='off')throw new Error('لا يمكنك إيقاف حسابك الحالي');
     await db.from('telegram_admins').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     await audit(admin,'admin_toggle','telegram_admins',id,{active:state==='on'});
     await adminsMenu(chatId,mid);
    }
    else if(data.startsWith('admin:deleteask:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const id=data.split(':')[2];
     await edit(chatId,mid,'تأكيد حذف المشرف؟',[
      [{text:'نعم، حذف',callback_data:`admin:delete:${id}`}],
      [{text:'إلغاء',callback_data:`admin:view:${id}`}]
     ]);
    }
    else if(data.startsWith('admin:delete:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const id=data.split(':')[2];
     const {data:item}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(item.chat_id===chatId)throw new Error('لا يمكنك حذف حسابك الحالي');
     await db.from('telegram_admins').delete().eq('id',id);
     await audit(admin,'admin_delete','telegram_admins',id);
     await adminsMenu(chatId,mid);
    }
    else if(data==='audit:list'){
     const {data:rows}=await db.from('bot_audit_log').select('*').order('created_at',{ascending:false}).limit(12);
     const text=(rows||[]).map((x:any)=>`${x.success?'✅':'❌'} ${x.admin_name||x.admin_chat_id}\n${x.action} — ${x.target_type||''}\n${new Date(x.created_at).toLocaleString('ar')}`).join('\n\n')||'لا توجد عمليات مسجلة';
     await edit(chatId,mid,text,[[{text:'⬅️ الرئيسية',callback_data:'home'}]]);
    }
    else await home(chatId,admin,mid);

   }catch(error){
    await audit(admin,'callback_error','telegram',data,{},false,String(error?.message||error));
    await telegram('answerCallbackQuery',{
     callback_query_id:callback.id,
     text:String(error?.message||error).slice(0,180),
     show_alert:true
    }).catch(()=>{});
   }
   return response({ok:true});
  }

  return response({ok:true});
 }catch(error){
  return response({ok:false,error:String(error?.message||error)},500);
 }
});
