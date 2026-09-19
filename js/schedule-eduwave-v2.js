import {toast,esc,rpc} from './core.js?v=66.0.0';

import{normalizeExtraction,generateProposals,saveGeneratedProfile}from'./schedule-generator.js?v=69.0.0';
import{fetchScheduleParser}from'./schedule-eduwave-transport-v3.js?v=69.0.0';
const SCHEDULE_KEY='uon-v7-schedule',SESSION_KEY='uon_ai_session_v46',CLIENT_KEY='uon_ai_client_v55';
let files=[],courses=[],proposals=[],previewUrls=[],analysisController=null,busy=false,applying=false,term='',searchLimited=false;

const input=document.querySelector('#eduwaveFiles');
const dropzone=document.querySelector('#eduwaveDropzone');
const preview=document.querySelector('#eduwavePreview');

function uuid(){try{return crypto.randomUUID()}catch{return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}}
function identity(key){let value='';try{value=localStorage.getItem(key)||sessionStorage.getItem(key)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(value)){value=uuid();try{if(key===SESSION_KEY)sessionStorage.setItem(key,value);else localStorage.setItem(key,value)}catch{}}return value}
function showStep(step){document.querySelectorAll('[data-flow-panel]').forEach(panel=>panel.hidden=panel.dataset.flowPanel!==step);document.querySelectorAll('[data-flow-step]').forEach(item=>item.classList.toggle('active',item.dataset.flowStep===step));document.querySelector('.schedule-eduwave-modal')?.scrollTo?.({top:0,behavior:'smooth'})}
function setFiles(next){
 if(busy)return;
 const accepted=next.filter(file=>['image/png','image/jpeg','image/webp'].includes(file?.type)&&file.size<=10*1024*1024);
 if(accepted.length!==next.length)toast('اختر صور PNG أو JPG أو WEBP، بحجم لا يتجاوز 10 ميجابايت للصورة.',true);
 if(accepted.length>10)toast('الحد الأقصى 10 صور لكل محاولة.',true);
 files=accepted.slice(0,10);courses=[];proposals=[];renderFiles();
}
function renderFiles(){
 if(!preview)return;
 previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=files.map(file=>URL.createObjectURL(file));
 preview.innerHTML=files.map((file,index)=>'<article class="eduwave-file"><img src="'+previewUrls[index]+'" alt="معاينة '+esc(file.name)+'"><button type="button" data-remove-file="'+index+'" aria-label="حذف الصورة '+esc(file.name)+'">×</button><span>'+esc(file.name)+'</span></article>').join('');
 const button=document.querySelector('#analyseEduwave');if(button)button.disabled=busy||!files.length;
}
function readDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error||new Error('file_read_failed'));reader.onload=()=>resolve(String(reader.result||''));reader.readAsDataURL(blob)})}
async function decodeImage(file){if('createImageBitmap'in window){try{return await createImageBitmap(file)}catch{}}const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('image_decode_failed'));img.src=url})}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}}
async function prepareImage(file){const image=await decodeImage(file);const width=image.width||image.naturalWidth||1,height=image.height||image.naturalHeight||1;const maxSide=1600,scale=Math.min(1,maxSide/Math.max(width,height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close?.();const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('image_encode_failed')),'image/jpeg',0.84));return readDataUrl(blob)}
function renderReview(){const host=document.querySelector('#eduwaveReview');if(!host)return;host.innerHTML='<div class="eduwave-review-head"><div><h3>راجع القراءة قبل التوليد</h3><p>تأكد من رمز المادة والشعب، وألغِ أي شعبة لا تريدها.</p></div><span>'+courses.length+' مواد</span></div>'+courses.map((course,ci)=>'<article class="eduwave-course-review"><div class="eduwave-course-fields"><label>رمز المادة<input data-course-code="'+ci+'" value="'+esc(course.course_code)+'"></label><label>اسم المادة<input data-course-name="'+ci+'" value="'+esc(course.course_name)+'"></label></div><div class="eduwave-sections">'+course.sections.map((section,si)=>'<label class="eduwave-section-row"><input type="checkbox" data-section="'+ci+':'+si+'" '+(section.valid?'checked':'disabled')+'><span><b>الشعبة '+esc(section.section_no||'—')+'</b>'+(!section.valid?'<strong class="eduwave-warning">قراءة غير مكتملة أو أوقات متداخلة. ارفع صورة أوضح لهذه الشعبة.</strong>':'')+'<small>'+section.meetings.map(m=>esc(m.day)+' · '+esc(m.start)+'–'+esc(m.end)+(m.room?' · '+esc(m.room):'')).join('<br>')+'</small></span><em>'+(section.enrolled?esc(section.enrolled)+' طالب':'')+'</em></label>').join('')+'</div></article>').join('')}
function syncReview(){document.querySelectorAll('[data-course-code]').forEach(el=>courses[Number(el.dataset.courseCode)].course_code=el.value.trim().toUpperCase());document.querySelectorAll('[data-course-name]').forEach(el=>courses[Number(el.dataset.courseName)].course_name=el.value.trim());document.querySelectorAll('[data-section]').forEach(el=>{const pair=el.dataset.section.split(':').map(Number);courses[pair[0]].sections[pair[1]].selected=el.checked})}
function renderProposals(){const host=document.querySelector('#eduwaveProposals');if(!host)return;host.innerHTML=(searchLimited?'<p class="eduwave-warning" role="status">عرضنا أفضل النتائج من الاحتمالات المفحوصة. قلّل عدد الشعب لتوسيع المقارنة.</p>':'')+'<div class="eduwave-review-head"><div><h3>اختر الجدول الأنسب لك</h3><p>الاقتراحات خالية من التعارضات حسب الأوقات التي راجعتها. جدولك الحالي يبقى محفوظًا.</p></div><span>'+proposals.length+' اقتراحات</span></div><div class="eduwave-proposal-list">'+proposals.map((proposal,index)=>'<article class="eduwave-proposal"><div><span>اقتراح '+(index+1)+'</span><h4>'+esc(proposal.title)+'</h4><p>'+esc(proposal.description)+'</p></div><div class="eduwave-proposal-stats"><b>'+new Set(proposal.rows.map(row=>row.day)).size+' أيام</b><b>'+proposal.chosen.length+' مواد</b></div><div class="eduwave-proposal-courses">'+proposal.chosen.map(item=>'<span>'+esc(item.course.course_code)+' · شعبة '+esc(item.section.section_no)+'</span>').join('')+'</div><button class="btn primary" type="button" data-apply-proposal="'+index+'">حفظ كجدول جديد</button></article>').join('')+'</div>'}
async function applyProposal(index){
 const proposal=proposals[index];if(!proposal||applying)return;
 if(new URLSearchParams(location.search).has('share')){toast('افتح جدولك الشخصي أولًا لحفظ اقتراح جديد. الجدول المشترك لم يتغير.',true);return;}
 applying=true;document.querySelectorAll('[data-apply-proposal]').forEach(button=>button.disabled=true);
 const rows=[];
 try{
  for(const item of proposal.chosen){const seriesId=uuid();for(const meeting of item.section.meetings)rows.push({id:uuid(),seriesId,course:item.course.course_code,day:meeting.day,start:meeting.start,end:meeting.end,room:meeting.room,teacher:item.section.instructor,type:'lecture',sectionNo:item.section.section_no});}
  saveGeneratedProfile(localStorage,rows,proposal.title+' · '+new Date().toLocaleDateString('ar-OM'),uuid());
 }catch(error){console.warn('Schedule save failed',error);toast('تعذر حفظ الجدول. جدولك السابق محفوظ؛ تحقق من مساحة التخزين ثم حاول.',true);applying=false;document.querySelectorAll('[data-apply-proposal]').forEach(button=>button.disabled=false);return;}
 let timer;
 try{
  await Promise.race([(async()=>{
   await rpc('uon_ai_sync_schedule',{p_session_id:identity(SESSION_KEY),p_client_token:identity(CLIENT_KEY),p_schedule:rows.map(row=>({course:row.course,day:row.day,start:row.start,end:row.end,room:row.room,teacher:row.teacher,type:row.type}))});
   await rpc('uon_confirm_schedule_sections',{p_session_id:identity(SESSION_KEY),p_client_token:identity(CLIENT_KEY),p_term:term||null,p_sections:proposal.chosen.map(item=>({course_code:item.course.course_code,course_name:item.course.course_name,section_no:item.section.section_no,instructor:item.section.instructor,capacity:0,enrolled:item.section.enrolled,meetings:item.section.meetings}))});
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('sync_timeout')),10000)})]);
  toast('تم حفظ جدول جديد وربطه مع UON AI. جدولك السابق محفوظ ✅');
 }catch(error){console.warn('Schedule cloud sync deferred',error);toast('تم حفظ الجدول على جهازك. تعذرت المزامنة الآن، وجدولك السابق محفوظ.');}
 finally{clearTimeout(timer);document.querySelector('#eduwaveModal')?.close();location.reload();}
}
input?.addEventListener('change',()=>{setFiles([...files,...(input.files||[])]);input.value=''});
dropzone?.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('dragging')});
dropzone?.addEventListener('dragleave',()=>dropzone.classList.remove('dragging'));
dropzone?.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('dragging');setFiles([...files,...[...(event.dataTransfer?.files||[])]])});
preview?.addEventListener('click',event=>{const button=event.target.closest('[data-remove-file]');if(button)setFiles(files.filter((_,index)=>index!==Number(button.dataset.removeFile)))});

const cancelButton=document.createElement('button');cancelButton.type='button';cancelButton.className='btn';cancelButton.textContent='إلغاء القراءة';cancelButton.hidden=true;cancelButton.id='cancelEduwaveAnalysis';
const analysisButton=document.querySelector('#analyseEduwave');analysisButton?.after(cancelButton);
const analysisStatus=document.createElement('p');analysisStatus.setAttribute('role','status');analysisStatus.className='eduwave-analysis-status';analysisButton?.before(analysisStatus);
cancelButton.addEventListener('click',()=>analysisController?.abort());
document.querySelector('#eduwaveModal')?.addEventListener('close',()=>analysisController?.abort());
dropzone?.setAttribute('role','button');dropzone?.setAttribute('tabindex','0');dropzone?.setAttribute('aria-label','اختيار صور الشعب');
dropzone?.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();if(!busy)input?.click();}});
analysisButton?.addEventListener('click',async()=>{
 if(!files.length||busy)return;
 busy=true;analysisController=new AbortController();const signal=analysisController.signal,selected=files.slice();
 analysisButton.disabled=true;input.disabled=true;cancelButton.hidden=false;dropzone?.setAttribute('aria-disabled','true');
 try{
  const images=[];
  for(let i=0;i<selected.length;i++){signal.throwIfAborted();analysisStatus.textContent='تجهيز الصورة '+(i+1)+' من '+selected.length+'…';images.push(await prepareImage(selected[i]));}
  signal.throwIfAborted();analysisStatus.textContent='قراءة المواد والشعب…';
  const data=await fetchScheduleParser({session_id:identity(SESSION_KEY),client_token:identity(CLIENT_KEY),images},{signal});
  signal.throwIfAborted();courses=normalizeExtraction(data);term=String(data.term||'');
  if(!courses.length)throw new Error('no_sections_found');
  renderReview();showStep('review');analysisStatus.textContent='';toast('تمت قراءة '+courses.length+' مواد. راجع الشعب والأوقات قبل التوليد.');
 }catch(error){
  const key=String(error?.message||'');let message='تعذرت قراءة الصور الآن. حاول مرة ثانية.';
  if(error?.name==='AbortError')message=signal.aborted?'تم إلغاء القراءة. لم يتغير جدولك.':'انتهت مهلة القراءة. جرّب عددًا أقل من الصور.';
  else if(/timeout/.test(key))message='تأخرت القراءة. جرّب عددًا أقل من الصور.';
  else if(key.includes('no_sections_found'))message='لم نجد شعبًا مكتملة. تأكد أن رمز المادة والشعبة والأيام والأوقات ظاهرة.';
  else if(/vision_provider_failed|vision_unavailable/.test(key))message='خدمة قراءة الصور غير متاحة مؤقتًا. صورك موجودة؛ حاول بعد قليل.';
  else if(key.includes('rate_limited'))message='تمت محاولات كثيرة. انتظر قليلًا ثم حاول.';
  else if(key.includes('images_too_large'))message='حجم الصور كبير. قلّل عددها ثم حاول.';
  analysisStatus.textContent=message;toast(message,true);
 }finally{busy=false;analysisController=null;input.disabled=false;analysisButton.disabled=!files.length;cancelButton.hidden=true;dropzone?.removeAttribute('aria-disabled');}
});
document.querySelector('#generateSchedules')?.addEventListener('click',()=>{
 syncReview();const result=generateProposals(courses);proposals=result.proposals;searchLimited=result.limited;
 if(!proposals.length){
  const messages={course_codes:'راجع رموز المواد: أدخل رمزًا صحيحًا ومختلفًا لكل مادة.',missing_sections:'اختر شعبة مكتملة وصحيحة واحدة على الأقل لكل مادة.',search_limit:'عدد الاحتمالات كبير. قلّل الشعب المختارة ثم جرّب مرة ثانية.',conflict:'لم نجد جدولًا بلا تعارض بين الشعب المختارة. جرّب شعبًا أخرى.'};
  toast(messages[result.reason]||'راجع المواد والشعب قبل التوليد.',true);return;
 }
 renderProposals();showStep('proposals');
});
document.querySelectorAll('[data-flow-back]').forEach(button=>button.addEventListener('click',()=>showStep(button.dataset.flowBack)));
document.querySelector('#eduwaveProposals')?.addEventListener('click',event=>{const button=event.target.closest('[data-apply-proposal]');if(button)applyProposal(Number(button.dataset.applyProposal))});

window.__UON_EDUWAVE_GENERATOR_VERSION__='2.1.0';
