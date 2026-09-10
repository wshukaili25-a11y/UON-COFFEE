import {getUonState,$} from './core.js?v=67.0.2';

const LANG_KEY='uon_language';
const LEGACY_LANG_KEY='uon_hub_lang';
const THEME_KEY='uon_theme';
const LEGACY_THEME_KEY='uonhub_theme';
let redirecting=false;
let latestState=null;

function language(){
 try{
  const current=localStorage.getItem(LANG_KEY);
  const legacy=localStorage.getItem(LEGACY_LANG_KEY);
  return current==='en'||(current!=='ar'&&legacy==='en')?'en':'ar';
 }catch{return'ar'}
}
function theme(){
 try{
  const current=localStorage.getItem(THEME_KEY);
  const legacy=localStorage.getItem(LEGACY_THEME_KEY)||localStorage.getItem('uon_theme_mode');
  return current==='light'||current==='dark'?current:(legacy==='light'||legacy==='dark'?legacy:'dark');
 }catch{return'dark'}
}
function setLanguage(value){
 try{localStorage.setItem(LANG_KEY,value);localStorage.setItem(LEGACY_LANG_KEY,value)}catch{}
 applyLanguage();
 renderState(latestState);
}
function setTheme(value){
 try{localStorage.setItem(THEME_KEY,value);localStorage.setItem(LEGACY_THEME_KEY,value);localStorage.setItem('uon_theme_mode',value)}catch{}
 applyTheme();
}
function applyTheme(){
 const value=theme();
 document.documentElement.dataset.theme=value;
 document.documentElement.style.colorScheme=value;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=value==='light'?'#f2f7f4':'#07110d';
 const button=$('#themeToggle');
 if(button){button.textContent=value==='light'?'☾':'☀';button.setAttribute('aria-label',value==='light'?'الوضع الداكن':'الوضع الفاتح')}
}
function applyLanguage(){
 const value=language(),en=value==='en';
 document.documentElement.lang=value;
 document.documentElement.dir=en?'ltr':'rtl';
 document.querySelectorAll('[data-ar][data-en]').forEach(node=>{node.textContent=en?node.dataset.en:node.dataset.ar});
 const button=$('#languageToggle');
 if(button){button.textContent=en?'ع':'EN';button.setAttribute('aria-label',en?'Switch to Arabic':'التبديل إلى الإنجليزية')}
 document.title=en?'Maintenance | UON Hub':'تحت الصيانة | UON Hub';
}
function formatReturn(value){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return'';
 return new Intl.DateTimeFormat(language()==='en'?'en-OM':'ar-OM',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Muscat'}).format(date);
}
function renderState(state){
 if(!state)return;
 const en=language()==='en';
 const defaultAr='نعمل حاليًا على تحسين المنصة وتجهيز التحديث الجديد. بنرجع لك قريبًا بتجربة أسرع وأرتب.';
 const defaultEn="We're improving the platform and preparing the new update. We'll be back soon with a faster, cleaner experience.";
 const configuredAr=String(state.maintenance_message||'').trim();
 const configuredEn=String(state.maintenance_message_en||'').trim();
 const message=$('#message');
 if(message)message.textContent=en?(configuredEn||defaultEn):(configuredAr||defaultAr);
 const wrap=$('#maintenanceUntil'),value=$('#maintenanceUntilValue');
 const formatted=state.maintenance_until?formatReturn(state.maintenance_until):'';
 if(wrap&&value&&formatted){value.textContent=formatted;wrap.hidden=false;wrap.classList.add('show')}
 else if(wrap){wrap.hidden=true;wrap.classList.remove('show')}
}
async function refresh(){
 if(redirecting)return;
 const button=$('#refreshButton');
 if(button){button.disabled=true;button.setAttribute('aria-busy','true')}
 try{
  const state=await getUonState();
  latestState=state;
  if(!state?.maintenance_enabled){redirecting=true;location.replace('index.html');return}
  renderState(state);
 }catch(error){
  console.error('Maintenance page state error',error);
 }finally{
  if(button&&!redirecting){button.disabled=false;button.removeAttribute('aria-busy')}
 }
}

applyTheme();
applyLanguage();
$('#languageToggle')?.addEventListener('click',()=>setLanguage(language()==='en'?'ar':'en'));
$('#themeToggle')?.addEventListener('click',()=>setTheme(theme()==='light'?'dark':'light'));
$('#refreshButton')?.addEventListener('click',()=>void refresh());

refresh();
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('storage',event=>{if([LANG_KEY,LEGACY_LANG_KEY].includes(event.key||'')){applyLanguage();renderState(latestState)}if([THEME_KEY,LEGACY_THEME_KEY,'uon_theme_mode'].includes(event.key||''))applyTheme()});