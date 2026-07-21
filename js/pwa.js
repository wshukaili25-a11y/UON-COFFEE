
export function setupPWA(){
 if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(console.warn);
 let deferred;
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const b=document.querySelector('#installApp');if(b)b.hidden=false});
 document.querySelector('#installApp')?.addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;document.querySelector('#installApp').hidden=true});
}
