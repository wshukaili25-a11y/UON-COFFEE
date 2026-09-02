import './admin-schedule-sections-v54.js?v=54.0.0';
import {rpc,esc} from './core.js?v=53.3.0';

const labels={
 summaries:'الملخصات',
 whatsapp_groups:'المجموعات',
 student_projects:'المشاريع',
 rating_submissions:'التقييمات',
 confessions:'الاعترافات',
 exam_questions:'بنك الأسئلة',
 marketplace:'سوق الطلاب'
};

async function renderPendingSummary(){
 const host=document.querySelector('#stats');
 if(!host)return;
 const password=sessionStorage.getItem('uon_admin_password')||'';
 if(!password)return;
 try{
  const counts=await rpc('uon_admin_pending_counts',{p_password:password});
  const total=Object.values(counts||{}).reduce((sum,value)=>sum+Number(value||0),0);
  let card=document.querySelector('#adminPendingSummaryV53');
  if(!card){
   card=document.createElement('div');
   card.id='adminPendingSummaryV53';
   card.className='card stat';
   host.prepend(card);
  }
  const detail=Object.entries(counts||{})
   .filter(([,value])=>Number(value||0)>0)
   .map(([key,value])=>`${esc(labels[key]||key)}: ${Number(value||0)}`)
   .join(' • ');
  card.innerHTML=`<span>بانتظار المراجعة</span><strong>${total}</strong><small>${detail||'لا توجد طلبات معلقة'}</small>`;
 }catch{}
}

document.addEventListener('DOMContentLoaded',renderPendingSummary,{once:true});
window.addEventListener('uon:admin-review-refresh',renderPendingSummary);
setTimeout(renderPendingSummary,500);
