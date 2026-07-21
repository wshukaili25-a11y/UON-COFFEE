
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
  if(msg){const text=String(msg.text||'');if(text==='/start'||text==='/menu')await sendMenu(chat,a.name);else if(text==='/health')await tg('sendMessage',{chat_id:chat,text:'البوت يعمل ✅'});else await sendMenu(chat,a.name)}
  if(cb){const data=String(cb.data),mid=cb.message.message_id;const edit=async(t:string,k:any)=>tg('editMessageText',{chat_id:chat,message_id:mid,text:t,reply_markup:k});
   if(data==='home')await edit('لوحة UON Hub',menu());
   else if(data==='stats')await edit(await stats(),{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]});
   else if(data==='features'){const x=await features();await edit(x.text,x.keyboard)}
   else if(data.startsWith('feature:')){const x=await feature(data.split(':')[1]);await edit(x.text,x.keyboard)}
   else if(data.startsWith('setf:')){const[,key,status]=data.split(':');await db.from('platform_features').update({status,updated_at:new Date().toISOString()}).eq('key',key);const x=await feature(key);await edit(x.text,x.keyboard)}
   else if(data==='maintenance'){const{data:s}=await db.from('site_settings').select('value').eq('key','maintenance_enabled').maybeSingle();const raw=s?.value;const on=raw===true||raw===1||String(raw).replace(/\"/g,'').toLowerCase()==='true';await edit(`الصيانة: ${on?'مفعلة':'متوقفة'}`,{inline_keyboard:[[{text:'تشغيل',callback_data:'maint:on'},{text:'إيقاف',callback_data:'maint:off'}],[{text:'⬅️ رجوع',callback_data:'home'}]]})}
   else if(data.startsWith('maint:')){const on=data.endsWith(':on');await db.from('site_settings').upsert({key:'maintenance_enabled',value:on,updated_at:new Date().toISOString()});await edit(`تم ${on?'تشغيل':'إيقاف'} الصيانة`,{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'home'}]]})}
   else if(data.startsWith('approve:')||data.startsWith('reject:')){const[action,table,id]=data.split(':');const d=tables[table];if(action==='reject'&&d.reject)await db.from(table).update(d.reject).eq('id',id);else if(action==='reject')await db.from(table).delete().eq('id',id);else await db.from(table).update(d.approve).eq('id',id);await edit(action==='approve'?'تم القبول ✅':'تم الرفض ❌',{inline_keyboard:[]})}
   await tg('answerCallbackQuery',{callback_query_id:cb.id}).catch(()=>{});
  }
  return res();
 }catch(e){console.error(e);return res(String(e),500)}
});
