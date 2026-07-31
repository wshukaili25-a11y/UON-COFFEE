import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const db=createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
async function tg(method:string,body:any){const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(t);return JSON.parse(t)}
async function send(chatId:string,text:string,kb?:any[]){return tg('sendMessage',{chat_id:chatId,text,reply_markup:kb?{inline_keyboard:kb}:undefined})}
async function edit(chatId:string,mid:number,text:string,kb:any[]){return tg('editMessageText',{chat_id:chatId,message_id:mid,text,reply_markup:{inline_keyboard:kb}})}
async function admin(chatId:string){const {data}=await db.from('telegram_admins').select('*').eq('chat_id',chatId).eq('active',true).maybeSingle();return data}
async function conv(chatId:string){const {data}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();return data}
async function setConv(chatId:string,state:string,data:any={}){await db.from('telegram_conversations').upsert({chat_id:chatId,state,data,updated_at:new Date().toISOString()})}
async function clearConv(chatId:string){await db.from('telegram_conversations').delete().eq('chat_id',chatId)}
async function proxy(payload:any){return fetch(`${SUPABASE_URL}/functions/v1/telegram-admin`,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':SECRET},body:JSON.stringify(payload)})}

const colleges=[['كلية العلوم والآداب','csa'],['كلية الاقتصاد والإدارة ونظم المعلومات','ceis'],['كلية الهندسة والعمارة','cea'],['كلية العلوم الصحية','chs']];
const collegeName=(code:string)=>colleges.find(x=>x[1]===code)?.[0]||code;

async function startBulk(chatId:string,mid?:number){const kb=colleges.map(([name,code])=>[{text:name,callback_data:`bulk:college:${code}`}]);kb.push([{text:'إلغاء',callback_data:'bulk:cancel'}]);const text='📦 رفع ملخصات دفعة واحدة\n\nاختر الكلية أولًا:';mid?await edit(chatId,mid,text,kb):await send(chatId,text,kb)}
async function runImport(chatId:string,data:any){const files=data.files||[];if(!files.length)throw new Error('ما تم إرسال أي ملف');const r=await fetch(`${SUPABASE_URL}/functions/v1/telegram-bulk-import`,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${KEY}`},body:JSON.stringify({college:data.college,subject:data.subject||'',course_code:data.course_code||'',content_type:'summary',requested_by:chatId,items:files})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'فشل الاستيراد');return j}

Deno.serve(async req=>{
 try{
  const payload=await req.json();
  if(req.headers.get('x-telegram-bot-api-secret-token')!==SECRET)return reply({ok:false,error:'unauthorized'},401);
  const callback=payload.callback_query;const message=payload.message;
  if(callback)try{await tg('answerCallbackQuery',{callback_query_id:callback.id})}catch{}
  const chatId=String(callback?.message?.chat?.id||message?.chat?.id||'');
  const senderId=String(callback?.from?.id||message?.from?.id||'');
  const a=await admin(senderId);if(!a)return reply({ok:true});
  const c=await conv(senderId);
  const text=String(message?.text||'').trim();

  if(text==='/bulk'){await startBulk(chatId);return reply({ok:true})}
  if((text==='/start'||text==='/menu')&&!c){await proxy(payload);await send(chatId,'📦 رفع المحتوى الجماعي',[[{text:'رفع ملخصات دفعة واحدة',callback_data:'bulk:start'}]]);return reply({ok:true})}

  if(callback){const d=String(callback.data||'');const mid=callback.message.message_id;
   if(d==='bulk:start'){await startBulk(chatId,mid);return reply({ok:true})}
   if(d==='bulk:cancel'){await clearConv(senderId);await edit(chatId,mid,'تم إلغاء الرفع الجماعي.',[[{text:'العودة للرئيسية',callback_data:'home'}]]);return reply({ok:true})}
   if(d.startsWith('bulk:college:')){const code=d.split(':')[2];await setConv(senderId,'bulk_subject',{college:collegeName(code),files:[]});await edit(chatId,mid,`الكلية: ${collegeName(code)}\n\nأرسل اسم المادة أو القسم الآن.`,[[{text:'إلغاء',callback_data:'bulk:cancel'}]]);return reply({ok:true})}
   if(d==='bulk:finish'){const data=c?.data||{};const j=await runImport(senderId,data);await clearConv(senderId);await edit(chatId,mid,`تم الاستيراد ✅\nنجح: ${j.imported||0}\nتخطّي: ${j.skipped||0}\n\nالملفات أضيفت كمعلّقة للمراجعة.`,[[{text:'فتح الطلبات المعلقة',callback_data:'pending:menu'}],[{text:'الرئيسية',callback_data:'home'}]]);return reply({ok:true})}
  }

  if(c?.state==='bulk_subject'&&text){await setConv(senderId,'bulk_files',{...c.data,subject:text,files:[]});await send(chatId,`تم اختيار: ${text}\n\nأرسل الملفات الآن واحدًا وراء الثاني. لما تخلص اضغط «بدء الاستيراد».`,[[{text:'بدء الاستيراد',callback_data:'bulk:finish'}],[{text:'إلغاء',callback_data:'bulk:cancel'}]]);return reply({ok:true})}
  if(c?.state==='bulk_files'&&message?.document){const files=[...(c.data?.files||[])];if(files.length>=100){await send(chatId,'وصلت الحد الأقصى 100 ملف. اضغط بدء الاستيراد.',[[{text:'بدء الاستيراد',callback_data:'bulk:finish'}]]);return reply({ok:true})}files.push({file_id:message.document.file_id,title:message.document.file_name||`ملف ${files.length+1}`,description:message.caption||''});await setConv(senderId,'bulk_files',{...c.data,files});await send(chatId,`تمت إضافة الملف رقم ${files.length} ✅`,[[{text:`بدء الاستيراد (${files.length})`,callback_data:'bulk:finish'}],[{text:'إلغاء',callback_data:'bulk:cancel'}]]);return reply({ok:true})}
  if(c?.state==='bulk_files'&&text&&/^https?:\/\//i.test(text)){await send(chatId,'لأسباب أمنية، أرسل الملف نفسه بدل رابط خارجي.');return reply({ok:true})}

  await proxy(payload);return reply({ok:true});
 }catch(e){return reply({ok:false,error:String(e?.message||e)},500)}
});
