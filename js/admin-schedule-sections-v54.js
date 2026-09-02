import{rpc,toast,esc}from'./core.js?v=53.3.0';

function host(){return document.querySelector('#sec-overview')||document.querySelector('main')||document.body}
function sample(){return JSON.stringify([
 {course_code:'INFS301',section_code:'1',day:'الأحد',start:'10:00',end:'11:50',room:'8-3',instructor:'اسم الدكتور'},
 {course_code:'INFS301',section_code:'1',day:'الثلاثاء',start:'10:00',end:'11:50',room:'8-3',instructor:'اسم الدكتور'}
],null,2)}
function render(){
 if(document.querySelector('#adminScheduleSectionsV54'))return;
 const root=host();if(!root)return;
 const card=document.createElement('section');card.id='adminScheduleSectionsV54';card.className='card';
 card.innerHTML=`<div class="section-head"><div><h3>شُعب الجدول الذكي</h3><p>استيراد شعب فصل دراسي إلى مولّد UON AI. لا تُفعّل «موثقة» إلا للمصدر الرسمي.</p></div></div>
 <form id="scheduleSectionsImportForm" class="admin-form">
  <div class="form-grid">
   <label>الفصل<input id="sectionsTerm" value="2026-Fall" required placeholder="2026-Fall"></label>
   <label>رابط المصدر<input id="sectionsSource" type="url" placeholder="https://..."></label>
  </div>
  <label>البيانات JSON<textarea id="sectionsRows" rows="12" spellcheck="false"></textarea></label>
  <label style="display:flex;gap:.5rem;align-items:center"><input id="sectionsVerified" type="checkbox"> موثقة من مصدر رسمي</label>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn primary" type="submit">استيراد الشعب</button><button class="btn" id="sectionsSample" type="button">مثال</button></div>
  <small id="sectionsImportResult"></small>
 </form>`;
 root.append(card);
 const rows=card.querySelector('#sectionsRows');rows.value=sample();
 card.querySelector('#sectionsSample')?.addEventListener('click',()=>{rows.value=sample()});
 card.querySelector('#scheduleSectionsImportForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=event.submitter||card.querySelector('button[type="submit"]');button.disabled=true;
  const result=card.querySelector('#sectionsImportResult');
  try{
   const password=sessionStorage.getItem('uon_admin_password')||'';if(!password)throw new Error('سجّل الدخول كإدارة أولًا');
   let parsed;try{parsed=JSON.parse(rows.value)}catch{throw new Error('صيغة JSON غير صحيحة')}
   if(!Array.isArray(parsed))throw new Error('البيانات يجب أن تكون قائمة JSON');
   const data=await rpc('uon_admin_import_course_sections',{p_password:password,p_term:card.querySelector('#sectionsTerm').value.trim(),p_rows:parsed,p_source_url:card.querySelector('#sectionsSource').value.trim()||null,p_verified:card.querySelector('#sectionsVerified').checked});
   result.innerHTML=`تم الاستيراد: <strong>${Number(data?.imported||0)}</strong> • تم تجاهل: ${Number(data?.skipped||0)} • ${data?.verified?'موثقة':'بانتظار التوثيق'}`;
   toast(`تم استيراد ${Number(data?.imported||0)} سجل للشعب`);
  }catch(error){result.textContent=error.message||'تعذر الاستيراد';toast(error.message||'تعذر الاستيراد',true)}finally{button.disabled=false}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
