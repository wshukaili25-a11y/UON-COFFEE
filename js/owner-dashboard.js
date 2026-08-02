const API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/owner-dashboard-api';
const login=document.querySelector('#ownerLogin');
const app=document.querySelector('#ownerApp');
const form=document.querySelector('#ownerLoginForm');
const passwordInput=document.querySelector('#ownerPassword');
const daysSelect=document.querySelector('#ownerDays');
const toast=document.querySelector('#toast');
const KEY='uon_owner_password_v42';
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function notify(message,error=false){if(!toast)return;toast.textContent=message;toast.className=`toast show${error?' error':''}`;setTimeout(()=>toast.className='toast',2600)}
function password(){return sessionStorage.getItem(KEY)||''}
function row(title,value,sub=''){return `<div class="owner42-row"><div><strong>${esc(title)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div><b>${esc(value)}</b></div>`}
function empty(text){return `<div class="owner42-empty">${esc(text)}</div>`}
function render(data,days){
 const totals=data.totals||{},period=data.period||{};
 const stats=[['الزيارات',period.events||0],['الجلسات',period.sessions||0],['المقررات',totals.courses||0],['الملخصات',totals.summaries||0],['المجموعات',totals.groups||0],['البلاغات المعلقة',totals.pending_reports||0]];
 document.querySelector('#ownerStats').innerHTML=stats.map(([label,value])=>`<article class="owner42-stat"><strong>${Number(value).toLocaleString('ar-OM')}</strong><span>${label}</span></article>`).join('');
 document.querySelector('#ownerPeriodText').textContent=`آخر ${days} ${days===1?'يوم':'أيام'}`;
 const pages=data.top_pages||[];document.querySelector('#ownerTopPages').innerHTML=pages.length?pages.map(x=>row(x.page_path||'/',x.visits||0,'زيارة')).join(''):empty('لا توجد بيانات صفحات');
 const searches=data.top_searches||[];document.querySelector('#ownerTopSearches').innerHTML=searches.length?searches.map(x=>row(x.query||x.term||'—',x.total||x.count||0,'عملية بحث')).join(''):empty('تظهر كلمات البحث بعد استخدام البحث العالمي V42');
 const pending=data.pending_breakdown||{};const pendingRows=Object.entries(pending);document.querySelector('#ownerPending').innerHTML=pendingRows.length?pendingRows.map(([key,value])=>row(key,value)).join(''):empty('لا توجد طلبات معلقة');
 const reports=data.recent_reports||[];document.querySelector('#ownerReports').innerHTML=reports.length?reports.map(x=>row(x.content_title||'بلاغ محتوى',x.status||'pending',x.reason||x.report_type||'')).join(''):empty('لا توجد بلاغات حديثة');
 const events=data.top_events||[];const max=Math.max(1,...events.map(x=>Number(x.total)||0));document.querySelector('#ownerActivity').innerHTML=events.length?events.map(x=>`<div class="owner42-bar"><span>${esc(x.event_type)}</span><div class="owner42-bar-track"><i style="width:${Math.max(4,Math.round((Number(x.total)||0)/max*100))}%"></i></div><b>${Number(x.total||0).toLocaleString('ar-OM')}</b></div>`).join(''):empty('لا يوجد نشاط في الفترة المختارة');
}
async function load(){
 const pass=password();if(!pass){login.hidden=false;app.hidden=true;return}
 const days=Number(daysSelect.value)||7;document.querySelector('#ownerRefresh').disabled=true;
 try{const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','x-admin-password':pass},body:JSON.stringify({days}),cache:'no-store'});const payload=await response.json().catch(()=>({}));if(response.status===401){sessionStorage.removeItem(KEY);throw new Error('كلمة المرور غير صحيحة')}if(!response.ok||!payload.ok)throw new Error(payload.error||'تعذر تحميل الإحصائيات');login.hidden=true;app.hidden=false;render(payload.data||{},days)}catch(error){notify(error.message,true);if(!password()){login.hidden=false;app.hidden=true}}finally{document.querySelector('#ownerRefresh').disabled=false}
}
form.addEventListener('submit',event=>{event.preventDefault();const value=passwordInput.value.trim();if(!value)return;sessionStorage.setItem(KEY,value);load()});
document.querySelector('#ownerRefresh').addEventListener('click',load);daysSelect.addEventListener('change',load);document.querySelector('#ownerLogout').addEventListener('click',()=>{sessionStorage.removeItem(KEY);location.reload()});
load();
