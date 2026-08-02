import{fillCollege,uid,toast,trackEvent,enforceUonMaintenance,watchUonMaintenance}from'./core.js?v=42.0.0';
await enforceUonMaintenance();watchUonMaintenance();
const API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/resource-upload-api';
const form=document.querySelector('#resourceUploadForm');
const input=document.querySelector('#resourceFiles');
const zone=document.querySelector('#resourceDropZone');
const preview=document.querySelector('#resourcePreview');
const progress=document.querySelector('#resourceProgress');
const submit=document.querySelector('#resourceSubmit');
const college=document.querySelector('#uploadCollege');
fillCollege(college,{other:true});
let files=[];
const sessionKey='uon_resource_upload_session_v42';let session=localStorage.getItem(sessionKey);if(!session){session=uid();localStorage.setItem(sessionKey,session)}
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function formatSize(bytes){return bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`}
function render(){preview.innerHTML=files.length?files.map((file,index)=>`<article class="list-item"><div><strong>${esc(file.name)}</strong><small>${formatSize(file.size)}</small></div><button class="btn danger" type="button" data-remove="${index}">حذف</button></article>`).join(''):'<div class="muted">لم يتم اختيار ملفات.</div>';preview.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{files.splice(Number(button.dataset.remove),1);render()})}
function addFiles(list){for(const file of list){if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){toast(`تم تجاهل ${file.name}: PDF فقط`,true);continue}if(file.size>20*1024*1024){toast(`تم تجاهل ${file.name}: أكبر من 20MB`,true);continue}if(!files.some(current=>current.name===file.name&&current.size===file.size))files.push(file)}render()}
zone.addEventListener('click',()=>input.click());zone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click()}});input.addEventListener('change',()=>addFiles(input.files||[]));
for(const type of['dragenter','dragover'])zone.addEventListener(type,event=>{event.preventDefault();zone.classList.add('active')});for(const type of['dragleave','drop'])zone.addEventListener(type,event=>{event.preventDefault();zone.classList.remove('active')});zone.addEventListener('drop',event=>addFiles(event.dataTransfer?.files||[]));
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!files.length)return toast('اختر ملف PDF واحدًا على الأقل',true);
 const base=new FormData(form);const course=String(base.get('course_code')||'').trim().toUpperCase().replace(/\s+/g,'');if(!/^[A-Z]{2,10}[0-9]{2,4}[A-Z]?$/.test(course))return toast('رمز المقرر غير صالح',true);
 submit.disabled=true;progress.hidden=false;let success=0,failed=0;
 for(let index=0;index<files.length;index++){
  const file=files[index];progress.textContent=`جاري رفع ${index+1} من ${files.length}: ${file.name}`;
  const data=new FormData();for(const[key,value]of base.entries())data.append(key,String(value));data.set('course_code',course);data.set('session_id',session);data.set('file',file);if(files.length>1&&!String(base.get('title')||'').includes(file.name))data.set('title',`${base.get('title')} — ${file.name.replace(/\.pdf$/i,'')}`);
  try{const response=await fetch(API,{method:'POST',body:data});const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.ok)throw new Error(payload.error||'تعذر رفع الملف');success++}catch(error){failed++;console.error(error);toast(`${file.name}: ${error.message}`,true)}
 }
 progress.textContent=`اكتمل الرفع: ${success} ناجح${failed?`، ${failed} فشل`:''}. الملفات الناجحة تنتظر مراجعة المشرف.`;trackEvent('resource_upload_batch_v42',{course,success,failed});if(success){files=[];render();input.value='';form.querySelector('[name="description"]').value=''}submit.disabled=false;
});
render();
