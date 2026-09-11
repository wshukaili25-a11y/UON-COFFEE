const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};
const ADMIN_SESSION_TTL=30*60*1000;
const VISIBLE_VERSION_RE=/\s+(?:v|V)\d+(?:\.\d+)*/g;

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
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
async function adminLoginRpc(body={}){
 const password=String(body?.p_password||'');
 const res=await fetch(`${SUPABASE_URL}/functions/v1/admin-rpc-api`,{
  method:'POST',
  headers:{...headers,'x-admin-password':password},
  body:JSON.stringify({action:'rpc',name:'uon_admin_login',args:{p_password:password}}),
  cache:'no-store'
 });
 const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
 if(!res.ok||data?.ok===false){
  if(res.status===401)throw new Error('كلمة المرور غير صحيحة');
  throw new Error(data?.error||data?.message||data||`HTTP ${res.status}`);
 }
 return data?.data;
}
export async function rpc(name,body){
 if(name==='uon_admin_login')return adminLoginRpc(body);
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
 try{
  const res=await fetch(`${SUPABASE_URL}/functions/v1/public-submit-notify`,{
   method:'POST',headers,body:JSON.stringify({table,id}),cache:'no-store'
  });
  const text=await res.text();
  if(!res.ok)throw new Error(text||'Notification service error');
  return text?JSON.parse(text):null;
 }catch(e){
  console.warn('Notification delivery skipped',e);
  return null;
 }
}

const UON_STATE_TTL=2500;
let uonStateCache=null;
let uonStateCachedAt=0;
let uonStateInflight=null;
export async function getUonState(){
 const now=Date.now();
 if(uonStateCache&&now-uonStateCachedAt<UON_STATE_TTL)return uonStateCache;
 if(uonStateInflight)return uonStateInflight;
 uonStateInflight=rpc('uon_public_state',{}).then(state=>{
  uonStateCache=state;
  uonStateCachedAt=Date.now();
  return state;
 }).finally(()=>{uonStateInflight=null});
 return uonStateInflight;
}

let maintenanceInitialCheck=true;
let maintenanceRedirecting=false;

function isReleasePreview(){
 const host=String(location.hostname||'').toLowerCase();
 return host.includes('git-redesign-uon-green-v2')||sessionStorage.getItem('uon_release_student_preview')==='1';
}

export async function enforceUonMaintenance(){
 const isAdmin=location.pathname.endsWith('/admin.html');
 const isMaintenance=location.pathname.endsWith('/maintenance.html');
 if(isAdmin||isReleasePreview())return false;

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
