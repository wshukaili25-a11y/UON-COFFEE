import {get,esc,safeHref} from './core.js?v=67.0.0';

const grid=document.querySelector('#supportCentersGrid');
const count=document.querySelector('#supportCentersCount');
const lang=localStorage.getItem('uon_language')==='en'?'en':'ar',en=lang==='en',t=(ar,enText)=>en?enText:ar;

function centerName(center){return en?String(center.name_en||center.name||'').trim():String(center.name||center.name_ar||center.name_en||'').trim()}
function centerDescription(center){return en?String(center.description_en||center.description||t('خدمة دعم طلابية متاحة لطلبة جامعة نزوى.','Student support service available to University of Nizwa students.')).trim():String(center.description||center.description_ar||'خدمة دعم طلابية متاحة لطلبة جامعة نزوى.').trim()}
function card(center){const booking=safeHref(center.booking_url,''),location=safeHref(center.location_url,''),actions=[];if(booking)actions.push(`<a class="btn primary" href="${esc(booking)}" target="_blank" rel="noopener noreferrer">${t('حجز موعد','Book appointment')}</a>`);if(location)actions.push(`<a class="btn" href="${esc(location)}" target="_blank" rel="noopener noreferrer">${t('الموقع','Location')}</a>`);return `<article class="support-center-card"><span class="support-card-label">${t('مركز دعم','Support center')}</span><h2>${esc(centerName(center))}</h2><p>${esc(centerDescription(center))}</p>${actions.length?`<div class="support-center-actions">${actions.join('')}</div>`:''}</article>`}

async function load(){if(!grid)return;try{let rows;try{rows=await get('support_centers','select=id,name,name_en,description,description_en,booking_url,location_url,sort_order&active=eq.true&order=sort_order.asc,created_at.asc')}catch{rows=await get('support_centers','select=id,name,description,booking_url,location_url,sort_order&active=eq.true&order=sort_order.asc,created_at.asc')}if(count)count.textContent=String(rows.length);grid.innerHTML=rows.length?rows.map(card).join(''):`<div class="support-centers-empty">${t('لا توجد مراكز دعم منشورة حاليًا.','No support centers are published right now.')}</div>`}catch(error){console.error(error);grid.innerHTML=`<div class="support-centers-empty">${t('تعذر تحميل مراكز الدعم الآن. جرّب مرة ثانية.','Could not load support centers right now. Please try again.')}</div>`}grid.removeAttribute('aria-busy')}
load();
