import {
 whatsappShare,
 reportBrokenLink,
 installErrorCapture,
 setupNav,
 enforceUonMaintenance,
 watchUonMaintenance,
 $,
 get,
 insert,
 submitPending,
 notifyPending,
 toast,
 fillCollege,
 esc,
 openModal,
 closeModal,
 trackEvent
} from './core.js';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

const search=$('#search');
const collegeFilter=$('#collegeFilter');
const collegeInput=$('#collegeInput');
const openButton=$('#openForm');
const closeButton=$('#closeForm');
const form=$('#submitForm');
const items=$('#items');

if(collegeFilter)fillCollege(collegeFilter);
if(collegeInput)fillCollege(collegeInput);

let rows=[];

async function load(){
 try{
  rows=await get('summaries','select=*&approved=eq.true&order=created_at.desc');
  render();
  trackEvent('page_view',{page:'summaries'});
 }catch(error){
  console.error(error);
  toast('تعذر تحميل الملخصات حاليًا',true);
 }
}

function render(){
 if(!items)return;

 const query=(search?.value||'').trim().toLowerCase();
 const college=collegeFilter?.value||'';

 const list=rows.filter(item=>
  (!college||item.college===college)&&
  `${item.title||''} ${item.subject||''} ${item.course_code||''}`
   .toLowerCase()
   .includes(query)
 );

 items.innerHTML=list.length
  ?list.map(item=>{
   const title=item.title||'ملخص أو اختبار';
   const url=item.url||item.link||'';
   const type=item.resource_type||item.content_type||'ملف';

   return `<article class="card item-card">
    <div class="item-card-head">
     <span class="badge">${esc(type)}</span>
     <small>${esc(item.college||'')}</small>
    </div>
    <h3>${esc(title)}</h3>
    <p>${esc(item.subject||item.course_code||'')} ${item.description?`— ${esc(item.description)}`:''}</p>
    <div class="resource-actions">
     ${url?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(url)}">فتح الملف</a>`:''}
     ${url?`<a class="btn" target="_blank" rel="noopener" href="${whatsappShare(title,url)}">مشاركة</a>`:''}
     ${url?`<button type="button" class="btn danger"
       data-report-table="summaries"
       data-report-id="${item.id}"
       data-report-title="${esc(title)}"
       data-report-url="${esc(url)}">بلاغ عن الرابط</button>`:''}
    </div>
   </article>`;
  }).join('')
  :'<div class="empty">لا توجد نتائج</div>';
}

search?.addEventListener('input',render);
collegeFilter?.addEventListener('change',render);

openButton?.addEventListener('click',event=>{
 event.preventDefault();
 openModal('submitModal');
});

closeButton?.addEventListener('click',event=>{
 event.preventDefault();
 closeModal('submitModal');
});

$('#submitModal')?.addEventListener('click',event=>{
 if(event.target.id==='submitModal')closeModal('submitModal');
});

form?.addEventListener('submit',async event=>{
 event.preventDefault();

 const submitButton=form.querySelector('button[type="submit"],button:not([type])');
 const originalText=submitButton?.textContent||'إرسال للمشرف';

 const body=Object.fromEntries(new FormData(form));
 body.approved=false;

 // Compatibility with newer course-center queries.
 if(body.subject&&!body.course_code)body.course_code=String(body.subject).trim().toUpperCase();
 if(body.resource_type&&!body.content_type){
  body.content_type=body.resource_type==='اختبار'?'exam':'summary';
 }

 try{
  if(submitButton){
   submitButton.disabled=true;
   submitButton.textContent='جاري الإرسال...';
  }

  const data=await submitPending('summaries',body);
  await notifyPending('summaries',data.id);

  toast('تم إرسال الملف للمراجعة');
  form.reset();
  if(collegeInput)fillCollege(collegeInput);
  closeModal('submitModal');
  trackEvent('summary_submit',{
   course_code:body.course_code||body.subject||'',
   resource_type:body.resource_type||''
  });
 }catch(error){
  console.error(error);
  const message=String(error?.message||'');
  toast(
   /row-level security|policy/i.test(message)
    ?'تعذر الإرسال بسبب صلاحيات قاعدة البيانات'
    :'تعذر إرسال الملف، تحقق من البيانات والرابط',
   true
  );
 }finally{
  if(submitButton){
   submitButton.disabled=false;
   submitButton.textContent=originalText;
  }
 }
});

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-report-table]');
 if(!button)return;

 reportBrokenLink({
  sourceTable:button.dataset.reportTable,
  sourceId:button.dataset.reportId,
  title:button.dataset.reportTitle,
  url:button.dataset.reportUrl
 });
});

load();
