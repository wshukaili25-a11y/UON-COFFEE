import {toast} from './core.js?v=66.0.0';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const SCHEDULE_KEY='uon-v7-schedule';
const CLIENT_KEY='uon_ai_client_v55';
const MAX_IMAGES=12;
const MAX_TOTAL_BASE64=17_500_000;

function uuid(){try{return crypto.randomUUID()}catch{return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}}
function clientToken(){let id='';try{id=localStorage.getItem(CLIENT_KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(id)){id=uuid();try{localStorage.setItem(CLIENT_KEY,id)}catch{}}return id}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function injectStyles(){
 if(document.querySelector('#scheduleImageAiStyles'))return;
 const style=document.createElement('style');
 style.id='scheduleImageAiStyles';
 style.textContent=`
 .schedule-ai-generator{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--border,#d9e2df) 80%,#1d8f63 20%);background:linear-gradient(145deg,color-mix(in srgb,var(--card,#fff) 94%,#eaf8f1 6%),var(--card,#fff));}
 .schedule-ai-generator:before{content:"";position:absolute;inset-inline-start:-80px;top:-110px;width:230px;height:230px;border-radius:50%;background:rgba(28,145,97,.08);pointer-events:none}
 .schedule-ai-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;position:relative;z-index:1}.schedule-ai-title{display:flex;gap:12px;align-items:flex-start}.schedule-ai-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#176b4d;color:#fff;font-size:22px;box-shadow:0 10px 24px rgba(23,107,77,.18)}
 .schedule-ai-head h2{margin:0 0 5px}.schedule-ai-head p{margin:0;color:var(--muted,#66756f);line-height:1.75}.schedule-ai-badge{white-space:nowrap;border:1px solid rgba(23,107,77,.18);background:rgba(23,107,77,.08);color:#176b4d;border-radius:999px;padding:7px 11px;font-weight:800;font-size:.78rem}
 .schedule-ai-instructions{margin-top:18px;padding:15px 16px;border-radius:16px;background:color-mix(in srgb,var(--card,#fff) 80%,#eef7f2 20%);border:1px solid var(--border,#e2e7e5)}.schedule-ai-instructions strong{display:block;margin-bottom:8px}.schedule-ai-instructions ol{margin:0;padding-inline-start:22px;display:grid;gap:7px;line-height:1.75;color:var(--muted,#5d6d67)}
 .schedule-ai-upload{margin-top:16px;border:1.5px dashed color-mix(in srgb,var(--border,#ccd6d2) 65%,#177354 35%);border-radius:18px;padding:20px;text-align:center;cursor:pointer;transition:.2s;background:rgba(255,255,255,.03)}.schedule-ai-upload:hover,.schedule-ai-upload.is-drag{border-color:#177354;background:rgba(23,115,84,.055)}.schedule-ai-upload input{display:none}.schedule-ai-upload-icon{font-size:28px;display:block;margin-bottom:7px}.schedule-ai-upload b{display:block;margin-bottom:4px}.schedule-ai-upload small{color:var(--muted,#6c7773)}
 .schedule-ai-files{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;margin-top:12px}.schedule-ai-file{display:flex;align-items:center;gap:9px;border:1px solid var(--border,#e1e6e4);border-radius:13px;padding:9px 10px;background:var(--card,#fff);min-width:0}.schedule-ai-file img{width:44px;height:44px;border-radius:9px;object-fit:cover}.schedule-ai-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;flex:1}.schedule-ai-file button{border:0;background:transparent;cursor:pointer;color:#a33;font-size:18px}
 .schedule-ai-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-top:16px}.schedule-ai-controls .field{min-width:210px;flex:1}.schedule-ai-controls label{display:block;font-weight:800;margin-bottom:7px}.schedule-ai-controls select{width:100%}.schedule-ai-generate{min-height:46px;min-width:190px}.schedule-ai-generate[disabled]{opacity:.6;cursor:wait}.schedule-ai-status{margin-top:13px;min-height:24px;font-size:.9rem;color:var(--muted,#65736e)}.schedule-ai-status.is-error{color:#b3261e}.schedule-ai-status.is-success{color:#166b4d}.schedule-ai-progress{height:5px;background:var(--border,#e5e9e7);border-radius:999px;overflow:hidden;margin-top:10px;display:none}.schedule-ai-progress.show{display:block}.schedule-ai-progress span{display:block;width:36%;height:100%;background:#177354;border-radius:inherit;animation:scheduleAiMove 1.15s ease-in-out infinite alternate}@keyframes scheduleAiMove{from{transform:translateX(-15%)}to{transform:translateX(180%)}}
 .schedule-ai-privacy{margin-top:10px;font-size:.78rem;color:var(--muted,#71807a)}
 @media(max-width:680px){.schedule-ai-head{display:block}.schedule-ai-badge{display:inline-block;margin-top:10px}.schedule-ai-instructions{padding:13px}.schedule-ai-upload{padding:17px 12px}.schedule-ai-controls{display:grid}.schedule-ai-controls .field{min-width:0}.schedule-ai-generate{width:100%}}
 `;
 document.head.append(style);
}

function markup(){return `
<section class="card schedule-ai-generator" aria-labelledby="scheduleAiTitle">
 <div class="schedule-ai-head">
  <div class="schedule-ai-title"><span class="schedule-ai-icon" aria-hidden="true">✦</span><div><h2 id="scheduleAiTitle">مولّد الجدول من صور الشعب</h2><p>ارفع لقطات الشعب المتاحة من EduWave، وUON AI يقرأها ويختار لك جدولًا بدون تعارض.</p></div></div>
  <span class="schedule-ai-badge">UON AI Vision</span>
 </div>
 <div class="schedule-ai-instructions">
  <strong>طريقة أخذ صور الشعب من EduWave</strong>
  <ol>
   <li>سجّل الدخول إلى موقع <b>EduWave</b> التابع لجامعة نزوى.</li>
   <li>اضغط على <b>المربع الأصفر العلوي</b>، ثم اختر <b>خطة المرشد</b>.</li>
   <li>ستظهر مواد الخطة ضمن متطلبات الجامعة والكلية والتخصص والمواد الاختيارية.</li>
   <li>اسحب الجدول إلى اليسار حتى تصل إلى خانة <b>الشعب المتاحة</b>.</li>
   <li>اضغط على كلمة <b>الشعب</b> الظاهرة باللون الأزرق لعرض جميع الشعب المتاحة للمادة.</li>
   <li>خذ لقطة شاشة واضحة لكل الشعب المتاحة، وكررها للمواد التي تريد إدخالها في جدولك.</li>
   <li>ارفع جميع الصور هنا دفعة واحدة، ولا تحتاج إلى كتابة رمز المادة أو اسمها يدويًا.</li>
  </ol>
 </div>
 <label class="schedule-ai-upload" id="scheduleAiDrop">
  <input id="scheduleAiFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple>
  <span class="schedule-ai-upload-icon">▣</span><b>اضغط لرفع صور السكاشن</b><small>PNG / JPG / WEBP · حتى ${MAX_IMAGES} صورة</small>
 </label>
 <div class="schedule-ai-files" id="scheduleAiFileList"></div>
 <div class="schedule-ai-controls">
  <div class="field"><label for="scheduleAiPreference">تفضيل الجدول</label><select id="scheduleAiPreference"><option value="balanced">متوازن ومريح</option><option value="morning">أفضل المحاضرات الصباحية</option><option value="late">أفضل المحاضرات المتأخرة</option><option value="fewer_days">أقل عدد أيام دوام</option></select></div>
  <button class="btn primary schedule-ai-generate" id="scheduleAiGenerate" type="button">✦ توليد الجدول بالذكاء الاصطناعي</button>
 </div>
 <div class="schedule-ai-progress" id="scheduleAiProgress"><span></span></div>
 <div class="schedule-ai-status" id="scheduleAiStatus" role="status" aria-live="polite"></div>
 <div class="schedule-ai-privacy">تُرسل الصور للتحليل عند الضغط على «توليد الجدول»، ولا تُحفظ صور EduWave نفسها داخل قاعدة بيانات UON Hub.</div>
</section>`}

let files=[];
function updateList(){
 const list=document.querySelector('#scheduleAiFileList');
 if(!list)return;
 list.innerHTML=files.map((file,i)=>`<div class="schedule-ai-file"><img alt="" src="${URL.createObjectURL(file)}"><span title="${esc(file.name)}">${esc(file.name)}</span><button type="button" data-remove="${i}" aria-label="حذف الصورة">×</button></div>`).join('');
 list.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{files.splice(Number(btn.dataset.remove),1);updateList();setStatus(files.length?`${files.length} صورة جاهزة للتحليل`: '')}));
}
function addFiles(input){
 const incoming=[...input].filter(f=>/^image\/(png|jpeg|webp)$/i.test(f.type));
 if(!incoming.length){toast('ارفع صور PNG أو JPG أو WEBP',true);return}
 files=[...files,...incoming].slice(0,MAX_IMAGES);
 updateList();setStatus(`${files.length} صورة جاهزة للتحليل`);
}
function setStatus(text,type=''){
 const el=document.querySelector('#scheduleAiStatus');if(!el)return;
 el.textContent=text;el.className=`schedule-ai-status${type?` is-${type}`:''}`;
}
function busy(on){
 const btn=document.querySelector('#scheduleAiGenerate'),bar=document.querySelector('#scheduleAiProgress');
 if(btn){btn.disabled=on;btn.textContent=on?'جارٍ قراءة الشعب وبناء الجدول…':'✦ توليد الجدول بالذكاء الاصطناعي'}
 bar?.classList.toggle('show',on);
}

async function imageToPayload(file){
 const bitmap=await createImageBitmap(file);
 const max=2200,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image_encode_failed')),'image/jpeg',.9));
 const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)});
 return{mime_type:'image/jpeg',data:String(dataUrl).split(',')[1]||''};
}
function normalizeRows(rows){
 const allowed=new Set(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس']);
 return (Array.isArray(rows)?rows:[]).slice(0,80).map(r=>({
  id:uuid(),seriesId:`ai-${String(r.course||'').trim()}-${String(r.section||'').trim()}`,
  course:String(r.course||r.title||'').trim().slice(0,40),title:String(r.title||'').trim().slice(0,100),section:String(r.section||'').trim().slice(0,40),
  day:String(r.day||'').trim(),start:String(r.start||'').slice(0,5),end:String(r.end||'').slice(0,5),room:String(r.room||'').trim().slice(0,50),teacher:String(r.teacher||'').trim().slice(0,100),type:String(r.type||'lecture').slice(0,20)
 })).filter(r=>r.course&&allowed.has(r.day)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end)&&r.end>r.start);
}
async function generate(){
 if(!files.length){setStatus('ارفع صور الشعب المتاحة أولًا.','error');return}
 busy(true);setStatus('نجهّز الصور للقراءة…');
 try{
  const images=[];let total=0;
  for(let i=0;i<files.length;i++){
   setStatus(`نجهّز الصورة ${i+1} من ${files.length}…`);
   const img=await imageToPayload(files[i]);total+=img.data.length;if(total>MAX_TOTAL_BASE64)throw new Error('images_too_large');images.push(img);
  }
  setStatus('UON AI يقرأ المواد والشعب والأوقات الآن…');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/schedule-image-ai-v66`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({client_token:clientToken(),preference:document.querySelector('#scheduleAiPreference')?.value||'balanced',images}),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
   const messages={no_sections_found:'ما قدرت أقرأ شعب واضحة من الصور. تأكد أن أرقام الشعب والأيام والأوقات ظاهرة بالكامل.',no_conflict_free_schedule:'قرأت الشعب، لكن ما لقيت اختيارًا كاملًا بدون تعارض. جرّب رفع شعب إضافية لبعض المواد.',images_too_large:'حجم الصور كبير جدًا. قلّل عدد الصور أو ارفع لقطات أوضح ومقصوصة.',rate_limited:'تم استخدام التوليد عدة مرات خلال فترة قصيرة. حاول مرة أخرى لاحقًا.',vision_failed:'تعذر تحليل الصور بالذكاء الاصطناعي حاليًا.'};
   throw new Error(messages[data?.error]||'تعذر توليد الجدول من الصور.');
  }
  const rows=normalizeRows(data.schedule);
  if(!rows.length)throw new Error('تمت قراءة الصور لكن لم يرجع جدول صالح.');
  let current=[];try{current=JSON.parse(localStorage.getItem(SCHEDULE_KEY)||'[]')}catch{}
  if(Array.isArray(current)&&current.length&&!confirm('عندك جدول محفوظ حاليًا. هل تريد استبداله بالجدول الجديد الذي ولّده UON AI؟'))return;
  localStorage.setItem(SCHEDULE_KEY,JSON.stringify(rows));
  try{window.UONScheduleProfiles?.sync?.()}catch{}
  sessionStorage.setItem('uon_schedule_ai_image_result_v66',JSON.stringify({courses:data.courses_found||0,sections:data.sections_found||0,classes:rows.length}));
  setStatus(`تم! قرأنا ${data.courses_found||0} مواد و${data.sections_found||0} شعب، وولدنا جدولك بدون تعارض. سيتم فتحه الآن.`,'success');
  toast('تم توليد الجدول بنجاح ✨');
  setTimeout(()=>location.reload(),650);
 }catch(error){
  const msg=error?.message==='images_too_large'?'حجم الصور بعد التجهيز أكبر من الحد المسموح. قلّل عدد الصور.':(error?.message||'تعذر توليد الجدول.');
  setStatus(msg,'error');toast(msg,true);
 }finally{busy(false)}
}

function boot(){
 const anchor=document.querySelector('.schedule-form-card');if(!anchor||document.querySelector('.schedule-ai-generator'))return;
 injectStyles();anchor.insertAdjacentHTML('beforebegin',markup());
 const input=document.querySelector('#scheduleAiFiles'),drop=document.querySelector('#scheduleAiDrop');
 input?.addEventListener('change',e=>{addFiles(e.target.files||[]);e.target.value=''});
 drop?.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-drag')});
 drop?.addEventListener('dragleave',()=>drop.classList.remove('is-drag'));
 drop?.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-drag');addFiles(e.dataTransfer?.files||[])});
 document.querySelector('#scheduleAiGenerate')?.addEventListener('click',generate);
 try{const result=JSON.parse(sessionStorage.getItem('uon_schedule_ai_image_result_v66')||'null');if(result){sessionStorage.removeItem('uon_schedule_ai_image_result_v66');setTimeout(()=>toast(`جدولك جاهز: ${result.courses} مواد · ${result.classes} مواعيد`),350)}}catch{}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
