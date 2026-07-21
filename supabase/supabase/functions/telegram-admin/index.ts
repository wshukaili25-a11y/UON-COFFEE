
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const DATABASE_WEBHOOK_SECRET = Deno.env.get('DATABASE_WEBHOOK_SECRET')!;
const SITE_URL = Deno.env.get('SITE_URL') || '';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-database-webhook-secret, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

function corsResponse(body='ok',status=200){
  return new Response(body,{status,headers:{...corsHeaders,'Content-Type':'text/plain; charset=utf-8'}});
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const moderationTables: Record<string, {
  label:string;
  title:string;
  approvePermission:string;
  statusColumn?:string;
}> = {
  summaries:{label:'ملخص',title:'title',approvePermission:'summaries',statusColumn:'approved'},
  whatsapp_groups:{label:'مجموعة واتساب',title:'subject',approvePermission:'groups',statusColumn:'approved'},
  student_projects:{label:'مشروع طالب',title:'title',approvePermission:'projects'},
  rating_submissions:{label:'تقييم',title:'target_name',approvePermission:'ratings'},
  confessions:{label:'اعتراف',title:'content',approvePermission:'confessions'}
};

async function telegram(method:string, body:Record<string,unknown>){
  const res=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function activeAdmins(){
  const {data,error}=await supabase.from('telegram_admins').select('*').eq('active',true);
  if(error) throw error;
  return data || [];
}

async function findAdmin(chatId:string){
  const {data}=await supabase
    .from('telegram_admins')
    .select('*')
    .eq('chat_id',chatId)
    .eq('active',true)
    .maybeSingle();
  return data;
}

function has(admin:any, permission:string){
  if(!admin) return false;
  if(admin.role==='owner') return true;

  const roleDefaults:Record<string,string[]> = {
    admin:['summaries','groups','projects','ratings','confessions','announcements','tools','maintenance','stats'],
    moderator:['summaries','groups','projects','ratings','confessions','stats'],
    staff:['projects','stats']
  };

  if(roleDefaults[admin.role]?.includes(permission)) return true;
  return admin.permissions?.[permission] === true;
}

function preview(value:unknown,max=180){
  const s=String(value ?? '').replace(/\s+/g,' ').trim();
  return s.length>max?s.slice(0,max)+'…':s;
}

function mainKeyboard(admin:any){
  const rows:any[] = [
    [
      {text:'📊 الإحصائيات',callback_data:'menu|stats'},
      {text:'🕓 الطلبات المعلقة',callback_data:'menu|pending'}
    ]
  ];

  if(has(admin,'announcements')){
    rows.push([{text:'📢 الإعلانات',callback_data:'menu|announcements'}]);
  }

  if(has(admin,'tools')){
    rows.push([{text:'🛠 الأدوات',callback_data:'menu|tools'}]);
  }

  if(has(admin,'maintenance')){
    rows.push([{text:'🔧 الصيانة',callback_data:'menu|maintenance'}]);
  }

  rows.push([{text:'🌐 فتح لوحة الموقع',url:`${SITE_URL}/admin.html`}]);

  return {inline_keyboard:rows};
}

async function sendMainMenu(chatId:string,admin:any,text='لوحة تحكم UON Hub'){
  await telegram('sendMessage',{
    chat_id:chatId,
    text:`🏠 ${text}\n\nمرحبًا ${admin.name} — الصلاحية: ${admin.role}`,
    reply_markup:mainKeyboard(admin)
  });
}

async function statsText(){
  const queries=[
    ['summaries',{approved:false}],
    ['whatsapp_groups',{approved:false}],
    ['student_projects',{status:'pending'}],
    ['rating_submissions',{status:'pending'}],
    ['confessions',{status:'pending'}]
  ] as const;

  const values:number[]=[];
  for(const [table,filter] of queries){
    let q=supabase.from(table).select('*',{count:'exact',head:true});
    for(const [k,v] of Object.entries(filter)) q=q.eq(k,v);
    const {count}=await q;
    values.push(count||0);
  }

  const {data:settings}=await supabase
    .from('site_settings')
    .select('key,value')
    .in('key',['maintenance_enabled']);

  const maintenance = settings?.find((x:any)=>x.key==='maintenance_enabled')?.value === true;

  return `📊 إحصائيات UON Hub\n\n`+
    `📚 ملخصات معلقة: ${values[0]}\n`+
    `💬 مجموعات معلقة: ${values[1]}\n`+
    `💻 مشاريع معلقة: ${values[2]}\n`+
    `⭐ تقييمات معلقة: ${values[3]}\n`+
    `🗣 اعترافات معلقة: ${values[4]}\n\n`+
    `${maintenance?'🔴 الموقع تحت الصيانة':'🟢 الموقع يعمل'}`;
}

async function pendingKeyboard(admin:any){
  const rows:any[]=[];

  for(const [table,def] of Object.entries(moderationTables)){
    if(has(admin,def.approvePermission)){
      rows.push([{text:`${def.label}`,callback_data:`pending|${table}|0`}]);
    }
  }

  rows.push([{text:'⬅️ الرئيسية',callback_data:'menu|home'}]);
  return {inline_keyboard:rows};
}

async function pendingItems(table:string,page=0){
  const def=moderationTables[table];
  if(!def) return {text:'نوع غير معروف',keyboard:{inline_keyboard:[]}};

  let query=supabase.from(table).select('*').order('created_at',{ascending:false}).range(page*5,page*5+4);
  query = def.statusColumn==='approved' ? query.eq('approved',false) : query.eq('status','pending');
  const {data,error}=await query;
  if(error) throw error;

  if(!data?.length){
    return {
      text:`✅ لا توجد طلبات معلقة في قسم ${def.label}`,
      keyboard:{inline_keyboard:[[{text:'⬅️ رجوع',callback_data:'menu|pending'}]]}
    };
  }

  const rows:any[]=[];
  let text=`🕓 *${def.label} — الطلبات المعلقة*\n\n`;

  data.forEach((item:any,index:number)=>{
    const title=preview(item[def.title]||item.title||item.content||'طلب',120);
    text+=`${index+1}. ${title}\n`;
    rows.push([
      {text:`${index+1} ✅`,callback_data:`approve|${table}|${item.id}`},
      {text:`${index+1} ❌`,callback_data:`reject|${table}|${item.id}`}
    ]);
  });

  const nav:any[]=[];
  if(page>0) nav.push({text:'⬅️ السابق',callback_data:`pending|${table}|${page-1}`});
  if(data.length===5) nav.push({text:'التالي ➡️',callback_data:`pending|${table}|${page+1}`});
  if(nav.length) rows.push(nav);
  rows.push([{text:'⬅️ الأقسام',callback_data:'menu|pending'}]);

  return {text,keyboard:{inline_keyboard:rows}};
}

async function toolsMenu(){
  const {data,error}=await supabase.from('tools_items').select('id,name,status').order('name');
  if(error) throw error;

  const rows=(data||[]).map((t:any)=>[
    {text:`${t.status==='active'?'🟢':'🔴'} ${t.name}`,callback_data:`toolmenu|${t.id}`},
  ]);
  rows.push([{text:'⬅️ الرئيسية',callback_data:'menu|home'}]);

  return {
    text:'🛠 التحكم بالأدوات\n\nاختر أداة لتغيير حالتها:',
    keyboard:{inline_keyboard:rows}
  };
}

async function toolActions(id:string){
  const {data,error}=await supabase.from('tools_items').select('*').eq('id',id).maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('الأداة غير موجودة');

  return {
    text:`🛠 *${data.name}*\nالحالة الحالية: ${data.status||'active'}`,
    keyboard:{inline_keyboard:[
      [
        {text:'🟢 تشغيل',callback_data:`toolstatus|${id}|active`},
        {text:'🔴 إيقاف',callback_data:`toolstatus|${id}|disabled`}
      ],
      [
        {text:'🟡 قريبًا',callback_data:`toolstatus|${id}|coming_soon`},
        {text:'🛠 صيانة',callback_data:`toolstatus|${id}|maintenance`}
      ],
      [{text:'⬅️ الأدوات',callback_data:'menu|tools'}]
    ]}
  };
}

async function maintenanceMenu(){
  const {data}=await supabase.from('site_settings').select('key,value').eq('key','maintenance_enabled').maybeSingle();
  const on=data?.value===true;

  return {
    text:`🔧 وضع الصيانة\n\nالحالة الحالية: ${on?'🔴 مفعّل':'🟢 متوقف'}`,
    keyboard:{inline_keyboard:[
      [
        {text:'تشغيل الصيانة 🔴',callback_data:'maintenance|on'},
        {text:'إيقاف الصيانة 🟢',callback_data:'maintenance|off'}
      ],
      [{text:'⬅️ الرئيسية',callback_data:'menu|home'}]
    ]}
  };
}

async function announcementsMenu(){
  return {
    text:'📢 إدارة الإعلانات\n\nاختر الإجراء:',
    keyboard:{inline_keyboard:[
      [{text:'➕ إعلان جديد',callback_data:'announcement|new'}],
      [{text:'📋 آخر الإعلانات',callback_data:'announcement|list'}],
      [{text:'⬅️ الرئيسية',callback_data:'menu|home'}]
    ]}
  };
}

async function listAnnouncements(){
  const {data,error}=await supabase.from('site_announcements').select('*').order('created_at',{ascending:false}).limit(8);
  if(error) throw error;

  const rows=(data||[]).map((a:any)=>[
    {text:`${a.active?'🟢':'⚪'} ${preview(a.title,30)}`,callback_data:`annmenu|${a.id}`}
  ]);
  rows.push([{text:'⬅️ الإعلانات',callback_data:'menu|announcements'}]);

  return {
    text:'📋 آخر الإعلانات',
    keyboard:{inline_keyboard:rows}
  };
}

async function announcementActions(id:string){
  const {data,error}=await supabase.from('site_announcements').select('*').eq('id',id).maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('الإعلان غير موجود');

  return {
    text:`📢 ${data.title}\n\n${preview(data.body,500)}\n\nالحالة: ${data.active?'مفعّل':'متوقف'}`,
    keyboard:{inline_keyboard:[
      [
        {text:data.active?'إيقاف':'تشغيل',callback_data:`anntoggle|${id}|${data.active?'off':'on'}`},
        {text:'حذف 🗑',callback_data:`anndelete|${id}`}
      ],
      [{text:'⬅️ الإعلانات',callback_data:'announcement|list'}]
    ]}
  };
}

async function setConversation(chatId:string,state:string,data:any={}){
  await supabase.from('telegram_conversations').upsert({
    chat_id:chatId,
    state,
    data,
    updated_at:new Date().toISOString()
  });
}

async function getConversation(chatId:string){
  const {data}=await supabase.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();
  return data;
}

async function clearConversation(chatId:string){
  await supabase.from('telegram_conversations').delete().eq('chat_id',chatId);
}

async function notifyInsert(payload:any){
  const table=payload.table;
  const record=payload.record;
  const def=moderationTables[table];
  if(!def) return;

  const title=preview(record[def.title]||record.title||record.content||'طلب جديد',100);
  const text=`🔔 ${def.label} جديد بانتظار المراجعة\n\n${title}`;

  let delivered=0;
  const failures:string[]=[];

  for(const admin of await activeAdmins()){
    if(!admin.notifications_enabled || !has(admin,def.approvePermission)) continue;

    try{
      await telegram('sendMessage',{
        chat_id:admin.chat_id,
        text,
        reply_markup:{
          inline_keyboard:[
            [
              {text:'قبول ✅',callback_data:`approve|${table}|${record.id}`},
              {text:'رفض ❌',callback_data:`reject|${table}|${record.id}`}
            ],
            [{text:'فتح لوحة الإدارة 🔗',url:`${SITE_URL}/admin.html`}]
          ]
        }
      });
      delivered++;
    }catch(error){
      failures.push(`${admin.chat_id}: ${String(error?.message||error)}`);
      console.error('Telegram notification failed',admin.chat_id,error);
    }
  }

  if(delivered===0){
    throw new Error(`Telegram delivery failed: ${failures.join(' | ')||'no eligible active admins'}`);
  }
}

async function moderate(admin:any,action:string,table:string,id:string){
  const def=moderationTables[table];
  if(!def) throw new Error('جدول غير مسموح');
  if(!has(admin,def.approvePermission)) throw new Error('ليس لديك صلاحية');

  if(def.statusColumn==='approved'){
    if(action==='reject'){
      const {error}=await supabase.from(table).delete().eq('id',id);
      if(error) throw error;
    }else{
      const {error}=await supabase.from(table).update({approved:true}).eq('id',id);
      if(error) throw error;
    }
  }else{
    const {error}=await supabase.from(table).update({
      status:action==='approve'?'approved':'rejected',
      reviewed_at:new Date().toISOString()
    }).eq('id',id);
    if(error) throw error;
  }
}

async function editMessage(chatId:string,messageId:number,text:string,keyboard:any){
  await telegram('editMessageText',{
    chat_id:chatId,
    message_id:messageId,
    text,
    reply_markup:keyboard
  });
}

async function handleCallback(callback:any,admin:any){
  const chatId=String(callback.message.chat.id);
  const messageId=callback.message.message_id;
  const parts=String(callback.data).split('|');
  const action=parts[0];

  if(action==='menu'){
    const section=parts[1];

    if(section==='home'){
      await editMessage(chatId,messageId,'🏠 لوحة تحكم UON Hub',mainKeyboard(admin));
    }else if(section==='stats'){
      await editMessage(chatId,messageId,await statsText(),{inline_keyboard:[[{text:'⬅️ الرئيسية',callback_data:'menu|home'}]]});
    }else if(section==='pending'){
      await editMessage(chatId,messageId,'🕓 *اختر قسم الطلبات المعلقة*',await pendingKeyboard(admin));
    }else if(section==='tools'){
      if(!has(admin,'tools')) throw new Error('ليس لديك صلاحية الأدوات');
      const menu=await toolsMenu();
      await editMessage(chatId,messageId,menu.text,menu.keyboard);
    }else if(section==='maintenance'){
      if(!has(admin,'maintenance')) throw new Error('ليس لديك صلاحية الصيانة');
      const menu=await maintenanceMenu();
      await editMessage(chatId,messageId,menu.text,menu.keyboard);
    }else if(section==='announcements'){
      if(!has(admin,'announcements')) throw new Error('ليس لديك صلاحية الإعلانات');
      const menu=await announcementsMenu();
      await editMessage(chatId,messageId,menu.text,menu.keyboard);
    }
  }

  else if(action==='pending'){
    const table=parts[1],page=Number(parts[2]||0);
    const def=moderationTables[table];
    if(!def || !has(admin,def.approvePermission)) throw new Error('ليس لديك صلاحية');
    const menu=await pendingItems(table,page);
    await editMessage(chatId,messageId,menu.text,menu.keyboard);
  }

  else if(action==='approve'||action==='reject'){
    const table=parts[1],id=parts[2];
    await moderate(admin,action,table,id);
    await telegram('answerCallbackQuery',{
      callback_query_id:callback.id,
      text:action==='approve'?'تم القبول ✅':'تم الرفض ❌'
    });
    await telegram('editMessageReplyMarkup',{
      chat_id:chatId,
      message_id:messageId,
      reply_markup:{inline_keyboard:[]}
    });
    await telegram('sendMessage',{
      chat_id:chatId,
      text:action==='approve'?'تم اعتماد الطلب ونشره ✅':'تم رفض الطلب ❌'
    });
  }

  else if(action==='toolmenu'){
    if(!has(admin,'tools')) throw new Error('ليس لديك صلاحية الأدوات');
    const menu=await toolActions(parts[1]);
    await editMessage(chatId,messageId,menu.text,menu.keyboard);
  }

  else if(action==='toolstatus'){
    if(!has(admin,'tools')) throw new Error('ليس لديك صلاحية الأدوات');
    const id=parts[1],status=parts[2];
    const {error}=await supabase.from('tools_items').update({
      status,
      disabled:status!=='active'
    }).eq('id',id);
    if(error) throw error;
    const menu=await toolActions(id);
    await editMessage(chatId,messageId,menu.text,menu.keyboard);
  }

  else if(action==='maintenance'){
    if(!has(admin,'maintenance')) throw new Error('ليس لديك صلاحية الصيانة');
    const on=parts[1]==='on';
    const {error}=await supabase.from('site_settings').upsert({
      key:'maintenance_enabled',
      value:on,
      updated_at:new Date().toISOString()
    });
    if(error) throw error;
    const menu=await maintenanceMenu();
    await editMessage(chatId,messageId,menu.text,menu.keyboard);
  }

  else if(action==='announcement'){
    if(!has(admin,'announcements')) throw new Error('ليس لديك صلاحية الإعلانات');

    if(parts[1]==='new'){
      await setConversation(chatId,'announcement_title',{});
      await telegram('sendMessage',{chat_id:chatId,text:'📢 أرسل الآن عنوان الإعلان'});
      await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'ابدأ بكتابة العنوان'});
    }else if(parts[1]==='list'){
      const menu=await listAnnouncements();
      await editMessage(chatId,messageId,menu.text,menu.keyboard);
    }
  }

  else if(action==='annmenu'){
    if(!has(admin,'announcements')) throw new Error('ليس لديك صلاحية الإعلانات');
    const menu=await announcementActions(parts[1]);
    await editMessage(chatId,messageId,menu.text,menu.keyboard);
  }

  else if(action==='anntoggle'){
    if(!has(admin,'announcements')) throw new Error('ليس لديك صلاحية الإعلانات');
    const id=parts[1],active=parts[2]==='on';
    const {error}=await supabase.from('site_announcements').update({active}).eq('id',id);
    if(error) throw error;
    const menu=await announcementActions(id);
    await editMessage(chatId,messageId,menu.text,menu.keyboard);
  }

  else if(action==='anndelete'){
    if(!has(admin,'announcements')) throw new Error('ليس لديك صلاحية الإعلانات');
    const id=parts[1];
    const {error}=await supabase.from('site_announcements').delete().eq('id',id);
    if(error) throw error;
    const menu=await listAnnouncements();
    await editMessage(chatId,messageId,'تم حذف الإعلان 🗑\n\n'+menu.text,menu.keyboard);
  }

  await telegram('answerCallbackQuery',{callback_query_id:callback.id}).catch(()=>{});
}

async function handleMessage(message:any,admin:any){
  const chatId=String(message.chat.id);
  const text=String(message.text||'').trim();

  if(text==='/start'||text==='/menu'){
    await clearConversation(chatId);
    await sendMainMenu(chatId,admin);
    return;
  }

  if(text==='/cancel'){
    await clearConversation(chatId);
    await sendMainMenu(chatId,admin,'تم إلغاء العملية');
    return;
  }

  const conversation=await getConversation(chatId);

  if(conversation){
    if(conversation.state==='announcement_title'){
      await setConversation(chatId,'announcement_body',{title:text});
      await telegram('sendMessage',{chat_id:chatId,text:'أرسل الآن نص الإعلان'});
      return;
    }

    if(conversation.state==='announcement_body'){
      await setConversation(chatId,'announcement_url',{...conversation.data,body:text});
      await telegram('sendMessage',{
        chat_id:chatId,
        text:'أرسل رابط الإعلان، أو اكتب `skip` لتخطيه'
      });
      return;
    }

    if(conversation.state==='announcement_url'){
      const url=text.toLowerCase()==='skip'?'':text;
      const payload={...conversation.data,button_url:url};
      await setConversation(chatId,'announcement_confirm',payload);
      await telegram('sendMessage',{
        chat_id:chatId,
        text:`📢 معاينة الإعلان\n\n${payload.title}\n${payload.body}\n${url?`\n${url}`:''}`,
        reply_markup:{inline_keyboard:[
          [{text:'نشر ✅',callback_data:'annpublish|yes'}],
          [{text:'إلغاء ❌',callback_data:'annpublish|no'}]
        ]}
      });
      return;
    }
  }

  if(text==='/stats'){
    if(!has(admin,'stats')) throw new Error('ليس لديك صلاحية الإحصائيات');
    await telegram('sendMessage',{chat_id:chatId,text:await statsText()});
    return;
  }

  if(text==='/pending'){
    await telegram('sendMessage',{
      chat_id:chatId,
      text:'اختر القسم:',
      reply_markup:await pendingKeyboard(admin)
    });
    return;
  }

  await sendMainMenu(chatId,admin,'الأمر غير معروف — استخدم الأزرار');
}

async function handleTelegram(update:any){
  const callback=update.callback_query;
  const message=update.message;

  const chatId=String(callback?.message?.chat?.id || message?.chat?.id || '');
  if(!chatId) return new Response('ok');

  const admin=await findAdmin(chatId);
  if(!admin){
    if(message){
      await telegram('sendMessage',{
        chat_id:chatId,
        text:`هذا الحساب غير مسجل كمشرف.\nChat ID: ${chatId}`
      }).catch(()=>{});
    }
    return new Response('ok');
  }

  try{
    if(callback){
      const parts=String(callback.data).split('|');

      if(parts[0]==='annpublish'){
        if(!has(admin,'announcements')) throw new Error('ليس لديك صلاحية الإعلانات');
        const conversation=await getConversation(chatId);
        if(!conversation || conversation.state!=='announcement_confirm') throw new Error('انتهت جلسة الإعلان');

        if(parts[1]==='yes'){
          const data=conversation.data;
          const {error}=await supabase.from('site_announcements').insert({
            title:data.title,
            body:data.body,
            button_url:data.button_url||null,
            button_text:data.button_url?'التفاصيل':null,
            type:'important',
            priority:50,
            active:true
          });
          if(error) throw error;
          await clearConversation(chatId);
          await telegram('editMessageText',{
            chat_id:chatId,
            message_id:callback.message.message_id,
            text:'تم نشر الإعلان في الموقع ✅'
          });
        }else{
          await clearConversation(chatId);
          await telegram('editMessageText',{
            chat_id:chatId,
            message_id:callback.message.message_id,
            text:'تم إلغاء الإعلان ❌'
          });
        }

        await telegram('answerCallbackQuery',{callback_query_id:callback.id});
        return new Response('ok');
      }

      await handleCallback(callback,admin);
    }else if(message){
      await handleMessage(message,admin);
    }
  }catch(error){
    console.error(error);
    if(callback){
      await telegram('answerCallbackQuery',{
        callback_query_id:callback.id,
        text:String(error.message||error),
        show_alert:true
      }).catch(()=>{});
    }else{
      await telegram('sendMessage',{
        chat_id:chatId,
        text:`خطأ: ${String(error.message||error)}`
      }).catch(()=>{});
    }
  }

  return new Response('ok');
}


async function notifyWebSubmission(payload:any){
 const table=String(payload.table||'');
 const id=String(payload.id||'');
 const def=moderationTables[table];

 if(!def||!id)throw new Error('invalid submission');

 let q=supabase.from(table).select('*').eq('id',id);
 q=def.statusColumn==='approved'?q.eq('approved',false):q.eq('status','pending');

 const {data,error}=await q.maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('pending record not found');

 const {data:existing}=await supabase
   .from('telegram_notification_log')
   .select('record_id')
   .eq('table_name',table)
   .eq('record_id',id)
   .maybeSingle();

 if(existing)return;

 await notifyInsert({table,record:data});

 const {error:logError}=await supabase
   .from('telegram_notification_log')
   .insert({table_name:table,record_id:id});

 if(logError&&logError.code!=='23505')throw logError;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return corsResponse('',204);

  try{
    const telegramSecret=req.headers.get('x-telegram-bot-api-secret-token');
    const databaseSecret=req.headers.get('x-database-webhook-secret');
    const payload=await req.json();

    if(payload?.source==='web-submit'){await notifyWebSubmission(payload);return corsResponse('ok');}

    if(telegramSecret===WEBHOOK_SECRET){
      return handleTelegram(payload);
    }

    if(databaseSecret===DATABASE_WEBHOOK_SECRET){
      if(payload.type==='INSERT') await notifyInsert(payload);
      return new Response('ok');
    }

    return corsResponse('unauthorized',401);
  }catch(error){
    console.error(error);
    return corsResponse(String(error.message||error),500);
  }
});
