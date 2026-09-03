const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const PASSWORD_KEY='uon_admin_password';

export function adminPassword(){
 const value=sessionStorage.getItem(PASSWORD_KEY)||'';
 if(!value)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 return value;
}

function clearAdminSession(){
 sessionStorage.removeItem(PASSWORD_KEY);
 sessionStorage.removeItem('uon_admin');
 sessionStorage.removeItem('uon_admin_session');
}

export async function adminRpc(name,args={}){
 const password=adminPassword();
 const payload={...args};
 if(!Object.prototype.hasOwnProperty.call(payload,'p_password'))payload.p_password=password;
 const response=await fetch(`${SUPABASE_URL}/functions/v1/admin-rpc-api`,{
  method:'POST',
  headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json','x-admin-password':password},
  body:JSON.stringify({action:'rpc',name,args:payload}),
  cache:'no-store'
 });
 const text=await response.text();
 let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
 if(response.status===401)clearAdminSession();
 if(!response.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${response.status}`);
 return data?.data;
}
