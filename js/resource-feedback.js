import {insert,get,toast,esc} from './core.js?v=31.1.0';
function sessionId(){let id=localStorage.getItem('uon_anon_session');if(!id){id=crypto.randomUUID();localStorage.setItem('uon_anon_session',id)}return id}
export async function submitResourceFeedback(resourceTable,resourceId,{useful=null,rating=null,comment=''}={}){
 const payload={resource_table:resourceTable,resource_id:String(resourceId),session_id:sessionId(),useful,rating,comment,status:'approved'};
 try{await insert('resource_feedback',payload,{returning:false});toast('شكرًا، تم حفظ تقييمك');return true}catch(e){
  if(/duplicate|unique/i.test(String(e.message))){toast('سبق وقيّمت هذا الملف');return false}toast('تعذر حفظ التقييم',true);return false
 }
}
export function mountFeedback(root=document){
 root.addEventListener('click',async e=>{
  const b=e.target.closest('[data-feedback]');if(!b)return;
  const rating=b.dataset.rating?Number(b.dataset.rating):null;
  await submitResourceFeedback(b.dataset.table,b.dataset.id,{useful:b.dataset.feedback==='useful'?true:b.dataset.feedback==='not-useful'?false:null,rating});
 });
}
