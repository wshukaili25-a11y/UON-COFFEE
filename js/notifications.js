
import {fillCollege,$,$$,toast,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
fillCollege($('#notifyCollege'),{other:true});
const saved=JSON.parse(localStorage.getItem('uon_notification_preferences')||'{}');
$('#notifyCollege').value=saved.college||'';
$$('.notifyTopic').forEach(x=>x.checked=(saved.topics||[]).includes(x.value));
$('#saveNotifications').onclick=async()=>{
 const data={college:$('#notifyCollege').value,topics:$$('.notifyTopic:checked').map(x=>x.value),saved_at:new Date().toISOString()};
 localStorage.setItem('uon_notification_preferences',JSON.stringify(data));
 if('Notification' in window&&Notification.permission==='default')await Notification.requestPermission();
 trackEvent('notification_preferences',{college:data.college,topics:data.topics});
 toast('تم حفظ اختياراتك في جهازك فقط');
};
