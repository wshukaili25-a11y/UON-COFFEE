
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
 event.preventDefault();const body=Object.fromEntries(new FormData(event.target));
 ['overall','teaching','interaction','exam_difficulty'].forEach(k=>{if(body[k])body[k]=Number(body[k])});
 body.recommended=body.recommended==='true';body.status='pending';
 try{const r=await insert('rating_submissions',body);await notifyPending('rating_submissions',r[0].id);trackEvent('rating_submit',{target_type:body.target_type});toast('تم إرسال التقييم للمراجعة');event.target.reset();closeModal('ratingModal')}catch(e){toast(e.message,true)}
};
load();
