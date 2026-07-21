
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const DATABASE_WEBHOOK_SECRET = Deno.env.get('DATABASE_WEBHOOK_SECRET')!;
const SITE_URL = Deno.env.get('SITE_URL') || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const moderationTables: Record<string, { label:string; title:string; statusColumn?:string; approvedValue?:unknown; rejectedValue?:unknown }> = {
  summaries:{label:'ملخص',title:'title',statusColumn:'approved',approvedValue:true,rejectedValue:false},
  whatsapp_groups:{label:'مجموعة واتساب',title:'subject',statusColumn:'approved',approvedValue:true,rejectedValue:false},
  student_projects:{label:'مشروع طالب',title:'title'},
  rating_submissions:{label:'تقييم',title:'target_name'},
  confessions:{label:'اعتراف',title:'content'}
};

async function telegram(method:string, body:Record<string,unknown>){
  const res=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
  });
  if(!res.ok)throw new Error(await res.text());
  return res.json();
}

async function activeAdmins(){
  const {data,error}=await supabase.from('telegram_admins').select('*').eq('active',true);
  if(error)throw error;
  return data || [];
}

async function findAdmin(chatId:string){
  const {data}=await supabase.from('telegram_admins').select('*').eq('chat_id',chatId).eq('active',true).maybeSingle();
  return data;
}

function can(admin:any, permission:string){
  if(!admin)return false;
  if(admin.role==='owner'||admin.role==='admin')return true;
  return admin.permissions?.[permission]===true;
}

function preview(value:unknown,max=160){
  const s=String(value ?? '').replace(/\s+/g,' ').trim();
  return s.length>max?s.slice(0,max)+'…':s;
}

async function notifyInsert(payload:any){
  const table=payload.table;
  const record=payload.record;
  const def=moderationTables[table];
  if(!def)return;

  const title=preview(record[def.title]||record.title||record.content||'طلب جديد',100);
  const text=`🔔 *${def.label} جديد بانتظار المراجعة*\n\n${title}`;
  const keyboard={inline_keyboard:[
    [
      {text:'قبول ✅',callback_data:`approve|${table}|${record.id}`},
      {text:'رفض ❌',callback_data:`reject|${table}|${record.id}`}
    ],
    SITE_URL?[{text:'فتح لوحة الإدارة 🔗',url:`${SITE_URL}/admin.html`}]:[]
  ].filter((row:any[])=>row.length)};

  for(const admin of await activeAdmins()){
    if(!admin.notifications_enabled)continue;
    await telegram('sendMessage',{
      chat_id:admin.chat_id,text,parse_mode:'Markdown',
      reply_markup:keyboard
    });
  }
}

async function moderate(admin:any, action:string, table:string, id:string){
  if(!can(admin,action==='approve'?'approve':'reject'))throw new Error('ليس لديك صلاحية');
  const def=moderationTables[table];
  if(!def)throw new Error('جدول غير مسموح');

  let patch:any;
  if(def.statusColumn==='approved'){
    if(action==='reject'){
      const {error}=await supabase.from(table).delete().eq('id',id);
      if(error)throw error;
      return;
    }
    patch={approved:true};
  }else{
    patch={status:action==='approve'?'approved':'rejected',reviewed_at:new Date().toISOString()};
  }

  const {error}=await supabase.from(table).update(patch).eq('id',id);
  if(error)throw error;
}

async function setMaintenance(admin:any,on:boolean){
  if(!can(admin,'maintenance'))throw new Error('ليس لديك صلاحية الصيانة');
  const {error}=await supabase.from('site_settings').upsert({
    key:'maintenance_enabled',value:on,updated_at:new Date().toISOString()
  });
  if(error)throw error;
}

async function stats(){
  const queries=[
    ['summaries',{approved:false}],
    ['whatsapp_groups',{approved:false}],
    ['student_projects',{status:'pending'}],
    ['rating_submissions',{status:'pending'}],
    ['confessions',{status:'pending'}]
  ] as const;
  const values=[];
  for(const [table,filter] of queries){
    let q=supabase.from(table).select('*',{count:'exact',head:true});
    for(const [k,v] of Object.entries(filter))q=q.eq(k,v);
    const {count}=await q;values.push(count||0);
  }
  return `📊 *الطلبات المعلقة*\n\n📚 ملخصات: ${values[0]}\n💬 مجموعات: ${values[1]}\n💻 مشاريع: ${values[2]}\n⭐ تقييمات: ${values[3]}\n🗣 اعترافات: ${values[4]}`;
}

async function handleTelegram(update:any){
  const callback=update.callback_query;
  if(callback){
    const chatId=String(callback.message.chat.id);
    const admin=await findAdmin(chatId);
    if(!admin)return new Response('ok');

    try{
      const [action,table,id]=String(callback.data).split('|');
      await moderate(admin,action,table,id);
      await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:action==='approve'?'تم القبول ✅':'تم الرفض ❌'});
      await telegram('editMessageReplyMarkup',{chat_id:chatId,message_id:callback.message.message_id,reply_markup:{inline_keyboard:[]}});
      await telegram('sendMessage',{chat_id:chatId,text:action==='approve'?'تم اعتماد الطلب ونشره ✅':'تم رفض الطلب ❌'});
    }catch(error){
      await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:String(error.message||error),show_alert:true});
    }
    return new Response('ok');
  }

  const message=update.message;
  if(!message)return new Response('ok');
  const chatId=String(message.chat.id);
  const admin=await findAdmin(chatId);
  if(!admin)return new Response('ok');

  const text=String(message.text||'').trim();
  try{
    if(text==='/start'){
      await telegram('sendMessage',{chat_id:chatId,text:`هلا ${admin.name} 👋\nأوامر المشرف:\n/stats\n/maintenance_on\n/maintenance_off\n/site\n/pending`});
    }else if(text==='/stats'||text==='/pending'){
      await telegram('sendMessage',{chat_id:chatId,text:await stats(),parse_mode:'Markdown'});
    }else if(text==='/maintenance_on'){
      await setMaintenance(admin,true);
      await telegram('sendMessage',{chat_id:chatId,text:'تم تشغيل صيانة الموقع كاملة 🛠'});
    }else if(text==='/maintenance_off'){
      await setMaintenance(admin,false);
      await telegram('sendMessage',{chat_id:chatId,text:'تم فتح الموقع للزوار ✅'});
    }else if(text==='/site'){
      await telegram('sendMessage',{chat_id:chatId,text:SITE_URL||'لم يتم إعداد SITE_URL'});
    }else{
      await telegram('sendMessage',{chat_id:chatId,text:'الأوامر المتاحة: /stats /pending /maintenance_on /maintenance_off /site'});
    }
  }catch(error){
    await telegram('sendMessage',{chat_id:chatId,text:`خطأ: ${String(error.message||error)}`});
  }
  return new Response('ok');
}

Deno.serve(async(req)=>{
  try{
    const telegramSecret=req.headers.get('x-telegram-bot-api-secret-token');
    const databaseSecret=req.headers.get('x-database-webhook-secret');
    const payload=await req.json();

    if(telegramSecret===WEBHOOK_SECRET){
      return handleTelegram(payload);
    }
    if(databaseSecret===DATABASE_WEBHOOK_SECRET){
      if(payload.type==='INSERT')await notifyInsert(payload);
      return new Response('ok');
    }
    return new Response('unauthorized',{status:401});
  }catch(error){
    console.error(error);
    return new Response(String(error.message||error),{status:500});
  }
});
