import './admin.js?v=30.0.3';
import './admin-questions-v53.js?v=53.3.0';
import './admin-marketplace-v53.js?v=53.3.0';
import './admin-review-summary-v53.js?v=53.3.0';
import './admin-support-centers-v60.js?v=60.0.0';
import {rpc,toast} from './core.js?v=30.0.1';

const passwordKey='uon_admin_password';
const getPassword=()=>sessionStorage.getItem(passwordKey)||'';
const reload=()=>location.reload();

document.querySelectorAll('.admin-section.active').forEach(section=>section.classList.remove('active'));
document.querySelector('#sec-overview')?.classList.add('active');

document.querySelector('#logout')?.addEventListener('click',()=>{
 sessionStorage.removeItem(passwordKey);
 sessionStorage.removeItem('uon_admin');
},true);

if(sessionStorage.getItem('uon_admin')==='1'&&!getPassword()){
 sessionStorage.removeItem('uon_admin');
 location.reload();
}

async function requirePassword(){
 const password=getPassword();
 if(!password)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 return password;
}

async function run(button,task,success,{refresh=true}={}){
 if(button)button.disabled=true;
 try{
  await task();
  toast(success);
  if(refresh)setTimeout(reload,250);
 }catch(error){toast(error.message||'تعذر تنفيذ العملية',true)}
 finally{if(button)button.disabled=false}
}

function formPayload(form){
 return Object.fromEntries(new FormData(form).entries());
}

document.addEventListener('click',event=>{
 const button=event.target.closest('#saveSite');
 if(!button)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 run(button,async()=>rpc('uon_admin_save_site_settings',{
  p_password:await requirePassword(),
  p_settings:{
   maintenance_enabled:document.querySelector('#maintenance')?.checked||false,
   maintenance_message:document.querySelector('#maintenanceMessage')?.value||'',
   maintenance_until:document.querySelector('#maintenanceUntil')?.value||null,
   whatsapp_channel_url:document.querySelector('#whatsappUrl')?.value||'',
   instagram_url:document.querySelector('#instagramUrl')?.value||''
  }
 }),'تم حفظ إعدادات الموقع بأمان');
},true);

document.addEventListener('change',event=>{
 const select=event.target;
 if(!(select instanceof HTMLSelectElement))return;
 if(select.matches('[data-feature]')){
  event.stopImmediatePropagation();
  run(select,async()=>rpc('uon_admin_set_feature',{
   p_password:await requirePassword(),p_key:select.dataset.feature,p_status:select.value
  }),'تم تحديث الخدمة');
 }
 if(select.matches('[data-tool]')){
  event.stopImmediatePropagation();
  run(select,async()=>rpc('uon_admin_set_tool',{
   p_password:await requirePassword(),p_tool_id:select.dataset.tool,p_status:select.value
  }),'تم تحديث الأداة');
 }
},true);

document.addEventListener('click',event=>{
 const approve=event.target.closest('[data-ok]');
 const reject=event.target.closest('[data-no]');
 const suggestionReview=event.target.closest('[data-sug-ok]');
 const suggestionDelete=event.target.closest('[data-sug-del]');
 const target=approve||reject||suggestionReview||suggestionDelete;
 if(!target)return;
 event.preventDefault();event.stopImmediatePropagation();
 const table=suggestionReview||suggestionDelete?'feature_suggestions':document.querySelector('#pendingTable')?.value;
 const id=approve?.dataset.ok||reject?.dataset.no||suggestionReview?.dataset.sugOk||suggestionDelete?.dataset.sugDel;
 const action=approve?'approve':reject?'reject':suggestionReview?'review':'delete';
 run(target,async()=>rpc('uon_admin_moderate',{
  p_password:await requirePassword(),p_table:table,p_id:String(id),p_action:action
 }),action==='approve'?'تم القبول':action==='review'?'تمت المراجعة':action==='delete'?'تم الحذف':'تم الرفض');
},true);

document.addEventListener('click',event=>{
 const add=event.target.closest('#addAd');
 const toggle=event.target.closest('[data-togglead]');
 const del=event.target.closest('[data-delad]');
 const target=add||toggle||del;
 if(!target)return;
 event.preventDefault();event.stopImmediatePropagation();
 const action=add?'create':toggle?'toggle':'delete';
 const id=toggle?.dataset.togglead||del?.dataset.delad||null;
 const payload=add?{
  title:document.querySelector('#adTitle')?.value||'',
  body:document.querySelector('#adBody')?.value||'',
  button_url:document.querySelector('#adUrl')?.value||'',
  starts_at:document.querySelector('#adStartsAt')?.value||'',
  ends_at:document.querySelector('#adEndsAt')?.value||'',
  priority:10
 }:{};
 run(target,async()=>rpc('uon_admin_announcement',{
  p_password:await requirePassword(),p_action:action,p_id:id,p_payload:payload
 }),action==='create'?'تمت إضافة الإعلان':action==='toggle'?'تم تحديث حالة الإعلان':'تم حذف الإعلان');
},true);

document.addEventListener('click',event=>{
 const add=event.target.closest('#addTg');
 const del=event.target.closest('[data-deltg]');
 const target=add||del;
 if(!target)return;
 event.preventDefault();event.stopImmediatePropagation();
 const action=add?'create':'delete';
 const payload=add?{
  name:document.querySelector('#tgName')?.value||'',
  chat_id:document.querySelector('#tgChat')?.value||'',
  role:document.querySelector('#tgRole')?.value||'moderator'
 }:{};
 run(target,async()=>rpc('uon_admin_catalog_action',{
  p_password:await requirePassword(),p_entity:'telegram_admins',p_action:action,
  p_id:del?.dataset.deltg||null,p_payload:payload
 }),action==='create'?'تمت إضافة المشرف':'تم حذف المشرف');
},true);

document.addEventListener('click',event=>{
 const mappings=[
  ['[data-cal-del]','academic_calendar_events','calDel','تم حذف الموعد'],
  ['[data-course-del]','courses','courseDel','تم حذف المادة'],
  ['[data-notify-del]','site_notifications','notifyDel','تم حذف الإشعار']
 ];
 for(const [selector,entity,key,message] of mappings){
  const target=event.target.closest(selector);
  if(!target)continue;
  event.preventDefault();event.stopImmediatePropagation();
  run(target,async()=>rpc('uon_admin_catalog_action',{
   p_password:await requirePassword(),p_entity:entity,p_action:'delete',p_id:target.dataset[key],p_payload:{}
  }),message);
  return;
 }
},true);

document.addEventListener('submit',event=>{
 const form=event.target;
 const map={
  calendarForm:['academic_calendar_events','تمت إضافة الموعد'],
  notificationForm:['site_notifications','تم نشر الإشعار']
 };
 const config=map[form.id];
 if(!config)return;
 event.preventDefault();event.stopImmediatePropagation();
 const [entity,message]=config;
 const submit=form.querySelector('[type="submit"],button');
 run(submit,async()=>rpc('uon_admin_catalog_action',{
  p_password:await requirePassword(),p_entity:entity,p_action:'create',p_id:null,p_payload:formPayload(form)
 }),message);
},true);

document.addEventListener('submit',event=>{
 const form=event.target;
 if(!['anjizSettings','masalikSettings'].includes(form.id))return;
 event.preventDefault();event.stopImmediatePropagation();
 const prefix=form.id==='anjizSettings'?'anjiz':'masalik';
 const data=formPayload(form);
 const submit=form.querySelector('[type="submit"],button');
 run(submit,async()=>rpc('uon_admin_save_site_settings',{
  p_password:await requirePassword(),
  p_settings:{
   [`${prefix}_title`]:data.title||'',
   [`${prefix}_description`]:data.description||'',
   [`${prefix}_booking_url`]:data.booking_url||'',
   [`${prefix}_cta`]:data.cta||''
  }
 }),'تم حفظ بيانات المركز');
},true);