import{esc}from'./core.js';
// Email delivery (summaries + schedule): name + email → OTP → the file arrives in a fixed UON Hub template.
const endpoint='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/summary-email';
const key='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const CONTACT_KEY='uon-email-contact-v1';
const errors={email_not_configured:'خدمة البريد قيد التجهيز حاليًا.',rate_limited:'انتظر دقيقة قبل إعادة الطلب. الحد 3 طلبات في الساعة لكل بريد.',invalid_input:'تأكد من الاسم (حرفان على الأقل) وعنوان البريد.',invalid_schedule:'تعذر قراءة الجدول. تأكد أن فيه مادة واحدة على الأقل بأوقات صحيحة.',invalid_code:'الرمز غير صحيح أو انتهت صلاحيته. لديك 5 محاولات كحد أقصى.',unsupported_pdf:'هذا العنصر مجلد أو رابط خارجي. افتح ملف PDF محددًا لإرساله.',too_large:'الملف أكبر من 12 ميجابايت. يمكنك تنزيله من صفحة الملف.',delivery_failed:'تعذر إكمال الإرسال. أعد الطلب لاحقًا.'};
async function api(body){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',apikey:key},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(errors[d.error]||'تعذر الاتصال بخدمة البريد.');return d}
let statusPromise=null;
export function emailAvailable(){return statusPromise||=api({action:'status'}).then(d=>d.available===true).catch(()=>false)}
export function canEmail(item){try{const u=new URL(item.url||item.link||item.pdf_url);return u.hostname==='irkhvydgxpseflggbeqq.supabase.co'&&u.pathname.startsWith('/storage/v1/object/public/summaries/')&&u.pathname.toLowerCase().endsWith('.pdf')}catch{return false}}
export function cleanName(value){return String(value??'').replace(/\s+/g,' ').trim()}
export function greeting(name){const n=cleanName(name);return n.length>=2?`هلا ${n} 👋`:'هلا … 👋'}
function readContact(){try{const v=JSON.parse(localStorage.getItem(CONTACT_KEY)||'{}');return{name:String(v.name||'').slice(0,80),email:String(v.email||'').slice(0,254)}}catch{return{name:'',email:''}}}
function saveContact(name,email){try{localStorage.setItem(CONTACT_KEY,JSON.stringify({name,email}))}catch{}}

const STYLE=`#uonEmailDialog{width:min(460px,calc(100% - 28px));max-height:calc(100dvh - 28px);overflow:auto;border:1px solid rgba(207,160,56,.45);border-radius:22px;padding:0;background:#fff;color:#163a2a;color-scheme:light;box-shadow:0 24px 60px rgba(0,0,0,.35)}
#uonEmailDialog::backdrop{background:rgba(3,15,10,.62)}
#uonEmailDialog form{padding:22px;display:grid;gap:12px;font-family:Tajawal,system-ui,sans-serif}
#uonEmailDialog .ue-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#uonEmailDialog h2{margin:0;font-size:20px}#uonEmailDialog .ue-sub{margin:2px 0 0;opacity:.75;font-size:14px}
#uonEmailDialog .ue-close{border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer;padding:2px 6px}
#uonEmailDialog .ue-stack:not([hidden]){display:grid;gap:12px}#uonEmailDialog [hidden]{display:none!important}
#uonEmailDialog label{display:grid;gap:6px;font-weight:700;font-size:14px}
#uonEmailDialog input{font:inherit;font-weight:500;padding:11px 13px;border-radius:12px;border:1px solid rgba(127,160,140,.5);background:#fff;color:#163a2a}
#uonEmailDialog input::placeholder{color:#8a9b92}
#uonEmailDialog label{color:#163a2a}
#uonEmailDialog input:focus{outline:2px solid #CFA038;outline-offset:1px}
#uonEmailDialog .ue-code{font-size:26px;letter-spacing:10px;text-align:center;font-weight:800}
#uonEmailDialog .ue-note{margin:0;font-size:12.5px;opacity:.75;line-height:1.7}
#uonEmailDialog [data-status]{margin:0;min-height:1.4em;font-size:14px;font-weight:700}
#uonEmailDialog [data-status].err{color:#c2410c}
#uonEmailDialog .ue-primary{font:inherit;font-weight:800;border:0;border-radius:14px;padding:13px;background:#0B3B2C;color:#fff;cursor:pointer}
#uonEmailDialog .ue-primary:disabled{opacity:.6;cursor:wait}
#uonEmailDialog .ue-link{font:inherit;border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;opacity:.8;justify-self:start;padding:0}
#uonEmailDialog .ue-done{text-align:center;padding:10px 0}#uonEmailDialog .ue-done span{font-size:44px}`;

/**
 * kind: 'summary' | 'schedule'
 * title: shown in the dialog
 * request(): extra fields for the request call ({summary_id} or {schedule})
 * verifyExtra(): optional async extra fields for the verify call ({image})
 */
export function openEmailDialog({kind='summary',title='',request,verifyExtra}){
 document.querySelector('#uonEmailDialog')?.remove();
 if(!document.querySelector('#uonEmailStyle')){const s=document.createElement('style');s.id='uonEmailStyle';s.textContent=STYLE;document.head.append(s)}
 const what=kind==='schedule'?'جدولك الدراسي':'الملخص';
 const contact=readContact();
 const dialog=document.createElement('dialog');dialog.id='uonEmailDialog';dialog.dir='rtl';
 dialog.innerHTML=`<form novalidate>
 <div class="ue-head"><div><h2>أرسل ${what} إلى بريدك</h2><p class="ue-sub">${esc(title||'')}</p></div><button type="button" class="ue-close" data-close aria-label="إغلاق">×</button></div>
 <div class="ue-stack" data-details>
  <label>اسمك<input name="name" autocomplete="name" minlength="2" maxlength="80" required placeholder="اكتب اسمك" value="${esc(contact.name)}"></label>
  <label>بريدك الإلكتروني<input name="email" type="email" autocomplete="email" inputmode="email" dir="ltr" maxlength="254" required placeholder="name@example.com" value="${esc(contact.email)}"></label>
  <p class="ue-note">نرسل رمز تحقق لبريدك، وبعد إدخاله يصلك ${what}${kind==='summary'?' كملف PDF مرفق':' مع صورة له'}. يُستخدم بريدك لهذا الطلب فقط وتُحذف بيانات الطلب خلال 25 ساعة.</p>
 </div>
 <div class="ue-stack" data-verification hidden>
  <label>رمز التحقق<input class="ue-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" dir="ltr" placeholder="••••••"></label>
  <p class="ue-note">الرمز صالح 10 دقائق. إذا ما وصلك، راجع البريد غير المرغوب (Spam).</p>
  <button class="ue-link" type="button" data-reset>تغيير البريد أو طلب رمز جديد</button>
 </div>
 <p role="status" aria-live="polite" data-status></p>
 <button class="ue-primary" type="submit">أرسل رمز التحقق</button>
 </form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),status=dialog.querySelector('[data-status]'),submit=form.querySelector('[type=submit]');
 const setStatus=(msg,err=false)=>{status.textContent=msg;status.classList.toggle('err',err)};
 form.elements.code.addEventListener('input',()=>{form.elements.code.value=form.elements.code.value.replace(/\D/g,'').slice(0,6);if(form.elements.code.value.length===6&&!busy)form.requestSubmit()});
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>dialog.remove());
 dialog.showModal();
 (contact.name?form.elements.email:form.elements.name).focus();
 let requestId='',busy=false;
 function reset(){requestId='';form.elements.name.disabled=false;form.elements.email.disabled=false;form.elements.code.value='';dialog.querySelector('[data-details]').hidden=false;dialog.querySelector('[data-verification]').hidden=true;submit.textContent='أرسل رمز التحقق';setStatus('')}
 dialog.querySelector('[data-reset]').onclick=()=>{if(!busy)reset()};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const name=cleanName(form.elements.name.value),email=form.elements.email.value.trim();
  if(!requestId){
   if(name.length<2)return setStatus('اكتب اسمك (حرفان على الأقل).',true),form.elements.name.focus();
   if(!form.elements.email.checkValidity()||!email)return setStatus('اكتب بريدًا إلكترونيًا صحيحًا.',true),form.elements.email.focus();
  }else if(!/^\d{6}$/.test(form.elements.code.value))return setStatus('الرمز 6 أرقام.',true);
  busy=true;submit.disabled=true;setStatus(requestId?'جاري التحقق والإرسال…':'جاري إرسال الرمز…');
  try{
   if(!requestId){
    const data=await api({action:'request',kind,name,email,...request()});
    requestId=data.request_id;saveContact(name,email);
    form.elements.name.disabled=true;form.elements.email.disabled=true;
    dialog.querySelector('[data-details]').hidden=true;dialog.querySelector('[data-verification]').hidden=false;
    submit.textContent=kind==='schedule'?'تحقق وأرسل الجدول':'تحقق وأرسل الملخص';
    setStatus('أرسلنا الرمز إلى '+email);form.elements.code.focus();
   }else{
    const extra=verifyExtra?await verifyExtra().catch(()=>({})):{};
    await api({action:'verify',request_id:requestId,code:form.elements.code.value,...extra});
    form.innerHTML=`<div class="ue-done"><span>📬</span><h2>تم الإرسال</h2><p class="ue-note">وصل ${what} إلى <b dir="ltr">${esc(email)}</b>. إذا ما لقيته، راجع البريد غير المرغوب.</p></div><button class="ue-primary" type="button">تم</button>`;
    form.querySelector('button').onclick=()=>dialog.close();
   }
  }catch(error){setStatus(error.message,true)}
  finally{busy=false;if(submit.isConnected)submit.disabled=false}
 };
 return dialog;
}

export function openSummaryEmail(item){
 return openEmailDialog({kind:'summary',title:item.title||'ملف دراسي',request:()=>({summary_id:item.id})});
}
