import {getUonState,$} from './core.js';
async function refresh(){
 try{
  const state=await getUonState();
  if(!state.maintenance_enabled){location.replace(`index.html?v=${Date.now()}`);return}
  $('#message').textContent=state.maintenance_message||'الموقع تحت الصيانة';
 }catch(e){console.error(e)}
}
refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
