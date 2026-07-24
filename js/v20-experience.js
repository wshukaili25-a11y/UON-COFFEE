import {get,insert,esc,toast,trackEvent} from './core.js';

const PAGE_KEY='uon_favorites_v20';
const contributionKey='uon_contributions_v20';
const current={title:document.title.replace(/\s*\|.*$/,''),url:location.pathname.split('/').pop()||'index.html'};

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function favorites(){return readJson(PAGE_KEY,[])}
function isFavorite(){return favorites().some(x=>x.url===current.url)}
function toggleFavorite(){
 const rows=favorites(); const i=rows.findIndex(x=>x.url===current.url);
 if(i>=0){rows.splice(i,1);toast('تمت إزالة الصفحة من المفضلة');}
 else{rows.unshift({...current,added_at:new Date().toISOString()});toast('تم حفظ الصفحة في المفضلة ❤️');trackEvent('favorite_add',current)}
 writeJson(PAGE_KEY,rows.slice(0,80));syncButtons();
}
function syncButtons(){document.querySelectorAll('[data-v20-favorite]').forEach(b=>{b.textContent=isFavorite()?'♥':'♡';b.title=isFavorite()?'إزالة من المفضلة':'حفظ في المفضلة'})}

function openQr(){
 const old=document.querySelector('#v20QrModal'); if(old)old.remove();
 const url=location.href; const m=document.createElement('div');m.id='v20QrModal';m.className='v20-modal open';
 m.innerHTML=`<div class="v20-modal-card"><button class="v20-close" aria-label="إغلاق">×</button><h3>شارك الصفحة</h3><img alt="QR Code" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}"><p>${esc(document.title)}</p><button class="btn primary" data-copy>نسخ الرابط</button></div>`;
 document.body.append(m);m.querySelector('.v20-close').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
 m.querySelector('[data-copy]').onclick=async()=>{await navigator.clipboard.writeText(url);toast('تم نسخ الرابط')};
}

function openFeedback(){
 const old=document.querySelector('#v20FeedbackModal');if(old)old.remove();
 const m=document.createElement('div');m.id='v20FeedbackModal';m.className='v20-modal open';
 m.innerHTML=`<form class="v20-modal-card"><button type="button" class="v20-close">×</button><h3>كيف كانت تجربتك؟</h3><div class="v20-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-rate="${n}">☆</button>`).join('')}</div><textarea name="comment" placeholder="ملاحظتك اختيارية"></textarea><button class="btn primary" type="submit">إرسال التقييم</button></form>`;
 document.body.append(m);let rating=0;const stars=[...m.querySelectorAll('[data-rate]')];
 stars.forEach(b=>b.onclick=()=>{rating=Number(b.dataset.rate);stars.forEach((x,i)=>x.textContent=i<rating?'★':'☆')});
 m.querySelector('.v20-close').onclick=()=>m.remove();
 m.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!rating){toast('اختر عدد النجوم',true);return}const btn=e.submitter;btn.disabled=true;try{await insert('platform_feedback',{rating,comment:new FormData(e.target).get('comment')||null,page_path:location.pathname,status:'pending'},{returning:false});toast('شكرًا لتقييمك 💙');m.remove()}catch(err){toast(err.message,true)}finally{btn.disabled=false}};
}

function addUtilityDock(){
 if(document.querySelector('.v20-utility-dock'))return;
 const dock=document.createElement('div');dock.className='v20-utility-dock';dock.innerHTML=`<button data-v20-favorite title="المفضلة">♡</button><button data-v20-qr title="QR">▦</button><button data-v20-feedback title="قيّم المنصة">★</button>`;
 document.body.append(dock);dock.querySelector('[data-v20-favorite]').onclick=toggleFavorite;dock.querySelector('[data-v20-qr]').onclick=openQr;dock.querySelector('[data-v20-feedback]').onclick=openFeedback;syncButtons();
}

async function updateBadge(){
 try{const rows=await get('site_updates','select=id&active=eq.true&order=created_at.desc&limit=20');const seen=Number(localStorage.getItem('uon_updates_seen')||0);if(rows.length>seen){const a=document.createElement('a');a.href='updates.html';a.className='v20-update-badge';a.textContent=`${rows.length-seen} تحديث جديد`;document.body.append(a)}}catch{}
}

addUtilityDock();updateBadge();
window.UON_V20={favorites,toggleFavorite,contributions:()=>readJson(contributionKey,[])};
