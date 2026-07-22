
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TG_SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const DB_SECRET=Deno.env.get('DATABASE_WEBHOOK_SECRET')!;
const SITE=Deno.env.get('SITE_URL')||'';
const db=createClient(URL,KEY);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
const res=(s='ok',status=200)=>new Response(s,{status,headers:cors});
async function tg(method:string,body:any){const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());return r.json()}
async function admin(chat:string){const {data}=await db.from('telegram_admins').select('*').eq('chat_id',chat).eq('active',true).maybeSingle();return data}

async function getConversation(chat:string){
 const {data}=await db.from('telegram_conversations').select('*').eq('chat_id',chat).maybeSingle();
 return data;
}
async function setConversation(chat:string,state:string,data:any={}){
 const {error}=await db.from('telegram_conversations').upsert({chat_id:chat,state,data,updated_at:new Date().toISOString()});
 if(error)throw error;
}
async function clearConversation(chat:string){
 await db.from('telegram_conversations').delete().eq('chat_id',chat);
}
function ownerOnly(a:any){return a?.role==='owner'}

const tables:any={
 summaries:{title:'title',pending:{approved:false},approve:{approved:true}},
 whatsapp_groups:{title:'subject',pending:{approved:false},approve:{approved:true}},
 student_projects:{title:'title',pending:{status:'pending'},approve:{status:'approved'},reject:{status:'rejected'}},
 rating_submissions:{title:'target_name',pending:{status:'pending'},approve:{status:'approved'},reject:{status:'rejected'}},
 confessions:{title:'content',pending:{status:'pending'},approve:{status:'approved'},reject:{status:'rejected'}}
};
function menu(){return {inline_keyboard:[[{text:'📊 الإحصائيات',callback_data:'stats'},{text:'🕓 المعلقة',callback_data:'pending'}],[{text:'🛠 خدمات الموقع',callback_data:'features'}],[{text:'🔧 الصيانة',callback_data:'maintenance'}],[{text:'📢 إعلان جديد',callback_data:'new_ad'}],[{text:'🌐 لوحة الموقع',url:`${SITE}/admin.html`}]]}}
async function sendMenu(chat:string,name:string){await tg('sendMessage',{chat_id:chat,text:`لوحة UON Hub\nمرحبًا ${name}`,reply_markup:menu()})}
async function stats(){let s='إحصائيات UON Hub\n';for(const [t,d] of Object.entries(tables) as any){let q=db.from(t).select('*',{count:'exact',head:true});for(const[k,v]of Object.entries(d.pending))q=q.eq(k,v);const{count}=await q;s+=`${t}: ${count||0}\n`}return s}
async function features(){const{data}=await db.from('platform_features').select('*').order('sort_order');return {text:'خدمات الموقع',keyboard:{inline_keyboard:(data||[]).map((x:any)=>[{text:`${x.status==='active'?'🟢':'🔴'} ${x.name}`,callback_data:`feature:${x.key}`}]).concat([[{text:'⬅️ رجوع',callback_data:'home'}]])}}}
async function feature(key:string){const{data}=await db.from('platform_features').select('*').eq('key',key).single();return {text:`${data.name}\nالحالة: ${data.status}`,keyboard:{inline_keyboard:[[{text:'🟢 تشغيل',callback_data:`setf:${key}:active`},{text:'🔴 إيقاف',callback_data:`setf:${key}:disabled`}],[{text:'🟡 قريبًا',callback_data:`setf:${key}:coming_soon`},{text:'🛠 صيانة',callback_data:`setf:${key}:maintenance`}],[{text:'⬅️ الخدمات',callback_data:'features'}]]}}}
async function notify(table:string,record:any){const d=tables[table];if(!d)return;const{data:admins}=await db.from('telegram_admins').select('*').eq('active',true).eq('notifications_enabled',true);for(const a of admins||[]){await tg('sendMessage',{chat_id:a.chat_id,text:`طلب جديد: ${record[d.title]||'بدون عنوان'}`,reply_markup:{inline_keyboard:[[{text:'قبول ✅',callback_data:`approve:${table}:${record.id}`},{text:'رفض ❌',callback_data:`reject:${table}:${record.id}`}]]}}).catch(console.error)}}

async function adminsMenu(){
 const {data,error}=await db.from('telegram_admins').select('id,name,chat_id,role,active').order('created_at');
 if(error)throw error;
 const rows=(data||[]).map((x:any)=>[
  {text:`${x.active?'🟢':'🔴'} ${x.name} — ${x.role}`,callback_data:`admin:${x.id}`}
 ]);
 rows.push([{text:'➕ إضافة مشرف',callback_data:'adminadd'}]);
 rows.push([{text:'⬅️ رجوع',callback_data:'home'}]);
 return {text:'إدارة مشرفي UON Hub',keyboard:{inline_keyboard:rows}};
}
async function adminDetails(id:string){
 const {data,error}=await db.from('telegram_admins').select('*').eq('id',id).single();
 if(error)throw error;
 return {
  text:`الاسم: ${data.name}\nChat ID: ${data.chat_id}\nالدور: ${data.role}\nالحالة: ${data.active?'نشط':'متوقف'}`,
  keyboard:{inline_keyboard:[
   [{text:data.active?'🔴 إيقاف':'🟢 تفعيل',callback_data:`admintoggle:${id}:${data.active?'off':'on'}`}],
   [{text:'🗑 حذف',callback_data:`admindelete:${id}`}],
   [{text:'⬅️ المشرفون',callback_data:'admins'}]
  ]}
 };
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return res('',204);
 try{
  const payload=await req.json();
  const tgHeader=req.headers.get('x-telegram-bot-api-secret-token');
  const dbHeader=req.headers.get('x-database-webhook-secret');
  if(payload.source==='admin-test'&&payload.channel==='telegram'){const {data:admins}=await db.from('telegram_admins').select('*').eq('active',true);for(const a of admins||[])await tg('sendMessage',{chat_id:a.chat_id,text:'✅ اختبار إشعارات UON Hub'});return res()}
  if(payload.source==='web-submit'){const d=tables[payload.table];if(!d)return res('ignored');const{data}=await db.from(payload.table).select('*').eq('id',payload.id).single();await notify(payload.table,data);return res()}
  if(dbHeader===DB_SECRET&&payload.type==='INSERT'){await notify(payload.table,payload.record);return res()}
  if(tgHeader!==TG_SECRET)return res('unauthorized',401);
  const cb=payload.callback_query,msg=payload.message;const chat=String(cb?.message?.chat?.id||msg?.chat?.id||'');const a=await admin(chat);if(!a)return res();
  if(msg){const text=String(msg.text||'');if(text==='/start'||text==='/menu')await sendMenu(chat,a.name);else if(text==='/health'){
    const{data:state,error}=await db.rpc('uon_public_state');
    await tg('sendMessage',{chat_id:chat,text:error?`البوت يعمل لكن قراءة الحالة فشلت: ${error.message}`:`البوت يعمل ✅
الصيانة: ${state?.maintenance_enabled?'مفعلة':'متوقفة'}
آخر تحديث: ${state?.updated_at||'—'}`})
   };else await sendMenu(chat,a.name)}
  if(cb){
   const data=String(cb.data),mid=cb.message.message_id;
   await tg('answerCallbackQuery',{callback_query_id:cb.id}).catch(()=>{});
   const edit=async(t:string,k:any)=>tg('editMessageText',{chat_id:chat,message_id:mid,text:t,reply_markup:k});
   try{
   if(data==='home')await edit('لوحة UON Hub',menu());
   else if(data==='stats')await edit(await stats(),{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
   else if(data==='features'){const x=await features();await edit(x.text,x.keyboard)}
   else if(data.startsWith('feature:')){const x=await feature(data.split(':')[1]);await edit(x.text,x.keyboard)}
   else if(data.startsWith('setf:')){
    const[,key,status]=data.split(':');
    const{data:changed,error}=await db.rpc('uon_set_feature_state',{p_key:key,p_status:status});
    if(error)throw new Error(`Feature update failed: ${error.message}`);
    const x=await feature(key);
    await edit(`${x.text}
تم الحفظ في قاعدة البيانات ✅`,x.keyboard)
   }
   else if(data==='maintenance'){const{data:s}=await db.from('site_settings').select('value').eq('key','maintenance_enabled').maybeSingle();const raw=s?.value;const on=raw===true||raw===1||String(raw).replace(/\"/g,'').toLowerCase()==='true';await edit(`الصيانة: ${on?'مفعلة':'متوقفة'}`,{inline_keyboard:[[{text:'تشغيل',callback_data:'maint:on'},{text:'إيقاف',callback_data:'maint:off'}],[{text:'⬅️ رجوع',callback_data:'home'}]]})}
   else if(data.startsWith('maint:')){
    const on=data.endsWith(':on');
    const{data:state,error}=await db.rpc('uon_set_maintenance',{p_enabled:on,p_message:null,p_until:null});
    if(error)throw new Error(`Maintenance update failed: ${error.message}`);
    if(state?.maintenance_enabled!==on)throw new Error('Maintenance verification failed');
    await edit(`تم ${on?'تشغيل':'إيقاف'} الصيانة فعليًا ✅`,{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]})
   }
   
   else if(data==='admins'){
    if(!ownerOnly(a))throw new Error('هذه الصفحة للمالك فقط');
    const x=await adminsMenu();await edit(x.text,x.keyboard)
   }
   else if(data==='adminadd'){
    if(!ownerOnly(a))throw new Error('الإضافة للمالك فقط');
    await setConversation(chat,'admin_chat_id',{});
    await edit('أرسل Chat ID للمشرف الجديد.\nيمكنه إرسال /start للبوت ثم يرسل لك رقمه.\nللإلغاء: /cancel',{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'admins'}]]})
   }
   else if(data.startsWith('adminrole:')){
    if(!ownerOnly(a))throw new Error('الإضافة للمالك فقط');
    const conv=await getConversation(chat);
    if(conv?.state!=='admin_role')throw new Error('جلسة الإضافة انتهت، ابدأ من جديد');
    const role=data.split(':')[1];
    const permissions=role==='admin'?{moderate:true,announcements:true,features:true,maintenance:true}:role==='moderator'?{moderate:true}:{announcements:true};
    const {error}=await db.from('telegram_admins').insert({
      name:conv.data.name,chat_id:conv.data.chat_id,role,permissions,active:true,notifications_enabled:true
    });
    if(error)throw error;
    await clearConversation(chat);
    const x=await adminsMenu();await edit(`تمت إضافة ${conv.data.name} ✅\n\n${x.text}`,x.keyboard)
   }
   else if(data.startsWith('admin:')){
    if(!ownerOnly(a))throw new Error('هذه الصفحة للمالك فقط');
    const x=await adminDetails(data.split(':')[1]);await edit(x.text,x.keyboard)
   }
   else if(data.startsWith('admintoggle:')){
    if(!ownerOnly(a))throw new Error('هذه العملية للمالك فقط');
    const[,id,state]=data.split(':');
    const {error}=await db.from('telegram_admins').update({active:state==='on',updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    const x=await adminDetails(id);await edit(x.text,x.keyboard)
   }
   else if(data.startsWith('admindelete:')){
    if(!ownerOnly(a))throw new Error('هذه العملية للمالك فقط');
    const id=data.split(':')[1];
    const {data:target}=await db.from('telegram_admins').select('chat_id,role').eq('id',id).single();
    if(target?.chat_id===chat)throw new Error('لا يمكنك حذف حسابك الحالي');
    const {error}=await db.from('telegram_admins').delete().eq('id',id);
    if(error)throw error;
    const x=await adminsMenu();await edit('تم حذف المشرف ✅\n\n'+x.text,x.keyboard)
   }

   else if(data.startsWith('approve:')||data.startsWith('reject:')){const[action,table,id]=data.split(':');const d=tables[table];if(action==='reject'&&d.reject)await db.from(table).update(d.reject).eq('id',id);else if(action==='reject')await db.from(table).delete().eq('id',id);else await db.from(table).update(d.approve).eq('id',id);await edit(action==='approve'?'تم القبول ✅':'تم الرفض ❌',{inline_keyboard:[]})}
      }catch(error){
    console.error('Callback error',error);
    await tg('sendMessage',{chat_id:chat,text:`تعذر تنفيذ العملية:\n${String(error?.message||error)}`}).catch(()=>{});
   }
  }
  return res();
 }catch(e){console.error(e);return res(String(e),500)}
});
