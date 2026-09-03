const loadDeferredCss=(href,id)=>{if(document.getElementById(id))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;link.media='print';link.onload=()=>{link.media='all'};document.head.appendChild(link)};
const idle=(fn,timeout=1800)=>{
 if('scheduler'in window&&typeof scheduler.postTask==='function'){
  scheduler.postTask(fn,{priority:'background',delay:0}).catch(()=>{});return;
 }
 if('requestIdleCallback'in window){requestIdleCallback(()=>fn(),{timeout});return}
 setTimeout(fn,Math.min(timeout,900));
};
const importQuiet=async(spec,label)=>{try{await import(spec)}catch(error){console.warn(label+' deferred load failed',error)}};
const runAfterPaint=()=>{
 // Stage 1: only runtime/PWA work shortly after the page is visually ready.
 idle(()=>{void Promise.allSettled([
  importQuiet('./runtime-guard.js?v=64.4.1','Runtime guard'),
  importQuiet('./pwa-init.js?v=64.4.1','PWA')
 ])},1400);

 // Stage 2: optional experience/reporting code waits longer so it cannot compete
 // with the home feed, scrolling, or the first user interaction.
 const stageTwo=()=>{
  loadDeferredCss('css/content-reports.css?v=31.2.0','contentReportsDeferredStyle');
  void Promise.allSettled([
   importQuiet('./v20-experience.js?v=64.4.1','Home experience'),
   importQuiet('./content-reports.js?v=64.4.1','Content reports')
  ]);
 };
 let started=false;
 const startOnce=()=>{if(started)return;started=true;idle(stageTwo,4200)};
 ['pointerdown','keydown','touchstart'].forEach(type=>window.addEventListener(type,startOnce,{once:true,passive:true}));
 setTimeout(startOnce,3200);
};
if(document.readyState==='complete')runAfterPaint();
else window.addEventListener('load',runAfterPaint,{once:true});