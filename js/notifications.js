import {fillCollege,$,$$,toast,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js?v=61.1.0';
import {runStudentPulse} from './student-pulse.js?v=61.1.0';

await enforceUonMaintenance();watchUonMaintenance();
fillCollege($('#notifyCollege'),{other:true});
let saved={};try{saved=JSON.parse(localStorage.getItem('uon_notification_preferences')||'{}')}catch{}
$('#notifyCollege').value=saved.college||'';
$$('.notifyTopic').forEach(x=>x.checked=(saved.topics||[]).includes(x.value));
if($('#classLeadMinutes'))$('#classLeadMinutes').value=String(saved.class_lead_minutes||30);
if($('#taskLeadHours'))$('#taskLeadHours').value=String(saved.task_lead_hours||12);

function permissionText(){
 const note=$('#notificationPermissionNote');if(!note||!('Notification' in window))return;
 note.textContent=Notification.permission==='granted'?'إشعارات الجهاز مفعلة ✅':Notification.permission==='denied'?'إذن الإشعارات مرفوض من إعدادات المتصفح. التنبيهات داخل UON Hub بتظل تعمل.':'سيطلب المتصفح إذن الإشعارات بعد الحفظ.';
}
permissionText();

$('#saveNotifications').onclick=async()=>{
 const data={
  college:$('#notifyCollege').value,
  topics:$$('.notifyTopic:checked').map(x=>x.value),
  class_lead_minutes:Number($('#classLeadMinutes')?.value||30),
  task_lead_hours:Number($('#taskLeadHours')?.value||12),
  saved_at:new Date().toISOString()
 };
 localStorage.setItem('uon_notification_preferences',JSON.stringify(data));
 if('Notification' in window&&Notification.permission==='default'){
  try{await Notification.requestPermission()}catch{}
 }
 permissionText();
 trackEvent('notification_preferences',{college:data.college,topics:data.topics,class_lead_minutes:data.class_lead_minutes,task_lead_hours:data.task_lead_hours});
 runStudentPulse();
 toast('تم حفظ التنبيهات الذكية على جهازك ✅');
};