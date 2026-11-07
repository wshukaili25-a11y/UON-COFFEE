import{emailAvailable,openEmailDialog}from'./summary-email.js';
// "Send my schedule to my email" on the schedule page. Hidden until email delivery is live.
const MAX_IMAGE=1_500_000;
const rows=()=>window.UONScheduleExport?.rows?.()||[];
const title=()=>{try{return window.UONScheduleProfiles?.active?.()?.name||'جدولي الدراسي'}catch{return 'جدولي الدراسي'}};
async function imageBase64(){
 const blob=await window.UONScheduleExport?.imageBlob?.();
 if(!blob||blob.size>MAX_IMAGE)return{};
 const buffer=new Uint8Array(await blob.arrayBuffer());let raw='';
 for(let i=0;i<buffer.length;i+=8192)raw+=String.fromCharCode(...buffer.subarray(i,i+8192));
 return{image:btoa(raw)};
}
function open(){
 const list=rows();
 const toast=document.querySelector('#toast');
 if(!list.length){if(toast){toast.textContent='أضف مادة واحدة على الأقل قبل إرسال الجدول.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000)}return}
 openEmailDialog({kind:'schedule',title:title(),request:()=>({schedule:{title:title(),rows:rows()}}),verifyExtra:imageBase64});
}
const triggers=[...document.querySelectorAll('[data-email-schedule]')];
triggers.forEach(el=>el.addEventListener('click',event=>{event.preventDefault();el.closest('details')?.removeAttribute('open');open()}));
emailAvailable().then(ready=>{if(ready)triggers.forEach(el=>{el.hidden=false})});
