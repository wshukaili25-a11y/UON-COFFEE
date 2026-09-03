import {esc,toast} from './core.js?v=53.3.0';
import {adminRpc} from './admin-rpc-client.js?v=1.0.0';

const select=document.querySelector('#pendingTable');
const list=document.querySelector('#pendingList');
if(select && !select.querySelector('option[value="exam_questions"]')){
  const option=document.createElement('option');
  option.value='exam_questions'; option.textContent='بنك الأسئلة';
  select.append(option);
}

async function loadExamQuestions(){
  if(!list) return;
  list.innerHTML='<div class="empty">جاري تحميل الأسئلة…</div>';
  try{
    const rows=await adminRpc('uon_admin_pending_exam_questions');
    list.innerHTML=rows?.length?rows.map(x=>`<div class="list-row"><div><strong>${esc(x.subject||'بدون مادة')} — ${esc(x.text||'')}</strong><small>${esc(x.college||'عام')} • ${esc(x.type||'')} ${x.year?`• ${esc(x.year)}`:''}</small>${x.answer?`<small>الإجابة: ${esc(x.answer)}</small>`:''}</div><div class="actions"><button class="btn success" data-ok="${x.id}">قبول</button><button class="btn danger" data-no="${x.id}">رفض</button></div></div>`).join(''):'<div class="empty">لا توجد أسئلة بانتظار المراجعة</div>';
  }catch(error){list.innerHTML=`<div class="empty">${esc(error.message||'تعذر تحميل الأسئلة')}</div>`;}
}

select?.addEventListener('change',event=>{
  if(event.target.value!=='exam_questions')return;
  event.stopImmediatePropagation();
  loadExamQuestions();
},true);

document.addEventListener('click',async event=>{
  if(select?.value!=='exam_questions')return;
  const approve=event.target.closest('[data-ok]');
  const reject=event.target.closest('[data-no]');
  const target=approve||reject;
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  target.disabled=true;
  try{
    await adminRpc('uon_admin_moderate',{p_table:'exam_questions',p_id:String(approve?.dataset.ok||reject?.dataset.no),p_action:approve?'approve':'reject'});
    toast(approve?'تم اعتماد السؤال':'تم رفض السؤال');
    await loadExamQuestions();
  }catch(error){toast(error.message||'تعذر تنفيذ العملية',true)}finally{target.disabled=false}
},true);
