
export function setupPWA(){
 if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js?v=10').catch(console.warn);
 }

 let deferredPrompt=null;
 const button=document.querySelector('#installApp');

 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredPrompt=event;
  if(button)button.hidden=false;
 });

 button?.addEventListener('click',async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  button.hidden=true;
 });
}
