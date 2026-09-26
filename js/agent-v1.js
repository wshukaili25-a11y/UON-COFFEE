import{$,enforceUonMaintenance,watchUonMaintenance,trackEvent,applyFeatureStates}from'./core.js?v=64.1.0';
const API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-agent-v1';
const form=$('#chatForm'),input=$('#question'),chat=$('#chat'),send=$('#assistantSend'),stop=$('#assistantStop');
let sending=false,controller=null;
const sessionKey='uon_ai_session_v46',clientKey='uon_ai_client_v55';
function uuid(){try{return crypto.randomUUID()}catch{return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}}
function idFrom(storage,key){let x='';try{x=storage.getItem(key)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(x)){x=uuid();try{storage.setItem(key,x)}catch{}}return x}
const sessionId=idFrom(sessionStorage,sessionKey),clientToken=idFrom(localStorage,clientKey);
const lang=()=>localStorage.getItem('uon_language')==='en'?'en':'ar',t=(ar,en)=>lang()==='en'?en:ar;
const clean=v=>String(v??'').replace(/^#{1,6}\s*/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').trim();
function addMessage(role,content){const a=document.createElement('article');a.className='message '+role;const b=document.createElement('div');b.className='message-content';b.textContent=clean(content);a.appendChild(b);chat.appendChild(a);chat.scrollTop=chat.scrollHeight;return a}
function addTyping(){const a=document.createElement('article');a.className='message bot typing-message';a.innerHTML='<div class="typing-dots"><span></span><span></span><span></span></div>';chat.appendChild(a);return a}
function setSending(v){sending=v;send.disabled=v;stop.hidden=!v}
function history(){return[...chat.querySelectorAll(':scope > .message:not(.typing-message)')].slice(-10).map(el=>({role:el.classList.contains('user')?'user':'assistant',content:el.querySelector('.message-content')?.textContent||''}))}
function renderMeta(article,result){
  const trace=Array.isArray(result?.tool_trace)?result.tool_trace:[];
  if(trace.length){const row=document.createElement('div');row.className='agent-tool-trace';trace.forEach(x=>{const s=document.createElement('span');s.textContent=(x.status==='ok'?'✓ ':'')+String(x.name||'tool').replaceAll('_',' ') + (Number.isFinite(x.count)?' · '+x.count:'');row.appendChild(s)});article.appendChild(row)}
  const links=Array.isArray(result?.links)?result.links.slice(0,5):[];
  const actions=Array.isArray(result?.actions)?result.actions.slice(0,4):[];
  if(links.length||actions.length){const row=document.createElement('div');row.className='agent-actions';
    const all=[...actions.map(x=>({label:x.label,url:x.url})),...links.map(x=>({label:x.title||t('المصدر','Source'),url:x.url}))].filter(x=>x.url);
    [...new Map(all.map(x=>[x.url,x])).values()].slice(0,5).forEach(x=>{const a=document.createElement('a');a.href=x.url;a.textContent=x.label;a.className='agent-action';if(/^https?:/i.test(x.url)){a.target='_blank';a.rel='noopener noreferrer'}row.appendChild(a)});
    article.appendChild(row)}
}
async function askOnce(q,signal){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,history:history(),language:lang(),page_context:location.pathname,session_id:sessionId,client_token:clientToken,channel:'web'}),cache:'no-store',signal});const d=await r.json().catch(()=>({}));if(!r.ok||!d.answer)throw new Error(d.error||('agent_http_'+r.status));return d}
async function ask(q,signal){try{return await askOnce(q,signal)}catch(first){if(signal?.aborted)throw first;await new Promise(r=>setTimeout(r,650));return await askOnce(q,signal)}}
async function submit(q){if(sending||!q)return;addMessage('user',q);input.value='';setSending(true);const typing=addTyping();controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);try{const result=await ask(q,controller.signal);typing.remove();const a=addMessage('bot',result.answer);renderMeta(a,result)}catch{typing.remove();addMessage('bot',t('تعذر الوصول إلى UON Agent الآن. جرّب مرة ثانية.','UON Agent is unavailable right now. Try again.'))}finally{clearTimeout(timer);controller=null;setSending(false);input.focus()}}
form?.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(q)void submit(q)});
input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form?.requestSubmit()}});
stop?.addEventListener('click',()=>controller?.abort());
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.prompt||'';input.focus()}));
$('#agentNewChat')?.addEventListener('click',()=>{chat.innerHTML='';addMessage('bot',t('هلا 👋 أنا UON Agent. أبحث في بيانات UON Hub قبل ما أجاوبك.','Hi 👋 I’m UON Agent. I check UON Hub data before answering.'));input.focus()});
async function init(){try{await enforceUonMaintenance()}catch{}try{watchUonMaintenance()}catch{}try{await applyFeatureStates(document)}catch{}try{trackEvent('page_view',{page:'uon-agent-v1'})}catch{}}
init();