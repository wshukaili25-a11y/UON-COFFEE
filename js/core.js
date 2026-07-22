const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'};

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
export const insert=(t,b)=>api(t,{method:'POST',body:b});
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
