
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;
declare const EdgeRuntime: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || '';
const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || '';
const IG_TOKEN = Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || Deno.env.get('META_ACCESS_TOKEN') || '';
const WA_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || Deno.env.get('META_ACCESS_TOKEN') || '';
const IG_ACCOUNT_ID = Deno.env.get('INSTAGRAM_ACCOUNT_ID') || '';
const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') || 'v26.0';
const IG_GRAPH_BASE = (Deno.env.get('INSTAGRAM_GRAPH_BASE') || 'https://graph.instagram.com').replace(/\/+$/,'');
const HANDOFF_SECRET = Deno.env.get('UON_AI_HANDOFF_SECRET') || '';
const AI_URL = SUPABASE_URL + '/functions/v1/uon-ai-chat-v64';
const HANDOFF_URL = SUPABASE_URL + '/functions/v1/uon-ai-handoff';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });

const clean = (v:any,n=5000) => String(v ?? '').replace(/\u0000/g,'').trim().slice(0,n);
const json = (body:any,status=200) => new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function sha256(value:string){
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function stableUuid(seed:string){
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20,32);
}
async function verifyMetaSignature(raw:string, signature:string|null){
  if(!META_APP_SECRET || !signature || !signature.startsWith('sha256=')) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
  const expected='sha256='+[...signed].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(expected.length!==signature.length)return false;
  let diff=0;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0;
}
function isArabic(text:string){return /[\u0600-\u06ff]/.test(text)}
function handoffIntent(text:string){
  const q=text.toLowerCase().replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim();
  return /^(?:(?:ابي|اريد|ابغي|بغيت|ممكن)\s*)?(?:اكلم|اتكلم مع|تحولني|حولني|وصلني|ابي اتواصل مع)\s*(?:مشرف|شخص|انسان|موظف حقيقي)|^(?:human|agent|representative|talk to (?:a )?(?:human|person|agent))$/i.test(q);
}
function resumeIntent(text:string){
  const q=text.toLowerCase().replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim();
  return /^(?:رجع|شغل|فعل)\s*(?:uon\s*ai|الذكاء|المساعد)|^(?:uon\s*ai|ai)\s*(?:ارجع|رد)$/i.test(q);
}
async function claimEvent(channel:string,eventId:string,sender:string){
  const sender_hash=await sha256(channel+':'+sender);
  const {error}=await db.from('uon_ai_social_events').insert({channel,event_id:eventId,sender_hash,status:'received'});
  if(!error)return true;
  if((error as any)?.code==='23505')return false;
  throw error;
}
async function finishEvent(channel:string,eventId:string,status:'processed'|'ignored'|'failed',error=''){
  await db.from('uon_ai_social_events').update({status,error:error?clean(error,900):null,processed_at:new Date().toISOString()}).eq('channel',channel).eq('event_id',eventId);
}
async function getThread(channel:string,sender:string){
  const session_id=await stableUuid('uonhub:'+channel+':'+sender+':session');
  const client_token=await stableUuid('uonhub:'+channel+':'+sender+':client');
  const {data:conv}=await db.from('uon_ai_conversations').select('id,status').eq('session_id',session_id).maybeSingle();
  let history:any[]=[];
  if(conv?.id){
    const {data:messages}=await db.from('uon_ai_messages').select('role,content').eq('conversation_id',conv.id).order('created_at',{ascending:false}).limit(12);
    history=(messages||[]).reverse().filter((x:any)=>['user','assistant'].includes(x.role)).map((x:any)=>({role:x.role,content:clean(x.content,1800)}));
  }
  return {session_id,client_token,conversation:conv,history};
}
async function ensureHumanThread(channel:string,sender:string,text:string){
  const t=await getThread(channel,sender);
  let cid=t.conversation?.id || null;
  if(!cid){
    const {data,error}=await db.from('uon_ai_conversations').insert({
      session_id:t.session_id, client_token_hash:await sha256(t.client_token), channel, status:'human',
      page_context:'social:'+channel, handoff_requested_at:new Date().toISOString(), last_message_at:new Date().toISOString()
    }).select('id').single();
    if(!error)cid=data?.id||null;
  }else{
    await db.from('uon_ai_conversations').update({status:'human',handoff_requested_at:new Date().toISOString(),last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',cid);
  }
  if(cid)await db.from('uon_ai_messages').insert({conversation_id:cid,role:'user',content:text});
  if(HANDOFF_SECRET){
    fetch(HANDOFF_URL,{method:'POST',headers:{'content-type':'application/json','x-internal-handoff':HANDOFF_SECRET},body:JSON.stringify({conversation_id:cid,session_id:t.session_id,question:text,reason:'social_handoff:'+channel})}).catch(()=>{});
  }
}
async function askAi(channel:string,sender:string,text:string){
  const t=await getThread(channel,sender);
  if(t.conversation?.status==='human'){
    if(resumeIntent(text)){
      await db.from('uon_ai_conversations').update({status:'ai',updated_at:new Date().toISOString()}).eq('id',t.conversation.id);
    }else{
      await db.from('uon_ai_messages').insert({conversation_id:t.conversation.id,role:'user',content:text});
      return {answer:isArabic(text)?'محادثتك محوّلة للمشرف حاليًا. إذا تريد ترجع لـ UON AI اكتب: رجع UON AI 🤖':'Your conversation is with a supervisor. To return to UON AI, send: UON AI رجع 🤖',links:[]};
    }
  }
  const r=await fetch(AI_URL,{
    method:'POST',
    headers:{'content-type':'application/json','Authorization':'Bearer '+SERVICE_ROLE_KEY,'apikey':SERVICE_ROLE_KEY},
    body:JSON.stringify({question:text,language:isArabic(text)?'ar':'en',history:t.history,session_id:t.session_id,client_token:t.client_token,channel,page_context:'social:'+channel}),
    signal:AbortSignal.timeout(25000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok || !data?.answer)throw new Error('uon_ai_'+r.status+':'+clean(data?.error||'empty_answer',160));
  return data;
}
function withSources(result:any){
  const answer=clean(result?.answer,5200);
  const links=(Array.isArray(result?.links)?result.links:[]).filter((x:any)=>/^https?:\/\//i.test(String(x?.url||''))).filter((x:any,i:number,a:any[])=>a.findIndex(y=>y.url===x.url)===i).slice(0,2);
  if(!links.length)return answer;
  return answer+'\n\n'+links.map((x:any)=>'🔗 '+clean(x.title||'المصدر',80)+'\n'+x.url).join('\n');
}
function splitText(text:string,max:number){
  const out:string[]=[]; let rest=clean(text,12000);
  while(rest.length>max){
    let cut=rest.lastIndexOf('\n',max);
    if(cut<Math.floor(max*.55))cut=rest.lastIndexOf(' ',max);
    if(cut<Math.floor(max*.55))cut=max;
    out.push(rest.slice(0,cut).trim()); rest=rest.slice(cut).trim();
  }
  if(rest)out.push(rest);
  return out;
}
async function sendInstagram(accountId:string,userId:string,text:string){
  if(!IG_TOKEN)throw new Error('instagram_token_missing');
  const id=accountId||IG_ACCOUNT_ID;
  if(!id)throw new Error('instagram_account_id_missing');
  for(const part of splitText(text,900)){
    const r=await fetch(IG_GRAPH_BASE+'/'+GRAPH_VERSION+'/'+encodeURIComponent(id)+'/messages',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+IG_TOKEN},body:JSON.stringify({recipient:{id:userId},message:{text:part}}),signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error('instagram_send_'+r.status+':'+clean(await r.text(),300));
  }
}
async function sendWhatsapp(phoneId:string,userId:string,text:string){
  if(!WA_TOKEN)throw new Error('whatsapp_token_missing');
  if(!phoneId)throw new Error('whatsapp_phone_id_missing');
  for(const part of splitText(text,3500)){
    const r=await fetch('https://graph.facebook.com/'+GRAPH_VERSION+'/'+encodeURIComponent(phoneId)+'/messages',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+WA_TOKEN},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:userId,type:'text',text:{preview_url:false,body:part}}),signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error('whatsapp_send_'+r.status+':'+clean(await r.text(),300));
  }
}
async function handleMessage(channel:'instagram'|'whatsapp',sender:string,eventId:string,text:string,send:(reply:string)=>Promise<void>){
  let claimed=false;
  try{
    claimed=await claimEvent(channel,eventId,sender);
    if(!claimed)return;
    if(!text){
      await send('أرسل سؤالك كنص حاليًا، وبرد عليك UON AI 🤖');
      await finishEvent(channel,eventId,'ignored'); return;
    }
    if(handoffIntent(text)){
      await ensureHumanThread(channel,sender,text);
      await send(isArabic(text)?'تم تحويل المحادثة للمشرف ✅\nإذا تريد ترجع للمساعد لاحقًا اكتب: رجع UON AI 🤖':'Your conversation was handed to a supervisor ✅\nTo return to the assistant later, send: UON AI رجع 🤖');
      await finishEvent(channel,eventId,'processed'); return;
    }
    const result=await askAi(channel,sender,text);
    await send(withSources(result));
    await finishEvent(channel,eventId,'processed');
  }catch(e){
    console.error('social-message',channel,eventId,e);
    if(claimed)await finishEvent(channel,eventId,'failed',String((e as Error)?.message||e));
    try{await send(isArabic(text)?'تعذر عليّ الرد الحين. جرّب ترسل رسالتك مرة ثانية بعد قليل.':'I could not reply just now. Please try again shortly.')}catch{}
  }
}
async function processInstagram(payload:any){
  for(const entry of payload?.entry||[]){
    for(const event of entry?.messaging||[]){
      const sender=clean(event?.sender?.id,200), accountId=clean(event?.recipient?.id||entry?.id,200);
      const mid=clean(event?.message?.mid||event?.postback?.mid||String(entry?.time||Date.now())+':'+sender,300);
      if(!sender || event?.message?.is_echo)continue;
      const text=clean(event?.message?.text||event?.postback?.payload||'',1800);
      await handleMessage('instagram',sender,mid,text,(reply)=>sendInstagram(accountId,sender,reply));
    }
  }
}
async function processWhatsapp(payload:any){
  for(const entry of payload?.entry||[]){
    for(const change of entry?.changes||[]){
      const value=change?.value||{}, phoneId=clean(value?.metadata?.phone_number_id,120);
      for(const msg of value?.messages||[]){
        const sender=clean(msg?.from,120), mid=clean(msg?.id,300);
        if(!sender||!mid)continue;
        const text=clean(msg?.text?.body||msg?.button?.text||msg?.interactive?.button_reply?.title||msg?.interactive?.list_reply?.title||msg?.image?.caption||'',1800);
        await handleMessage('whatsapp',sender,mid,text,(reply)=>sendWhatsapp(phoneId,sender,reply));
      }
    }
  }
}
async function processPayload(payload:any){
  if(payload?.object==='instagram' || (payload?.entry||[]).some((e:any)=>Array.isArray(e?.messaging)))return processInstagram(payload);
  if(payload?.object==='whatsapp_business_account')return processWhatsapp(payload);
}
Deno.serve(async (req:Request)=>{
  const url=new URL(req.url);
  if(req.method==='GET'){
    if(url.searchParams.get('health')==='1')return json({ok:true,graph_version:GRAPH_VERSION,meta_app_secret_configured:Boolean(META_APP_SECRET),verify_token_configured:Boolean(VERIFY_TOKEN),instagram_token_configured:Boolean(IG_TOKEN),whatsapp_token_configured:Boolean(WA_TOKEN)});
    const mode=url.searchParams.get('hub.mode')||'', token=url.searchParams.get('hub.verify_token')||'', challenge=url.searchParams.get('hub.challenge')||'';
    if(mode==='subscribe' && VERIFY_TOKEN && token===VERIFY_TOKEN)return new Response(challenge,{status:200,headers:{'content-type':'text/plain','cache-control':'no-store'}});
    return new Response('forbidden',{status:403});
  }
  if(req.method!=='POST')return new Response('method_not_allowed',{status:405});
  const raw=await req.text();
  if(!await verifyMetaSignature(raw,req.headers.get('x-hub-signature-256')))return new Response('invalid_signature',{status:401});
  let payload:any={}; try{payload=JSON.parse(raw)}catch{return new Response('bad_json',{status:400})}
  const task=processPayload(payload).catch(e=>console.error('social-webhook-process',e));
  try{EdgeRuntime.waitUntil(task)}catch{await task}
  return new Response('EVENT_RECEIVED',{status:200,headers:{'content-type':'text/plain','cache-control':'no-store'}});
});
