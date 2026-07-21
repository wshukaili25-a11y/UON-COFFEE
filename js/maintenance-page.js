
import {get} from './api.js';
try{
  const rows=await get('site_settings','select=key,value');
  const settings=Object.fromEntries((rows||[]).map(x=>[x.key,x.value]));
  if(settings.maintenance_message){
    document.getElementById('maintenanceMessage').textContent=settings.maintenance_message;
  }
  const on=settings.maintenance_enabled===true||settings.maintenance_enabled==='true';
  if(!on)location.replace('index.html');
}catch{}
