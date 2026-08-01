import{$,$$,get,update,toast,esc,adminSession,formatDate}from'./core.js?v=39.0.0';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const statusLabels={active:'تشغيل',disabled:'إيقاف',coming_soon:'قريبًا',maintenance:'صيانة'};
const statusIcons={active:'🟢',disabled:'🔴',coming_soon:'🟡',maintenance:'🛠'};

function updateVersionLabels(){
 document.title='إدارة UON Hub V39';
 document.querySelectorAll('.sidebar h2').forEach(element=>element.textContent='UON Hub V39');
 document.querySelector('.admin-top h1')?.insertAdjacentHTML('beforeend',' <small style="font-size:12px;opacity:.65">V39</small>');
}
function removeConfessionsFromPending(){
 const select=$('#pendingTable');
 select?.querySelector('option[value="confessions"]')?.remove();
}
function installStyles(){
 if($('#adminV39Styles'))return;
 const style=document.createElement('style');
 style.id='adminV39Styles';
 style.textContent=`
  .v39-feature-row{display:grid;grid-template-columns:minmax(170px,1fr) 170px 120px;gap:10px;align-items:center;padding:13px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.025)}
  .v39-feature-row small{display:block;opacity:.65}.v39-feature-row select,.v39-visibility{width:100%}
  .v39-visibility.visible{background:#065f46;color:#fff}.v39-visibility.hidden{background:#374151;color:#fff}
  .v39-admin-note{padding:12px 14px;border-radius:14px;background:#1d4ed822;border:1px solid #60a5fa33;margin-bottom:14px;line-height:1.7}
  .v39-save-state{font-size:12px;min-height:18px;opacity:.72}
  @media(max-width:680px){.v39-feature-row{grid-template-columns:1fr}.v39-feature-row select,.v39-visibility{min-height:44px}}
 `;
 document.head.append(style);
}
async function renderFeatures(){
 const target=$('#featuresList');
 if(!target)return;
 target.innerHTML='<div class="empty">جاري تحميل الخدمات...</div>';
 try{
  const rows=await get('platform_features','select=*&order=sort_order.asc');
  target.innerHTML=`<div class="v39-admin-note">الحالة والظهور منفصلان: يمكنك إخفاء الأداة نهائيًا من الموقع، أو إبقاءها ظاهرة بحالة صيانة/قريبًا/متوقفة.</div><div id="v39FeatureSaveState" class="v39-save-state"></div>`+rows.map(item=>`<div class="v39-feature-row" data-v39-feature-row="${esc(item.key)}"><div><strong>${statusIcons[item.status]||'⚪'} ${esc(item.name)}</strong><small>${esc(item.key)}</small></div><select data-v39-status="${esc(item.key)}">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${item.status===value?'selected':''}>${label}</option>`).join('')}</select><button type="button" class="btn v39-visibility ${item.is_visible?'visible':'hidden'}" data-v39-visibility="${esc(item.key)}" data-visible="${item.is_visible?'1':'0'}">${item.is_visible?'👁 ظاهرة':'🙈 مخفية'}</button></div>`).join('');
  bindFeatureControls();
 }catch(error){target.innerHTML=`<div class="empty">${esc(error.message||'تعذر تحميل الخدمات')}</div>`}
}
function saveState(message,error=false){
 const state=$('#v39FeatureSaveState');
 if(state){state.textContent=message;state.style.color=error?'#fca5a5':'#86efac'}
}
function bindFeatureControls(){
 $$('[data-v39-status]').forEach(select=>select.addEventListener('change',async()=>{
  select.disabled=true;saveState('جاري حفظ الحالة...');
  try{
   await update('platform_features',`key=eq.${encodeURIComponent(select.dataset.v39Status)}`,{status:select.value,updated_at:new Date().toISOString()});
   saveState(`تم حفظ الحالة: ${statusLabels[select.value]}`);toast('تم تحديث حالة الخدمة');
   const row=select.closest('[data-v39-feature-row]');const title=row?.querySelector('strong');if(title)title.textContent=`${statusIcons[select.value]} ${title.textContent.replace(/^[^ ]+\s/,'')}`;
  }catch(error){saveState(error.message||'تعذر الحفظ',true);toast(error.message||'تعذر الحفظ',true)}finally{select.disabled=false}
 }));
 $$('[data-v39-visibility]').forEach(button=>button.addEventListener('click',async()=>{
  const visible=button.dataset.visible!=='1';
  button.disabled=true;saveState('جاري حفظ الظهور...');
  try{
   await update('platform_features',`key=eq.${encodeURIComponent(button.dataset.v39Visibility)}`,{is_visible:visible,updated_at:new Date().toISOString()});
   button.dataset.visible=visible?'1':'0';button.classList.toggle('visible',visible);button.classList.toggle('hidden',!visible);button.textContent=visible?'👁 ظاهرة':'🙈 مخفية';
   saveState(visible?'تم إظهار الخدمة في الموقع':'تم إخفاء الخدمة من الموقع');toast(visible?'تم إظهار الخدمة':'تم إخفاء الخدمة');
  }catch(error){saveState(error.message||'تعذر الحفظ',true);toast(error.message||'تعذر الحفظ',true)}finally{button.disabled=false}
 }));
}
function patchFeatureSectionButton(){
 document.querySelector('[data-section="features"]')?.addEventListener('click',()=>renderFeatures(),true);
}
function addDirectConfessionsManagement(){
 const pendingSection=$('#sec-pending');
 if(!pendingSection||$('#v39ConfessionsManager'))return;
 const block=document.createElement('div');
 block.id='v39ConfessionsManager';
 block.className='card form-card';
 block.style.marginTop='18px';
 block.innerHTML='<div class="section-head"><div><h2>الاعترافات المنشورة مباشرة</h2><p>الاعترافات لا تمر بالمراجعة. افتح الإدارة لحذف المحتوى المخالف.</p></div><button class="btn" id="v39LoadConfessions" type="button">عرض الاعترافات</button></div><div id="v39ConfessionsList" class="list"></div>';
 pendingSection.append(block);
 $('#v39LoadConfessions')?.addEventListener('click',loadConfessions);
}
async function loadConfessions(){
 const target=$('#v39ConfessionsList');if(!target)return;
 target.innerHTML='<div class="empty">جاري التحميل...</div>';
 try{
  const rows=await get('confessions','select=id,text,content,college,program,status,created_at&order=created_at.desc&limit=100');
  target.innerHTML=rows.length?rows.map(item=>`<div class="list-row"><div><strong>${esc(String(item.text||item.content||'').slice(0,130))}</strong><small>${esc([item.college,item.program].filter(Boolean).join(' • ')||'عام')} • ${formatDate(item.created_at)}</small></div><button class="btn danger" type="button" data-v39-delete-confession="${esc(item.id)}">حذف</button></div>`).join(''):'<div class="empty">لا توجد اعترافات</div>';
  $$('[data-v39-delete-confession]').forEach(button=>button.addEventListener('click',async()=>{
   if(!confirm('حذف الاعتراف نهائيًا؟'))return;
   button.disabled=true;
   try{
    const {remove}=await import('./core.js?v=39.0.0');
    await remove('confessions',`id=eq.${encodeURIComponent(button.dataset.v39DeleteConfession)}`);
    button.closest('.list-row')?.remove();toast('تم حذف الاعتراف');
   }catch(error){toast(error.message||'تعذر الحذف',true);button.disabled=false}
  }));
 }catch(error){target.innerHTML=`<div class="empty">${esc(error.message||'تعذر التحميل')}</div>`}
}
async function waitForAdmin(){
 for(let i=0;i<120;i++){
  if(adminSession()?.created_at&&sessionStorage.getItem('uon_admin')==='1')return true;
  await sleep(500);
 }
 return false;
}

installStyles();updateVersionLabels();removeConfessionsFromPending();patchFeatureSectionButton();addDirectConfessionsManagement();
waitForAdmin().then(ok=>{if(ok&&$('#sec-features')?.classList.contains('active'))renderFeatures()});
