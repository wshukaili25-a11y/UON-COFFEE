import{
 whatsappShare,reportBrokenLink,installErrorCapture,setupNav,enforceUonMaintenance,
 watchUonMaintenance,$,get,submitPending,notifyPending,toast,fillCollege,esc,
 openModal,closeModal,trackEvent,rpc,uid
}from'./core.js?v=39.0.0';

setupNav();
installErrorCapture();
watchUonMaintenance();
enforceUonMaintenance();

const search=$('#search');
const collegeFilter=$('#collegeFilter');
const collegeInput=$('#collegeInput');
const typeFilter=$('#typeFilter');
const form=$('#submitForm');
const items=$('#items');
fillCollege(collegeFilter);
fillCollege(collegeInput);

const ratingPicker=$('#ratingPicker');
if(ratingPicker)ratingPicker.innerHTML=[1,2,3,4,5].map(n=>`<button type="button" data-value="${n}" aria-label="${n} نجوم">★</button>`).join('');

let rows=[];
let stats=new Map();
let activeItem=null;
let selectedRating=0;
let selectedRecommended=null;
const SESSION_KEY='uon_anon_session';
let sessionId=localStorage.getItem(SESSION_KEY);
if(!sessionId){sessionId=uid();localStorage.setItem(SESSION_KEY,sessionId)}

const safeUrl=value=>{
 try{
  const url=new URL(String(value||''),location.origin);
  return ['https:','http:'].includes(url.protocol)?url.href:'';
 }catch{return''}
};
const formatDate=value=>value?new Date(value).toLocaleDateString('ar-OM'):'—';
const starText=value=>{
 const count=Math.max(0,Math.min(5,Math.round(Number(value)||0)));
 return '★'.repeat(count)+'☆'.repeat(5-count);
};
const normalizedType=item=>{
 const value=String(item.resource_type||item.content_type||'').trim().toLowerCase();
 const map={summary:'ملخص',exam:'اختبار',explanation:'شرح',assignment:'واجب',file:'ملف'};
 return map[value]||item.resource_type||'ملف';
};

async function load(){
 items.innerHTML='<div class="sum-loading">جاري تحميل الملفات...</div>';
 try{
  rows=await get('summaries','select=*&approved=eq.true&order=created_at.desc&limit=500');
  await loadStats();
  render();
  trackEvent('page_view',{page:'summaries'});
 }catch(error){
  console.error(error);
  items.innerHTML='<div class="sum-empty">تعذر تحميل الملخصات حاليًا.</div>';
  toast('تعذر تحميل الملخصات حاليًا',true);
 }
}
async function loadStats(){
 stats.clear();
 const ids=rows.map(item=>String(item.id));
 if(!ids.length)return;
 try{
  const data=await rpc('uon_summary_rating_stats',{p_ids:ids});
  for(const stat of data||[])stats.set(String(stat.resource_id),stat);
 }catch(error){console.warn('Rating stats unavailable',error)}
}
function card(item){
 const title=item.title||'ملخص أو اختبار';
 const url=safeUrl(item.url||item.link||item.pdf_url);
 const type=normalizedType(item);
 const code=item.course_code||item.subject||'ملف عام';
 const stat=stats.get(String(item.id))||{};
 const average=Number(stat.average||item.rating||0);
 const count=Number(stat.total||0);
 return `<article class="sum-card" data-id="${esc(item.id)}">
  <div class="sum-card-head"><span class="sum-type">${esc(type)}</span><span class="sum-code">${esc(code)}</span></div>
  <h3>${esc(title)}</h3>
  <p class="sum-desc">${esc(item.description||'ملف دراسي مرفوع لطلاب المقرر.')}</p>
  <div class="sum-meta"><span>🏫 ${esc(item.college||'غير محدد')}</span><span>👁 ${Number(item.views||0)}</span><span>📥 ${Number(item.downloads||0)}</span><span>🗓 ${formatDate(item.updated_at||item.created_at)}</span></div>
  <div class="sum-rating-line"><span class="sum-stars">${starText(average)}</span><span class="sum-rating-num">${average?average.toFixed(1):'جديد'}</span><small>(${count} تقييم)</small></div>
  <div class="sum-actions">
   ${url?`<a class="btn primary" data-open="view" target="_blank" rel="noopener noreferrer" href="${esc(url)}">فتح الملف</a>`:''}
   <button class="btn" type="button" data-rate>⭐ تقييم</button>
   ${url?`<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(whatsappShare(title,url))}">مشاركة</a><button class="btn danger" type="button" data-report>بلاغ</button>`:''}
  </div>
 </article>`;
}
function render(){
 const query=(search?.value||'').trim().toLowerCase();
 const college=collegeFilter?.value||'';
 const type=typeFilter?.value||'';
 const list=rows.filter(item=>{
  const haystack=`${item.title||''} ${item.subject||''} ${item.course_code||''} ${item.description||''}`.toLowerCase();
  return (!college||item.college===college)&&(!type||normalizedType(item)===type)&&haystack.includes(query);
 });
 items.innerHTML=list.length?list.map(card).join(''):'<div class="sum-empty">ما حصلنا ملفات تطابق بحثك.</div>';
}
search?.addEventListener('input',render);
collegeFilter?.addEventListener('change',render);
typeFilter?.addEventListener('change',render);

$('#openForm')?.addEventListener('click',()=>openModal('submitModal'));
$('#closeForm')?.addEventListener('click',()=>closeModal('submitModal'));
$('#closeRating')?.addEventListener('click',()=>closeModal('ratingModal'));
document.querySelectorAll('.modal').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal)closeModal(modal.id)}));

form?.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=event.submitter||form.querySelector('[type="submit"]');
 const body=Object.fromEntries(new FormData(form));
 body.course_code=String(body.course_code||body.subject||'').trim().toUpperCase();
 body.subject=body.course_code||String(body.title||'').trim();
 delete body.subject_code;
 body.approved=false;
 body.resource_type=body.resource_type||'ملخص';
 body.content_type=body.resource_type==='اختبار'?'exam':body.resource_type==='شرح'?'explanation':body.resource_type==='واجب'?'assignment':'summary';
 if(!body.course_code)return toast('اكتب رمز المادة مثل STAT101',true);
 const url=safeUrl(body.url);
 if(!url)return toast('الرابط غير صالح',true);
 body.url=url;
 button.disabled=true;
 button.textContent='جاري الإرسال...';
 try{
  const data=await submitPending('summaries',body);
  await notifyPending('summaries',data.id);
  toast('تم إرسال الملف للمراجعة');
  form.reset();
  fillCollege(collegeInput);
  closeModal('submitModal');
  trackEvent('summary_submit',{course_code:body.course_code,resource_type:body.resource_type});
 }catch(error){
  console.error(error);
  toast(error.message||'تعذر إرسال الملف، تحقق من البيانات والرابط',true);
 }finally{
  button.disabled=false;
  button.textContent='إرسال للمراجعة';
 }
});

function ratingOverview(stat={}){
 const average=Number(stat.average||0);
 const total=Number(stat.total||0);
 const stars=stat.stars||{};
 const recommended=stat.recommended_percent;
 const bars=[5,4,3,2,1].map(n=>{
  const count=Number(stars[String(n)]||0);
  const percentage=total?Math.round(count/total*100):0;
  return `<div class="rating-bar"><span>${n}★</span><i><span style="width:${percentage}%"></span></i><b>${count}</b></div>`;
 }).join('');
 return `<div class="rating-overview"><div class="rating-score"><strong>${average?average.toFixed(1):'—'}</strong><div class="sum-stars">${starText(average)}</div><small>${total} تقييم</small>${recommended!==null&&recommended!==undefined?`<p>${recommended}% ينصحون به</p>`:''}</div><div class="rating-bars">${bars}</div></div>`;
}
function reviewsHtml(stat={}){
 const comments=Array.isArray(stat.comments)?stat.comments:[];
 return comments.length?comments.map(review=>`<article class="review"><div class="review-top"><strong>${esc(review.name||'مجهول')}</strong><span class="sum-stars">${starText(review.rating)}</span></div><p>${esc(review.comment||'')}</p><small>${formatDate(review.created_at)}</small></article>`).join(''):'<div class="sum-empty">ما فيه آراء مكتوبة للحين.</div>';
}
function openRating(item){
 activeItem=item;
 selectedRating=0;
 selectedRecommended=null;
 $('#ratingResourceId').value=item.id;
 $('#ratingTitle').textContent='تقييم: '+(item.title||'الملف');
 $('#ratingSubtitle').textContent=item.course_code||item.subject||'';
 const stat=stats.get(String(item.id))||{};
 $('#ratingOverview').innerHTML=ratingOverview(stat);
 $('#reviewList').innerHTML=reviewsHtml(stat);
 $('#ratingComment').value='';
 $('#reviewerName').value='';
 syncPicker();
 document.querySelectorAll('[data-recommend]').forEach(button=>button.classList.remove('primary'));
 openModal('ratingModal');
}
function syncPicker(){
 document.querySelectorAll('#ratingPicker [data-value]').forEach(button=>button.classList.toggle('active',Number(button.dataset.value)<=selectedRating));
}
ratingPicker?.addEventListener('click',event=>{
 const button=event.target.closest('[data-value]');
 if(!button)return;
 selectedRating=Number(button.dataset.value);
 syncPicker();
});
document.querySelectorAll('[data-recommend]').forEach(button=>button.addEventListener('click',()=>{
 selectedRecommended=button.dataset.recommend==='true';
 document.querySelectorAll('[data-recommend]').forEach(item=>item.classList.toggle('primary',item===button));
}));
$('#ratingForm')?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!selectedRating)return toast('اختر عدد النجوم أولًا',true);
 const button=event.submitter||event.currentTarget.querySelector('[type="submit"]');
 button.disabled=true;
 try{
  await rpc('uon_submit_resource_rating',{
   p_resource_table:'summaries',p_resource_id:String(activeItem.id),p_session_id:sessionId,
   p_rating:selectedRating,p_recommended:selectedRecommended,
   p_comment:$('#ratingComment').value.trim()||null,p_reviewer_name:$('#reviewerName').value.trim()||null
  });
  toast('تم حفظ تقييمك ⭐');
  await loadStats();
  render();
  openRating(activeItem);
  trackEvent('summary_rating',{rating:selectedRating});
 }catch(error){toast(error.message||'تعذر حفظ التقييم',true)}finally{button.disabled=false}
});

items?.addEventListener('click',async event=>{
 const cardElement=event.target.closest('[data-id]');
 if(!cardElement)return;
 const item=rows.find(row=>String(row.id)===cardElement.dataset.id);
 if(!item)return;
 if(event.target.closest('[data-rate]'))return openRating(item);
 if(event.target.closest('[data-report]')){
  const url=safeUrl(item.url||item.link||item.pdf_url);
  return reportBrokenLink({sourceTable:'summaries',sourceId:item.id,title:item.title,url});
 }
 const open=event.target.closest('[data-open]');
 if(open){
  rpc('uon_track_summary_open',{p_summary_id:item.id,p_kind:'view'}).catch(()=>{});
  item.views=Number(item.views||0)+1;
  trackEvent('summary_open',{id:item.id,course_code:item.course_code||item.subject||''});
 }
});

load();
