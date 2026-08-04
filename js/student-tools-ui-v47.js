const STYLE_ID='uon47StudentToolsStyle';
const VERSION='47.0.0';
let installed=false;
let observer=null;
let queued=false;

const PATHS={
 schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
 courses:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/>',
 gpa:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h8"/>',
 projects:'<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.5-1.7 2.5h-3.6c-.2-1-.8-1.8-1.7-2.5Z"/><path d="M12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"/>',
 confessions:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
 'useful-sites':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 summaries:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7M9 11h7M9 15h4"/>',
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

function injectStyles(){
 if(document.getElementById(STYLE_ID))return;
 const link=document.createElement('link');
 link.id=STYLE_ID;
 link.rel='stylesheet';
 link.href=`/css/student-tools-ui-v47.css?v=${VERSION}`;
 document.head.append(link);
}

function svg(key){
 const path=PATHS[key]||PATHS.fallback;
 return `<svg class="uon47-icon-svg" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

function iconMarkup(key){
 if(key==='groups')return `<img class="uon47-icon-img" data-whatsapp-brand="1" src="/assets/whatsapp-official.svg?v=${VERSION}" alt="" aria-hidden="true">`;
 return svg(key);
}

function replaceIcon(element,key){
 if(!element||element.dataset.uon47Icon===key)return;
 element.dataset.uon47Icon=key;
 element.classList.add('uon47-icon-frame');
 element.style.removeProperty('background-image');
 element.replaceChildren();
 element.insertAdjacentHTML('afterbegin',iconMarkup(key));
}

function applyToolIcons(root=document){
 root.querySelectorAll('[data-tool-key]').forEach(card=>{
  const key=card.dataset.toolKey;
  const icon=card.querySelector('.h37-service-icon,.tool-icon');
  replaceIcon(icon,key);
 });
 root.querySelectorAll('.v18-primary-tools [data-feature],.v18-secondary-tools [data-feature]').forEach(card=>{
  const key=card.dataset.feature;
  const icon=card.querySelector('.v18-tool-icon')||card.querySelector(':scope > span:first-child');
  replaceIcon(icon,key);
 });
 replaceIcon(document.querySelector('#anjizCard .v251-support-icon'),'anjiz');
 replaceIcon(document.querySelector('#masalikCard .v251-support-icon'),'masalik');
}

function positionSupportCenters(){
 const support=document.querySelector('section[data-feature="support-centers"]');
 const primaryRoot=document.querySelector('.h37-services,.v18-primary-tools');
 const primarySection=primaryRoot?.closest('section');
 document.querySelectorAll('.uon44-secondary-section').forEach(section=>section.remove());
 document.querySelectorAll('.v18-secondary-tools').forEach(grid=>{
  const section=grid.closest('section');
  if(section&&section!==support)section.remove();
 });
 if(!support||!primarySection)return;
 support.id='support-centers';
 support.classList.add('uon47-support-home');
 const heading=support.querySelector('.v18-section-head h2');
 if(heading){
  heading.textContent=localStorage.getItem('uon_language')==='en'?'Student support centers':'مراكز الدعم للطالب';
  heading.dataset.ar='مراكز الدعم للطالب';
  heading.dataset.en='Student support centers';
 }
 const head=support.querySelector('.v18-section-head>div');
 if(head&&!head.querySelector('p')){
  const description=document.createElement('p');
  description.dataset.ar='مراكز تساعدك في السنة التأسيسية والتخصص، مع روابط الحجز المباشر.';
  description.dataset.en='Support for foundation and major students, with direct booking links.';
  description.textContent=localStorage.getItem('uon_language')==='en'?description.dataset.en:description.dataset.ar;
  head.append(description);
 }
 if(support.previousElementSibling!==primarySection)primarySection.insertAdjacentElement('afterend',support);
}

function refresh(){
 applyToolIcons();
 positionSupportCenters();
}

function queueRefresh(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{queued=false;refresh()});
}

export function installStudentToolsUI(){
 if(installed)return;
 installed=true;
 injectStyles();
 refresh();
 observer=new MutationObserver(queueRefresh);
 observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('uon:tool-catalog-updated',queueRefresh);
 document.addEventListener('uon:language-changed',queueRefresh);
 setTimeout(queueRefresh,500);
 setTimeout(queueRefresh,1600);
 setTimeout(()=>observer?.disconnect(),45000);
}
