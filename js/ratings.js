
import {$,get,insert,esc,toast,openModal,closeModal,notifyPending,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
let rows=[];
async function load(){
 rows=await get('rating_submissions','select=*&status=eq.approved&order=created_at.desc');
 render();trackEvent('page_view',{page:'ratings'});
}
function stars(n){return '★'.repeat(Math.round(Number(n)||0))+'☆'.repeat(5-Math.round(Number(n)||0))}
function render(){
 const q=$('#ratingSearch').value.toLowerCase();
 const filtered=rows.filter(x=>`${x.target_name||''} ${x.course_code||''}`.toLowerCase().includes(q));
 $('#ratingCards').innerHTML=filtered.length?filtered.map(x=>`<article class="card rating-card">
 <span class="badge">${x.target_type==='course'?'مقرر':'دكتور'}</span>
 <h3>${esc(x.target_name)}</h3><strong class="rating-stars">${stars(x.overall)}</strong>
 <small>${esc(x.course_code||'')}</small>
 <p>${esc(x.comment||'بدون تعليق')}</p>
 <div class="rating-metrics"><span>الشرح: ${x.teaching||'—'}</span><span>التعامل: ${x.interaction||'—'}</span><span>الصعوبة: ${x.exam_difficulty||'—'}</span></div>
 </article>`).join(''):'<div class="empty">لا توجد تقييمات معتمدة حاليًا</div>';
}
$('#ratingSearch').oninput=render;
$('#openRating').onclick=()=>openModal('ratingModal');$('#closeRating').onclick=()=>closeModal('ratingModal');
$('#ratingForm').onsubmit=async event=>{
 event.preventDefault();

 const form=event.target;
 const submitButton=form.querySelector('button[type="submit"],button:not([type])');
 const originalText=submitButton?.textContent||'إرسال للمراجعة';
 const body=Object.fromEntries(new FormData(form));

 ['overall','teaching','interaction','exam_difficulty'].forEach(key=>{
  if(body[key]!==''&&body[key]!==undefined)body[key]=Number(body[key]);
  else delete body[key];
 });

 body.target_type=body.target_type||'instructor';

 // Compatibility with the original rating_submissions schema.
 body.kind=body.target_type;
 body.overall_rating=body.overall;
 body.recommended=body.recommended==='true';
 body.status='pending';

 try{
  if(submitButton){
   submitButton.disabled=true;
   submitButton.textContent='جاري الإرسال...';
  }

  const result=await insert('rating_submissions',body);
  if(result?.[0]?.id)await notifyPending('rating_submissions',result[0].id);

  trackEvent('rating_submit',{target_type:body.target_type});
  toast('تم إرسال التقييم للمراجعة');
  form.reset();
  closeModal('ratingModal');
 }catch(error){
  console.error(error);
  const message=String(error?.message||'');

  if(/kind.*not-null|overall_rating.*not-null/i.test(message)){
   toast('تعذر إرسال التقييم بسبب عدم توافق قديم في قاعدة البيانات',true);
  }else{
   toast('تعذر إرسال التقييم، راجع البيانات وحاول مرة أخرى',true);
  }
 }finally{
  if(submitButton){
   submitButton.disabled=false;
   submitButton.textContent=originalText;
  }
 }
};
load();
