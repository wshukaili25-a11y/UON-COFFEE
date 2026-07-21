
export const $=(s,r=document)=>r.querySelector(s);export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}
export function toast(message,error=false){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.append(el)}el.textContent=message;el.className=`toast show${error?' error':''}`;setTimeout(()=>el.className='toast',2800)}
export function setupNav(){$('#menuBtn')?.addEventListener('click',()=>$('#navLinks')?.classList.toggle('open'));$('#langBtn')?.addEventListener('click',()=>{const next=document.documentElement.lang==='ar'?'en':'ar';localStorage.setItem('uon-lang',next);location.reload()})}
export function formatDate(v){if(!v)return '—';return new Date(v).toLocaleDateString(document.documentElement.lang==='en'?'en-GB':'ar-OM')}
