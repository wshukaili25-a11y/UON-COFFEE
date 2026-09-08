import {rpc,esc} from './core.js?v=66.8.0';

const LANG_KEY='uon_language';
const lang=localStorage.getItem(LANG_KEY)==='en'?'en':'ar';
const en=lang==='en';
const t=(ar,enText)=>en?enText:ar;

const LABELS={
 'المالية':'Finance',
 'القبول والتسجيل':'Admissions & Registration',
 'الرعاية الاجتماعية':'Social Welfare',
 'الرقم العام – الحرم المبدئي':'Main Campus',
 'الرقم العام - الحرم المبدئي':'Main Campus',
 'مكتب الجامعة – الخوير':'University Office – Al Khuwair',
 'مكتب الجامعة - الخوير':'University Office – Al Khuwair'
};

function displayLabel(value){
 const raw=String(value||'').trim();
 return en?(LABELS[raw]||raw):raw;
}

function phoneParts(value){
 const raw=String(value||'').trim();
 let digits=raw.replace(/\D/g,'');
 if(digits.startsWith('968')&&digits.length>8)digits=digits.slice(3);
 if(digits.length===8){
  return {href:`tel:+968${digits}`,display:`+968 ${digits.slice(0,4)} ${digits.slice(4)}`};
 }
 const href=raw.startsWith('+')?`tel:${raw.replace(/\s+/g,'')}`:`tel:${digits}`;
 return {href,display:raw};
}

function mount(rows){
 if(!Array.isArray(rows)||!rows.length)return;
 document.querySelector('#uonHomeContacts')?.remove();
 const anchor=document.querySelector('.uon-rd-note')||document.querySelector('#rdManagedFooter');
 if(!anchor)return;
 const section=document.createElement('section');
 section.id='uonHomeContacts';
 section.className='uon-home-contacts';
 section.innerHTML=`<div class="uon-rd-container"><div class="uon-rd-section-head centered uon-contact-head"><span>${t('تواصل مع الجامعة','Contact the university')}</span><h2>${t('أرقام التواصل المهمة','Important contact numbers')}</h2><p>${t('الأرقام المتاحة مرتبة في مكان واحد للوصول السريع.','Available contact numbers, organized for quick access.')}</p></div><div class="uon-contact-grid">${rows.map(row=>{const phone=phoneParts(row.phone);return `<a class="uon-contact-card" href="${esc(phone.href)}"><span class="uon-contact-icon">☎</span><span class="uon-contact-copy"><strong>${esc(displayLabel(row.label))}</strong><b dir="ltr">${esc(phone.display)}</b></span><span class="uon-contact-action">${t('اتصال','Call')}</span></a>`}).join('')}</div></div>`;
 anchor.before(section);
}

async function load(){
 try{
  const rows=await rpc('uon_public_contact_numbers',{});
  mount(rows);
 }catch(error){
  console.warn('Public contact directory unavailable',error);
 }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void load(),{once:true});else void load();
window.addEventListener('focus',()=>void load());
