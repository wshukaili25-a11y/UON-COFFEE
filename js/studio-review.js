document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{document.body.dataset.size=button.dataset.size;document.querySelectorAll('[data-size]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)))}));

const pagePicker=document.querySelector('#studioPage'),frame=document.querySelector('#studioFrame'),openPage=document.querySelector('#studioOpen');
pagePicker.addEventListener('change',()=>{frame.src=pagePicker.value;openPage.href=pagePicker.value});
frame.addEventListener('load',()=>{try{const page=frame.contentWindow.location.pathname.split('/').pop()||'index.html';if([...pagePicker.options].some(option=>option.value===page))pagePicker.value=page;openPage.href=frame.contentWindow.location.href}catch{}});
