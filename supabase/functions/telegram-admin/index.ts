import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'https://uon-coffee.vercel.app';
const db=createClient(URL,KEY);

const adminCache=new Map<string,{admin:any,expires:number}>();
const ADMIN_CACHE_TTL=60_000;

function background(task:Promise<any>){
 try{
  // Supabase Edge Runtime keeps the task alive after returning the webhook response.
  // @ts-ignore
  if(typeof EdgeRuntime!=='undefined'&&EdgeRuntime.waitUntil)EdgeRuntime.waitUntil(task.catch(()=>{}));
  else task.catch(()=>{});
 }catch{}
}

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
 const cached=adminCache.get(chatId);
 if(cached&&cached.expires>Date.now())return cached.admin;

 const {data,error}=await db.from('telegram_admins')
  .select('id,chat_id,name,role,permissions,notifications_enabled,active')
  .eq('chat_id',chatId).eq('active',true).maybeSingle();
 if(error)throw error;

 if(data){
  adminCache.set(chatId,{admin:data,expires:Date.now()+ADMIN_CACHE_TTL});
  background(
   db.from('telegram_admins')
    .update({last_seen_at:new Date().toISOString()})
    .eq('id',data.id)
    .then(()=>{})
  );
 }
 return data;
}

const isOwner=(admin:any)=>admin?.role==='owner';
const can=(admin:any,permission:string)=>{
 if(isOwner(admin)||admin?.permissions?.all===true)return true;
 if(admin?.role==='admin')return true;
 return admin?.permissions?.[permission]===true;
};

function audit(admin:any,action:string,targetType='',targetId='',details:any={},success=true,error=''){
 background(
  db.from('bot_audit_log').insert({
   admin_chat_id:String(admin?.chat_id||''),
   admin_name:admin?.name||'',
   action,target_type:targetType,target_id:String(targetId||''),
   details,success,error:error||null
  }).then(()=>{})
 );
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
  [{text:'🔗 المواقع المهمة والمفيدة',callback_data:'useful:menu'}],
 ];
 if(can(admin,'backups'))rows.push([{text:'💾 النسخ والاستعادة',callback_data:'backup:menu'}]);
 if(can(admin,'admins'))rows.push([{text:'👥 المشرفون والصلاحيات',callback_data:'admins:menu'}]);
 rows.push(
  [{text:'📋 سجل العمليات',callback_data:'audit:list'}],
  [{text:'🌐 فتح لوحة الموقع',url:`${SITE}/admin.html?v=18.7`}],
 );
 return rows;
}

async function home(chatId:string,admin:any,messageId?:number){
 const text=`لوحة إدارة UON Hub V18.7\nمرحبًا ${admin.name||'مشرف'} 👋\nاختر القسم الذي تريد إدارته.`;
 if(messageId)await edit(chatId,messageId,text,mainMenu(admin));
 else await send(chatId,text,mainMenu(admin));
}

const pendingConfigs:any={
 summaries:{
  title:'الملخصات والاختبارات',status:'approved',pending:false,approve:true,reject:false,
  booleanModeration:true,
  fields:['title','subject','course_code','college','resource_type','description','url','created_at'],
  urlFields:['url','link','file_url','download_url']
 },
 whatsapp_groups:{
  title:'مجموعات الواتساب',status:'approved',pending:false,approve:true,reject:false,
  booleanModeration:true,
  fields:['subject','course_code','college','link','created_at'],
  urlFields:['link','url']
 },
 rating_submissions:{
  title:'التقييمات',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['target_type','target_name','course_code','overall','teaching','interaction','exam_difficulty','recommended','comment','created_at']
 },
 confessions:{
  title:'الاعترافات',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['text','content','created_at']
 },
 student_projects:{
  title:'مشاريع الطلاب',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['title','major','owner_name','description','url','created_at'],
  urlFields:['url','project_url','demo_url']
 },
 course_requests:{
  title:'طلبات المقررات',status:'status',pending:'pending',approve:'approved',reject:'rejected',
  fields:['request_type','code','name_ar','name_en','college','department','description','created_at']
 },
 feature_suggestions:{
  title:'الاقتراحات',status:'status',pending:'pending',approve:'reviewed',reject:'rejected',
  fields:['category','title','details','college','contact','created_at']
 },
 broken_link_reports:{
  title:'بلاغات الروابط',status:'status',pending:'pending',approve:'reviewed',reject:'rejected',
  fields:['source_table','source_title','source_url','reason','created_at'],
  urlFields:['source_url']
 }
};

// Telegram callback_data is limited to 64 bytes. Compact aliases prevent UUID buttons from silently failing.
const pendingTableAliases:Record<string,string>={
 s:'summaries',g:'whatsapp_groups',r:'rating_submissions',c:'confessions',
 p:'student_projects',q:'course_requests',f:'feature_suggestions',b:'broken_link_reports'
};
const pendingTableCodes=Object.fromEntries(Object.entries(pendingTableAliases).map(([code,table])=>[table,code]));
const pendingCode=(table:string)=>pendingTableCodes[table]||table;
const pendingTable=(value:string)=>pendingTableAliases[value]||value;
const pendingCb=(action:string,table:string,idOrPage:string|number,page?:number)=>
 page===undefined?`p:${action}:${pendingCode(table)}:${idOrPage}`:`p:${action}:${pendingCode(table)}:${idOrPage}:${page}`;

function validExternalUrl(value:any){
 try{
  const u=new URL(String(value||''));
  return ['http:','https:'].includes(u.protocol)?u.toString():'';
 }catch{return '';}
}

async function updateWithOptionalReviewedAt(table:string,id:string,patch:any){
 let result=await db.from(table).update({...patch,reviewed_at:new Date().toISOString()}).eq('id',id);
 if(result.error&&/reviewed_at|column/i.test(result.error.message||'')){
  result=await db.from(table).update(patch).eq('id',id);
 }
 if(result.error)throw result.error;
}

function displayValue(value:any){
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='object')return JSON.stringify(value);
 return String(value).slice(0,700);
}

async function pendingCounts(){
 const entries=Object.entries(pendingConfigs) as any[];
 const values=await Promise.all(entries.map(async([table,cfg])=>{
  const {count}=await db.from(table)
   .select('id',{count:'exact',head:true})
   .eq(cfg.status,cfg.pending);
  return [table,count||0];
 }));
 return Object.fromEntries(values);
}

async function pendingMenu(chatId:string,mid:number){
 const counts=await pendingCounts();
 const rows=Object.entries(pendingConfigs).map(([table,cfg]:any)=>[
  {text:`${counts[table]?'🟠':'⚪'} ${cfg.title} (${counts[table]||0})`,callback_data:pendingCb('l',table,0)}
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
  callback_data:pendingCb('v',table,item.id,page)
 }]);
 if(page>0)rows.push([{text:'السابق',callback_data:pendingCb('l',table,page-1)}]);
 if((data||[]).length===7)rows.push([{text:'التالي',callback_data:pendingCb('l',table,page+1)}]);
 rows.push([{text:'⬅️ الأقسام',callback_data:'pending:menu'}]);
 await edit(chatId,mid,(data||[]).length?cfg.title:`لا توجد طلبات في ${cfg.title}`,rows);
}

async function pendingView(chatId:string,mid:number,table:string,id:string,page=0){
 const cfg=pendingConfigs[table];
 if(!cfg)throw new Error('نوع الطلب غير معروف');
 const {data,error}=await db.from(table).select('*').eq('id',id).single();
 if(error)throw error;

 const labels:any={
  title:'العنوان',subject:'المادة/المجموعة',course_code:'رمز المادة',college:'الكلية',
  resource_type:'النوع',description:'الوصف',url:'الرابط',link:'الرابط',created_at:'تاريخ الإرسال',
  target_type:'نوع التقييم',target_name:'الاسم',overall:'التقييم العام',teaching:'الشرح',
  interaction:'التعامل',exam_difficulty:'صعوبة الاختبارات',recommended:'ينصح به',comment:'التعليق',
  text:'النص',content:'المحتوى',major:'التخصص',owner_name:'صاحب المشروع',request_type:'نوع الطلب',
  code:'الرمز',name_ar:'الاسم بالعربي',name_en:'الاسم بالإنجليزي',department:'القسم',
  category:'التصنيف',details:'التفاصيل',contact:'التواصل',source_table:'المصدر',
  source_title:'عنوان الرابط',source_url:'الرابط المبلغ عنه',reason:'السبب'
 };
 const lines=cfg.fields
  .filter((field:string)=>data[field]!==null&&data[field]!==undefined&&data[field]!=='')
  .map((field:string)=>{
   let value=data[field];
   if(field==='created_at')value=new Date(value).toLocaleString('ar');
   if(field==='recommended')value=value?'نعم':'لا';
   return `${labels[field]||field}: ${displayValue(value)}`;
  }).join('\n');

 const keyboard:any[]=[];
 const external=(cfg.urlFields||[]).map((f:string)=>validExternalUrl(data[f])).find(Boolean);
 if(external)keyboard.push([{text:table==='whatsapp_groups'?'🔗 فتح المجموعة':'📎 فتح الرابط/الملف',url:external}]);
 keyboard.push([
  {text:'✅ قبول',callback_data:pendingCb('a',table,id,page)},
  {text:'❌ رفض',callback_data:pendingCb('r',table,id,page)}
 ]);
 keyboard.push([{text:'🗑 حذف نهائي',callback_data:pendingCb('x',table,id,page)}]);
 keyboard.push([{text:'⬅️ القائمة',callback_data:pendingCb('l',table,page)}]);
 await edit(chatId,mid,`${cfg.title}

${lines||'لا توجد تفاصيل إضافية'}`,keyboard);
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
 await updateWithOptionalReviewedAt(table,id,{[cfg.status]:cfg.approve});
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
  [{text:'🕓 طلبات المقررات',callback_data:pendingCb('l','course_requests',0)}],
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
  [{text:'✏️ تعديل الاسم',callback_data:`c:e:${id}:n:${page}`},{text:'🏷 تعديل الرمز',callback_data:`c:e:${id}:c:${page}`}],
  [{text:'🏫 تعديل الكلية',callback_data:`c:e:${id}:g:${page}`},{text:'⏱ تعديل الساعات',callback_data:`c:e:${id}:h:${page}`}],
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
 const now=new Date();
 const todayStart=new Date(now); todayStart.setHours(0,0,0,0);
 const yesterdayStart=new Date(todayStart.getTime()-86400000);
 const todayISO=todayStart.toISOString();
 const yesterdayISO=yesterdayStart.toISOString();

 const [
  {data:todayEvents},{data:yesterdayEvents},{count:courses},
  {count:summaries},{count:pendingSummaries},{count:groups},{count:pendingGroups},
  {count:ratings},{count:pendingRatings},{count:errors},{count:reports},{count:suggestions},
  {data:backup},{data:state}
 ]=await Promise.all([
  db.from('usage_events').select('event_type,session_id,metadata,created_at').gte('created_at',todayISO),
  db.from('usage_events').select('event_type,session_id,metadata,created_at').gte('created_at',yesterdayISO).lt('created_at',todayISO),
  db.from('courses').select('id',{count:'exact',head:true}).eq('active',true),
  db.from('summaries').select('id',{count:'exact',head:true}).eq('approved',true),
  db.from('summaries').select('id',{count:'exact',head:true}).eq('approved',false),
  db.from('whatsapp_groups').select('id',{count:'exact',head:true}).eq('approved',true),
  db.from('whatsapp_groups').select('id',{count:'exact',head:true}).eq('approved',false),
  db.from('rating_submissions').select('id',{count:'exact',head:true}).eq('status','approved'),
  db.from('rating_submissions').select('id',{count:'exact',head:true}).eq('status','pending'),
  db.from('system_errors').select('id',{count:'exact',head:true}).gte('created_at',todayISO),
  db.from('broken_link_reports').select('id',{count:'exact',head:true}).eq('status','pending'),
  db.from('feature_suggestions').select('id',{count:'exact',head:true}).eq('status','pending'),
  db.from('backup_runs').select('status,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle(),
  db.rpc('uon_public_state')
 ]);

 const todayVisitors=new Set((todayEvents||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
 const yesterdayVisitors=new Set((yesterdayEvents||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
 const diff=todayVisitors-yesterdayVisitors;
 const percent=yesterdayVisitors?Math.round((diff/yesterdayVisitors)*100):(todayVisitors?100:0);
 const trend=diff>0?`📈 +${diff} (+${percent}%)`:diff<0?`📉 ${diff} (${percent}%)`:'➖ بدون تغيير';

 const featureLabels:any={
  'assistant':'UON AI','ai':'UON AI','uon-ai':'UON AI',
  'summaries':'الملخصات','groups':'المجموعات','whatsapp':'المجموعات',
  'gpa':'حاسبة المعدل','ratings':'التقييمات','courses':'المقررات',
  'projects':'المشاريع الطلابية','useful-sites':'المواقع والبرامج','university-guide':'دليل الجامعة',
  'schedule':'الجدول الدراسي','calendar':'التقويم الأكاديمي'
 };
 const featureCounts:any={};
 (todayEvents||[]).filter((x:any)=>x.event_type==='feature_open').forEach((x:any)=>{
  const key=String(x.metadata?.feature||'').trim();
  if(key)featureCounts[key]=(featureCounts[key]||0)+1;
 });
 const medals=['🥇','🥈','🥉'];
 const topFeatures=Object.entries(featureCounts).sort((a:any,b:any)=>b[1]-a[1]).slice(0,3)
  .map(([key,count],i)=>`${medals[i]} ${featureLabels[key]||key}: ${count}`).join('\n')||'لا توجد بيانات بعد';

 const pendingTotal=(pendingSummaries||0)+(pendingGroups||0)+(pendingRatings||0)+(suggestions||0)+(reports||0);
 const backupText=backup?`${backup.status==='completed'?'✅':backup.status==='failed'?'❌':'⏳'} ${new Date(backup.created_at).toLocaleString('ar-OM')}`:'لا توجد';
 const text=`📊 لوحة إحصائيات UON Hub

👥 الزوار اليوم: ${todayVisitors}
👤 الزوار أمس: ${yesterdayVisitors}
${trend}
🧭 الأحداث اليوم: ${(todayEvents||[]).length}

📚 الملخصات
✅ المعتمدة: ${summaries||0}
⏳ بانتظار المراجعة: ${pendingSummaries||0}

💬 المجموعات
✅ المعتمدة: ${groups||0}
⏳ بانتظار المراجعة: ${pendingGroups||0}

⭐ التقييمات
✅ المعتمدة: ${ratings||0}
⏳ بانتظار المراجعة: ${pendingRatings||0}

💡 الاقتراحات المعلقة: ${suggestions||0}
🔗 بلاغات الروابط: ${reports||0}
🕓 إجمالي الطلبات المعلقة: ${pendingTotal}

🔥 أكثر الأدوات استخدامًا اليوم
${topFeatures}

📘 المواد النشطة: ${courses||0}
⚠️ الأخطاء اليوم: ${errors||0}
🛠 صيانة الموقع: ${state?.maintenance_enabled?'مفعلة 🔴':'متوقفة ✅'}
💾 آخر نسخة: ${backupText}`;
 await edit(chatId,mid,text,[
  [{text:'🔄 تحديث',callback_data:'dashboard'},{text:'📨 إرسال تقرير اليوم',callback_data:'report:send'}],
  [{text:'📈 إحصائيات آخر 7 أيام',callback_data:'dashboard:details'}],
  [{text:'🕓 فتح الطلبات المعلقة',callback_data:'pending:menu'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}

async function dashboardDetails(chatId:string,mid:number){
 const start=new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-6);
 const {data:events,error}=await db.from('usage_events')
  .select('event_type,session_id,metadata,created_at')
  .gte('created_at',start.toISOString()).order('created_at',{ascending:true});
 if(error)throw error;

 const days:any={};
 const featureCounts:any={};
 const featureLabels:any={
  'assistant':'UON AI','ai':'UON AI','uon-ai':'UON AI','summaries':'الملخصات',
  'groups':'المجموعات','whatsapp':'المجموعات','gpa':'حاسبة المعدل','ratings':'التقييمات',
  'courses':'المقررات','projects':'المشاريع الطلابية','useful-sites':'المواقع والبرامج',
  'university-guide':'دليل الجامعة','schedule':'الجدول الدراسي','calendar':'التقويم الأكاديمي'
 };
 for(let i=0;i<7;i++){
  const d=new Date(start); d.setDate(start.getDate()+i);
  const key=d.toISOString().slice(0,10);
  days[key]={label:d.toLocaleDateString('ar-OM',{weekday:'short',day:'numeric',month:'numeric'}),sessions:new Set(),events:0};
 }
 for(const event of events||[]){
  const key=String(event.created_at||'').slice(0,10);
  if(days[key]){
   days[key].events++;
   if(event.session_id)days[key].sessions.add(event.session_id);
  }
  if(event.event_type==='feature_open'&&event.metadata?.feature){
   const feature=String(event.metadata.feature);
   featureCounts[feature]=(featureCounts[feature]||0)+1;
  }
 }
 const daily=Object.values(days).map((d:any)=>`${d.label}: 👥 ${d.sessions.size} | 🧭 ${d.events}`).join('\n');
 const top=Object.entries(featureCounts).sort((a:any,b:any)=>b[1]-a[1]).slice(0,8)
  .map(([key,value],i)=>`${i+1}. ${featureLabels[key]||key}: ${value}`).join('\n')||'لا توجد بيانات بعد';
 const totalVisitors=new Set((events||[]).map((x:any)=>x.session_id).filter(Boolean)).size;

 await edit(chatId,mid,`📈 إحصائيات آخر 7 أيام

${daily}

👥 الزوار الفريدون خلال الفترة: ${totalVisitors}
🧭 إجمالي الأحداث: ${(events||[]).length}

🔥 أكثر الأدوات استخدامًا
${top}`,[[{text:'🔄 تحديث',callback_data:'dashboard:details'}],[{text:'⬅️ لوحة الإحصائيات',callback_data:'dashboard'}]]);
}

async function backupMenu(chatId:string,mid:number){
 const {data,error}=await db.from('backup_runs').select('*').order('created_at',{ascending:false}).limit(8);
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${item.status==='completed'?'✅':item.status==='failed'?'❌':'⏳'} ${new Date(item.created_at).toLocaleString('ar')}`,
  callback_data:`b:v:${item.id}`
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
  callback_data:`a:v:${item.id}`
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
   [{text:'فتح الطلب',callback_data:pendingCb('v',table,id,0)}],
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
  audit(admin,'maintenance_message','site_settings','maintenance_message',{value:text});
  await send(chatId,'تم تحديث رسالة الصيانة ✅');
  return true;
 }

 if(state==='setting_value'){
  await db.from('site_settings').upsert({key:data.key,value:text,updated_at:new Date().toISOString()});
  await clearConversation(chatId);
  audit(admin,'setting_update','site_settings',data.key,{value:text});
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
  audit(admin,'course_create','courses',data.code,data);
  await send(chatId,'تمت إضافة المادة ✅');
  return true;
 }

 if(state==='course_edit_value'){
  const value=data.field==='credit_hours'?Number(text)||null:data.field==='code'?text.toUpperCase().replace(/\s+/g,''):text;
  const {error}=await db.from('courses').update({[data.field]:value,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw error;
  await clearConversation(chatId);
  audit(admin,'course_update','courses',data.id,{field:data.field,value});
  await send(chatId,'تم تعديل المادة ✅');
  return true;
 }

 if(state==='useful_add_title'){
  await setConversation(chatId,'useful_add_url',{title_ar:text});
  await send(chatId,'أرسل رابط الموقع كاملًا');
  return true;
 }
 if(state==='useful_add_url'){
  await setConversation(chatId,'useful_add_category',{...data,url:text});
  await send(chatId,'أرسل التصنيف: university أو math أو files أو ai أو academic أو books');
  return true;
 }
 if(state==='useful_add_category'){
  const {error}=await db.from('useful_sites').insert({
   title_ar:data.title_ar,url:data.url,category:text.trim().toLowerCase(),
   icon:'🔗',active:true,sort_order:100
  });
  if(error)throw error;
  await clearConversation(chatId);
  audit(admin,'useful_site_create','useful_sites','',{title:data.title_ar,url:data.url});
  await send(chatId,'تمت إضافة الموقع ✅');
  return true;
 }

 if(state==='useful_edit_value'){
  let value:any=text;
  if(data.field==='sort_order')value=Number(text)||100;
  const {error}=await db.from('useful_sites').update({
   [data.field]:value,updated_at:new Date().toISOString()
  }).eq('id',data.id);
  if(error)throw error;
  await clearConversation(chatId);
  audit(admin,'useful_site_update','useful_sites',data.id,{field:data.field,value});
  await send(chatId,'تم تعديل الموقع ✅');
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
  audit(admin,'notification_create','site_notifications','',{title:data.title});
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
  audit(admin,'announcement_create','site_announcements','',{title:data.title});
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
   if(payload.table&&payload.id){
    background(notifyAdmins(String(payload.table),String(payload.id)));
   }
   return response({ok:true});
  }

  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET){
   return response({ok:false,error:'unauthorized'},401);
  }

  const callback=payload.callback_query;
  const message=payload.message;

  // Stop Telegram's loading spinner immediately, before any database work.
  if(callback){
   background(telegram('answerCallbackQuery',{callback_query_id:callback.id}));
  }

  const chatId=String(callback?.message?.chat?.id||message?.chat?.id||'');
  const admin=await getAdmin(chatId);
  if(!admin)return response({ok:true});

  if(message){
   const text=String(message.text||'').trim();
   const {data:conv}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();

   if(conv&&await handleConversation(chatId,admin,text,conv))return response({ok:true});

   if(text==='/ping'){
    await send(chatId,'⚡ البوت يعمل');
   }else if(text==='/start'||text==='/menu')await home(chatId,admin);
   else if(text==='/diagnostics'){
    const checks=await Promise.all(Object.entries(pendingConfigs).map(async([table,cfg]:any)=>{
     const {count,error}=await db.from(table).select('id',{count:'exact',head:true}).eq(cfg.status,cfg.pending);
     return `${error?'❌':'✅'} ${cfg.title}: ${error?error.message:(count||0)+' معلق'}`;
    }));
    await send(chatId,`فحص أزرار وجداول المراجعة V18.7\n\n${checks.join('\n')}\n\n✅ callback_data تم ضغطها لتوافق حد Telegram.`);
   }
   else if(text==='/health'){
    const {data,error}=await db.rpc('uon_public_state');
    await send(chatId,error?`خطأ: ${error.message}`:`البوت يعمل ✅\nالصيانة: ${data.maintenance_enabled?'مفعلة':'متوقفة'}\nالإصدار: V18.7`);
   }else await home(chatId,admin);
   return response({ok:true});
  }

  if(callback){
   const data=String(callback.data||'');
   const mid=callback.message.message_id;

   try{
    if(data==='home')await home(chatId,admin,mid);
    else if(data==='dashboard')await dashboard(chatId,mid);
    else if(data==='dashboard:details')await dashboardDetails(chatId,mid);
    else if(data==='services')await servicesMenu(chatId,mid);
    else if(data.startsWith('service:view:'))await serviceView(chatId,mid,data.split(':')[2]);
    else if(data.startsWith('service:set:')){
     if(!can(admin,'features'))throw new Error('ليس لديك صلاحية إدارة الخدمات');
     const [, ,key,status]=data.split(':');
     const {error}=await db.rpc('uon_set_feature_state',{p_key:key,p_status:status});
     if(error)throw error;
     audit(admin,'feature_state','platform_features',key,{status});
     await serviceView(chatId,mid,key);
    }
    else if(data==='maintenance:menu')await maintenanceMenu(chatId,mid);
    else if(data.startsWith('maintenance:set:')){
     if(!can(admin,'maintenance'))throw new Error('ليس لديك صلاحية الصيانة');
     const enabled=data.endsWith(':on');
     const {error}=await db.rpc('uon_set_maintenance',{p_enabled:enabled});
     if(error)throw error;
     audit(admin,'maintenance_toggle','site_settings','maintenance_enabled',{enabled});
     await maintenanceMenu(chatId,mid);
    }
    else if(data==='maintenance:message'){
     await setConversation(chatId,'maintenance_message',{});
     await edit(chatId,mid,'أرسل رسالة الصيانة الجديدة',[[{text:'⬅️ إلغاء',callback_data:'maintenance:menu'}]]);
    }
    else if(data==='pending:menu')await pendingMenu(chatId,mid);
    else if(data.startsWith('p:')){
     const [,action,tableCode,idOrPage,pageRaw]=data.split(':');
     const table=pendingTable(tableCode);
     const page=Number(pageRaw)||0;
     if(action==='l')await pendingList(chatId,mid,table,Number(idOrPage)||0);
     else if(action==='v')await pendingView(chatId,mid,table,idOrPage,page);
     else if(action==='a'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
      await approvePending(table,idOrPage); audit(admin,'pending_approve',table,idOrPage);
      await pendingList(chatId,mid,table,page);
     }else if(action==='r'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
      const cfg=pendingConfigs[table];
      if(cfg.booleanModeration){
       const {error}=await db.from(table).delete().eq('id',idOrPage); if(error)throw error;
      }else await updateWithOptionalReviewedAt(table,idOrPage,{[cfg.status]:cfg.reject});
      audit(admin,'pending_reject',table,idOrPage);
      await pendingList(chatId,mid,table,page);
     }else if(action==='x'){
      await edit(chatId,mid,'تأكيد الحذف النهائي؟',[
       [{text:'نعم، حذف',callback_data:pendingCb('d',table,idOrPage,page)}],
       [{text:'إلغاء',callback_data:pendingCb('v',table,idOrPage,page)}]
      ]);
     }else if(action==='d'){
      if(!isOwner(admin))throw new Error('الحذف النهائي للمالك فقط');
      const {error}=await db.from(table).delete().eq('id',idOrPage); if(error)throw error;
      audit(admin,'pending_delete',table,idOrPage);
      await pendingList(chatId,mid,table,page);
     }
    }
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
     audit(admin,'pending_approve',table,id);
     await pendingList(chatId,mid,table,Number(page)||0);
    }
    else if(data.startsWith('pending:reject:')){
     if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
     const [, ,table,id,page]=data.split(':');
     const cfg=pendingConfigs[table];
     if(cfg.booleanModeration){
      const {error}=await db.from(table).delete().eq('id',id); if(error)throw error;
     }else await updateWithOptionalReviewedAt(table,id,{[cfg.status]:cfg.reject});
     audit(admin,'pending_reject',table,id);
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
     audit(admin,'pending_delete',table,id);
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
    else if(data.startsWith('c:e:')){
     if(!can(admin,'courses'))throw new Error('ليس لديك صلاحية إدارة المقررات');
     const [, ,id,fieldCode,page]=data.split(':');
     const fieldMap:any={n:'name_ar',c:'code',g:'college',h:'credit_hours'};
     const field=fieldMap[fieldCode];
     if(!field)throw new Error('حقل التعديل غير معروف');
     await setConversation(chatId,'course_edit_value',{id,field,page});
     await edit(chatId,mid,'أرسل القيمة الجديدة',[[{text:'⬅️ إلغاء',callback_data:`course:view:${id}:${page}`}]]);
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
     audit(admin,'course_toggle','courses',id,{active:state==='on'});
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
     audit(admin,'course_delete','courses',id);
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
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`an:t:${x.id}:${x.active?'0':'1'}:${page}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,(rows||[]).length?'اضغط الإعلان لتغيير حالته':'لا توجد إعلانات',keyboard);
    }
    else if(data.startsWith('an:t:')){
     const [, ,id,state,page]=data.split(':');
     const active=state==='1';
     const {error}=await db.from('site_announcements').update({active,updated_at:new Date().toISOString()}).eq('id',id);
     if(error)throw error;
     audit(admin,'announcement_toggle','site_announcements',id,{active});
     const p=Number(page)||0;
     const {data:rows}=await db.from('site_announcements').select('*').order('created_at',{ascending:false}).range(p*7,p*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`an:t:${x.id}:${x.active?'0':'1'}:${p}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,'تم تحديث الإعلان ✅',keyboard);
    }
    else if(data.startsWith('announcement:toggle:')){
     const [, ,id,state,page]=data.split(':');
     await db.from('site_announcements').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     audit(admin,'announcement_toggle','site_announcements',id,{active:state==='on'});
     const p=Number(page)||0;
     const {data:rows}=await db.from('site_announcements').select('*').order('created_at',{ascending:false}).range(p*7,p*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`an:t:${x.id}:${x.active?'0':'1'}:${p}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,'تم تحديث الإعلان ✅',keyboard);
    }
    else if(data.startsWith('notification:list:')){
     const page=Number(data.split(':')[2])||0;
     const {data:rows}=await db.from('site_notifications').select('*').order('created_at',{ascending:false}).range(page*7,page*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`nt:t:${x.id}:${x.active?'0':'1'}:${page}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,(rows||[]).length?'اضغط الإشعار لتغيير حالته':'لا توجد إشعارات',keyboard);
    }
    else if(data.startsWith('nt:t:')){
     const [, ,id,state,page]=data.split(':');
     const active=state==='1';
     const {error}=await db.from('site_notifications').update({active}).eq('id',id);
     if(error)throw error;
     audit(admin,'notification_toggle','site_notifications',id,{active});
     const p=Number(page)||0;
     const {data:rows}=await db.from('site_notifications').select('*').order('created_at',{ascending:false}).range(p*7,p*7+6);
     const keyboard=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title}`,callback_data:`nt:t:${x.id}:${x.active?'0':'1'}:${p}`}]);
     keyboard.push([{text:'⬅️ المحتوى',callback_data:'content:menu'}]);
     await edit(chatId,mid,'تم تحديث الإشعار ✅',keyboard);
    }
    else if(data.startsWith('notification:toggle:')){
     const [, ,id,state,page]=data.split(':');
     await db.from('site_notifications').update({active:state==='on'}).eq('id',id);
     audit(admin,'notification_toggle','site_notifications',id,{active:state==='on'});
     await contentMenu(chatId,mid);
    }
    else if(data==='useful:menu'){
     const {data:rows,error}=await db.from('useful_sites').select('*').order('sort_order').limit(20);
     if(error)throw error;
     const keyboard=(rows||[]).map((item:any)=>[{
      text:`${item.active?'🟢':'🔴'} ${item.title_ar}`,
      callback_data:`u:v:${item.id}`
     }]);
     keyboard.unshift([{text:'➕ إضافة موقع',callback_data:'useful:add'}]);
     keyboard.push([{text:'⚙️ حالة الأداة',callback_data:'service:view:useful-sites'}],[{text:'⬅️ الرئيسية',callback_data:'home'}]);
     await edit(chatId,mid,'المواقع المهمة والمفيدة',keyboard);
    }
    else if(data==='useful:add'){
     await setConversation(chatId,'useful_add_title',{});
     await edit(chatId,mid,'أرسل اسم الموقع',[[{text:'⬅️ إلغاء',callback_data:'useful:menu'}]]);
    }
    else if(data.startsWith('u:')){
     const [,action,id,arg]=data.split(':');
     if(action==='v'){
      const {data:item,error}=await db.from('useful_sites').select('*').eq('id',id).single();
      if(error)throw error;
      await edit(chatId,mid,`${item.title_ar}\n${item.url}\nالتصنيف: ${item.category}\nالحالة: ${item.active?'ظاهر':'مخفي'}`,[
       [{text:'✏️ الاسم',callback_data:`u:e:${id}:n`},{text:'🔗 الرابط',callback_data:`u:e:${id}:u`}],
       [{text:'🏷 التصنيف',callback_data:`u:e:${id}:c`},{text:'🎨 الأيقونة',callback_data:`u:e:${id}:i`}],
       [{text:'↕️ الترتيب',callback_data:`u:e:${id}:s`}],
       [{text:item.active?'🔴 إخفاء':'🟢 إظهار',callback_data:`u:t:${id}:${item.active?'0':'1'}`}],
       [{text:'🗑 حذف',callback_data:`u:x:${id}`}],
       [{text:'⬅️ المواقع',callback_data:'useful:menu'}]
      ]);
     }else if(action==='e'){
      const fieldMap:any={n:'title_ar',u:'url',c:'category',i:'icon',s:'sort_order'};
      const field=fieldMap[arg]; if(!field)throw new Error('حقل الموقع غير معروف');
      await setConversation(chatId,'useful_edit_value',{id,field});
      await edit(chatId,mid,'أرسل القيمة الجديدة',[[{text:'⬅️ إلغاء',callback_data:`u:v:${id}`}]]);
     }else if(action==='t'){
      const active=arg==='1';
      const {error}=await db.from('useful_sites').update({active,updated_at:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
      audit(admin,'useful_site_toggle','useful_sites',id,{active});
      const {data:item}=await db.from('useful_sites').select('*').eq('id',id).single();
      await edit(chatId,mid,`${item.title_ar}\nتم تحديث الحالة ✅`,[[{text:'⬅️ المواقع',callback_data:'useful:menu'}]]);
     }else if(action==='x'){
      await edit(chatId,mid,'تأكيد حذف الموقع؟',[[{text:'نعم، حذف',callback_data:`u:d:${id}`}],[{text:'إلغاء',callback_data:`u:v:${id}`}]]);
     }else if(action==='d'){
      if(!isOwner(admin))throw new Error('الحذف للمالك فقط');
      const {error}=await db.from('useful_sites').delete().eq('id',id); if(error)throw error;
      audit(admin,'useful_site_delete','useful_sites',id);
      await edit(chatId,mid,'تم حذف الموقع ✅',[[{text:'⬅️ المواقع',callback_data:'useful:menu'}]]);
     }
    }
    else if(data.startsWith('useful:view:')){
     const id=data.split(':')[2];
     const {data:item,error}=await db.from('useful_sites').select('*').eq('id',id).single();
     if(error)throw error;
     await edit(chatId,mid,`${item.title_ar}\n${item.url}\nالتصنيف: ${item.category}\nالحالة: ${item.active?'نشط':'متوقف'}`,[
      [{text:'✏️ الاسم',callback_data:`u:e:${id}:n`},{text:'🔗 الرابط',callback_data:`u:e:${id}:u`}],
      [{text:'🏷 التصنيف',callback_data:`u:e:${id}:c`},{text:'🎨 الأيقونة',callback_data:`u:e:${id}:i`}],
      [{text:'↕️ الترتيب',callback_data:`u:e:${id}:s`}],
      [{text:item.active?'🔴 إخفاء':'🟢 إظهار',callback_data:`u:t:${id}:${item.active?'0':'1'}`}],
      [{text:'🗑 حذف',callback_data:`u:x:${id}`}],
      [{text:'⬅️ المواقع',callback_data:'useful:menu'}]
     ]);
    }
    else if(data.startsWith('useful:edit:')){
     const [, ,id,field]=data.split(':');
     await setConversation(chatId,'useful_edit_value',{id,field});
     await edit(chatId,mid,'أرسل القيمة الجديدة',[[{text:'⬅️ إلغاء',callback_data:`u:v:${id}`}]]); 
    }
    else if(data.startsWith('useful:toggle:')){
     const [, ,id,state]=data.split(':');
     const {error}=await db.from('useful_sites').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     if(error)throw error;
     audit(admin,'useful_site_toggle','useful_sites',id,{active:state==='on'});
     const {data:item}=await db.from('useful_sites').select('*').eq('id',id).single();
     await edit(chatId,mid,`${item.title_ar}\nتم تحديث الحالة ✅`,[[{text:'⬅️ المواقع',callback_data:'useful:menu'}]]);
    }
    else if(data.startsWith('useful:deleteask:')){
     const id=data.split(':')[2];
     await edit(chatId,mid,'تأكيد حذف الموقع؟',[
      [{text:'نعم، حذف',callback_data:`u:d:${id}`}],
      [{text:'إلغاء',callback_data:`u:v:${id}`}]
     ]);
    }
    else if(data.startsWith('useful:delete:')){
     if(!isOwner(admin))throw new Error('الحذف للمالك فقط');
     const id=data.split(':')[2];
     const {error}=await db.from('useful_sites').delete().eq('id',id);
     if(error)throw error;
     audit(admin,'useful_site_delete','useful_sites',id);
     await edit(chatId,mid,'تم حذف الموقع ✅',[[{text:'⬅️ المواقع',callback_data:'useful:menu'}]]);
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
     audit(admin,'backup_create','backup_runs','');
     await backupMenu(chatId,mid);
    }
    else if(data.startsWith('b:')){
     const [,action,id]=data.split(':');
     if(action==='v'){
      const {data:item,error}=await db.from('backup_runs').select('*').eq('id',id).single(); if(error)throw error;
      await edit(chatId,mid,`النسخة الاحتياطية\nالحالة: ${item.status}\nالتاريخ: ${new Date(item.created_at).toLocaleString('ar')}\nالملف: ${item.file_url||'—'}`,[
       [{text:'♻️ استعادة هذه النسخة',callback_data:`b:x:${id}`}],[{text:'⬅️ النسخ',callback_data:'backup:menu'}]
      ]);
     }else if(action==='x'){
      await edit(chatId,mid,'تحذير: الاستعادة ستستبدل البيانات الحالية. هل أنت متأكد؟',[
       [{text:'تأكيد الاستعادة',callback_data:`b:r:${id}`}],[{text:'إلغاء',callback_data:`b:v:${id}`}]
      ]);
     }else if(action==='r'){
      if(!isOwner(admin))throw new Error('الاستعادة للمالك فقط');
      const r=await fetch(`${URL}/functions/v1/database-restore`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${KEY}`},body:JSON.stringify({backup_id:id})});
      if(!r.ok)throw new Error(await r.text()); audit(admin,'backup_restore','backup_runs',id);
      await edit(chatId,mid,'اكتملت الاستعادة ✅',[[{text:'⬅️ النسخ',callback_data:'backup:menu'}]]);
     }
    }
    else if(data.startsWith('backup:view:')){
     const id=data.split(':')[2];
     const {data:item,error}=await db.from('backup_runs').select('*').eq('id',id).single();
     if(error)throw error;
     await edit(chatId,mid,`النسخة الاحتياطية
الحالة: ${item.status}
التاريخ: ${new Date(item.created_at).toLocaleString('ar')}
الملف: ${item.file_path||'—'}`,[
      [{text:'♻️ استعادة هذه النسخة',callback_data:`b:x:${id}`}],
      [{text:'⬅️ النسخ',callback_data:'backup:menu'}]
     ]);
    }
    else if(data.startsWith('backup:restoreask:')){
     if(!isOwner(admin))throw new Error('الاستعادة للمالك فقط');
     const id=data.split(':')[2];
     await edit(chatId,mid,'⚠️ تأكيد الاستعادة؟ ستتم مزامنة بيانات النسخة مع الجداول الحالية.',[
      [{text:'تأكيد الاستعادة',callback_data:`b:r:${id}`}],
      [{text:'إلغاء',callback_data:`b:v:${id}`}]
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
     audit(admin,'backup_restore','backup_runs',id);
     await edit(chatId,mid,'اكتملت الاستعادة ✅',[[{text:'⬅️ النسخ',callback_data:'backup:menu'}]]);
    }
    else if(data==='report:send'){
     const result=await fetch(`${URL}/functions/v1/daily-report`,{
      method:'POST',
      headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},
      body:JSON.stringify({chat_id:chatId})
     });
     if(!result.ok)throw new Error(await result.text());
     background(send(chatId,'تم إرسال التقرير اليومي ✅'));
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
     audit(admin,'admin_create','telegram_admins',conv.data.chat_id,{role});
     await adminsMenu(chatId,mid);
    }
    else if(data.startsWith('a:')){
     const [,action,id,arg]=data.split(':');
     if(action==='v'){
      const {data:item,error}=await db.from('telegram_admins').select('*').eq('id',id).single(); if(error)throw error;
      await edit(chatId,mid,`${item.name}\nChat ID: ${item.chat_id}\nالدور: ${item.role}\nالحالة: ${item.active?'نشط':'متوقف'}`,[
       [{text:item.active?'🔴 إيقاف':'🟢 تفعيل',callback_data:`a:t:${id}:${item.active?'0':'1'}`}],
       [{text:'🗑 حذف',callback_data:`a:x:${id}`}],[{text:'⬅️ المشرفون',callback_data:'admins:menu'}]
      ]);
     }else if(action==='t'){
      if(!isOwner(admin))throw new Error('إدارة المشرفين للمالك فقط');
      const active=arg==='1'; const {error}=await db.from('telegram_admins').update({active}).eq('id',id); if(error)throw error;
      adminCache.clear(); audit(admin,'admin_toggle','telegram_admins',id,{active}); await adminsMenu(chatId,mid);
     }else if(action==='x'){
      if(!isOwner(admin))throw new Error('إدارة المشرفين للمالك فقط');
      await edit(chatId,mid,'تأكيد حذف المشرف؟',[[{text:'نعم، حذف',callback_data:`a:d:${id}`}],[{text:'إلغاء',callback_data:`a:v:${id}`}]]);
     }else if(action==='d'){
      if(!isOwner(admin))throw new Error('إدارة المشرفين للمالك فقط');
      const {error}=await db.from('telegram_admins').delete().eq('id',id); if(error)throw error;
      adminCache.clear(); audit(admin,'admin_delete','telegram_admins',id); await adminsMenu(chatId,mid);
     }
    }
    else if(data.startsWith('admin:view:')){
     const id=data.split(':')[2];
     const {data:item,error}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(error)throw error;
     await edit(chatId,mid,`${item.name}
Chat ID: ${item.chat_id}
الدور: ${item.role}
الحالة: ${item.active?'نشط':'متوقف'}`,[
      [{text:item.active?'🔴 إيقاف':'🟢 تفعيل',callback_data:`a:t:${id}:${item.active?'0':'1'}`}],
      [{text:'🗑 حذف',callback_data:`a:x:${id}`}],
      [{text:'⬅️ المشرفون',callback_data:'admins:menu'}]
     ]);
    }
    else if(data.startsWith('admin:toggle:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const [, ,id,state]=data.split(':');
     const {data:item}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(item.chat_id===chatId&&state==='off')throw new Error('لا يمكنك إيقاف حسابك الحالي');
     await db.from('telegram_admins').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
     audit(admin,'admin_toggle','telegram_admins',id,{active:state==='on'});
     await adminsMenu(chatId,mid);
    }
    else if(data.startsWith('admin:deleteask:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const id=data.split(':')[2];
     await edit(chatId,mid,'تأكيد حذف المشرف؟',[
      [{text:'نعم، حذف',callback_data:`a:d:${id}`}],
      [{text:'إلغاء',callback_data:`a:v:${id}`}]
     ]);
    }
    else if(data.startsWith('admin:delete:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const id=data.split(':')[2];
     const {data:item}=await db.from('telegram_admins').select('*').eq('id',id).single();
     if(item.chat_id===chatId)throw new Error('لا يمكنك حذف حسابك الحالي');
     await db.from('telegram_admins').delete().eq('id',id);
     audit(admin,'admin_delete','telegram_admins',id);
     await adminsMenu(chatId,mid);
    }
    else if(data==='audit:list'){
     const {data:rows}=await db.from('bot_audit_log').select('*').order('created_at',{ascending:false}).limit(12);
     const text=(rows||[]).map((x:any)=>`${x.success?'✅':'❌'} ${x.admin_name||x.admin_chat_id}\n${x.action} — ${x.target_type||''}\n${new Date(x.created_at).toLocaleString('ar')}`).join('\n\n')||'لا توجد عمليات مسجلة';
     await edit(chatId,mid,text,[[{text:'⬅️ الرئيسية',callback_data:'home'}]]);
    }
    else await home(chatId,admin,mid);

   }catch(error){
    audit(admin,'callback_error','telegram',data,{},false,String(error?.message||error));
    background(telegram('answerCallbackQuery',{
     callback_query_id:callback.id,
     text:String(error?.message||error).slice(0,180),
     show_alert:true
    }));
   }
   return response({ok:true});
  }

  return response({ok:true});
 }catch(error){
  return response({ok:false,error:String(error?.message||error)},500);
 }
});
