import './admin.js?v=30.0.3';
import './admin-questions-v53.js?v=53.4.0';
import './admin-marketplace-v53.js?v=53.4.0';
import './admin-review-summary-v53.js?v=53.4.0';
import './admin-support-centers-v60.js?v=60.1.0';
import {toast} from './core.js?v=30.0.1';
import {adminRpc} from './admin-rpc-client.js?v=1.0.0';

const passwordKey='uon_admin_password';
const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
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

async function callAdminApi(payload={}){
 const password=await requirePassword();
 const response=await fetch(`${SUPABASE_URL}/functions/v1/admin-api`,{
  method:'POST',
  headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json','x-admin-password':password},
  body:JSON.stringify(payload),
  cache:'no-store'
 });
 const text=await response.text();
 let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
 if(response.status===401){
  sessionStorage.removeItem(passwordKey);
  sessionStorage.removeItem('uon_admin');
  sessionStorage.removeItem('uon_admin_session');
 }
 if(!response.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${response.status}`);
 return data;
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
 run(button,async()=>adminRpc('uon_admin_save_site_settings',{
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
  run(select,async()=>adminRpc('uon_admin_set_feature',{
   p_key:select.dataset.feature,p_status:select.value
  }),'تم تحديث الخدمة');
 }
 if(select.matches('[data-tool]')){
  event.stopImmediatePropagation();
  run(select,async()=>adminRpc('uon_admin_set_tool',{
   p_tool_id:select.dataset.tool,p_status:select.value
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
 run(target,async()=>{
  if(table==='summaries'&&(action==='approve'||action==='reject')){
   return callAdminApi({action:'summary_moderate',id:String(id),moderation_action:action});
  }
  return adminRpc('uon_admin_moderate',{
   p_table:table,p_id:String(id),p_action:action
  });
 },action==='approve'?'تم القبول':action==='review'?'تمت المراجعة':action==='delete'?'تم الحذف':'تم الرفض');
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
 run(target,async()=>adminRpc('uon_admin_announcement',{
  p_action:action,p_id:id,p_payload:payload
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
 run(target,async()=>adminRpc('uon_admin_catalog_action',{
  p_entity:'telegram_admins',p_action:action,
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
  run(target,async()=>adminRpc('uon_admin_catalog_action',{
   p_entity:entity,p_action:'delete',p_id:target.dataset[key],p_payload:{}
  }),message);
  return;
 }
},true);

document.addEventListener('submit',event=>{
 const form=event.target;
 if(!['calendarForm','siteNotificationForm'].includes(form.id))return;
 event.preventDefault();event.stopImmediatePropagation();
 let entity,payload,message;
 if(form.id==='calendarForm'){
  const raw=formPayload(form);
  const start=String(raw.start_at||'');
  const end=String(raw.end_at||'');
  entity='academic_calendar_events';
  payload={
   title:String(raw.title||'').trim(),
   start_date:start.slice(0,10),
   end_date:(end||start).slice(0,10),
   event_type:'other',
   description:[String(raw.description||'').trim(),raw.location?`الموقع: ${String(raw.location).trim()}`:''].filter(Boolean).join('\n')
  };
  message='تمت إضافة الموعد';
 }else{
  const type=document.querySelector('#siteNotificationType')?.value||'info';
  const icons={info:'🔔',important:'⚠️',urgent:'🚨'};
  entity='site_notifications';
  payload={
   title:document.querySelector('#siteNotificationTitle')?.value.trim()||'',
   body:document.querySelector('#siteNotificationMessage')?.value.trim()||'',
   url:document.querySelector('#siteNotificationUrl')?.value.trim()||'',
   icon:icons[type]||'🔔'
  };
  message='تم نشر الإشعار';
 }
 const submit=form.querySelector('[type="submit"],button');
 run(submit,async()=>adminRpc('uon_admin_catalog_action',{
  p_entity:entity,p_action:'create',p_id:null,p_payload:payload
 }),message);
},true);

document.addEventListener('submit',event=>{
 const form=event.target;
 if(!['anjizSettings','masalikSettings'].includes(form.id))return;
 event.preventDefault();event.stopImmediatePropagation();
 const prefix=form.id==='anjizSettings'?'anjiz':'masalik';
 const data=formPayload(form);
 const submit=form.querySelector('[type="submit"],button');
 run(submit,async()=>adminRpc('uon_admin_save_site_settings',{
  p_settings:{
   [`${prefix}_title`]:data.title||'',
   [`${prefix}_description`]:data.description||'',
   [`${prefix}_booking_url`]:data.booking_url||'',
   [`${prefix}_cta`]:data.cta||''
  }
 }),'تم حفظ بيانات المركز');
},true);
