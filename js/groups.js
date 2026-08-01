import{
 setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,rpc,notifyPending,
 toast,fillCollege,esc,openModal,closeModal,getSetting,trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

setupNav();
enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();
fillCollege($('#collegeFilter'));
fillCollege($('#collegeInput'),{other:true});

let rows=[];
const whatsappLogo=`<svg class="wa-card-logo" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C8.86 3 3.02 8.7 3.02 15.72c0 2.47.73 4.86 2.11 6.91L3 29l6.58-2.06a13.14 13.14 0 0 0 6.45 1.69h.01c7.17 0 13.01-5.7 13.01-12.72C29.05 8.7 23.21 3 16.04 3Zm7.65 18.1c-.32.88-1.87 1.68-2.58 1.76-.66.07-1.49.1-2.4-.18-.55-.17-1.26-.4-2.17-.78-3.82-1.62-6.31-5.39-6.5-5.64-.18-.25-1.55-2.02-1.55-3.85s.98-2.73 1.33-3.1c.35-.37.76-.46 1.02-.46.25 0 .51 0 .73.01.23.01.55-.09.86.64.32.76 1.08 2.63 1.17 2.82.1.19.16.42.03.67-.13.25-.19.4-.38.62-.19.22-.4.49-.57.66-.19.18-.39.38-.17.75.22.37.98 1.58 2.11 2.56 1.45 1.27 2.67 1.66 3.05 1.85.38.19.6.16.82-.09.22-.25.95-1.08 1.2-1.45.25-.37.51-.31.86-.19.35.12 2.22 1.02 2.6 1.21.38.19.63.28.73.43.09.16.09.91-.23 1.79Z"/></svg>`;

function safeWhatsAppUrl(value){
 try{
  const url=new URL(String(value||''));
  return url.protocol==='https:'&&['chat.whatsapp.com','whatsapp.com','www.whatsapp.com'].includes(url.hostname)?url.href:'';
 }catch{return''}
}
async function loadCommunityCard(){
 const [name,url]=await Promise.all([
  getSetting('whatsapp_channel_name','مجتمع طلاب جامعة نزوى'),
  getSetting('whatsapp_channel_url','https://whatsapp.com/channel/0029Vb9RCFoHgZWkH8X6di1x')
 ]);
 const card=$('#officialWhatsAppCommunity');
 if(!card)return;
 const safe=safeWhatsAppUrl(url);
 card.hidden=!safe;
 if(safe)card.href=safe;
 const title=card.querySelector('[data-community-title]');
 if(title)title.textContent=name||'مجتمع طلاب جامعة نزوى';
}
async function load(){
 const items=$('#items');
 items.innerHTML='<div class="empty">جاري تحميل المجموعات...</div>';
 try{
  rows=await get('whatsapp_groups','select=*&approved=eq.true&order=created_at.desc&limit=300');
  render();
  trackEvent('page_view',{page:'groups'});
 }catch(error){
  console.error(error);
  items.innerHTML='<div class="empty">تعذر تحميل المجموعات حاليًا.</div>';
  toast(error.message||'تعذر تحميل المجموعات',true);
 }
}
function render(){
 const query=($('#search')?.value||'').trim().toLowerCase();
 const college=$('#collegeFilter')?.value||'';
 const filtered=rows.filter(item=>{
  const haystack=`${item.subject||''} ${item.course_code||''} ${item.college||''} ${item.description||''}`.toLowerCase();
  return (!college||item.college===college)&&haystack.includes(query);
 });
 $('#items').innerHTML=filtered.length?filtered.map(item=>{
  const url=safeWhatsAppUrl(item.link);
  const courseCode=String(item.course_code||'').trim();
  const type=courseCode?'مجموعة مادة':'مجتمع عام';
  return `<article class="simple-group-card"><div class="simple-group-head"><span class="wa-logo-wrap">${whatsappLogo}</span><span class="badge">${esc(type)}</span></div><div><h3>${esc(item.subject||'مجموعة واتساب')}</h3><p>${courseCode?`رمز المادة: ${esc(courseCode)}`:esc(item.college||'كل الكليات')}</p>${item.description?`<small>${esc(item.description)}</small>`:''}</div>${url?`<a class="whatsapp-join-button" target="_blank" rel="noopener noreferrer" href="${esc(url)}" data-group-id="${item.id}">${whatsappLogo}<span>دخول المجموعة</span></a>`:'<span class="notice">الرابط غير متاح</span>'}</article>`;
 }).join(''):'<div class="empty">لا توجد مجموعات مطابقة حاليًا</div>';
}

$('#collegeInput')?.addEventListener('change',()=>{$('#otherCollegeField').hidden=$('#collegeInput').value!=='أخرى'});
$('#search')?.addEventListener('input',render);
$('#collegeFilter')?.addEventListener('change',render);
$('#openForm')?.addEventListener('click',()=>openModal('submitModal'));
$('#closeForm')?.addEventListener('click',()=>closeModal('submitModal'));
$('#submitModal')?.addEventListener('click',event=>{if(event.target.id==='submitModal')closeModal('submitModal')});

$('#items')?.addEventListener('click',event=>{
 const link=event.target.closest('[data-group-id]');
 if(link)trackEvent('whatsapp_group_open',{id:link.dataset.groupId});
});

$('#submitForm')?.addEventListener('submit',async event=>{
 event.preventDefault();
 const form=event.currentTarget;
 const button=event.submitter||form.querySelector('[type="submit"]');
 const body=Object.fromEntries(new FormData(form));
 if(body.college==='أخرى')body.college=$('#otherCollege')?.value.trim()||'';
 body.subject=String(body.subject||'').trim();
 body.course_code=String(body.course_code||'').trim().toUpperCase();
 body.link=safeWhatsAppUrl(body.link);
 body.description=String(body.description||'').trim();
 if(!body.subject)return toast('اكتب اسم المجموعة',true);
 if(!body.college)return toast('اختر الكلية أو الجهة',true);
 if(!body.link)return toast('أدخل رابط واتساب صحيح',true);
 button.disabled=true;
 const original=button.textContent;
 button.textContent='جاري الإرسال...';
 try{
  const id=await rpc('uon_submit_whatsapp_group',{
   p_subject:body.subject,p_course_code:body.course_code||null,p_college:body.college,
   p_link:body.link,p_description:body.description||null,p_submitter_name:null
  });
  await notifyPending('whatsapp_groups',id);
  toast('تم إرسال المجموعة للمراجعة');
  form.reset();
  fillCollege($('#collegeInput'),{other:true});
  $('#otherCollegeField').hidden=true;
  closeModal('submitModal');
  trackEvent('whatsapp_group_submit',{has_course_code:Boolean(body.course_code)});
 }catch(error){
  console.error(error);
  toast(error.message||'تعذر إرسال المجموعة',true);
 }finally{
  button.disabled=false;
  button.textContent=original;
 }
});

loadCommunityCard();
load();
