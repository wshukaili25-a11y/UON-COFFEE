const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=()=>crypto.randomUUID();

export async function api(table,{method='GET',query='',body,prefer='return=representation'}={}){
 const res=await fetch(`${SUPABASE_URL}/rest/v1/${table}${query?`?${query}`:''}`,{
  method,headers:{...headers,Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'
 });
 const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
 if(!res.ok)throw new Error(data?.message||data?.error_description||data||`HTTP ${res.status}`);
 return data;
}
export const get=(t,q='')=>api(t,{query:q,prefer:''});
export const insert=(t,b,{returning=true}={})=>api(t,{method:'POST',body:b,prefer:returning?'return=representation':'return=minimal'});
export async function submitPending(table,body){
 const payload={...body};
 if(!payload.id)payload.id=crypto.randomUUID();
 await insert(table,payload,{returning:false});
 return payload;
}
export const update=(t,q,b)=>api(t,{method:'PATCH',query:q,body:b});
export const remove=(t,q)=>api(t,{method:'DELETE',query:q,prefer:''});
export async function rpc(name,body){
 const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
 const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
 if(!res.ok)throw new Error(data?.message||data||`HTTP ${res.status}`);return data;
}
export async function edge(payload){
 const res=await fetch(`${SUPABASE_URL}/functions/v1/telegram-admin`,{method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'});
 const text=await res.text();if(!res.ok)throw new Error(text||'Edge function error');return text;
}
export function toast(message,error=false){
 let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.append(el)}
 el.textContent=message;el.className=`toast show${error?' error':''}`;clearTimeout(el._t);el._t=setTimeout(()=>el.className='toast',3200);
}
export function setupNav(){
 $('#menuBtn')?.addEventListener('click',()=>$('#navLinks')?.classList.toggle('open'));
}
export const colleges=[
 'كلية العلوم والآداب',
 'كلية الاقتصاد والإدارة ونظم المعلومات',
 'كلية الهندسة والعمارة',
 'كلية العلوم الصحية'
];
export function fillCollege(select,{other=false}={}){
 select.innerHTML='<option value="">اختر الكلية</option>'+colleges.map(c=>`<option value="${c}">${c}</option>`).join('')+(other?'<option value="أخرى">أخرى</option>':'');
}
export function openModal(id){$('#'+id)?.classList.add('open')} export function closeModal(id){$('#'+id)?.classList.remove('open')}

export async function notifyPending(table,id){
 try{await edge({source:'web-submit',table,id})}catch(e){console.warn('Notification fallback failed',e)}
}



export async function getUonState(){
 return await rpc('uon_public_state',{});
}

let maintenanceInitialCheck=true;
let maintenanceRedirecting=false;

export async function enforceUonMaintenance(){
 const isAdmin=location.pathname.endsWith('/admin.html');
 const isMaintenance=location.pathname.endsWith('/maintenance.html');
 if(isAdmin)return false;

 if(maintenanceInitialCheck && document.readyState==='loading'){
  document.documentElement.classList.add('maintenance-check');
 }

 try{
  const state=await getUonState();
  const enabled=state?.maintenance_enabled===true;

  if(enabled&&!isMaintenance&&!maintenanceRedirecting){
   maintenanceRedirecting=true;
   location.replace('maintenance.html');
   return true;
  }

  if(!enabled&&isMaintenance&&!maintenanceRedirecting){
   maintenanceRedirecting=true;
   location.replace('index.html');
   return false;
  }
 }catch(error){
  console.error('UON maintenance state error',error);
 }finally{
  if(maintenanceInitialCheck){
   document.documentElement.classList.remove('maintenance-check');
   maintenanceInitialCheck=false;
  }
 }

 return false;
}

export function watchUonMaintenance(){
 if(location.pathname.endsWith('/admin.html'))return;

 let checking=false;
 const check=async()=>{
  if(checking||maintenanceRedirecting)return;
  checking=true;
  try{
   await enforceUonMaintenance();
  }finally{
   checking=false;
  }
 };

 // No interval: check only when the user returns to the tab/window.
 window.addEventListener('focus',check);
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)check();
 });
}


export function debounce(fn,delay=250){
 let timer;
 return (...args)=>{
  clearTimeout(timer);
  timer=setTimeout(()=>fn(...args),delay);
 };
}

export function formatDate(value){
 if(!value)return '—';
 try{return new Date(value).toLocaleString('ar')}catch{return String(value)}
}

export function adminSession(){
 try{return JSON.parse(sessionStorage.getItem('uon_admin_session')||'null')}catch{return null}
}

export function saveAdminSession(data){
 sessionStorage.setItem('uon_admin_session',JSON.stringify({
  ...data,
  created_at:Date.now()
 }));
}

export function clearAdminSession(){
 sessionStorage.removeItem('uon_admin_session');
 sessionStorage.removeItem('uon_admin');
}


export async function trackEvent(eventType,metadata={}){
 try{
  const sessionKey='uon_anon_session';
  let sessionId=localStorage.getItem(sessionKey);
  if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(sessionKey,sessionId)}
  await insert('usage_events',{
   event_type:eventType,
   page_path:location.pathname,
   session_id:sessionId,
   metadata,
   user_agent:navigator.userAgent.slice(0,300)
  },{returning:false});
 }catch(error){console.warn('Usage tracking skipped',error)}
}

export function trackClicks(){
 document.addEventListener('click',event=>{
  const link=event.target.closest('a,button');
  if(!link)return;
  const feature=link.closest('[data-feature]')?.dataset.feature;
  if(feature)trackEvent('feature_open',{feature});
  if(link.matches('a[href*="summaries"]'))trackEvent('summary_section_open',{href:link.getAttribute('href')});
 },{capture:true});
}


export async function getSetting(key,fallback=''){
 try{
  const rows=await get('site_settings',`select=value&key=eq.${encodeURIComponent(key)}&limit=1`);
  const value=rows?.[0]?.value;
  return value===null||value===undefined?fallback:value;
 }catch{return fallback}
}

export async function loadSocialLinks(){
 const [whatsapp,instagram]=await Promise.all([
  getSetting('whatsapp_channel_url','https://whatsapp.com/channel/0029Vb9RCFoHgZWkH8X6di1x'),
  getSetting('instagram_url','')
 ]);
 document.querySelectorAll('[data-social="whatsapp"]').forEach(a=>{
  a.href=whatsapp||'#';a.hidden=!whatsapp;
 });
 document.querySelectorAll('[data-social="instagram"]').forEach(a=>{
  a.href=instagram||'#';a.hidden=!instagram;
 });
 return {whatsapp,instagram};
}

export async function loadNotificationCenter(limit=20){
 const target=document.querySelector('#notificationItems');
 if(!target)return;
 try{
  const rows=await get('site_notifications',`select=*&active=eq.true&order=created_at.desc&limit=${limit}`);
  target.innerHTML=rows.length?rows.map(x=>`<a class="notification-item" href="${esc(x.url||'#')}">
   <span>${esc(x.icon||'🔔')}</span>
   <div><strong>${esc(x.title)}</strong><small>${esc(x.body||'')}</small></div>
  </a>`).join(''):'<div class="empty">لا توجد إشعارات جديدة</div>';
 }catch(error){target.innerHTML='<div class="empty">تعذر تحميل الإشعارات</div>'}
}


export function whatsappShare(title,url=location.href){
 const text=`${title}\n${url}`;
 return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function reportBrokenLink({sourceTable,sourceId,title,url}){
 const reason=prompt('ما المشكلة في الرابط؟','الرابط لا يعمل');
 if(reason===null)return false;
 const report=await submitPending('broken_link_reports',{
  source_table:sourceTable,
  source_id:String(sourceId),
  source_title:title||'',
  source_url:url||'',
  reason,
  status:'pending'
 });
 toast('تم إرسال البلاغ للمشرف');
 try{await notifyPending('broken_link_reports',report.id)}catch{}
 return true;
}

export function installErrorCapture(){
 window.addEventListener('error',event=>{
  insert('system_errors',{source:location.pathname,message:event.message||'Browser error',details:{file:event.filename,line:event.lineno}},{returning:false}).catch(()=>{});
 });
 window.addEventListener('unhandledrejection',event=>{
  insert('system_errors',{source:location.pathname,message:String(event.reason?.message||event.reason||'Unhandled rejection')},{returning:false}).catch(()=>{});
 });
}


export function featureStatusLabel(status){
 const lang=localStorage.getItem('uon_language')||'ar';
 const labels={
  ar:{active:'متاحة',disabled:'متوقفة',maintenance:'صيانة',coming_soon:'قريبًا'},
  en:{active:'Available',disabled:'Unavailable',maintenance:'Maintenance',coming_soon:'Coming soon'}
 };
 return labels[lang]?.[status]||status;
}

export async function applyFeatureStates(root=document){
 try{
  const state=await getUonState();
  const map=state?.features||{};
  const {showFeatureStateBanner}=await import('./v14-ui.js?v=17.6');

  root.querySelectorAll('[data-feature]').forEach(card=>{
   const status=map[card.dataset.feature]||'active';
   card.dataset.status=status;
   card.classList.toggle('feature-unavailable',status!=='active');

   card.querySelector('.feature-state')?.remove();

   if(status!=='active'){
    card.setAttribute('aria-disabled','true');
    card.addEventListener('click',event=>{
     event.preventDefault();
     event.stopPropagation();
     const title=card.querySelector('h3')?.textContent?.trim()||'';
     showFeatureStateBanner(status,title);
    },true);
   }else{
    card.removeAttribute('aria-disabled');
   }
  });
  return state;
 }catch(error){
  console.warn('Feature states unavailable',error);
  return null;
 }
}
