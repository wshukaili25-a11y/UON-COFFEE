const shown=new Set();

(function installGreenRedesign(){
 const body=document.body;
 if(body?.classList.contains('admin-page')||body?.classList.contains('owner42')||body?.classList.contains('admin53'))return;
 if(document.querySelector('link[data-uon-green-system]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href='/css/uon-green-system-v1.css?v=1.0.0';
 link.dataset.uonGreenSystem='1';
 document.head.append(link);
})();

(function simplifyAssistantGoogleUi(){
 if(!/\/assistant\.html$/i.test(location.pathname))return;
 const clean=()=>{
  document.querySelector('.assistant-google-connect')?.remove();
  document.querySelector('.assistant-smart-actions')?.remove();
  const copy=document.querySelector('.assistant-side-head p');
  if(copy)copy.textContent='اسأل عن الجامعة والمقررات والخدمات والمصادر الموثوقة، واستفد من جدولك ومهامك المحلية داخل UON Hub.';
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean,{once:true});else clean();
})();

function showMessage(message,type='error'){
 const key=`${type}:${message}`;
 if(shown.has(key))return;
 shown.add(key);
 let box=document.querySelector('#runtimeGuardMessage');
 if(!box){
  box=document.createElement('div');
  box.id='runtimeGuardMessage';
  box.className='runtime-guard-message';
  box.innerHTML='<button aria-label="إغلاق">✕</button><strong></strong><p></p>';
  document.body.appendChild(box);
  box.querySelector('button').onclick=()=>box.classList.remove('show');
 }
 box.dataset.type=type;
 box.querySelector('strong').textContent=type==='offline'?'لا يوجد اتصال بالإنترنت':'حدث خطأ بسيط';
 box.querySelector('p').textContent=message;
 box.classList.add('show');
 setTimeout(()=>box.classList.remove('show'),5000);
}

addEventListener('offline',()=>showMessage('تحقق من الاتصال ثم حاول مرة أخرى.','offline'));
addEventListener('online',()=>{
 const box=document.querySelector('#runtimeGuardMessage');
 if(box){
  box.dataset.type='success';
  box.querySelector('strong').textContent='عاد الاتصال';
  box.querySelector('p').textContent='يمكنك متابعة استخدام المنصة.';
  box.classList.add('show');
  setTimeout(()=>box.classList.remove('show'),2500);
 }
});
addEventListener('unhandledrejection',event=>{
 console.error('Unhandled promise rejection:',event.reason);
 if(!navigator.onLine)return;
 const technical=String(event.reason?.message||event.reason||'');
 if(/COURSES_FEATURE_DISABLED|FEATURE_DISABLED/i.test(technical))return;
 showMessage('تعذر إكمال العملية حاليًا. حدّث الصفحة أو حاول مرة أخرى.');
});
addEventListener('error',event=>console.error('Runtime error:',event.error||event.message));
