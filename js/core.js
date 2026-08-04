const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};
const ADMIN_SESSION_TTL=30*60*1000;
const VISIBLE_VERSION_RE=/\s+(?:v|V)\d+(?:\.\d+)*/g;

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=()=>crypto.randomUUID();
export function safeHref(value,fallback='#'){
 const raw=String(value??'').trim();
 if(!raw)return fallback;
 try{
  const url=new URL(raw,location.origin);
  return ['http:','https:'].includes(url.protocol)?url.href:fallback;
 }catch{return fallback}
}

function stripVisibleVersion(value){return String(value||'').replace(VISIBLE_VERSION_RE,'').replace(/\s{2,}/g,' ').trim()}
export function cleanVisibleVersionLabels(root=document){
 if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
  const parent=node.parentElement;
  if(!parent||parent.closest('script,style,code,pre'))return NodeFilter.FILTER_REJECT;
  return VISIBLE_VERSION_RE.test(node.nodeValue||'')?(VISIBLE_VERSION_RE.lastIndex=0,NodeFilter.FILTER_ACCEPT):(VISIBLE_VERSION_RE.lastIndex=0,NodeFilter.FILTER_REJECT);
 }});
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(node=>{node.nodeValue=stripVisibleVersion(node.nodeValue)});
 root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el=>{
  for(const attr of ['placeholder','title','aria-label']){
   if(el.hasAttribute(attr))el.setAttribute(attr,stripVisibleVersion(el.getAttribute(attr)));
  }
 });
}
function scheduleVersionCleanup(){
 const run=()=>cleanVisibleVersionLabels(document);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else queueMicrotask(run);
 setTimeout(run,500);setTimeout(run,1800);
}
scheduleVersionCleanup();

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
 const res=await fetch(`${SUPABASE_URL}/functions/v1/admin-api`,{
  method:'POST',
  headers:{...headers,'x-admin-password':password},
  body:JSON.stringify({action:'read',table,query}),
  cache:'no-store'
 });
 const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
 if(res.status===401)clearAdminSession();
 if(!res.ok||data?.ok===false)throw new Error(data?.error||data?.message||data||`HTTP ${res.status}`);
 return data?.data||[];
}

export async function api(table,{method='GET',query='',body,prefer='return=representation'}={}){
 if(method==='GET'&&onAdminPage())return adminRead(table,query);
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
 if(table==='whatsapp_groups'){
  delete payload.id;
 }else if(!payload.id){
  payload.id=crypto.randomUUID();
 }
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
 sessionStorage.removeItem('uon_admin_password');
}

export async function trackEvent(eventType,metadata={}){
 try{
  const sessionKey='uon_anon_session';
  let sessionId=localStorage.getItem(sessionKey);
  if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(sessionKey,sessionId)}
  await rpc('uon_track_event',{
   p_event_type:String(eventType||'').slice(0,80),
   p_page_path:location.pathname,
   p_session_id:sessionId,
   p_metadata:metadata&&typeof metadata==='object'?metadata:{},
   p_user_agent:navigator.userAgent.slice(0,300)
  });
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
  const href=safeHref(whatsapp,'#');a.href=href;a.hidden=href==='#';a.rel='noopener noreferrer';
 });
 document.querySelectorAll('[data-social="instagram"]').forEach(a=>{
  const href=safeHref(instagram,'#');a.href=href;a.hidden=href==='#';a.rel='noopener noreferrer';
 });
 return {whatsapp,instagram};
}

export async function loadNotificationCenter(limit=20){
 const target=document.querySelector('#notificationItems');
 if(!target)return;
 try{
  const safeLimit=Math.max(1,Math.min(Number(limit)||20,50));
  const rows=await get('site_notifications',`select=*&active=eq.true&order=created_at.desc&limit=${safeLimit}`);
  target.innerHTML=rows.length?rows.map(x=>`<a class="notification-item" href="${esc(safeHref(x.url||'#','#'))}" rel="noopener">
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
 const send=(source,message,details={})=>rpc('uon_report_client_error',{
  p_message:String(message||'').slice(0,500),
  p_source:String(source||'browser').slice(0,80),
  p_details:{...details,page:location.href,user_agent:navigator.userAgent.slice(0,300)}
 }).catch(()=>{});
 window.addEventListener('error',event=>{
  send(location.pathname,event.message||'Browser error',{file:event.filename,line:event.lineno,column:event.colno});
 });
 window.addEventListener('unhandledrejection',event=>{
  send(location.pathname,String(event.reason?.message||event.reason||'Unhandled rejection'));
 });
}

export function featureStatusLabel(status){
 const lang=localStorage.getItem('uon_language')||'ar';
 const labels={
  ar:{active:'متاحة',disabled:'قريبًا · Coming Soon',maintenance:'تحت الصيانة',coming_soon:'قريبًا · Coming Soon'},
  en:{active:'Available',disabled:'Coming Soon',maintenance:'Maintenance',coming_soon:'Coming Soon'}
 };
 return labels[lang]?.[status]||status;
}

const featureStateHandlers=new WeakMap();

export async function applyFeatureStates(root=document){
 try{
  const state=await getUonState();
  const map=state?.features||{};
  const {showFeatureStateBanner}=await import('./v14-ui.js?v=17.6');

  root.querySelectorAll('[data-feature]').forEach(card=>{
   const status=map[card.dataset.feature]||'active';
   card.dataset.status=status;
   card.classList.toggle('feature-unavailable',status!=='active');

   const previousHandler=featureStateHandlers.get(card);
   if(previousHandler){
    card.removeEventListener('click',previousHandler,true);
    featureStateHandlers.delete(card);
   }
   card.querySelector('.feature-state')?.remove();

   if(status!=='active'){
    card.setAttribute('aria-disabled','true');
    const label=document.createElement('span');
    label.className=`feature-state ${status}`;
    label.setAttribute('role','status');
    label.innerHTML=`<span aria-hidden="true">${status==='maintenance'?'⚙':'⏳'}</span><b>${esc(featureStatusLabel(status))}</b>`;
    card.append(label);

    const handler=event=>{
     event.preventDefault();
     event.stopImmediatePropagation();
     const title=card.querySelector('h3,strong')?.textContent?.trim()||'';
     showFeatureStateBanner(status,title);
    };
    featureStateHandlers.set(card,handler);
    card.addEventListener('click',handler,true);
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
