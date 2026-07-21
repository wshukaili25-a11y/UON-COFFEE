
import {get} from './api.js';

const ADMIN_SESSION =
  sessionStorage.getItem('uon_admin_entry') === 'granted' ||
  sessionStorage.getItem('uon_admin_password');

const path = location.pathname;
const isAdminPage = path.endsWith('/admin.html');
const isMaintenancePage = path.endsWith('/maintenance.html');

async function readSettings(){
  try{
    const rows = await get('site_settings','select=key,value');
    return Object.fromEntries((rows || []).map(row => [row.key, row.value]));
  }catch(error){
    console.warn('site settings unavailable', error);
    return {};
  }
}

(async()=>{
  const settings = await readSettings();

  if(settings.whatsapp_channel_url){
    localStorage.setItem('uon_whatsapp_channel_url', settings.whatsapp_channel_url);
  }

  const maintenance = settings.maintenance_enabled === true ||
    settings.maintenance_enabled === 'true';

  if(maintenance && !ADMIN_SESSION && !isAdminPage && !isMaintenancePage){
    location.replace('maintenance.html');
    return;
  }

  if(!maintenance && isMaintenancePage){
    location.replace('index.html');
  }
})();
