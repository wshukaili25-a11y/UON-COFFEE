const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json',Accept:'application/json'};
const ADMIN_SESSION_TTL=30*60*1000;
const REQUEST_TIMEOUT=10000;
const STATE_TIMEOUT=4500;
const STATE_CACHE_TTL=30000;
const STATE_FALLBACK_TTL=6*60*60*1000;

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;

function parseResponse(text){
 try{return text?JSON.parse(text):null}catch{return text}
}

async function fetchWithTimeout(url,options={},timeout=REQUEST_TIMEOUT){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  return await fetch(url,{...options,signal:controller.signal});
 }catch(error){
  if(error?.name==='AbortError')throw new Error('انتهت مهلة الاتصال، حاول مرة ثانية');
  throw error;
 }finally{clearTimeout(timer)}
}

function onAdminPage(){
 return /\/admin(?:\.html)?\/?$/.test(location.pathname)||document.body?.classList.contains('admin-page');
}

async function adminRead(table,query){
 const password=sessionStorage.getItem('uon_admin_password')||'';
 const session=adminSession();
 if(!password||!session?.created_at||Date.now()-session.created_at>ADMIN_SESSION_TTL){
  clearAdminSession();
  throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 }
 const res=await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/admin-api`,{
  method:'POST',
  headers:{...headers,'x-admin-password':password},
  body:JSON.stringify({action:'read',table,query}),
  cache:'no-store'
 });
 const data=parseResponse(await res.text());
 if(res.status===401)clearAdminSession();
 if(!res.ok||data?.ok===false)throw new Error(data?.error||data?.message||data||`HTTP ${res.status}`);
 return data?.data||[];
}

export async function api(table,{method='GET',query='',body,prefer='return=representation',timeout=REQUEST_TIMEOUT}={}){
 if(method==='GET'&&onAdminPage())return adminRead(table,query);
 const res=await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}${query?`?${query}`:''}`,{
  method,
  headers:{...headers,Prefer:prefer},
  body:body===undefined?undefined:JSON.stringify(body),
  cache:'no-store'
 },timeout);
 const data=parseResponse(await res.text());
 if(!res.ok)throw new Error(data?.message||data?.error_description||data||`HTTP ${res.status}`);
 return data;
}
export const get=(t,q='')=>api(t,{query:q,prefer:''});
export const insert=(t,b,{returning=true}={})=>api(t,{method:'POST',body:b,prefer:returning?'return=representation':'return=minimal'});
export async function submitPending(table,body){
 const payload={...body};
 if(table==='whatsapp_groups')delete payload.id;
 else if(!payload.id)payload.id=uid();
 await insert(table,payload,{returning:false});
 return payload;
}
export const update=(t,q,b)=>api(t,{method:'PATCH',query:q,body:b});
export const remove=(t,q)=>api(t,{method:'DELETE',query:q,prefer:''});
export async function rpc(name,body,timeout=REQUEST_TIMEOUT){
 const res=await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
  method:'POST',headers,body:JSON.stringify(body),cache:'no-store'
 },timeout);
 const data=parseResponse(await res.text());
 if(!res.ok)throw new Error(data?.message||data||`HTTP ${res.status}`);
 return data;
}
export async function edge(payload){
 const res=await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/telegram-admin`,{
  method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'
 },15000);
 const text=await res.text();
 if(!res.ok)throw new Error(text||'Edge function error');
 return text;
}

export function toast(message,error=false){
 let el=$('#toast');
 if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.append(el)}
 el.textContent=message;
 el.className=`toast show${error?' error':''}`;
 clearTimeout(el._t);
 el._t=setTimeout(()=>el.className='toast',3200);
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
 if(!select)return;
 select.innerHTML='<option value="">اختر الكلية</option>'+colleges.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')+(other?'<option value="أخرى">أخرى</option>':'');
}
export function openModal(id){$('#'+id)?.classList.add('open')}
export function closeModal(id){$('#'+id)?.classList.remove('open')}

export async function notifyPending(table,id){
 try{await edge({source:'web-submit',table,id})}catch(error){console.warn('Notification fallback failed',error)}
}

let stateCache=null;
let stateCacheAt=0;
let statePromise=null;
const STATE_STORAGE_KEY='uon_public_state_cache_v39';

function readStoredState(){
 try{
  const saved=JSON.parse(localStorage.getItem(STATE_STORAGE_KEY)||'null');
  return saved&&Date.now()-saved.saved_at<STATE_FALLBACK_TTL?saved.state:null;
 }catch{return null}
}
function storeState(state){
 try{localStorage.setItem(STATE_STORAGE_KEY,JSON.stringify({saved_at:Date.now(),state}))}catch{}
}

export async function getUonState({force=false}={}){
 if(!force&&stateCache&&Date.now()-stateCacheAt<STATE_CACHE_TTL)return stateCache;
 if(!force&&statePromise)return statePromise;
 statePromise=rpc('uon_public_state',{},STATE_TIMEOUT)
  .then(state=>{
   stateCache=state||{};
   stateCacheAt=Date.now();
   storeState(stateCache);
   return stateCache;
  })
  .catch(error=>{
   const fallback=stateCache||readStoredState();
   if(fallback)return fallback;
   throw error;
  })
  .finally(()=>{statePromise=null});
 return statePromise;
}

let maintenanceRedirecting=false;
export async function enforceUonMaintenance(){
 const isAdmin=/\/admin(?:\.html)?\/?$/.test(location.pathname);
 const isMaintenance=/\/maintenance(?:\.html)?\/?$/.test(location.pathname);
 if(isAdmin)return false;
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
  }
 }catch(error){
  console.warn('Maintenance state unavailable; page will continue normally',error);
 }
 return false;
}

export function watchUonMaintenance(){
 if(/\/admin(?:\.html)?\/?$/.test(location.pathname))return;
 let checking=false;
 const check=async()=>{
  if(checking||maintenanceRedirecting)return;
  checking=true;
  try{await getUonState({force:true});await enforceUonMaintenance()}finally{checking=false}
 };
 window.addEventListener('focus',check);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
}

export function debounce(fn,delay=250){
 let timer;
 return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay)};
}
export function formatDate(value){
 if(!value)return '—';
 try{return new Date(value).toLocaleString('ar-OM')}catch{return String(value)}
}

export function adminSession(){
 try{return JSON.parse(sessionStorage.getItem('uon_admin_session')||'null')}catch{return null}
}
export function saveAdminSession(data){
 sessionStorage.setItem('uon_admin_session',JSON.stringify({...data,created_at:Date.now()}));
}
export function clearAdminSession(){
 sessionStorage.removeItem('uon_admin_session');
 sessionStorage.removeItem('uon_admin');
 sessionStorage.removeItem('uon_admin_password');
}

export async function trackEvent(eventType,metadata={}){
 try{
  const sessionKey='uon_anon_session';
  let sessionId=localStorage.getItem(sessionKey);
  if(!sessionId){sessionId=uid();localStorage.setItem(sessionKey,sessionId)}
  const payload={event_type:eventType,page_path:location.pathname,session_id:sessionId,metadata,user_agent:navigator.userAgent.slice(0,300)};
  await fetch(`${SUPABASE_URL}/rest/v1/usage_events`,{
   method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify(payload),keepalive:true
  });
 }catch(error){console.warn('Usage tracking skipped',error)}
}
export function trackClicks(){
 if(document.documentElement.dataset.uonClickTracking==='1')return;
 document.documentElement.dataset.uonClickTracking='1';
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
 document.querySelectorAll('[data-social="whatsapp"]').forEach(a=>{a.href=whatsapp||'#';a.hidden=!whatsapp});
 document.querySelectorAll('[data-social="instagram"]').forEach(a=>{a.href=instagram||'#';a.hidden=!instagram});
 return {whatsapp,instagram};
}

function safeHref(value='#'){
 const raw=String(value||'#').trim();
 if(raw.startsWith('/')||raw.startsWith('./')||raw.startsWith('../')||raw==='#')return raw;
 try{
  const url=new URL(raw,location.origin);
  return ['http:','https:'].includes(url.protocol)?url.href:'#';
 }catch{return '#'}
}
export async function loadNotificationCenter(limit=20){
 const target=$('#notificationItems');
 if(!target)return;
 try{
  const rows=await get('site_notifications',`select=*&active=eq.true&order=created_at.desc&limit=${limit}`);
  target.innerHTML=rows.length?rows.map(x=>`<a class="notification-item" href="${esc(safeHref(x.url||'#'))}">
   <span>${esc(x.icon||'🔔')}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.body||'')}</small></div>
  </a>`).join(''):'<div class="empty">لا توجد إشعارات جديدة</div>';
 }catch{target.innerHTML='<div class="empty">تعذر تحميل الإشعارات</div>'}
}

export function whatsappShare(title,url=location.href){
 return `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
}
export async function reportBrokenLink({sourceTable,sourceId,title,url}){
 const reason=prompt('ما المشكلة في الرابط؟','الرابط لا يعمل');
 if(reason===null)return false;
 const report=await submitPending('broken_link_reports',{
  source_table:sourceTable,source_id:String(sourceId),source_title:title||'',source_url:url||'',reason,status:'pending'
 });
 toast('تم إرسال البلاغ للمشرف');
 try{await notifyPending('broken_link_reports',report.id)}catch{}
 return true;
}

export function installErrorCapture(){
 if(document.documentElement.dataset.uonErrorCapture==='1')return;
 document.documentElement.dataset.uonErrorCapture='1';
 window.addEventListener('error',event=>{
  insert('system_errors',{
   source:'browser_error',message:event.message||'Browser error',
   details:{page:location.pathname,file:event.filename||'',line:event.lineno||0,column:event.colno||0}
  },{returning:false}).catch(()=>{});
 });
 window.addEventListener('unhandledrejection',event=>{
  insert('system_errors',{
   source:'unhandledrejection',message:String(event.reason?.message||event.reason||'Unhandled rejection'),
   details:{page:location.pathname,stack:String(event.reason?.stack||'').slice(0,3000)}
  },{returning:false}).catch(()=>{});
 });
}

export function featureStatusLabel(status){
 const lang=localStorage.getItem('uon_language')||'ar';
 const labels={
  ar:{active:'متاحة',disabled:'متوقفة مؤقتًا',maintenance:'تحت الصيانة',coming_soon:'قريبًا · Coming Soon'},
  en:{active:'Available',disabled:'Temporarily unavailable',maintenance:'Maintenance',coming_soon:'Coming Soon'}
 };
 return labels[lang]?.[status]||status;
}

const featureStateHandlers=new WeakMap();
function setFeatureVisibility(card,visible){
 if(!visible){
  card.hidden=true;
  card.dataset.featureHidden='1';
  card.setAttribute('aria-hidden','true');
 }else if(card.dataset.featureHidden==='1'){
  card.hidden=false;
  delete card.dataset.featureHidden;
  card.removeAttribute('aria-hidden');
 }
}

export async function applyFeatureStates(root=document){
 try{
  const state=await getUonState();
  const statuses=state?.features||{};
  const visibility=state?.visibility||{};
  const {showFeatureStateBanner}=await import('./v14-ui.js?v=39.0.0');
  const cards=[];
  if(root.matches?.('[data-feature]'))cards.push(root);
  root.querySelectorAll?.('[data-feature]').forEach(card=>cards.push(card));

  cards.forEach(card=>{
   const feature=card.dataset.feature;
   const visible=visibility[feature]!==false;
   setFeatureVisibility(card,visible);

   const previousHandler=featureStateHandlers.get(card);
   if(previousHandler){card.removeEventListener('click',previousHandler,true);featureStateHandlers.delete(card)}
   card.querySelector('.feature-state')?.remove();
   if(!visible)return;

   const status=statuses[feature]||'active';
   card.dataset.status=status;
   card.classList.toggle('feature-unavailable',status!=='active');
   if(status==='active'){
    card.removeAttribute('aria-disabled');
    return;
   }

   card.setAttribute('aria-disabled','true');
   const label=document.createElement('span');
   label.className=`feature-state ${status}`;
   label.setAttribute('role','status');
   label.innerHTML=`<span aria-hidden="true">${status==='maintenance'?'⚙':'⏳'}</span><b>${esc(featureStatusLabel(status))}</b>`;
   card.append(label);
   const handler=event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const title=card.querySelector('h3,strong')?.textContent?.trim()||'';
    showFeatureStateBanner(status,title);
   };
   featureStateHandlers.set(card,handler);
   card.addEventListener('click',handler,true);
  });
  return state;
 }catch(error){
  console.warn('Feature states unavailable',error);
  return null;
 }
}
