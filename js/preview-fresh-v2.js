const host=location.hostname;
const isBranchPreview=host.includes('git-redesign-')||(/\.vercel\.app$/i.test(host)&&host!=='uon-hub.vercel.app'&&host!=='www.uon-hub.vercel.app');

if(isBranchPreview&&'serviceWorker'in navigator){
 try{
  const regs=await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(regs.map(reg=>reg.unregister()));
  if('caches'in window){
   const keys=await caches.keys();
   await Promise.allSettled(keys.filter(key=>/^uonhub-(static|pages|data)-/i.test(key)).map(key=>caches.delete(key)));
  }
 }catch(error){console.warn('Preview cache cleanup skipped',error)}
}
