import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'https://uonhub.space';
const db=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const adminCache=new Map<string,{admin:any,expires:number}>();
const ADMIN_CACHE_TTL=300_000;

function background(task:Promise<any>){
 try{
  // Supabase Edge Runtime keeps the task alive after returning the webhook response.
  // @ts-ignore
  if(typeof EdgeRuntime!=='undefined'&&EdgeRuntime.waitUntil)EdgeRuntime.waitUntil(task.catch(()=>{}));
  else task.catch(()=>{});
 }catch{}
}

const ALLOWED_ORIGINS=new Set([
 'https://uonhub.space',
 'https://www.uonhub.space',
 'https://uon-hub.vercel.app'
]);

function isAllowedOrigin(origin:string){
 if(!origin)return false;
 if(ALLOWED_ORIGINS.has(origin))return true;
 try{
  const hostname=new URL(origin).hostname.toLowerCase();
  return hostname.endsWith('.vercel.app')&&(hostname.startsWith('uon-')||hostname.includes('uon-hub'));
 }catch{return false;}
}

function corsHeaders(req:Request){
 const origin=req.headers.get('origin')||'';
 return {
  'Access-Control-Allow-Origin':isAllowedOrigin(origin)?origin:'https://uonhub.space',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-admin-password, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Max-Age':'86400',
  'Vary':'Origin'
 };
}

const response=(req:Request,body:any='ok',status=200)=>new Response(
 typeof body==='string'?body:JSON.stringify(body),
 {status,headers:{...corsHeaders(req),'content-type':'application/json; charset=utf-8'}}
);

async function adminAuthorized(req:Request){
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(bearer&&bearer===KEY)return true;
 const password=req.headers.get('x-admin-password')||'';
 if(!password)return false;
 const {data,error}=await db.rpc('uon_admin_authorized',{p_password:password});
 return !error&&data===true;
}

async function telegram(method:string,body:any){
 const result=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(body),
  signal:AbortSignal.timeout(5_000)
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
  [{text:'🤖 مركز المشرف الذكي',callback_data:'ai:menu'}],
  [{text:'🗂 إدارة كل المحتوى',callback_data:'manage:menu'}],
  [{text:'📘 مركز المقررات',callback_data:'courses:menu'}],
  [{text:'📢 الإعلانات والإشعارات',callback_data:'content:menu'}],
  [{text:'🏫 مراكز الدعم والروابط',callback_data:'settings:menu'}],
  [{text:'🔗 المواقع المهمة والمفيدة',callback_data:'useful:menu'}],
 ];
 if(can(admin,'backups'))rows.push([{text:'💾 النسخ والاستعادة',callback_data:'backup:menu'}]);
 if(can(admin,'admins'))rows.push([{text:'👥 المشرفون والصلاحيات',callback_data:'admins:menu'}]);
 rows.push(
  [{text:'📋 سجل العمليات',callback_data:'audit:list'}],
  [{text:'🌐 فتح لوحة الموقع',url:`${SITE}/admin.html?v=30.0`}],
 );
 return rows;
}

async function home(chatId:string,admin:any,messageId?:number){
 const text=`لوحة إدارة UON Hub V30 AI Supervisor\nمرحبًا ${admin.name||'مشرف'} 👋\nاختر القسم الذي تريد إدارته.`;
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

// UON_AI_SUPERVISOR_V24
type AiAssessment={score:number;recommendation:'approve'|'review'|'reject';reasons:string[];flags:string[]};

function aiText(item:any,cfg:any){
 const fields=[...(cfg?.fields||[]),'text','content','description','details','comment','title','subject','course_code','college','major'];
 return fields.map((f:string)=>item?.[f]).filter((v:any)=>v!==null&&v!==undefined)
  .map((v:any)=>typeof v==='object'?JSON.stringify(v):String(v)).join(' ').trim();
}

function aiAssess(table:string,item:any,cfg:any):AiAssessment{
 const source=aiText(item,cfg);
 let score=72;
 const reasons:string[]=[];
 const flags:string[]=[];
 const external=(cfg?.urlFields||[]).map((f:string)=>validExternalUrl(item?.[f])).find(Boolean);
 if(source.length>=18){score+=7;reasons.push('المحتوى واضح وكافٍ');}
 else{score-=22;flags.push('short_content');reasons.push('المحتوى قصير أو ناقص');}
 if(['summaries','whatsapp_groups','student_projects'].includes(table)){
  if(external){score+=11;reasons.push('الرابط أو الملف صالح');}
  else{score-=28;flags.push('missing_link');reasons.push('الرابط أو الملف غير موجود');}
 }
 if(item?.course_code){score+=5;reasons.push('رمز المادة محدد');}
 if(item?.college){score+=3;reasons.push('الكلية محددة');}
 const personal=[/\b(?:\+?968)?[79]\d{7}\b/,/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,/@[A-Za-z0-9_]{3,}/];
 if(personal.some((x)=>x.test(source))){score-=18;flags.push('personal_data');reasons.push('قد يحتوي بيانات شخصية');}
 if(/(https?:\/\/){2,}|(?:www\.){2,}/i.test(source)||/(خصم|ربح سريع|تحويل مالي|استثمار مضمون)/i.test(source)){
  score-=24;flags.push('spam');reasons.push('مؤشرات محتوى مزعج أو دعائي');
 }
 if(/(تهديد|ابتزاز|قذف|تشهير|انتحار|إيذاء النفس)/i.test(source)){
  score-=40;flags.push('sensitive');reasons.push('محتوى حساس يحتاج مراجعة بشرية');
 }
 score=Math.max(0,Math.min(100,score));
 const recommendation=score>=86?'approve':score>=55?'review':'reject';
 return {score,recommendation,reasons:[...new Set(reasons)].slice(0,6),flags:[...new Set(flags)]};
}

const aiRecommendationLabel=(x:string)=>x==='approve'?'🟢 مقترح قبول':x==='reject'?'🔴 مقترح رفض':'🟡 مراجعة بشرية';

async function saveAiReview(table:string,id:string,a:AiAssessment){
 const {error}=await db.from('ai_supervisor_reviews').upsert({
  source_table:table,source_id:String(id),score:a.score,recommendation:a.recommendation,
  reasons:a.reasons,flags:a.flags,reviewed_by_ai_at:new Date().toISOString()
 },{onConflict:'source_table,source_id'});
 if(error&&!/relation .* does not exist/i.test(error.message||''))throw error;
}

async function recordDecision(admin:any,table:string,id:string,action:string,oldState:any,newState:any,note=''){
 const {error}=await db.from('moderation_decisions').insert({
  source_table:table,source_id:String(id),action,old_state:oldState||{},new_state:newState||{},
  admin_chat_id:String(admin?.chat_id||''),admin_name:admin?.name||'',note:note||null
 });
 if(error&&!/relation .* does not exist/i.test(error.message||''))throw error;
}

async function markNeedsChanges(table:string,id:string,admin:any){
 const cfg=pendingConfigs[table];
 const {data:item,error}=await db.from(table).select('*').eq('id',id).single();
 if(error)throw error;
 let patch:any=cfg.booleanModeration?{approved:false,moderation_status:'needs_changes'}:{[cfg.status]:'needs_changes'};
 let r=await db.from(table).update({...patch,reviewed_at:new Date().toISOString()}).eq('id',id);
 if(r.error&&/moderation_status|reviewed_at|column/i.test(r.error.message||'')){
  patch=cfg.booleanModeration?{approved:false}:{[cfg.status]:'needs_changes'};
  r=await db.from(table).update(patch).eq('id',id);
 }
 if(r.error)throw r.error;
 await recordDecision(admin,table,id,'needs_changes',item,patch);
 audit(admin,'pending_needs_changes',table,id);
}

async function assignToSelf(table:string,id:string,admin:any){
 const {error}=await db.from('moderation_assignments').insert({
  source_table:table,source_id:String(id),assigned_to_chat_id:String(admin.chat_id),
  assigned_by_chat_id:String(admin.chat_id),status:'assigned'
 });
 if(error&&error.code!=='23505')throw error;
 audit(admin,'pending_assign_self',table,id);
}

async function aiMenu(chatId:string,mid:number,admin:any){
 if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية الإشراف');
 const counts=await pendingCounts();
 const total=Object.values(counts).reduce((a:any,b:any)=>Number(a)+Number(b),0);
 const {data:s}=await db.from('ai_supervisor_settings').select('*').eq('id',true).maybeSingle();
 await edit(chatId,mid,`🤖 مركز المشرف الذكي\n\nالحالة: ${s?.enabled!==false?'🟢 يعمل':'🔴 متوقف'}\nالطلبات المعلقة: ${total}\nالقبول التلقائي: ${s?.auto_approve_enabled?'مفعل':'متوقف'}\nحد الثقة: ${s?.auto_approve_threshold||97}%`,[
  [{text:'🧠 تحليل الطلبات المعلقة',callback_data:'ai:scan'}],
  [{text:'📊 تقرير المشرف الذكي',callback_data:'ai:report'}],
  [{text:'📥 الطلبات المسندة لي',callback_data:'ai:mine'}],
  [{text:s?.enabled!==false?'🔴 إيقاف المشرف الذكي':'🟢 تشغيل المشرف الذكي',callback_data:`ai:toggle:${s?.enabled!==false?'0':'1'}`}],
  [{text:'⚙️ إعدادات القبول التلقائي',callback_data:'ai:auto:menu'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}

async function aiScanPending(chatId:string,mid:number,admin:any){
 let scanned=0,approve=0,review=0,reject=0;
 for(const [table,cfg] of Object.entries(pendingConfigs) as any[]){
  const {data}=await db.from(table).select('*').eq(cfg.status,cfg.pending).order('created_at',{ascending:true}).limit(40);
  for(const item of data||[]){
   const a=aiAssess(table,item,cfg); await saveAiReview(table,item.id,a); scanned++;
   if(a.recommendation==='approve')approve++; else if(a.recommendation==='reject')reject++; else review++;
  }
 }
 audit(admin,'ai_scan_pending','ai_supervisor_reviews','',{scanned,approve,review,reject});
 await edit(chatId,mid,`اكتمل التحليل الذكي ✅\n\nتم تحليل: ${scanned}\n🟢 مقترح قبول: ${approve}\n🟡 مراجعة بشرية: ${review}\n🔴 مقترح رفض: ${reject}`,[[{text:'🤖 العودة للمركز',callback_data:'ai:menu'}],[{text:'🕓 فتح الطلبات',callback_data:'pending:menu'}]]);
}

async function aiReport(chatId:string,mid:number){
 const {data:rows}=await db.from('ai_supervisor_reviews').select('*').order('reviewed_by_ai_at',{ascending:false}).limit(250);
 const st={approve:0,review:0,reject:0,flagged:0};
 for(const x of rows||[]){if(x.recommendation==='approve')st.approve++;else if(x.recommendation==='reject')st.reject++;else st.review++;if((x.flags||[]).length)st.flagged++;}
 await edit(chatId,mid,`📊 تقرير المشرف الذكي\n\nآخر التحليلات: ${(rows||[]).length}\n🟢 مقترح قبول: ${st.approve}\n🟡 مراجعة بشرية: ${st.review}\n🔴 مقترح رفض: ${st.reject}\n🚩 تحتوي مؤشرات: ${st.flagged}`,[[{text:'🧠 تحليل الآن',callback_data:'ai:scan'}],[{text:'⬅️ مركز AI',callback_data:'ai:menu'}]]);
}

async function assignedToMe(chatId:string,mid:number,admin:any){
 const {data:rows,error}=await db.from('moderation_assignments').select('*').eq('assigned_to_chat_id',String(admin.chat_id)).eq('status','assigned').order('created_at',{ascending:false}).limit(20);
 if(error)throw error;
 const keys=(rows||[]).map((x:any)=>[{text:`${pendingConfigs[x.source_table]?.title||x.source_table} — ${String(x.source_id).slice(0,10)}`,callback_data:pendingCb('v',x.source_table,x.source_id,0)}]);
 keys.push([{text:'⬅️ مركز AI',callback_data:'ai:menu'}]);
 await edit(chatId,mid,(rows||[]).length?'📥 الطلبات المسندة لك':'لا توجد طلبات مسندة لك',keys);
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
 const ai=aiAssess(table,data,cfg);
 await saveAiReview(table,id,ai);
 keyboard.push([
  {text:'✅ قبول',callback_data:pendingCb('a',table,id,page)},
  {text:'❌ رفض',callback_data:pendingCb('r',table,id,page)}
 ]);
 keyboard.push([
  {text:'🟡 يحتاج تعديل',callback_data:pendingCb('n',table,id,page)},
  {text:'👤 إسناد لي',callback_data:pendingCb('u',table,id,page)}
 ]);
 keyboard.push([{text:'🗑 حذف نهائي',callback_data:pendingCb('x',table,id,page)}]);
 keyboard.push([{text:'⬅️ القائمة',callback_data:pendingCb('l',table,page)}]);
 await edit(chatId,mid,`${cfg.title}

${lines||'لا توجد تفاصيل إضافية'}

🤖 تقييم المشرف الذكي
النتيجة: ${ai.score}/100
التوصية: ${aiRecommendationLabel(ai.recommendation)}
${ai.reasons.map((x:string)=>`• ${x}`).join('\n')}`,keyboard);
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


const manageOnlyConfigs:any={
 tools_items:{title:'الأدوات',fields:['title_ar','title_en','description_ar','description_en','url','icon','active','sort_order'],activeField:'active'},
 site_announcements:{title:'الإعلانات',fields:['title','body','button_text','button_url','active','starts_at','ends_at'],activeField:'active'},
 site_notifications:{title:'الإشعارات',fields:['title','body','icon','active'],activeField:'active'},
 academic_calendar_events:{title:'التقويم الأكاديمي',fields:['title_ar','title_en','description_ar','description_en','start_date','end_date','category','active'],activeField:'active'},
 university_programs:{title:'برامج الجامعة',fields:['college_ar','college_en','program_ar','program_en','degree_ar','degree_en','url','active'],activeField:'active'}
};
const getManageCfg=(table:string)=>pendingConfigs[table]||manageOnlyConfigs[table];

const manageEditableFields:Record<string,string[]>={
 summaries:['title','subject','course_code','college','resource_type','description','url'],
 whatsapp_groups:['subject','course_code','college','description','link'],
 rating_submissions:['target_type','target_name','course_code','overall','teaching','interaction','exam_difficulty','recommended','comment'],
 confessions:['text','content'],
 student_projects:['title','major','owner_name','description','url'],
 feature_suggestions:['category','title','details','college','contact'],
 broken_link_reports:['source_title','source_url','reason'],
 course_requests:['request_type','code','name_ar','name_en','college','department','description'],
 tools_items:['title_ar','title_en','description_ar','description_en','url','icon','sort_order'],
 site_announcements:['title','body','button_text','button_url','starts_at','ends_at'],
 site_notifications:['title','body','icon'],
 academic_calendar_events:['title_ar','title_en','description_ar','description_en','start_date','end_date','category'],
 university_programs:['college_ar','college_en','program_ar','program_en','degree_ar','degree_en','url']
};

async function manageMenu(chatId:string,mid:number){
 const all={...pendingConfigs,...manageOnlyConfigs};
 const rows=Object.entries(all).map(([table,cfg]:any)=>[{
  text:`🗂 ${cfg.title}`,callback_data:`m:l:${pendingCode(table)}:0`
 }]);
 rows.push([{text:'📘 المقررات',callback_data:'courses:menu'}]);
 rows.push([{text:'🔗 المواقع والبرامج',callback_data:'useful:menu'}]);
 rows.push([{text:'⬅️ الرئيسية',callback_data:'home'}]);
 await edit(chatId,mid,'إدارة جميع محتويات المنصة\nيمكنك العرض والتعديل وتغيير الحالة والحذف.',rows);
}

async function manageList(chatId:string,mid:number,table:string,page=0){
 const cfg=getManageCfg(table);
 if(!cfg)throw new Error('نوع المحتوى غير معروف');
 const from=page*8;
 const {data,error}=await db.from(table).select('*').order('created_at',{ascending:false}).range(from,from+7);
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${displayValue(item[cfg.fields[0]]||item.title||item.subject||item.id)}`,
  callback_data:`m:v:${pendingCode(table)}:${item.id}:${page}`
 }]);
 if(page>0)rows.push([{text:'السابق',callback_data:`m:l:${pendingCode(table)}:${page-1}`}]);
 if((data||[]).length===8)rows.push([{text:'التالي',callback_data:`m:l:${pendingCode(table)}:${page+1}`}]);
 rows.push([{text:'⬅️ إدارة المحتوى',callback_data:'manage:menu'}]);
 await edit(chatId,mid,(data||[]).length?`إدارة ${cfg.title}`:`لا توجد عناصر في ${cfg.title}`,rows);
}

async function manageView(chatId:string,mid:number,table:string,id:string,page=0){
 const cfg=getManageCfg(table);
 if(!cfg)throw new Error('نوع المحتوى غير معروف');
 const {data,error}=await db.from(table).select('*').eq('id',id).single();
 if(error)throw error;
 const fields=(manageEditableFields[table]||cfg.fields||[]).filter((f:string)=>Object.prototype.hasOwnProperty.call(data,f));
 const lines=fields.filter((f:string)=>data[f]!==null&&data[f]!==undefined&&data[f]!=='')
  .map((f:string)=>`${f}: ${displayValue(data[f])}`).join('\n');
 const keyboard:any[]=[];
 const external=(cfg.urlFields||[]).map((f:string)=>validExternalUrl(data[f])).find(Boolean);
 if(external)keyboard.push([{text:table==='whatsapp_groups'?'🔗 فتح المجموعة':'📎 فتح الرابط/الملف',url:external}]);
 const editButtons=fields.slice(0,10).map((f:string)=>({text:`✏️ ${f}`,callback_data:`m:e:${pendingCode(table)}:${id}:${f}:${page}`}));
 for(let i=0;i<editButtons.length;i+=2)keyboard.push(editButtons.slice(i,i+2));
 if(cfg.booleanModeration){
  keyboard.push([{text:data[cfg.status]?'🔴 إلغاء الاعتماد':'🟢 اعتماد',callback_data:`m:t:${pendingCode(table)}:${id}:${page}`}]);
 }else if(cfg.activeField){
  keyboard.push([{text:data[cfg.activeField]?'🔴 إيقاف':'🟢 تشغيل',callback_data:`m:t:${pendingCode(table)}:${id}:${page}`}]);
 }else if(cfg.status){
  keyboard.push([
   {text:'✅ معتمد',callback_data:`m:s:${pendingCode(table)}:${id}:${String(cfg.approve)}:${page}`},
   {text:'⏳ معلق',callback_data:`m:s:${pendingCode(table)}:${id}:${String(cfg.pending)}:${page}`}
  ]);
  keyboard.push([{text:'❌ مرفوض',callback_data:`m:s:${pendingCode(table)}:${id}:${String(cfg.reject)}:${page}`}]);
 }
 keyboard.push([{text:'🗑 حذف نهائي',callback_data:`m:x:${pendingCode(table)}:${id}:${page}`}]);
 keyboard.push([{text:'⬅️ القائمة',callback_data:`m:l:${pendingCode(table)}:${page}`}]);
 await edit(chatId,mid,`${cfg.title}\n\n${lines||'لا توجد تفاصيل'}`,keyboard);
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
  [{text:'🖼 شرائح الواجهة',callback_data:'slides:menu'}],
  [{text:'📊 قسم أرقام المنصة',callback_data:'stats:menu'}],
  [{text:'🧾 إعدادات الحقوق',callback_data:'footer:menu'}],
  [{text:'🗓 رابط التقويم الرسمي',callback_data:'setting:edit:official_calendar_url'}],
  [{text:'⚙️ حالة مراكز الدعم',callback_data:'service:view:support-centers'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}


async function footerMenu(chatId:string,mid:number){
 const keys=['footer_top_text','footer_credit_prefix','footer_rights'];
 const {data:rows}=await db.from('site_settings').select('key,value').in('key',keys);
 const m=Object.fromEntries((rows||[]).map((x:any)=>[x.key,x.value]));
 const {count:accountsCount}=await db.from('footer_social_links').select('id',{count:'exact',head:true});
 await edit(chatId,mid,`إعدادات حقوق الموقع

${m.footer_top_text||'رَبِّ زِدْنِي عِلْمًا'}
${m.footer_credit_prefix||'صُمم بحب من طلاب جامعة نزوى ❤️'}
الحسابات: ${accountsCount||0}
${m.footer_rights||'جميع الحقوق محفوظة © 2026 UON Hub'}`,[
  [{text:'🤲 النص العلوي',callback_data:'setting:edit:footer_top_text'}],
  [{text:'✍️ عبارة صُمم بحب',callback_data:'setting:edit:footer_credit_prefix'}],
  [{text:'🔗 إدارة الحسابات والروابط',callback_data:'footerlinks:list'}],
  [{text:'©️ نص الحقوق',callback_data:'setting:edit:footer_rights'}],
  [{text:'⬅️ الإعدادات',callback_data:'settings:menu'}]
 ]);
}

async function footerLinksMenu(chatId:string,mid:number){
 const {data:rows,error}=await db.from('footer_social_links').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true}).limit(40);
 if(error)throw error;
 const buttons=(rows||[]).map((item:any)=>[{text:`${item.active?'🟢':'🔴'} ${item.label}`,callback_data:`fl:v:${item.id}`}]);
 buttons.push([{text:'➕ إضافة حساب ورابط',callback_data:'fl:add'}]);
 buttons.push([{text:'⬅️ إعدادات الحقوق',callback_data:'footer:menu'}]);
 await edit(chatId,mid,rows?.length?'الحسابات الظاهرة تحت عبارة «صُمم بحب»':'لا توجد حسابات بعد.',buttons);
}

async function footerLinkView(chatId:string,mid:number,id:string){
 const {data:item,error}=await db.from('footer_social_links').select('*').eq('id',id).single();
 if(error)throw error;
 await edit(chatId,mid,`الحساب: ${item.label}\nالرابط: ${item.url||'غير مضاف'}\nالترتيب: ${item.sort_order||0}\nالحالة: ${item.active?'ظاهر':'مخفي'}`,[
  [{text:'✏️ تعديل الاسم/المنشن',callback_data:`fl:e:label:${id}`}],
  [{text:'🔗 تعديل الرابط',callback_data:`fl:e:url:${id}`}],
  [{text:'↕️ تعديل الترتيب',callback_data:`fl:e:sort_order:${id}`}],
  [{text:item.active?'🔴 إخفاء':'🟢 إظهار',callback_data:`fl:t:${id}`}],
  [{text:'🗑 حذف',callback_data:`fl:d:${id}`}],
  [{text:'⬅️ الحسابات',callback_data:'footerlinks:list'}]
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
 await edit(chatId,mid,'النسخ الاحتياطية والفحص الآمن',rows);
}

async function validateBackupRestore(
 chatId:string,
 mid:number,
 backupId:string,
 admin:any
){
 if(!can(admin,'backups'))throw new Error('ليس لديك صلاحية فحص النسخ');
 const result=await fetch(`${URL}/functions/v1/database-restore`,{
  method:'POST',
  headers:{Authorization:`Bearer ${KEY}`,'content-type':'application/json'},
  body:JSON.stringify({
   backup_run_id:backupId,
   requested_by:chatId,
   dry_run:true,
   validate_only:true
  })
 });
 const text=await result.text();
 let payload:any={};
 try{payload=text?JSON.parse(text):{}}catch{payload={error:text}}
 if(!result.ok||payload?.ok===false)throw new Error(payload?.error||text||'فشل فحص النسخة');
 const validation=payload.validation||{};
 const counts=validation.table_counts||{};
 const important=['summaries','whatsapp_groups','tools_items','university_programs','courses']
  .filter(key=>Object.prototype.hasOwnProperty.call(counts,key))
  .map(key=>`${key}: ${counts[key]}`)
  .join('\n')||'لا توجد أعداد جداول متاحة';
 audit(admin,'backup_restore_validate','backup_runs',backupId,{
  dry_run:true,
  writes_performed:false
 });
 await edit(chatId,mid,`✅ فحص النسخة مكتمل بدون استعادة

لم تُكتب أي بيانات في قاعدة الإنتاج.
إجمالي السجلات: ${validation.total_rows??'—'}
الحجم: ${validation.size_bytes??'—'} بايت

${important}`,[[{text:'⬅️ النسخ',callback_data:'backup:menu'}]]);
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
 if(!cfg)throw new Error('unsupported_table');
 if(!id||id.length>100)throw new Error('invalid_id');

 const {data:item,error:itemError}=await db.from(table).select('*').eq('id',id).maybeSingle();
 if(itemError)throw itemError;
 if(!item)throw new Error('pending_item_not_found');

 const isPending=cfg.booleanModeration
  ? item[cfg.status]===cfg.pending
  : String(item[cfg.status])===String(cfg.pending);
 if(!isPending)throw new Error('item_is_not_pending');

 const createdAt=new Date(item.created_at||0).getTime();
 if(!Number.isFinite(createdAt)||createdAt>Date.now()+5*60*1000||Date.now()-createdAt>30*60*1000){
  throw new Error('notification_window_expired');
 }

 const {data:claimStatus,error:claimError}=await db.rpc(
  'claim_telegram_web_notification',{
   p_source_table:table,
   p_source_id:id
  }
 );
 if(claimError)throw claimError;
 if(claimStatus==='duplicate')return {duplicate:true,sent:0};
 if(claimStatus==='rate_limited')throw new Error('rate_limited');
 if(claimStatus!=='claimed')throw new Error('notification_claim_failed');

 const {data:admins}=await db.from('telegram_admins').select('chat_id').eq('active',true).eq('notifications_enabled',true);
 const title=cfg?.title||table;
 const label=item?displayValue(item[cfg.fields[0]]):id;
 let sent=0;
 for(const admin of admins||[]){
  const result=await send(String(admin.chat_id),`🆕 طلب جديد\nالقسم: ${title}\nالعنصر: ${label}`,[
   [{text:'فتح الطلب',callback_data:pendingCb('v',table,id,0)}],
   [{text:'الطلبات المعلقة',callback_data:'pending:menu'}]
  ]).then(()=>true).catch(()=>false);
  if(result)sent++;
 }
 await db.from('telegram_web_notifications').update({sent_count:sent}).eq('source_table',table).eq('source_id',id);
 return {duplicate:false,sent};
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
  await send(chatId,'تم حفظ الإعداد ✅',data.key?.startsWith('footer_')?[[{text:'🧾 الرجوع لإعدادات الحقوق',callback_data:'footer:menu'}]]:undefined);
  return true;
 }


 if(state==='footer_link_add_label'){
  await setConversation(chatId,'footer_link_add_url',{label:text});
  await send(chatId,'أرسل الرابط الكامل، مثل:\nhttps://www.instagram.com/uonhub\n\nيمكنك أيضًا إرسال www.example.com');
  return true;
 }
 if(state==='footer_link_add_url'){
  const raw=text.trim();
  const url=/^https?:\/\//i.test(raw)?raw:(/^www\./i.test(raw)?`https://${raw}`:raw);
  const {count}=await db.from('footer_social_links').select('id',{count:'exact',head:true});
  const {error}=await db.from('footer_social_links').insert({label:data.label,url,sort_order:count||0,active:true});
  if(error)throw error;
  await clearConversation(chatId);
  audit(admin,'footer_link_add','footer_social_links','',{label:data.label,url});
  await send(chatId,'تمت إضافة الحساب والرابط ✅',[[{text:'🔗 عرض الحسابات',callback_data:'footerlinks:list'}]]);
  return true;
 }
 if(state==='footer_link_edit'){
  let value:any=text.trim();
  if(data.field==='sort_order')value=Number.parseInt(value,10)||0;
  if(data.field==='url' && /^www\./i.test(value))value=`https://${value}`;
  const {error}=await db.from('footer_social_links').update({[data.field]:value,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw error;
  await clearConversation(chatId);
  audit(admin,'footer_link_edit','footer_social_links',data.id,{field:data.field,value});
  await send(chatId,'تم التعديل ✅',[[{text:'⬅️ فتح الحساب',callback_data:`fl:v:${data.id}`}]]);
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

 if(state==='slide_add_title'){
  await setConversation(chatId,'slide_add_description',{title_ar:text});
  await send(chatId,'أرسل وصف الشريحة');return true;
 }
 if(state==='slide_add_description'){
  await setConversation(chatId,'slide_add_url',{...data,description_ar:text});
  await send(chatId,'أرسل رابط زر الشريحة، مثل tools.html');return true;
 }
 if(state==='slide_add_url'){
  const {error}=await db.from('home_slides').insert({...data,button_url:text,icon:'🎓',active:true,sort_order:100});
  if(error)throw error;await clearConversation(chatId);audit(admin,'slide_create','home_slides','',data);await send(chatId,'تمت إضافة الشريحة ✅');return true;
 }
 if(state==='slide_edit_value'){
  let value:any=text;if(data.field==='sort_order')value=Number(text)||100;
  const {error}=await db.from('home_slides').update({[data.field]:value,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw error;await clearConversation(chatId);audit(admin,'slide_update','home_slides',data.id,{field:data.field,value});await send(chatId,'تم تعديل الشريحة ✅');return true;
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


 if(state==='manage_edit_value'){
  let value:any=text;
  if(['overall','teaching','interaction','exam_difficulty'].includes(data.field))value=Number(text)||0;
  if(data.field==='recommended')value=['1','true','نعم','yes'].includes(text.trim().toLowerCase());
  const {error}=await db.from(data.table).update({[data.field]:value,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw error;
  await clearConversation(chatId);
  audit(admin,'content_update',data.table,data.id,{field:data.field,value});
  await send(chatId,'تم تعديل المحتوى ✅',[[{text:'فتح العنصر',callback_data:`m:v:${pendingCode(data.table)}:${data.id}:${data.page||0}`}]]);
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

Deno.serve(async (req:Request)=>{
 if(req.method==='OPTIONS'){
  return new Response(null,{status:204,headers:corsHeaders(req)});
 }

 try{
  let payload:any;
  try{payload=await req.json()}
  catch{return response(req,{ok:false,error:'invalid_json'},400)}

  // Public submission notifications are derived from a fresh pending DB row,
  // and each (table,id) can notify only once.
  if(payload?.source==='web-submit'){
   const keys=Object.keys(payload);
   if(keys.some((key)=>!['source','table','id'].includes(key))){
    return response(req,{ok:false,error:'unsupported_payload'},400);
   }
   if(!payload.table||!payload.id)return response(req,{ok:false,error:'table_and_id_required'},400);
   try{
    const result=await notifyAdmins(String(payload.table),String(payload.id));
    return response(req,{ok:true,...result});
   }catch(error){
    const message=String((error as Error)?.message||error);
    const status=/rate_limited/i.test(message)?429:/unsupported|invalid|required|not_found|not_pending|expired/i.test(message)?400:500;
    return response(req,{ok:false,error:message},status);
   }
  }

  if(payload?.source==='admin-test'){
   if(!(await adminAuthorized(req)))return response(req,{ok:false,error:'unauthorized'},401);
   const {data:admins,error}=await db.from('telegram_admins')
    .select('chat_id').eq('active',true).eq('notifications_enabled',true);
   if(error)throw error;
   let sent=0;
   for(const item of admins||[]){
    if(await send(String(item.chat_id),'✅ اختبار إشعارات UON Hub V30 من لوحة الإدارة').then(()=>true).catch(()=>false))sent++;
   }
   return response(req,{ok:true,sent});
  }

  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET){
   return response(req,{ok:false,error:'unauthorized'},401);
  }

  const callback=payload.callback_query;
  const message=payload.message;

  // Stop Telegram's loading spinner immediately, before any database work.
  if(callback){
   // Acknowledge immediately so Telegram never leaves the button spinning.
   try{await telegram('answerCallbackQuery',{callback_query_id:callback.id});}catch{}
  }

  const chatId=String(callback?.message?.chat?.id||message?.chat?.id||'');
  const senderId=String(callback?.from?.id||message?.from?.id||'');
  const admin=await getAdmin(senderId);
  if(!admin)return response(req,{ok:true});

  if(message){
   const text=String(message.text||'').trim();
   const {data:conv}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();

   if(conv&&await handleConversation(chatId,admin,text,conv))return response(req,{ok:true});

   if(text==='/ping'){
    await send(chatId,'⚡ البوت يعمل');
   }else if(text==='/start'||text==='/menu')await home(chatId,admin);
   else if(text==='/diagnostics'){
    const checks=await Promise.all(Object.entries(pendingConfigs).map(async([table,cfg]:any)=>{
     const {count,error}=await db.from(table).select('id',{count:'exact',head:true}).eq(cfg.status,cfg.pending);
     return `${error?'❌':'✅'} ${cfg.title}: ${error?error.message:(count||0)+' معلق'}`;
    }));
    await send(chatId,`فحص أزرار وجداول المراجعة UON Hub V30\n\n${checks.join('\n')}\n\n✅ callback_data تم ضغطها لتوافق حد Telegram.`);
   }
   else if(text==='/health'){
    const {data,error}=await db.rpc('uon_public_state');
    await send(chatId,error?`خطأ: ${error.message}`:`البوت يعمل ✅\nالصيانة: ${data.maintenance_enabled?'مفعلة':'متوقفة'}\nالإصدار: UON Hub V30`);
   }else await home(chatId,admin);
   return response(req,{ok:true});
  }

  if(callback){
   background((async()=>{
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
     }else if(action==='n'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
      await markNeedsChanges(table,idOrPage,admin);
      await pendingList(chatId,mid,table,page);
     }else if(action==='u'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');
      await assignToSelf(table,idOrPage,admin);
      await pendingView(chatId,mid,table,idOrPage,page);
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

    else if(data==='manage:menu')await manageMenu(chatId,mid);
    else if(data.startsWith('m:')){
     const parts=data.split(':');
     const action=parts[1], table=pendingTable(parts[2]);
     if(action==='l')await manageList(chatId,mid,table,Number(parts[3])||0);
     else if(action==='v')await manageView(chatId,mid,table,parts[3],Number(parts[4])||0);
     else if(action==='e'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية التعديل');
      const id=parts[3],field=parts[4],page=Number(parts[5])||0;
      if(!(manageEditableFields[table]||[]).includes(field))throw new Error('هذا الحقل غير قابل للتعديل');
      await setConversation(chatId,'manage_edit_value',{table,id,field,page});
      await edit(chatId,mid,`أرسل القيمة الجديدة للحقل: ${field}`,[[{text:'⬅️ إلغاء',callback_data:`m:v:${pendingCode(table)}:${id}:${page}`}]]);
     }else if(action==='t'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية التعديل');
      const id=parts[3],page=Number(parts[4])||0,cfg=getManageCfg(table);
      const {data:item,error}=await db.from(table).select('*').eq('id',id).single();if(error)throw error;
      const field=cfg.activeField||cfg.status;
      const patch={[field]:!item[field]};
      if(cfg.activeField){const {error:e}=await db.from(table).update({...patch,updated_at:new Date().toISOString()}).eq('id',id);if(e)throw e;}
      else await updateWithOptionalReviewedAt(table,id,patch);
      audit(admin,'content_toggle',table,id,patch);
      await manageView(chatId,mid,table,id,page);
     }else if(action==='s'){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية التعديل');
      const id=parts[3],status=parts[4],page=Number(parts[5])||0,cfg=getManageCfg(table);
      let value:any=status;if(status==='true')value=true;if(status==='false')value=false;
      await updateWithOptionalReviewedAt(table,id,{[cfg.status]:value});
      audit(admin,'content_status',table,id,{status:value});
      await manageView(chatId,mid,table,id,page);
     }else if(action==='x'){
      const id=parts[3],page=Number(parts[4])||0;
      await edit(chatId,mid,'⚠️ هل تريد حذف هذا العنصر نهائيًا؟',[ [{text:'نعم، حذف',callback_data:`m:d:${pendingCode(table)}:${id}:${page}`}], [{text:'إلغاء',callback_data:`m:v:${pendingCode(table)}:${id}:${page}`}] ]);
     }else if(action==='d'){
      if(!isOwner(admin))throw new Error('الحذف النهائي للمالك فقط');
      const id=parts[3],page=Number(parts[4])||0;
      const {error}=await db.from(table).delete().eq('id',id);if(error)throw error;
      audit(admin,'content_delete',table,id);
      await manageList(chatId,mid,table,page);
     }
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
    else if(data==='slides:menu'){
     const {data:rows,error}=await db.from('home_slides').select('*').order('sort_order');if(error)throw error;
     const kb=(rows||[]).map((x:any)=>[{text:`${x.active?'🟢':'🔴'} ${x.title_ar}`,callback_data:`sl:v:${x.id}`}]);
     kb.unshift([{text:'➕ إضافة شريحة',callback_data:'sl:add'}]);kb.push([{text:'⬅️ الإعدادات',callback_data:'settings:menu'}]);
     await edit(chatId,mid,'شرائح الواجهة الرئيسية',kb);
    }
    else if(data==='sl:add'){
     await setConversation(chatId,'slide_add_title',{});await edit(chatId,mid,'أرسل عنوان الشريحة',[[{text:'⬅️ إلغاء',callback_data:'slides:menu'}]]);
    }
    else if(data.startsWith('sl:')){
     const [,action,id,arg]=data.split(':');
     if(action==='v'){
      const {data:item,error}=await db.from('home_slides').select('*').eq('id',id).single();if(error)throw error;
      await edit(chatId,mid,`${item.title_ar}\n${item.description_ar||''}\n${item.button_url||'#'}\nالحالة: ${item.active?'ظاهر':'مخفي'}`,[
       [{text:'✏️ العنوان',callback_data:`sl:e:${id}:title_ar`},{text:'📝 الوصف',callback_data:`sl:e:${id}:description_ar`}],
       [{text:'🔗 الرابط',callback_data:`sl:e:${id}:button_url`},{text:'🎨 الأيقونة',callback_data:`sl:e:${id}:icon`}],
       [{text:'🔘 نص الزر',callback_data:`sl:e:${id}:button_text_ar`},{text:'↕️ الترتيب',callback_data:`sl:e:${id}:sort_order`}],
       [{text:item.active?'🔴 إخفاء':'🟢 إظهار',callback_data:`sl:t:${id}:${item.active?'0':'1'}`}],
       [{text:'🗑 حذف',callback_data:`sl:d:${id}`}],[{text:'⬅️ الشرائح',callback_data:'slides:menu'}]
      ]);
     }else if(action==='e'){
      await setConversation(chatId,'slide_edit_value',{id,field:arg});await edit(chatId,mid,'أرسل القيمة الجديدة',[[{text:'⬅️ إلغاء',callback_data:`sl:v:${id}`}]]);
     }else if(action==='t'){
      await db.from('home_slides').update({active:arg==='1',updated_at:new Date().toISOString()}).eq('id',id);await edit(chatId,mid,'تم تحديث حالة الشريحة ✅',[[{text:'⬅️ الشرائح',callback_data:'slides:menu'}]]);
     }else if(action==='d'){
      if(!isOwner(admin))throw new Error('الحذف للمالك فقط');await db.from('home_slides').delete().eq('id',id);await edit(chatId,mid,'تم حذف الشريحة ✅',[[{text:'⬅️ الشرائح',callback_data:'slides:menu'}]]);
     }
    }
    else if(data==='stats:menu'){
     const keys=['stats_section_enabled','stats_title','stats_tools_label','stats_summaries_label','stats_ratings_label','stats_groups_label','stats_university_name'];
     const {data:rows}=await db.from('site_settings').select('key,value').in('key',keys);
     const m=Object.fromEntries((rows||[]).map((x:any)=>[x.key,x.value]));
     const enabled=m.stats_section_enabled===true||m.stats_section_enabled==='true';
     await edit(chatId,mid,`قسم أرقام المنصة\nالحالة: ${enabled?'ظاهر':'مخفي'}\nالعنوان: ${m.stats_title||'UON Hub بالأرقام'}`,[
      [{text:enabled?'🔴 إخفاء القسم':'🟢 إظهار القسم',callback_data:`stats:toggle:${enabled?'0':'1'}`}],
      [{text:'✏️ العنوان',callback_data:'setting:edit:stats_title'}],
      [{text:'🛠 تسمية الأدوات',callback_data:'setting:edit:stats_tools_label'},{text:'📚 تسمية الملخصات',callback_data:'setting:edit:stats_summaries_label'}],
      [{text:'⭐ تسمية الآراء',callback_data:'setting:edit:stats_ratings_label'},{text:'💬 تسمية المجموعات',callback_data:'setting:edit:stats_groups_label'}],
      [{text:'🏫 اسم الجامعة',callback_data:'setting:edit:stats_university_name'}],
      [{text:'⬅️ الإعدادات',callback_data:'settings:menu'}]
     ]);
    }
    else if(data.startsWith('stats:toggle:')){
     const enabled=data.endsWith(':1');
     await db.from('site_settings').upsert({key:'stats_section_enabled',value:enabled,updated_at:new Date().toISOString()});
     await edit(chatId,mid,`تم ${enabled?'إظهار':'إخفاء'} قسم أرقام المنصة ✅`,[[{text:'⬅️ قسم الأرقام',callback_data:'stats:menu'}]]);
    }
    else if(data==='settings:menu')await settingsMenu(chatId,mid);
    else if(data==='footer:menu')await footerMenu(chatId,mid);
    else if(data==='footerlinks:list')await footerLinksMenu(chatId,mid);
    else if(data==='fl:add'){
     await setConversation(chatId,'footer_link_add_label',{});
     await edit(chatId,mid,'أرسل اسم الحساب أو المنشن، مثل: @uonhub',[[{text:'⬅️ إلغاء',callback_data:'footerlinks:list'}]]);
    }
    else if(data.startsWith('fl:v:'))await footerLinkView(chatId,mid,data.split(':')[2]);
    else if(data.startsWith('fl:e:')){
     const [, ,field,id]=data.split(':');
     const labels:any={label:'الاسم أو المنشن',url:'الرابط الكامل',sort_order:'رقم الترتيب'};
     await setConversation(chatId,'footer_link_edit',{id,field});
     await edit(chatId,mid,`أرسل ${labels[field]||field} الجديد`,[[{text:'⬅️ إلغاء',callback_data:`fl:v:${id}`}]]);
    }
    else if(data.startsWith('fl:t:')){
     const id=data.split(':')[2];
     const {data:item,error}=await db.from('footer_social_links').select('active').eq('id',id).single();if(error)throw error;
     await db.from('footer_social_links').update({active:!item.active,updated_at:new Date().toISOString()}).eq('id',id);
     await footerLinkView(chatId,mid,id);
    }
    else if(data.startsWith('fl:d:')){
     if(!isOwner(admin))throw new Error('الحذف للمالك فقط');
     const id=data.split(':')[2];
     await db.from('footer_social_links').delete().eq('id',id);
     audit(admin,'footer_link_delete','footer_social_links',id);
     await footerLinksMenu(chatId,mid);
    }
    else if(data.startsWith('center:view:'))await centerView(chatId,mid,data.split(':')[2]);
    else if(data.startsWith('setting:edit:')){
     const key=data.split(':').slice(2).join(':');
     const labels:any={
      footer_top_text:'النص العلوي في الحقوق',
      footer_credit_prefix:'عبارة صُمم بحب',
      footer_rights:'نص جميع الحقوق محفوظة'
     };
     await setConversation(chatId,'setting_value',{key});
     const back=key.startsWith('footer_')?'footer:menu':'settings:menu';
     await edit(chatId,mid,`أرسل القيمة الجديدة لـ ${labels[key]||key}`,[[{text:'⬅️ إلغاء',callback_data:back}]]);
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
      await edit(chatId,mid,`النسخة الاحتياطية\nالحالة: ${item.status}\nالتاريخ: ${new Date(item.created_at).toLocaleString('ar')}\nالملف: ${item.file_path||item.backup_path||'—'}`,[
       [{text:'🧪 فحص سلامة النسخة',callback_data:`b:c:${id}`}],[{text:'⬅️ النسخ',callback_data:'backup:menu'}]
      ]);
     }else if(action==='c'||action==='x'||action==='r'){
      // x/r are retained only for stale Telegram buttons. They now perform
      // the same non-writing validation as the current c action.
      await validateBackupRestore(chatId,mid,id,admin);
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
      [{text:'🧪 فحص سلامة النسخة',callback_data:`b:c:${id}`}],
      [{text:'⬅️ النسخ',callback_data:'backup:menu'}]
     ]);
    }
    else if(data.startsWith('backup:restoreask:')){
     // Legacy callback retained as validate-only so old messages are safe.
     const id=data.split(':')[2];
     await validateBackupRestore(chatId,mid,id,admin);
    }
    else if(data.startsWith('backup:restore:')){
     // Legacy callback retained as validate-only so old messages are safe.
     const id=data.split(':')[2];
     await validateBackupRestore(chatId,mid,id,admin);
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
    else if(data==='ai:menu')await aiMenu(chatId,mid,admin);
    else if(data==='ai:scan')await aiScanPending(chatId,mid,admin);
    else if(data==='ai:report')await aiReport(chatId,mid);
    else if(data==='ai:mine')await assignedToMe(chatId,mid,admin);
    else if(data.startsWith('ai:toggle:')){
     if(!isOwner(admin))throw new Error('إعدادات الذكاء الاصطناعي للمالك فقط');
     const enabled=data.endsWith(':1');
     const {error}=await db.from('ai_supervisor_settings').upsert({id:true,enabled,updated_by:chatId,updated_at:new Date().toISOString()});
     if(error)throw error; audit(admin,'ai_toggle','ai_supervisor_settings','',{enabled}); await aiMenu(chatId,mid,admin);
    }
    else if(data==='ai:auto:menu'){
     if(!isOwner(admin))throw new Error('إعدادات القبول التلقائي للمالك فقط');
     const {data:s}=await db.from('ai_supervisor_settings').select('*').eq('id',true).single();
     await edit(chatId,mid,`⚙️ إعدادات القبول التلقائي\n\nالحالة: ${s.auto_approve_enabled?'🟢 مفعل':'🔴 متوقف'}\nحد الثقة: ${s.auto_approve_threshold}%`,[
      [{text:s.auto_approve_enabled?'🔴 إيقاف':'🟢 تشغيل',callback_data:`ai:auto:toggle:${s.auto_approve_enabled?'0':'1'}`}],
      [{text:'95%',callback_data:'ai:auto:threshold:95'},{text:'97%',callback_data:'ai:auto:threshold:97'},{text:'99%',callback_data:'ai:auto:threshold:99'}],
      [{text:'⬅️ مركز AI',callback_data:'ai:menu'}]
     ]);
    }
    else if(data.startsWith('ai:auto:toggle:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const enabled=data.endsWith(':1');
     const {error}=await db.from('ai_supervisor_settings').update({auto_approve_enabled:enabled,updated_by:chatId,updated_at:new Date().toISOString()}).eq('id',true);
     if(error)throw error; audit(admin,'ai_auto_toggle','ai_supervisor_settings','',{enabled}); await aiMenu(chatId,mid,admin);
    }
    else if(data.startsWith('ai:auto:threshold:')){
     if(!isOwner(admin))throw new Error('للمالك فقط');
     const threshold=Number(data.split(':')[3]);
     const {error}=await db.from('ai_supervisor_settings').update({auto_approve_threshold:threshold,updated_by:chatId,updated_at:new Date().toISOString()}).eq('id',true);
     if(error)throw error; audit(admin,'ai_threshold','ai_supervisor_settings','',{threshold}); await aiMenu(chatId,mid,admin);
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
   })());
   return response(req,{ok:true});
  }

  return response(req,{ok:true});
 }catch(error){
  return response(req,{ok:false,error:String(error?.message||error)},500);
 }
});
