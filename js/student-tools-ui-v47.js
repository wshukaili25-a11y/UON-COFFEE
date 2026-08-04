import {get} from './core.js?v=47.0.2';

const STYLE_ID='uon47StudentToolsStyle';
const VERSION='47.0.2';
let installed=false;
let observer=null;
let queued=false;
let settingsPromise=null;

const ICONS={
 schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
 courses:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/>',
 gpa:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h8"/>',
 projects:'<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.5-1.7 2.5h-3.6c-.2-1-.8-1.8-1.7-2.5Z"/><path d="M12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"/>',
 confessions:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
 'useful-sites':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 summaries:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7M9 11h7M9 15h4"/>',
 groups:'<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-4.7A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M8.7 8.2c.3 3.5 3.1 6.3 6.6 6.6"/><path d="m9.1 8.3 1.3-.3.8 2-1 .7M15.2 13.1l.8-1 2 .8-.3 1.3"/>',
 'university-guide':'<path d="m3 10 9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M2 18h20"/>',
 ratings:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
 assistant:'<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 3h6M12 3v4M8 12h.01M16 12h.01M9 16h6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/>',
 'support-centers':'<path d="M20 12a8 8 0 1 1-8-8"/><path d="M12 8v8M8 12h8"/><path d="M17 3h4v4"/><path d="m21 3-5 5"/>',
 feedback:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 anjiz:'<path d="M4.5 16.5c-1.5 1.2-2 3-2 5 2 0 3.8-.5 5-2"/><path d="M9 15 5 11l3-1 2-4c2.8-2.8 6.8-3.5 10-3-0.5 3.2-1.2 7.2-4 10l-4 2-1 3Z"/><circle cx="15" cy="8" r="1.5"/>',
 masalik:'<path d="m2 10 10-5 10 5-10 5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6"/>',
 fallback:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
};

const english=()=>localStorage.getItem('uon_language')==='en';
const text=(ar,en)=>english()?en:ar;
const setText=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value};

function injectStyles(){
 if(document.getElementById(STYLE_ID))return;
 const link=document.createElement('link');
 link.id=STYLE_ID;
 link.rel='stylesheet';
 link.href=`/css/student-tools-ui-v47.css?v=${VERSION}`;
 document.head.append(link);
}

function svg(key){return `<svg class="uon47-icon-svg" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]||ICONS.fallback}</svg>`}

function replaceIcon(element,key){
 if(!element)return;
 const marker=`${key}:${VERSION}`;
 if(element.dataset.uon47Icon===marker&&element.querySelector('.uon47-icon-svg'))return;
 element.dataset.uon47Icon=marker;
 element.classList.add('uon47-icon-frame');
 element.style.removeProperty('background-image');
 element.innerHTML=svg(key);
}

function applyToolIcons(root=document){
 root.querySelectorAll('[data-tool-key]').forEach(card=>replaceIcon(card.querySelector('.h37-service-icon,.tool-icon'),card.dataset.toolKey));
 root.querySelectorAll('.v18-primary-tools [data-feature],.v18-secondary-tools [data-feature]').forEach(card=>replaceIcon(card.querySelector('.v18-tool-icon')||card.querySelector(':scope > span:first-child'),card.dataset.feature));
 replaceIcon(document.querySelector('#anjizCard .v251-support-icon'),'anjiz');
 replaceIcon(document.querySelector('#masalikCard .v251-support-icon'),'masalik');
}

function supportMarkup(){
 return `<section class="h37-section h37-soft uon47-support-home" data-feature="support-centers" id="support-centers">
  <div class="h37-container">
   <div class="h37-head v18-section-head"><div><h2 data-ar="مراكز الدعم للطالب" data-en="Student support centers">${text('مراكز الدعم للطالب','Student support centers')}</h2><p data-ar="مراكز تساعدك في السنة التأسيسية والتخصص، مع روابط الحجز المباشر." data-en="Support for foundation and major students, with direct booking links.">${text('مراكز تساعدك في السنة التأسيسية والتخصص، مع روابط الحجز المباشر.','Support for foundation and major students, with direct booking links.')}</p></div></div>
   <div class="v18-centers v251-centers-no-images">
    <article id="anjizCard" class="v251-support-card"><div class="v251-support-icon" aria-hidden="true"></div><div class="v251-support-content"><span data-ar="لطلاب السنة التأسيسية" data-en="For foundation students">${text('لطلاب السنة التأسيسية','For foundation students')}</span><h3 id="anjizTitle">${text('مركز أنجز','Anjiz Center')}</h3><p id="anjizDescription">${text('دعم لطلاب السنة التأسيسية في المهارات والمواد الأساسية.','Support for foundation students in core skills.')}</p><a id="anjizLink" class="btn primary v251-booking-btn" target="_blank" rel="noopener noreferrer">${text('احجز الآن','Book now')}</a></div></article>
    <article id="masalikCard" class="v251-support-card"><div class="v251-support-icon" aria-hidden="true"></div><div class="v251-support-content"><span data-ar="لطلاب التخصص" data-en="For major students">${text('لطلاب التخصص','For major students')}</span><h3 id="masalikTitle">${text('مركز مسالك التعلم','Masalik Learning Support Center')}</h3><p id="masalikDescription">${text('جلسات دعم أكاديمي لطلاب التخصص.','Academic support sessions for major courses.')}</p><a id="masalikLink" class="btn primary v251-booking-btn" target="_blank" rel="noopener noreferrer">${text('احجز الآن','Book now')}</a></div></article>
   </div>
  </div>
 </section>`;
}

function ensureSupportSection(){
 let section=document.querySelector('section[data-feature="support-centers"]');
 if(section)return section;
 const main=document.querySelector('main');
 if(!main)return null;
 main.insertAdjacentHTML('beforeend',supportMarkup());
 return document.querySelector('section[data-feature="support-centers"]');
}

function safeLink(value){
 try{const url=new URL(String(value||''),location.origin);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}
}

async function hydrateSupport(section){
 if(!section||section.dataset.uon47Settings==='ready'||section.dataset.uon47Settings==='loading')return;
 section.dataset.uon47Settings='loading';
 if(!settingsPromise){
  settingsPromise=get('site_settings','select=key,value&key=in.(anjiz_title,anjiz_description,anjiz_booking_url,anjiz_cta,masalik_title,masalik_description,masalik_booking_url,masalik_cta)').catch(()=>[]);
 }
 const rows=await settingsPromise;
 const settings=Object.fromEntries((rows||[]).map(row=>[row.key,String(row.value??'')]));
 for(const prefix of ['anjiz','masalik']){
  const title=document.querySelector(`#${prefix}Title`);
  const description=document.querySelector(`#${prefix}Description`);
  const link=document.querySelector(`#${prefix}Link`);
  setText(title,settings[`${prefix}_title`]||title?.textContent||'');
  if(settings[`${prefix}_description`])setText(description,settings[`${prefix}_description`]);
  if(link){
   const href=safeLink(settings[`${prefix}_booking_url`]);
   setText(link,settings[`${prefix}_cta`]||text('احجز الآن','Book now'));
   if(href&&link.href!==href)link.href=href;
   if(link.hidden===Boolean(href))link.hidden=!href;
  }
 }
 section.dataset.uon47Settings='ready';
}

function positionSupport(){
 const section=ensureSupportSection();
 const primary=document.querySelector('.h37-services,.v18-primary-tools')?.closest('section');
 document.querySelectorAll('.uon44-secondary-section').forEach(item=>item.remove());
 document.querySelectorAll('.v18-secondary-tools').forEach(grid=>{const parent=grid.closest('section');if(parent&&parent!==section)parent.remove()});
 if(!section||!primary)return;
 setText(section.querySelector('.v18-section-head h2,.h37-head h2'),text('مراكز الدعم للطالب','Student support centers'));
 if(section.previousElementSibling!==primary)primary.insertAdjacentElement('afterend',section);
 void hydrateSupport(section).then(()=>applyToolIcons(section));
}

function refresh(){positionSupport();applyToolIcons()}
function queueRefresh(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})}

export function installStudentToolsUI(){
 if(installed)return;
 installed=true;
 injectStyles();
 refresh();
 observer=new MutationObserver(queueRefresh);
 observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('uon:tool-catalog-updated',queueRefresh);
 document.addEventListener('uon:language-changed',()=>{
  settingsPromise=null;
  const section=document.querySelector('section[data-feature="support-centers"]');
  section?.removeAttribute('data-uon47-settings');
  queueRefresh();
 });
 setTimeout(queueRefresh,300);
 setTimeout(queueRefresh,1000);
 setTimeout(queueRefresh,2500);
 setTimeout(()=>observer?.disconnect(),15000);
}
