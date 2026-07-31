import {$,get,submitPending,esc,toast,openModal,closeModal,notifyPending,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
let rows=[];
const num=v=>Number(v)||0;
async function load(){
 rows=await get('rating_submissions','select=*&status=eq.approved&order=created_at.desc').catch(()=>[]);
 render();trackEvent('page_view',{page:'ratings'});
}
function stars(n){const x=Math.max(0,Math.min(5,Math.round(num(n))));return '★'.repeat(x)+'☆'.repeat(5-x)}
function renderSummary(list){
 const box=$('#ratingSummary');if(!box)return;
 const avg=list.length?list.reduce((a,x)=>a+num(x.overall||x.overall_rating),0)/list.length:0;
 const recommended=list.length?Math.round(list.filter(x=>x.recommended===true||x.recommended==='true').length/list.length*100):0;
 const instructors=list.filter(x=>(x.target_type||x.kind)==='instructor').length;
 box.innerHTML=`<article class="card stat"><span>متوسط التقييم</span><strong>${avg.toFixed(1)} / 5</strong></article><article class="card stat"><span>نسبة التوصية</span><strong>${recommended}%</strong></article><article class="card stat"><span>تقييمات الدكاترة</span><strong>${instructors}</strong></article>`;
}
function render(){
 const q=($('#ratingSearch')?.value||'').toLowerCase().trim();
 const type=$('#ratingType')?.value||'';
 const sort=$('#ratingSort')?.value||'recent';
 let filtered=rows.filter(x=>{
  const rowType=x.target_type||x.kind||'instructor';
  const text=`${x.target_name||''} ${x.course_code||''} ${x.comment||''}`.toLowerCase();
  return (!type||rowType===type)&&(!q||text.includes(q));
 });
 filtered=[...filtered].sort((a,b)=>{
  if(sort==='top')return num(b.overall||b.overall_rating)-num(a.overall||a.overall_rating);
  if(sort==='recommended')return Number(Boolean(b.recommended))-Number(Boolean(a.recommended));
  return new Date(b.created_at||0)-new Date(a.created_at||0);
 });
 renderSummary(filtered);
 $('#ratingCards').innerHTML=filtered.length?filtered.map(x=>{const rowType=x.target_type||x.kind;return `<article class="card rating-card">
 <span class="badge">${rowType==='course'?'مقرر':'دكتور'}</span>
 <h3>${esc(x.target_name||'غير محدد')}</h3><strong class="rating-stars">${stars(x.overall||x.overall_rating)}</strong>
 <small>${esc(x.course_code||'')}</small>
 <p>${esc(x.comment||'بدون تعليق')}</p>
 <div class="rating-metrics"><span>الشرح: ${x.teaching||'—'}</span><span>التعامل: ${x.interaction||'—'}</span><span>الصعوبة: ${x.exam_difficulty||'—'}</span><span>${x.recommended===true||x.recommended==='true'?'✅ ينصح به':'➖ بدون توصية'}</span></div>
 </article>`}).join(''):'<div class="empty">لا توجد تقييمات مطابقة</div>';
}
['ratingSearch','ratingType','ratingSort'].forEach(id=>$('#'+id)?.addEventListener(id==='ratingSearch'?'input':'change',render));
$('#openRating').onclick=()=>openModal('ratingModal');$('#closeRating').onclick=()=>closeModal('ratingModal');
$('#ratingForm').onsubmit=async event=>{
 event.preventDefault();const form=event.target;const submitButton=form.querySelector('button[type="submit"]');const originalText=submitButton?.textContent||'إرسال للمراجعة';
 const body=Object.fromEntries(new FormData(form));['overall','teaching','interaction','exam_difficulty'].forEach(k=>{if(body[k]!=='')body[k]=Number(body[k]);else delete body[k]});
 body.target_type=body.target_type||'instructor';body.kind=body.target_type;body.overall_rating=body.overall;body.recommended=body.recommended==='true';body.status='pending';
 try{if(submitButton){submitButton.disabled=true;submitButton.textContent='جاري الإرسال...'}const result=await submitPending('rating_submissions',body);await notifyPending('rating_submissions',result.id);trackEvent('rating_submit',{target_type:body.target_type});toast('تم إرسال التقييم للمراجعة');form.reset();closeModal('ratingModal')}
 catch(error){console.error(error);toast('تعذر إرسال التقييم، راجع البيانات وحاول مرة أخرى',true)}
 finally{if(submitButton){submitButton.disabled=false;submitButton.textContent=originalText}}
};
load();
