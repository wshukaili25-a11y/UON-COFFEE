const loadDeferredCss=(href,id)=>{if(document.getElementById(id))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;link.media='print';link.onload=()=>{link.media='all'};document.head.appendChild(link)};
const runAfterPaint=()=>{
 const load=()=>{loadDeferredCss('css/content-reports.css?v=31.2.0','contentReportsDeferredStyle');return Promise.allSettled([
  import('./runtime-guard.js?v=49.0.1'),
  import('./v20-experience.js?v=49.0.1'),
  import('./pwa-init.js?v=49.0.1'),
  import('./content-reports.js?v=49.0.1')
 ]).then(results=>{
  const labels=['Runtime guard','Home experience','PWA','Content reports'];
  results.forEach((result,index)=>{
   if(result.status==='rejected')console.warn(labels[index]+' deferred load failed',result.reason);
  });
 })};
 if('requestIdleCallback'in window){
  requestIdleCallback(()=>{void load()},{timeout:1600});
 }else{
  setTimeout(()=>{void load()},700);
 }
};
if(document.readyState==='complete')runAfterPaint();
else window.addEventListener('load',runAfterPaint,{once:true});