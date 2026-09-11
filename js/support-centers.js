import {get,esc,safeHref} from './core.js?v=67.0.0';

const grid=document.querySelector('#supportCentersGrid');
const count=document.querySelector('#supportCentersCount');
const LANG_KEY='uon_language',LEGACY_LANG_KEY='uon_hub_lang';
function readLanguage(){const current=localStorage.getItem(LANG_KEY),legacy=localStorage.getItem(LEGACY_LANG_KEY);return current==='en'||current==='ar'?current:(legacy==='en'||legacy==='ar'?legacy:'ar')}
const lang=readLanguage(),en=lang==='en',t=(ar,enText)=>en?enText:ar;
const hasArabic=value=>/[\u0600-\u06FF]/.test(String(value||''));
const hasLatin=value=>/[A-Za-z]/.test(String(value||''));
const normalizeArabic=value=>String(value||'').trim().toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ـ]/g,'').replace(/\s+/g,' ');
const usableEnglish=value=>{const s=String(value||'').trim();return s&&hasLatin(s)&&!hasArabic(s)?s:''};
const usableArabic=value=>{const s=String(value||'').trim();return s&&hasArabic(s)?s:''};

const KNOWN_CENTERS=[
 {match:value=>{const n=normalizeArabic(value);return n.includes('انجز')||/anjiz/i.test(String(value||''))},nameAr:'مركز أنجز',nameEn:'Anjiz Center',descriptionAr:'دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.',descriptionEn:'Support for foundation-year students in English, mathematics, computing, and study skills.'},
 {match:value=>{const n=normalizeArabic(value);return n.includes('مسالك')||/learning pathways/i.test(String(value||''))},nameAr:'مركز تعزيز مسالك التعلم',nameEn:'Learning Pathways Enhancement Center',descriptionAr:'جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.',descriptionEn:'Academic support sessions and small workshops for major students in foundational courses.'}
];
function known(center){const hay=`${center?.name||''} ${center?.name_ar||''} ${center?.name_en||''} ${center?.description||''} ${center?.description_ar||''} ${center?.description_en||''}`;return KNOWN_CENTERS.find(item=>item.match(hay))||null}
function centerName(center){
 const item=known(center);
 if(en)return usableEnglish(center.name_en)||item?.nameEn||usableEnglish(center.name)||'Student Support Center';
 return usableArabic(center.name_ar)||usableArabic(center.name)||item?.nameAr||String(center.name_en||'مركز دعم').trim();
}
function centerDescription(center){
 const item=known(center);
 if(en)return usableEnglish(center.description_en)||item?.descriptionEn||usableEnglish(center.description)||'Student support service available to University of Nizwa students.';
 return usableArabic(center.description_ar)||usableArabic(center.description)||item?.descriptionAr||'خدمة دعم طلابية متاحة لطلبة جامعة نزوى.';
}
function card(center){
 const booking=safeHref(center.booking_url,''),location=safeHref(center.location_url,''),actions=[];
 if(booking)actions.push(`<a class="btn primary" href="${esc(booking)}" target="_blank" rel="noopener noreferrer">${t('حجز موعد','Book appointment')}</a>`);
 if(location)actions.push(`<a class="btn" href="${esc(location)}" target="_blank" rel="noopener noreferrer">${t('الموقع','Location')}</a>`);
 return `<article class="support-center-card" dir="${en?'ltr':'rtl'}"><span class="support-card-label">${t('مركز دعم','Support center')}</span><h2>${esc(centerName(center))}</h2><p>${esc(centerDescription(center))}</p>${actions.length?`<div class="support-center-actions">${actions.join('')}</div>`:''}</article>`;
}

async function load(){
 if(!grid)return;
 try{
  let rows;
  try{rows=await get('support_centers','select=id,name,name_ar,name_en,description,description_ar,description_en,booking_url,location_url,sort_order&active=eq.true&order=sort_order.asc,created_at.asc')}
  catch{try{rows=await get('support_centers','select=id,name,name_en,description,description_en,booking_url,location_url,sort_order&active=eq.true&order=sort_order.asc,created_at.asc')}
  catch{rows=await get('support_centers','select=id,name,description,booking_url,location_url,sort_order&active=eq.true&order=sort_order.asc,created_at.asc')}}
  rows=Array.isArray(rows)?rows:[];
  if(count)count.textContent=String(rows.length);
  grid.innerHTML=rows.length?rows.map(card).join(''):`<div class="support-centers-empty">${t('لا توجد مراكز دعم منشورة حاليًا.','No support centers are published right now.')}</div>`;
 }catch(error){
  console.error(error);
  grid.innerHTML=`<div class="support-centers-empty">${t('تعذر تحميل مراكز الدعم الآن. جرّب مرة ثانية.','Could not load support centers right now. Please try again.')}</div>`;
 }
 grid.removeAttribute('aria-busy');
}
load();
