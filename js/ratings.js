import{
 $,get,submitPending,esc,toast,openModal,closeModal,notifyPending,
 enforceUonMaintenance,watchUonMaintenance,trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

let rows=[];
const num=value=>Number(value)||0;
const isTrue=value=>value===true||value==='true';
const stars=value=>{
 const count=Math.max(0,Math.min(5,Math.round(num(value))));
 return '★'.repeat(count)+'☆'.repeat(5-count);
};
const formatDate=value=>value?new Date(value).toLocaleDateString('ar-OM'):'—';

function setupStarInputs(){
 document.querySelectorAll('[data-rating-input]').forEach(box=>{
  const name=box.dataset.ratingInput;
  const input=document.querySelector(`[name="${name}"]`);
  box.innerHTML=[1,2,3,4,5].map(n=>`<button type="button" data-value="${n}" aria-label="${n} نجوم">★</button>`).join('');
  box.addEventListener('click',event=>{
   const button=event.target.closest('[data-value]');
   if(!button||!input)return;
   const value=Number(button.dataset.value);
   input.value=value;
   box.querySelectorAll('[data-value]').forEach(item=>item.classList.toggle('active',Number(item.dataset.value)<=value));
  });
 });
}
function clearStars(){
 document.querySelectorAll('[data-rating-input]').forEach(box=>box.querySelectorAll('button').forEach(button=>button.classList.remove('active')));
}

async function load(){
 const cards=$('#ratingCards');
 if(cards)cards.innerHTML='<div class="r38-empty">جاري تحميل التقييمات...</div>';
 try{
  rows=await get('rating_submissions','select=*&status=eq.approved&order=created_at.desc&limit=500');
  render();
  trackEvent('page_view',{page:'ratings'});
 }catch(error){
  console.error(error);
  if(cards)cards.innerHTML='<div class="r38-empty">تعذر تحميل التقييمات حاليًا.</div>';
 }
}
function renderSummary(list){
 const box=$('#ratingSummary');
 if(!box)return;
 const average=list.length?list.reduce((sum,item)=>sum+num(item.overall||item.overall_rating),0)/list.length:0;
 const recommended=list.length?Math.round(list.filter(item=>isTrue(item.recommended)).length/list.length*100):0;
 const instructors=list.filter(item=>(item.target_type||item.kind)==='instructor').length;
 const descriptions=list.filter(item=>String(item.comment||'').trim()).length;
 box.innerHTML=`<article class="r38-stat"><span>متوسط التقييم</span><strong>${average.toFixed(1)} / 5</strong></article><article class="r38-stat"><span>نسبة التوصية</span><strong>${recommended}%</strong></article><article class="r38-stat"><span>تقييمات الدكاترة</span><strong>${instructors}</strong></article><article class="r38-stat"><span>تجارب مكتوبة</span><strong>${descriptions}</strong></article>`;
}
function metricData(item,rowType){
 if(rowType==='course')return [
  ['وضوح المحتوى',item.clarity_rating||item.teaching],
  ['عبء المادة',item.workload_rating||item.interaction],
  ['الصعوبة',item.difficulty_rating||item.exam_difficulty],
  ['الاختبارات',item.exams_rating||item.attendance]
 ];
 return [
  ['الشرح',item.teaching||item.clarity_rating],
  ['التعامل',item.interaction],
  ['الاختبارات',item.exam_difficulty||item.exams_rating],
  ['الالتزام',item.attendance]
 ];
}
function render(){
 const query=($('#ratingSearch')?.value||'').toLowerCase().trim();
 const type=$('#ratingType')?.value||'';
 const sort=$('#ratingSort')?.value||'recent';
 let filtered=rows.filter(item=>{
  const rowType=item.target_type||item.kind||'instructor';
  const text=`${item.target_name||''} ${item.course_code||''} ${item.comment||''}`.toLowerCase();
  return (!type||rowType===type)&&(!query||text.includes(query));
 });
 filtered=[...filtered].sort((a,b)=>{
  if(sort==='top')return num(b.overall||b.overall_rating)-num(a.overall||a.overall_rating);
  if(sort==='recommended')return Number(isTrue(b.recommended))-Number(isTrue(a.recommended));
  return new Date(b.created_at||0)-new Date(a.created_at||0);
 });
 renderSummary(filtered);
 const cards=$('#ratingCards');
 if(!cards)return;
 cards.innerHTML=filtered.length?filtered.map(item=>{
  const rowType=item.target_type||item.kind||'instructor';
  const overall=num(item.overall||item.overall_rating);
  const description=String(item.comment||'').trim();
  const metrics=metricData(item,rowType).map(([label,value])=>`<div class="r38-metric"><span>${label}</span><b>${value||'—'}</b></div>`).join('');
  return `<article class="r38-card"><div class="r38-card-head"><div><span class="r38-type">${rowType==='course'?'مقرر':'دكتور'}</span><h3>${esc(item.target_name||'غير محدد')}</h3>${item.course_code?`<span class="r38-course">${esc(item.course_code)}</span>`:''}</div><div><div class="r38-stars">${stars(overall)}</div><div class="r38-score">${overall?overall.toFixed(1):'—'} / 5</div></div></div><p class="r38-description">${esc(description||'لم يُكتب وصف لهذا التقييم.')}</p><div class="r38-metrics">${metrics}</div><div class="r38-recommend">${isTrue(item.recommended)?'✅ ينصح به':'➖ لا ينصح به'}</div><small class="r38-date">${formatDate(item.created_at)}</small></article>`;
 }).join(''):'<div class="r38-empty">لا توجد تقييمات مطابقة.</div>';
}
['ratingSearch','ratingType','ratingSort'].forEach(id=>$('#'+id)?.addEventListener(id==='ratingSearch'?'input':'change',render));

function syncFormLabels(){
 const course=$('[name="target_type"]')?.value==='course';
 const values=course
  ?{target:'اسم المقرر',first:'وضوح المحتوى',second:'عبء المادة',third:'صعوبة المقرر',fourth:'الاختبارات'}
  :{target:'اسم الدكتور',first:'الشرح',second:'التعامل',third:'الاختبارات',fourth:'الالتزام والحضور'};
 Object.entries(values).forEach(([key,value])=>{const element=$(`[data-dynamic-label="${key}"]`);if(element)element.textContent=value});
}
$('#openRating')?.addEventListener('click',()=>{syncFormLabels();openModal('ratingModal')});
$('#closeRating')?.addEventListener('click',()=>closeModal('ratingModal'));
$('#ratingModal')?.addEventListener('click',event=>{if(event.target.id==='ratingModal')closeModal('ratingModal')});
$('[name="target_type"]')?.addEventListener('change',syncFormLabels);

$('#ratingForm')?.addEventListener('submit',async event=>{
 event.preventDefault();
 const form=event.currentTarget;
 const button=event.submitter||form.querySelector('[type="submit"]');
 const original=button.textContent;
 const body=Object.fromEntries(new FormData(form));
 if(!body.overall)return toast('اختر التقييم العام أولًا',true);
 body.target_name=String(body.target_name||'').trim();
 if(!body.target_name)return toast('اكتب اسم الدكتور أو المقرر',true);
 body.target_type=body.target_type||'instructor';
 body.kind=body.target_type;
 body.overall=Number(body.overall);
 body.overall_rating=body.overall;
 body.recommended=body.recommended==='true';
 body.status='pending';
 body.comment=String(body.comment||'').trim()||null;
 if(body.course_code)body.course_code=String(body.course_code).trim().toUpperCase();

 const first=body.teaching?Number(body.teaching):null;
 const second=body.interaction?Number(body.interaction):null;
 const third=body.exam_difficulty?Number(body.exam_difficulty):null;
 const fourth=body.attendance?Number(body.attendance):null;
 if(body.target_type==='course'){
  body.clarity_rating=first;
  body.workload_rating=second;
  body.difficulty_rating=third;
  body.exams_rating=fourth;
 }else{
  body.teaching=first;
  body.interaction=second;
  body.exam_difficulty=third;
  body.attendance=fourth;
  body.clarity_rating=first;
  body.exams_rating=third;
 }
 ['teaching','interaction','exam_difficulty','attendance'].forEach(key=>{if(body[key]===null||body[key]==='')delete body[key]});

 try{
  button.disabled=true;
  button.textContent='جاري الإرسال...';
  const result=await submitPending('rating_submissions',body);
  await notifyPending('rating_submissions',result.id);
  trackEvent('rating_submit',{target_type:body.target_type});
  toast('تم إرسال التقييم للمراجعة');
  form.reset();
  clearStars();
  syncFormLabels();
  closeModal('ratingModal');
 }catch(error){
  console.error(error);
  toast(error.message||'تعذر إرسال التقييم، راجع البيانات وحاول مرة أخرى',true);
 }finally{
  button.disabled=false;
  button.textContent=original;
 }
});

setupStarInputs();
syncFormLabels();
load();
