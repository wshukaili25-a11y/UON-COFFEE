import {esc,toast} from './core.js?v=53.3.0';
import {adminRpc} from './admin-rpc-client.js?v=1.0.0';

const $=selector=>document.querySelector(selector);
const pendingSelect=$('#pendingTable');
const pendingList=$('#pendingList');

if(pendingSelect&&!pendingSelect.querySelector('option[value="marketplace"]')){
 const option=document.createElement('option');
 option.value='marketplace';
 option.textContent='سوق الطلاب';
 pendingSelect.append(option);
}

async function loadMarketplacePending(){
 if(!pendingList)return;
 pendingList.innerHTML='<div class="empty">جاري تحميل إعلانات السوق…</div>';
 try{
  const rows=await adminRpc('uon_admin_pending_marketplace');
  pendingList.innerHTML=rows?.length?rows.map(item=>`<div class="list-row"><div><strong>${esc(item.title||'إعلان بدون عنوان')}</strong><small>${esc(item.type||'')} • ${esc(item.condition||'')} • ${item.price==null?'—':esc(item.price)} ر.ع</small><small>${esc(item.description||'بدون وصف')}</small><small dir="ltr">${esc(item.phone||'')}</small></div><div class="actions"><button class="btn success" type="button" data-ok="${item.id}">قبول</button><button class="btn danger" type="button" data-no="${item.id}">رفض</button></div></div>`).join(''):'<div class="empty">لا توجد إعلانات سوق بانتظار المراجعة</div>';
 }catch(error){pendingList.innerHTML=`<div class="empty">${esc(error.message||'تعذر تحميل الإعلانات')}</div>`;toast(error.message||'تعذر تحميل إعلانات السوق',true)}
}

document.addEventListener('change',event=>{
 if(event.target!==pendingSelect||pendingSelect.value!=='marketplace')return;
 event.preventDefault();
 event.stopImmediatePropagation();
 loadMarketplacePending();
},true);

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-ok],[data-no]');
 if(!button||pendingSelect?.value!=='marketplace')return;
 event.preventDefault();
 event.stopImmediatePropagation();
 const id=button.dataset.ok||button.dataset.no;
 const action=button.dataset.ok?'approve':'reject';
 button.disabled=true;
 adminRpc('uon_admin_moderate',{p_table:'marketplace',p_id:String(id),p_action:action})
  .then(()=>{toast(action==='approve'?'تم اعتماد الإعلان':'تم رفض الإعلان');return loadMarketplacePending()})
  .catch(error=>toast(error.message||'تعذر تنفيذ العملية',true))
  .finally(()=>{button.disabled=false});
},true);
