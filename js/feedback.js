
import {fillCollege,$,insert,submitPending,notifyPending,toast,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();
fillCollege($('#feedbackCollege'),{other:true});
$('#feedbackForm').onsubmit=async event=>{
 event.preventDefault();
 const body=Object.fromEntries(new FormData(event.target));
 body.category=String(body.category||'').trim();
 body.title=String(body.title||'').trim();
 body.details=String(body.details||'').trim();
 if(!body.category||!body.title||!body.details)return toast('أكمل نوع الاقتراح والعنوان والتفاصيل',true);
 body.status='pending';
 body.page_url=location.href;
 try{
  const row=await submitPending('feature_suggestions',body);
  await notifyPending('feature_suggestions',row.id);
  await trackEvent('suggestion_submit',{category:body.category});
  toast('وصل اقتراحك للمشرف، شكرًا لك 🤍');
  event.target.reset();
 }catch(error){toast(error.message,true)}
};
