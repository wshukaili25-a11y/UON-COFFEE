const API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/telegram-bot-control-v42';
const SESSION_KEY='uon_owner_session_v42';
const toast=document.querySelector('#toast');
const statusEl=document.querySelector('#telegramV42Status');
function notify(message,error=false){if(!toast)return;toast.textContent=message;toast.className=`toast show${error?' error':''}`;setTimeout(()=>toast.className='toast',3400)}
function token(){return sessionStorage.getItem(SESSION_KEY)||''}
function setStatus(data){if(!statusEl)return;const mode=data?.mode;statusEl.textContent=mode==='v42'?'V42 مفعل':mode==='legacy'?'البوت القديم مفعل':data?.url?'Webhook آخر':'غير مفعل';statusEl.dataset.mode=mode||'unknown'}
async function call(action){const session=token();if(!session)throw new Error('انتهت جلسة التحقق، سجل الدخول مرة ثانية');const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','x-owner-session':session},body:JSON.stringify({action}),cache:'no-store'});const payload=await response.json().catch(()=>({}));if(response.status===401){sessionStorage.removeItem(SESSION_KEY);throw new Error('انتهت جلسة التحقق، سجل الدخول مرة ثانية')}if(!response.ok||!payload.ok)throw new Error(payload.error||'تعذر تحديث البوت');return payload}
async function refreshStatus(){try{setStatus(await call('status'))}catch(error){if(statusEl)statusEl.textContent='تعذر قراءة الحالة';console.warn(error)}}
async function switchBot(action,button){const activate=action==='activate';if(!confirm(activate?'تفعيل بوت V42؟':'الرجوع للبوت القديم؟'))return;button.disabled=true;const old=button.textContent;button.textContent='جاري التنفيذ...';try{const result=await call(action);setStatus(result);notify(activate?'تم تفعيل بوت V42 بنجاح':'تم الرجوع للبوت القديم بنجاح')}catch(error){notify(error.message||'تعذر تحديث البوت',true)}finally{button.disabled=false;button.textContent=old}}
for(const [id,action] of [['activateTelegramV42','activate'],['rollbackTelegramV42','rollback']]){const button=document.getElementById(id);button?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();switchBot(action,button)},true)}
if(token())refreshStatus();
