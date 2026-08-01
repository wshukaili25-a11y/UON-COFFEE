import{
 $,fillCollege,rpc,notifyPending,toast,uid,trackEvent,enforceUonMaintenance,
 watchUonMaintenance,installErrorCapture
}from'./core.js?v=39.0.0';

enforceUonMaintenance();watchUonMaintenance();installErrorCapture();

const form=$('#feedbackForm');
const collegeSelect=$('#feedbackCollege');
const SESSION_KEY='uon_feedback_session_v39';
let sessionId=localStorage.getItem(SESSION_KEY);
if(!sessionId){sessionId=uid();localStorage.setItem(SESSION_KEY,sessionId)}
fillCollege(collegeSelect,{other:true});

collegeSelect?.addEventListener('change',()=>{$('#feedbackOtherCollege').hidden=collegeSelect.value!=='أخرى'});
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(form.dataset.submitting==='true')return;
 const button=event.submitter||form.querySelector('[type="submit"]');
 const data=Object.fromEntries(new FormData(form));
 let college=String(data.college||'').trim();
 if(college==='أخرى')college=$('#feedbackOtherCollegeInput')?.value.trim()||'';
 const title=String(data.title||'').trim(),details=String(data.details||'').trim();
 if(title.length<3)return toast('اكتب عنوانًا أوضح',true);
 if(details.length<10)return toast('اكتب تفاصيل أكثر عن اقتراحك',true);
 form.dataset.submitting='true';button.disabled=true;const original=button.textContent;button.textContent='جاري الإرسال...';
 try{
  const id=await rpc('uon_submit_feature_suggestion',{
   p_category:String(data.category||'feature'),p_title:title,p_details:details,
   p_college:college||null,p_contact:String(data.contact||'').trim()||null,
   p_page_url:location.href,p_session_id:sessionId
  });
  await notifyPending('feature_suggestions',id);
  form.reset();fillCollege(collegeSelect,{other:true});$('#feedbackOtherCollege').hidden=true;
  toast('وصل اقتراحك للمشرف، شكرًا لك 🤍');trackEvent('feature_suggestion_submit',{category:data.category||'feature'});
 }catch(error){toast(error.message||'تعذر إرسال الاقتراح، حاول مرة ثانية',true)}finally{
  form.dataset.submitting='false';button.disabled=false;button.textContent=original;
 }
});
trackEvent('page_view',{page:'feedback'});
