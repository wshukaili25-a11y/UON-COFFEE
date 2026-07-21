
export const $=(s,r=document)=>r.querySelector(s);export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}
export function toast(message,error=false){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.append(el)}el.textContent=message;el.className=`toast show${error?' error':''}`;setTimeout(()=>el.className='toast',2800)}
export function setupNav(){setupHiddenAdminEntry();$('#menuBtn')?.addEventListener('click',()=>$('#navLinks')?.classList.toggle('open'));$('#langBtn')?.addEventListener('click',()=>{const next=document.documentElement.lang==='ar'?'en':'ar';localStorage.setItem('uon-lang',next);location.reload()})}
export function formatDate(v){if(!v)return '—';return new Date(v).toLocaleDateString(document.documentElement.lang==='en'?'en-GB':'ar-OM')}


export function setupHiddenAdminEntry(){
 const brand=document.querySelector('[data-admin-entry]');
 if(!brand)return;

 let tapCount=0;
 let tapTimer=null;
 let holdTimer=null;
 let holding=false;

 const openAdmin=()=>{
   tapCount=0;
   clearTimeout(tapTimer);
   clearTimeout(holdTimer);
   sessionStorage.setItem('uon_admin_entry','granted');
   window.location.assign('admin.html');
 };

 brand.addEventListener('pointerdown',event=>{
   holding=true;
   holdTimer=setTimeout(()=>{
     if(holding){event.preventDefault();openAdmin()}
   },2000);
 });

 brand.addEventListener('pointerup',event=>{
   holding=false;
   clearTimeout(holdTimer);
   event.preventDefault();
   tapCount++;
   clearTimeout(tapTimer);

   if(tapCount>=5){
     openAdmin();
     return;
   }

   tapTimer=setTimeout(()=>{
     tapCount=0;
     const path=location.pathname;
     if(!(path==='/'||path.endsWith('/index.html')))window.location.assign('index.html');
   },1800);
 });

 brand.addEventListener('pointercancel',()=>{
   holding=false;
   clearTimeout(holdTimer);
 });
}
