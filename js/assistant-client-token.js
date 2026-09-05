const KEY='uon_ai_client_v55';
const API_PATH='/functions/v1/uon-ai-chat';
const DIRECT_API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-chat-v64';
const SESSION_KEY='uon_ai_session_v46';
function uuid(){try{return crypto.randomUUID()}catch{return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}}
function token(){let value='';try{value=localStorage.getItem(KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(value)){value=uuid();try{localStorage.setItem(KEY,value)}catch{}}return value}
function sessionToken(){let value='';try{value=sessionStorage.getItem(SESSION_KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(value)){value=uuid();try{sessionStorage.setItem(SESSION_KEY,value)}catch{}}return value}
function waitLabel(seconds,language){const value=Math.max(1,Math.min(300,Math.ceil(Number(seconds)||60)));if(language==='en')return value<60?`${value} seconds`:`${Math.ceil(value/60)} minute${value>60?'s':''}`;return value<60?`${value} ثانية`:`${Math.ceil(value/60)} دقيقة`}
const CLIENT_TOKEN=token();
const SESSION_TOKEN=sessionToken();
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){let url='',body=null,nextInit=init;try{url=typeof input==='string'?input:input?.url||'';if(url.includes(API_PATH)&&nextInit?.body&&typeof nextInit.body==='string'){body=JSON.parse(nextInit.body);if(body&&typeof body==='object'&&!body.client_token){body.client_token=CLIENT_TOKEN;nextInit={...nextInit,body:JSON.stringify(body)}}}}catch{}
const response=await nativeFetch(input,nextInit);
if(url.includes(API_PATH)&&response.status===429&&body?.question&&!body?.action){try{const data=await response.clone().json().catch(()=>({}));const retry=Math.max(1,Number(data?.retry_after||response.headers.get('Retry-After')||60));const wait=waitLabel(retry,body.language);const answer=body.language==='en'?`You've reached UON AI's temporary usage limit. Try again in ${wait}. The service is running; this short limit protects the platform from overload.`:`وصلت للحد المؤقت لاستخدام UON AI. جرّب مرة ثانية بعد ${wait}. الخدمة شغالة؛ هذا حد قصير لحماية المنصة من الضغط.`;return new Response(JSON.stringify({...data,answer,mode:'rate_limited',retry_after:retry}),{status:200,statusText:'OK',headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}catch{}}
return response};

(function installAssistantHardFix(){
 if(!/\/assistant(?:\.html)?$/i.test(location.pathname))return;
 const style=document.createElement('style');
 style.textContent='.assistant-google-connect,.assistant-side-head>.assistant-google-connect,.assistant-side-head .assistant-smart-actions{display:none!important}';
 document.head.appendChild(style);
 const lang=()=>{try{return localStorage.getItem('uon_language')==='en'?'en':'ar'}catch{return'ar'}};
 const tr=(ar,en)=>lang()==='en'?en:ar;
 const history=[];
 let sending=false;
 let controller=null;
 function stripGoogleUi(){
  document.querySelectorAll('.assistant-google-connect').forEach(el=>el.remove());
  document.querySelectorAll('.assistant-smart-actions').forEach(el=>{el.innerHTML='';el.hidden=true;el.style.display='none'});
  const copy=document.querySelector('.assistant-side-head p[data-ar][data-en]');
  if(copy){
   copy.dataset.ar='اسأل عن الجامعة والمقررات والمواعيد والخدمات، واستفد من جدولك وبيانات UON Hub للحصول على مساعدة أذكى.';
   copy.dataset.en='Ask about the university, courses, dates, and services, using your UON Hub schedule and platform data for smarter help.';
   copy.textContent=lang()==='en'?copy.dataset.en:copy.dataset.ar;
  }
 }
 function addMessage(role,text,links){
  const chat=document.querySelector('#chat');
  if(!chat)return null;
  const article=document.createElement('article');
  article.className='message '+role;
  const body=document.createElement('div');
  body.className='message-content';
  body.textContent=String(text||'').trim();
  article.appendChild(body);
  if(role==='bot'&&Array.isArray(links)&&links.length){
   const usable=links.filter(x=>x&&x.url).slice(0,2);
   if(usable.length){
    const row=document.createElement('div');
    row.className='assistant-links assistant-links-minimal';
    usable.forEach(item=>{
     const a=document.createElement('a');
     a.href=item.url;
     a.target=/^https?:/i.test(item.url)?'_blank':'_self';
     a.rel='noopener noreferrer';
     a.textContent=item.official?tr('المصدر الرسمي','Official source'):(item.title||tr('فتح المصدر','Open source'));
     row.appendChild(a);
    });
    article.appendChild(row);
   }
  }
  chat.appendChild(article);
  chat.scrollTop=chat.scrollHeight;
  return article;
 }
 function addTyping(){
  const chat=document.querySelector('#chat');
  if(!chat)return null;
  const el=document.createElement('article');
  el.className='message bot typing-message';
  el.innerHTML='<div class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></div>';
  chat.appendChild(el);
  chat.scrollTop=chat.scrollHeight;
  return el;
 }
 function setBusy(active){
  sending=active;
  const button=document.querySelector('#chatForm button[type="submit"],#chatForm button[data-assistant-send],#chatForm .btn.primary');
  if(button){button.disabled=active;button.setAttribute('aria-busy',active?'true':'false')}
  const stop=document.querySelector('#assistantStop');
  if(stop)stop.hidden=!active;
 }
 async function sendDirect(){
  const input=document.querySelector('#question');
  const raw=input?.value?.trim()||'';
  if(!raw||sending)return;
  addMessage('user',raw);
  history.push({role:'user',content:raw});
  if(input)input.value='';
  setBusy(true);
  const typing=addTyping();
  controller=new AbortController();
  const timer=setTimeout(()=>controller?.abort(),30000);
  try{
   const response=await window.fetch(DIRECT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:raw,history:history.slice(-12),language:lang(),page_context:location.pathname,session_id:SESSION_TOKEN,client_token:CLIENT_TOKEN,channel:'web'}),cache:'no-store',signal:controller.signal});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.answer)throw new Error(data.error||('AI HTTP '+response.status));
   typing?.remove();
   addMessage('bot',data.answer,data.links||[]);
   history.push({role:'assistant',content:data.answer});
  }catch(error){
   typing?.remove();
   addMessage('bot',error?.name==='AbortError'?tr('تأخر الرد أكثر من المتوقع. حاول مرة أخرى.','The response took too long. Please try again.'):tr('تعذر الوصول إلى UON AI الآن. جرّب مرة أخرى بعد قليل.','UON AI is unavailable right now. Try again shortly.'));
  }finally{
   clearTimeout(timer);
   controller=null;
   setBusy(false);
   input?.focus();
  }
 }
 function installHandlers(){
  stripGoogleUi();
  const form=document.querySelector('#chatForm');
  const input=document.querySelector('#question');
  const button=form?.querySelector('button[type="submit"],button[data-assistant-send],.btn.primary');
  if(!form||!input||!button||form.dataset.directSend==='1')return;
  form.dataset.directSend='1';
  button.dataset.assistantSend='1';
  button.style.position='relative';
  button.style.zIndex='20';
  button.style.pointerEvents='auto';
  button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();void sendDirect()},true);
  form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();void sendDirect()},true);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();event.stopImmediatePropagation();void sendDirect()}},true);
  document.querySelector('#assistantStop')?.addEventListener('click',()=>controller?.abort());
  document.querySelector('#assistantNewChat')?.addEventListener('click',()=>{history.length=0});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHandlers,{once:true});else installHandlers();
 setTimeout(installHandlers,120);
 setTimeout(stripGoogleUi,500);
})();
