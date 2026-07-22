import {getUonState,$} from './core.js';

let redirecting=false;

async function refresh(){
 if(redirecting)return;

 try{
  const state=await getUonState();

  if(!state?.maintenance_enabled){
   redirecting=true;
   location.replace('index.html');
   return;
  }

  $('#message').textContent=
   state.maintenance_message||'الموقع تحت الصيانة';

  let badge=$('#maintenanceUntilBadge');

  if(state.maintenance_until){
   if(!badge){
    badge=document.createElement('p');
    badge.id='maintenanceUntilBadge';
    badge.className='badge';
    $('#message')?.after(badge);
   }
   badge.textContent=
    'العودة المتوقعة: '+
    new Date(state.maintenance_until).toLocaleString('ar');
  }else{
   badge?.remove();
  }
 }catch(error){
  console.error('Maintenance page state error',error);
 }
}

refresh();
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)refresh();
});
