import {rpc,esc} from './core.js?v=67.0.0';

const lang=localStorage.getItem('uon_language')==='en'?'en':'ar',en=lang==='en';
const labels={
 'المالية':'Finance',
 'القبول والتسجيل':'Admissions & Registration',
 'الرعاية الاجتماعية':'Social Welfare',
 'الرقم العام – الحرم المبدئي':'Main Campus',
 'الرقم العام - الحرم المبدئي':'Main Campus',
 'مكتب الجامعة – الخوير':'University Office – Al Khuwair',
 'مكتب الجامعة - الخوير':'University Office – Al Khuwair'
};
let unavailable=false;
let loading=false;
const translated=value=>en?(labels[String(value||'').trim()]||String(value||'')):String(value||'');
function phone(value){const raw=String(value||'').trim();let digits=raw.replace(/\D/g,'');if(digits.startsWith('968')&&digits.length>8)digits=digits.slice(3);if(digits.length===8)return{href:`tel:+968${digits}`,display:`+968 ${digits.slice(0,4)} ${digits.slice(4)}`};return{href:`tel:${raw.replace(/\s+/g,'')}`,display:raw}}
function render(root,rows){root.hidden=false;root.removeAttribute('aria-busy');root.innerHTML=rows.map(row=>{const p=phone(row.phone);return `<a class="guide-contact-card" href="${esc(p.href)}"><span>${esc(translated(row.label))}</span><strong dir="ltr">${esc(p.display)}</strong><small>${en?'Tap to call':'اضغط للاتصال'}</small></a>`}).join('')}
async function load(){
 const roots=[...document.querySelectorAll('[data-contact-directory]')];if(!roots.length||unavailable||loading)return;loading=true;
 try{const rows=await rpc('uon_public_contact_numbers',{});if(!Array.isArray(rows)||!rows.length)throw new Error('empty_contacts');roots.forEach(root=>render(root,rows))}
 catch(error){const message=String(error?.message||error||'');if(/schema cache|could not find|uon_public_contact_numbers/i.test(message))unavailable=true;console.warn('Contact directory unavailable',error);roots.forEach(root=>{root.innerHTML='';root.hidden=true;root.removeAttribute('aria-busy')})}
 finally{loading=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void load(),{once:true});else void load();
window.addEventListener('focus',()=>void load());
