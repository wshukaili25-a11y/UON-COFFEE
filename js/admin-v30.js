import './admin.js?v=26.1';
import {rpc,toast} from './core.js?v=26.1';

const passwordKey='uon_admin_password';
const getPassword=()=>sessionStorage.getItem(passwordKey)||'';

const loginForm=document.querySelector('#loginForm');
loginForm?.addEventListener('submit',()=>{
 const value=document.querySelector('#password')?.value||'';
 if(value)sessionStorage.setItem(passwordKey,value);
},true);

document.querySelector('#logout')?.addEventListener('click',()=>{
 sessionStorage.removeItem(passwordKey);
 sessionStorage.removeItem('uon_admin');
},true);

if(sessionStorage.getItem('uon_admin')==='1'&&!getPassword()){
 sessionStorage.removeItem('uon_admin');
 location.reload();
}

async function requirePassword(){
 const password=getPassword();
 if(!password)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 return password;
}

document.addEventListener('click',async event=>{
 const button=event.target.closest('#saveSite');
 if(!button)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 button.disabled=true;
 try{
  const p_password=await requirePassword();
  await rpc('uon_admin_save_site_settings',{
   p_password,
   p_settings:{
    maintenance_enabled:document.querySelector('#maintenance')?.checked||false,
    maintenance_message:document.querySelector('#maintenanceMessage')?.value||'',
    maintenance_until:document.querySelector('#maintenanceUntil')?.value||null,
    whatsapp_channel_url:document.querySelector('#whatsappUrl')?.value||'',
    instagram_url:document.querySelector('#instagramUrl')?.value||''
   }
  });
  toast('تم حفظ إعدادات الموقع بأمان');
 }catch(error){toast(error.message,true)}
 finally{button.disabled=false}
},true);

document.addEventListener('change',async event=>{
 const select=event.target;
 if(!(select instanceof HTMLSelectElement))return;
 if(select.matches('[data-feature]')){
  event.stopImmediatePropagation();
  select.disabled=true;
  try{
   await rpc('uon_admin_set_feature',{
    p_password:await requirePassword(),
    p_key:select.dataset.feature,
    p_status:select.value
   });
   toast('تم تحديث الخدمة');
  }catch(error){toast(error.message,true)}
  finally{select.disabled=false}
 }
 if(select.matches('[data-tool]')){
  event.stopImmediatePropagation();
  select.disabled=true;
  try{
   await rpc('uon_admin_set_tool',{
    p_password:await requirePassword(),
    p_tool_id:Number(select.dataset.tool),
    p_status:select.value
   });
   toast('تم تحديث الأداة');
  }catch(error){toast(error.message,true)}
  finally{select.disabled=false}
 }
},true);
