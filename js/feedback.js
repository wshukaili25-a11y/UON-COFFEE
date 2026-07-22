
import {fillCollege,$,insert,notifyPending,toast,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
fillCollege($('#feedbackCollege'),{other:true});
$('#feedbackForm').onsubmit=async event=>{
 event.preventDefault();
 const body=Object.fromEntries(new FormData(event.target));
 body.status='pending';
 body.page_url=location.href;
 try{
  const rows=await insert('feature_suggestions',body);
  await notifyPending('feature_suggestions',rows[0].id);
  await trackEvent('suggestion_submit',{category:body.category});
  toast('وصل اقتراحك للمشرف، شكرًا لك 🤍');
  event.target.reset();
 }catch(error){toast(error.message,true)}
};
