import {readPublicState,$} from './core.js';
async function refresh(){
 try{
  const state=await readPublicState();
  if(!state.maintenance_enabled){location.replace(`index.html?v=${Date.now()}`);return}
  if(state.maintenance_message)$('#message').textContent=state.maintenance_message;
  let badge=document.querySelector('#maintenanceUntilBadge');
  if(state.maintenance_until){
   if(!badge){badge=document.createElement('p');badge.id='maintenanceUntilBadge';badge.className='badge';$('#message').after(badge)}
   badge.textContent='العودة المتوقعة: '+new Date(state.maintenance_until).toLocaleString('ar');
  }else badge?.remove();
 }catch(e){console.error(e)}
}
refresh();setInterval(refresh,3000);window.addEventListener('focus',refresh);
