import {$,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent,applyFeatureStates,get} from './core.js';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const form=$('#chatForm');
const input=$('#question');
const chat=$('#chat');
const submitButton=form?.querySelector('button[type="submit"]');
const history=[];
let sending=false;

function addMessage(role,content,links=[],meta={}){
 if(!chat)return null;
 const article=document.createElement('article');
 article.className=`message ${role}`;
 const body=document.createElement('div');
 body.className='message-content';
 body.textContent=content;
 article.appendChild(body);
 if(role==='bot'&&meta.grounded){
  const evidence=document.createElement('div');
  evidence.className='assistant-source-note';
  const confidence=Math.round(Number(meta.confidence||0)*100);
  const totalMs=Number(meta?.timing?.total_ms||0);
  const timing=totalMs?` • ${(totalMs/1000).toFixed(totalMs<1000?2:1)} ث`:'';
  evidence.textContent=`إجابة من قاعدة معرفة UON AI${confidence?` • الثقة ${confidence}%`:''}${meta.sources_count!=null?` • ${meta.sources_count} نتيجة مطابقة`:''}${timing}`;
  article.appendChild(evidence);
 }
 if(Array.isArray(links)&&links.length){
  const box=document.createElement('div');
  box.className='assistant-links';
  links.forEach(item=>{
   if(!item?.url)return;
   const a=document.createElement('a');
   a.href=item.url;
   a.target=/^https?:/i.test(item.url)?'_blank':'_self';
   a.rel='noopener noreferrer';
   a.innerHTML=`<span>${esc(item.official?'مصدر رسمي':item.type||'مصدر')}</span><strong>${esc(item.title||item.url)}</strong>`;
   box.appendChild(a);
  });
  if(box.childElementCount)article.appendChild(box);
 }
 if(role==='bot'&&links.some?.(item=>item?.official)){
  const note=document.createElement('div');
  note.className='assistant-source-note';
  note.textContent='للقرارات الأكاديمية أو المالية، افتح المصدر الرسمي وتحقق من أحدث التفاصيل.';
  article.appendChild(note);
 }
 chat.appendChild(article);
 chat.scrollTop=chat.scrollHeight;
 return article;
}

function addTyping(){
 const el=document.createElement('article');
 el.className='message bot typing-message';
 el.innerHTML='<div class="typing-dots"><span></span><span></span><span></span></div>';
 chat?.appendChild(el);
 if(chat)chat.scrollTop=chat.scrollHeight;
 return el;
}

async function ask(question){
 const response=await fetch(`${SUPABASE_URL}/functions/v1/uon-ai`,{
  method:'POST',
  headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({question,history:history.slice(-4)}),
  cache:'no-store',
  signal:AbortSignal.timeout(11000)
 });
 const raw=await response.text();
 let data={};try{data=raw?JSON.parse(raw):{}}catch{data={error:raw}}
 if(!response.ok||!data.answer)throw new Error(data.error||`AI HTTP ${response.status}`);
 return data;
}

async function submitQuestion(question){
 if(sending||!question)return;
 sending=true;
 addMessage('user',question);
 history.push({role:'user',content:question});
 input.value='';
 const typing=addTyping();
 const original=submitButton?.textContent||'إرسال';
 if(submitButton){submitButton.disabled=true;submitButton.textContent='جاري البحث...'}
 trackEvent('assistant_question',{query:question.slice(0,100)});
 try{
  const result=await ask(question);
  typing.remove();
  addMessage('bot',result.answer,result.links||[],result);
  history.push({role:'assistant',content:result.answer});
 }catch(error){
  console.error(error);
  typing.remove();
  const timeout=/timeout|abort/i.test(String(error?.message||error));
  addMessage('bot',timeout?'تأخر الاتصال أكثر من 11 ثانية. جرّب السؤال مرة ثانية بصياغة أقصر.':'تعذر الوصول إلى قاعدة معرفة UON AI الآن. جرّب مرة أخرى بعد قليل.');
 }finally{
  sending=false;
  if(submitButton){submitButton.disabled=false;submitButton.textContent=original}
  input.focus();
 }
}

function handleSubmit(event){
 event?.preventDefault();event?.stopPropagation();event?.stopImmediatePropagation?.();
 const question=input?.value?.trim()||'';
 if(!question){input?.focus();return false}
 submitQuestion(question);return false;
}

if(form){form.action='javascript:void(0)';form.addEventListener('submit',handleSubmit,true);form.onsubmit=handleSubmit}
submitButton?.addEventListener('click',handleSubmit);
input?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();handleSubmit(event)}});
document.querySelectorAll('[data-prompt]').forEach(button=>{button.type='button';button.addEventListener('click',()=>{input.value=button.dataset.prompt||button.textContent.trim();input.focus()})});

async function loadOfficialQuickActions(){
 const target=$('#officialQuickActions');if(!target)return;
 let actions=[['🎓','ما رابط القبول والتسجيل الرسمي؟'],['🖥️','أين رابط Moodle الرسمي؟'],['📅','ما مواعيد التقويم الأكاديمي؟'],['📖','أين أجد اللوائح الأكاديمية؟'],['💬','كيف أنضم إلى مجتمع طلاب جامعة نزوى؟']];
 try{
  const rows=await get('useful_sites','select=title_ar,icon&active=eq.true&category=eq.university&order=sort_order.asc&limit=8');
  if(rows?.length)actions=rows.map(x=>[x.icon||'🔗',`أعطني رابط ${x.title_ar} الرسمي`]);
 }catch{}
 target.innerHTML=actions.map(([icon,q])=>`<button type="button" data-official-question="${esc(q)}"><span>${esc(icon)}</span>${esc(q)}</button>`).join('');
 target.querySelectorAll('[data-official-question]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.officialQuestion;input.focus()}));
}

async function initialize(){
 try{await enforceUonMaintenance()}catch{}
 try{watchUonMaintenance()}catch{}
 try{await applyFeatureStates(document)}catch{}
 try{trackEvent('page_view',{page:'assistant-v34-fast'})}catch{}
 loadOfficialQuickActions();
}
initialize();
