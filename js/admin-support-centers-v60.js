import {rpc,toast,esc} from './core.js?v=60.0.0';

const passwordKey='uon_admin_password';
const form=document.querySelector('#centerForm');
const list=document.querySelector('#centersAdminList');

function password(){
 const value=sessionStorage.getItem(passwordKey)||'';
 if(!value)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 return value;
}

async function action(name,{id=null,payload={}}={}){
 return rpc('uon_admin_catalog_action',{
  p_password:password(),
  p_entity:'support_centers',
  p_action:name,
  p_id:id,
  p_payload:payload
 });
}

function resetForm(){
 if(!form)return;
 form.reset();
 const id=document.querySelector('#centerId');
 const active=document.querySelector('#centerActive');
 if(id)id.value='';
 if(active)active.checked=true;
 form.querySelector('[type="submit"]')?.replaceChildren(document.createTextNode('حفظ'));
}

function payload(){
 return {
  name:document.querySelector('#centerName')?.value.trim()||'',
  description:document.querySelector('#centerDescription')?.value.trim()||'',
  booking_url:document.querySelector('#centerBookingUrl')?.value.trim()||'',
  location_url:document.querySelector('#centerLocationUrl')?.value.trim()||'',
  active:document.querySelector('#centerActive')?.checked!==false
 };
}

async function load(){
 if(!list)return;
 try{
  const result=await action('list');
  const rows=Array.isArray(result?.rows)?result.rows:[];
  list.innerHTML=rows.length?rows.map(row=>`<div class="list-row"><div><strong>${esc(row.name)}</strong><small>${row.active?'ظاهر للطلاب':'مخفي'}${row.booking_url?` • ${esc(row.booking_url)}`:''}</small></div><div class="actions"><button class="btn" type="button" data-center-edit="${esc(row.id)}">تعديل</button><button class="btn danger" type="button" data-center-delete="${esc(row.id)}">حذف</button></div></div>`).join(''):'<div class="empty">لا توجد مراكز دعم</div>';
  list.dataset.rows=JSON.stringify(rows);
 }catch(error){
  list.innerHTML=`<div class="empty">${esc(error.message||'تعذر تحميل المراكز')}</div>`;
 }
}

form?.addEventListener('submit',async event=>{
 event.preventDefault();
 event.stopImmediatePropagation();
 const submit=form.querySelector('[type="submit"]');
 const data=payload();
 if(!data.name){toast('اكتب اسم المركز',true);return}
 if(submit)submit.disabled=true;
 try{
  const id=document.querySelector('#centerId')?.value||null;
  await action(id?'update':'create',{id,payload:data});
  toast(id?'تم تحديث المركز':'تمت إضافة المركز');
  resetForm();
  await load();
 }catch(error){toast(error.message||'تعذر حفظ المركز',true)}
 finally{if(submit)submit.disabled=false}
},true);

document.addEventListener('click',async event=>{
 const edit=event.target.closest('[data-center-edit]');
 const del=event.target.closest('[data-center-delete]');
 if(!edit&&!del)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 const id=edit?.dataset.centerEdit||del?.dataset.centerDelete;
 if(edit){
  let rows=[];
  try{rows=JSON.parse(list?.dataset.rows||'[]')}catch{}
  const row=rows.find(item=>item.id===id);
  if(!row)return;
  document.querySelector('#centerId').value=row.id;
  document.querySelector('#centerName').value=row.name||'';
  document.querySelector('#centerDescription').value=row.description||'';
  document.querySelector('#centerBookingUrl').value=row.booking_url||'';
  document.querySelector('#centerLocationUrl').value=row.location_url||'';
  document.querySelector('#centerActive').checked=row.active!==false;
  form?.querySelector('[type="submit"]')?.replaceChildren(document.createTextNode('حفظ التعديلات'));
  form?.scrollIntoView({behavior:'smooth',block:'start'});
  return;
 }
 if(!confirm('حذف هذا المركز نهائيًا؟'))return;
 del.disabled=true;
 try{await action('delete',{id});toast('تم حذف المركز');await load()}
 catch(error){toast(error.message||'تعذر حذف المركز',true)}
 finally{del.disabled=false}
},true);

document.querySelector('[data-section="centers"]')?.addEventListener('click',load);
window.addEventListener('uon:admin-authenticated',load);
