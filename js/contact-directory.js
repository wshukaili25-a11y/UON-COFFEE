import {get,esc} from './core.js?v=60.0.0';

const fallback=[
 {label:'المالية',phone:'92596648'},
 {label:'القبول والتسجيل',phone:'25446234'},
 {label:'الرعاية الاجتماعية',phone:'91313951'},
 {label:'الرعاية الاجتماعية',phone:'25446247'},
 {label:'الرقم العام – الحرم المبدئي',phone:'25446200'},
 {label:'مكتب الجامعة – الخوير',phone:'24479171'},
 {label:'مكتب الجامعة – الخوير',phone:'24478167'}
];

function tel(value){
 const raw=String(value||'').trim();
 const digits=raw.replace(/\D/g,'');
 if(!digits)return '';
 return raw.startsWith('+')?`+${digits}`:digits.length===8?`+968${digits}`:digits;
}

function pretty(value){
 const raw=String(value||'').trim();
 const digits=raw.replace(/\D/g,'');
 if(digits.length===8)return `+968 ${digits.slice(0,4)} ${digits.slice(4)}`;
 return raw;
}

function card(row,variant){
 const href=tel(row.phone);
 const label=esc(row.label);
 const phone=esc(pretty(row.phone));
 if(variant==='guide'){
  return `<a class="guide-contact-card" href="tel:${esc(href)}"><span>${label}</span><strong dir="ltr">${phone}</strong><small>رقم مُدار من UON Hub</small></a>`;
 }
 return `<a class="card" href="tel:${esc(href)}"><span>${label}</span><strong dir="ltr" style="color:var(--green)">${phone}</strong></a>`;
}

async function loadRows(){
 try{
  const rows=await get('contact_numbers','select=id,label,phone,sort_order&is_visible=eq.true&order=sort_order.asc,created_at.asc');
  return Array.isArray(rows)&&rows.length?rows:fallback;
 }catch(error){
  console.warn('Could not load managed contact numbers',error);
  return fallback;
 }
}

async function render(){
 const roots=[...document.querySelectorAll('[data-contact-directory]')];
 if(!roots.length)return;
 const rows=await loadRows();
 roots.forEach(root=>{
  const variant=root.dataset.contactDirectory||'home';
  root.innerHTML=rows.map(row=>card(row,variant)).join('');
  root.removeAttribute('aria-busy');
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
