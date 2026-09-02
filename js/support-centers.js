import {get,esc,safeHref} from './core.js?v=60.0.0';

const grid=document.querySelector('#supportCentersGrid');
const count=document.querySelector('#supportCentersCount');

function card(center){
 const booking=safeHref(center.booking_url,'');
 const location=safeHref(center.location_url,'');
 const actions=[];
 if(booking)actions.push(`<a class="btn primary" href="${esc(booking)}" target="_blank" rel="noopener noreferrer">حجز موعد</a>`);
 if(location)actions.push(`<a class="btn" href="${esc(location)}" target="_blank" rel="noopener noreferrer">الموقع</a>`);
 return `<article class="support-center-card"><span class="student-label">مركز دعم</span><h2>${esc(center.name)}</h2><p>${esc(center.description||'خدمة دعم طلابية متاحة لطلبة جامعة نزوى.')}</p>${actions.length?`<div class="support-center-actions">${actions.join('')}</div>`:''}</article>`;
}

async function load(){
 if(!grid)return;
 try{
  const rows=await get('support_centers','select=id,name,description,booking_url,location_url,sort_order&active=eq.true&order=sort_order.asc,created_at.asc');
  if(count)count.textContent=String(rows.length);
  grid.innerHTML=rows.length?rows.map(card).join(''):'<div class="support-centers-empty">لا توجد مراكز دعم منشورة حاليًا.</div>';
 }catch(error){
  console.error(error);
  grid.innerHTML='<div class="support-centers-empty">تعذر تحميل مراكز الدعم الآن. جرّب مرة ثانية.</div>';
 }
 grid.removeAttribute('aria-busy');
}

load();
