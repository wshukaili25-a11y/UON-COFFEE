const runAfterPaint=()=>{
 const load=()=>Promise.allSettled([
  import('./v20-experience.js?v=49.0.0'),
  import('./pwa-init.js?v=49.0.0'),
  import('./content-reports.js?v=49.0.0')
 ]).then(results=>{
  results.forEach((result,index)=>{
   if(result.status==='rejected')console.warn(['Home experience','PWA','Content reports'][index]+' deferred load failed',result.reason);
  });
 });
 if('requestIdleCallback'in window){
  requestIdleCallback(()=>{void load()},{timeout:1600});
 }else{
  setTimeout(()=>{void load()},700);
 }
};

if(document.readyState==='complete')runAfterPaint();
else window.addEventListener('load',runAfterPaint,{once:true});
