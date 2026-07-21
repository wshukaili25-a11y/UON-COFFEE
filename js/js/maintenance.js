
import {get} from './api.js';

const path=location.pathname;
const isAdminPage=path.endsWith('/admin.html');
const isMaintenancePage=path.endsWith('/maintenance.html');

function toBoolean(value){
 if(value===true||value===1)return true;
 if(typeof value==='string')return value.trim().toLowerCase()==='true';
 return false;
}

async function readSettings(){
 try{
  const rows=await get('site_settings',`select=key,value&_=${Date.now()}`);
  return Object.fromEntries((rows||[]).map(row=>[row.key,row.value]));
 }catch(error){
  console.error('Unable to read site settings',error);
  return {};
 }
}

(async()=>{
 document.documentElement.classList.add('maintenance-checking');

 const settings=await readSettings();
 const maintenance=toBoolean(settings.maintenance_enabled);

 if(settings.whatsapp_channel_url){
  localStorage.setItem('uon_whatsapp_channel_url',String(settings.whatsapp_channel_url));
 }

 // Only the admin page bypasses maintenance.
 if(maintenance&&!isAdminPage&&!isMaintenancePage){
  location.replace(`maintenance.html?v=${Date.now()}`);
  return;
 }

 if(!maintenance&&isMaintenancePage){
  location.replace(`index.html?v=${Date.now()}`);
  return;
 }

 document.documentElement.classList.remove('maintenance-checking');
})();
