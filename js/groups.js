import { setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,notifyPending,toast,fillCollege,esc,openModal,closeModal,rpc } from './core.js?v=26.1';
setupNav(); await enforceUonMaintenance(); watchUonMaintenance();

const LANG_KEY='uon_language',LEGACY_LANG_KEY='uon_hub_lang';
const language=()=>localStorage.getItem(LANG_KEY)==='en'||(localStorage.getItem(LANG_KEY)!=='ar'&&localStorage.getItem(LEGACY_LANG_KEY)==='en')?'en':'ar';
const en=()=>language()==='en';
const t=(ar,enText)=>en()?enText:ar;
const collegeNames={
 'كلية العلوم والآداب':'College of Arts and Sciences',
 'كلية الاقتصاد والإدارة ونظم المعلومات':'College of Economics, Management and Information Systems',
 'كلية الهندسة والعمارة':'College of Engineering and Architecture',
 'كلية العلوم الصحية':'College of Health Sciences',
 'أخرى':'Other'
};
const collegeLabel=value=>en()?(collegeNames[value]||value):value;

const searchInput=$('#groupSearch'),collegeFilter=$('#groupCollege'),itemsContainer=$('#groupsGrid');
function translateCollegeOptions(select){
 if(!select)return;
 [...select.options].forEach(option=>{
  if(!option.value){option.textContent=t(select===collegeFilter?'كل الكليات':'اختر الكلية',select===collegeFilter?'All colleges':'Choose college');return}
  option.textContent=collegeLabel(option.value);
 });
}
function fillCollegeWithOther(select){if(!select)return;fillCollege(select,{other:true});translateCollegeOptions(select)}
fillCollegeWithOther(collegeFilter);
const collegeInput=$('#collegeInput');fillCollegeWithOther(collegeInput);

const SESSION_KEY='uon_group_submission_session_v2';
let sessionId=localStorage.getItem(SESSION_KEY);
if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(SESSION_KEY,sessionId)}
let rows=[];

const whatsappLogo=`<svg class="wa-card-logo" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C8.86 3 3.02 8.7 3.02 15.72c0 2.47.73 4.86 2.11 6.91L3 29l6.58-2.06a13.14 13.14 0 0 0 6.45 1.69h.01c7.17 0 13.01-5.7 13.01-12.72C29.05 8.7 23.21 3 16.04 3Zm7.65 18.1c-.32.88-1.87 1.68-2.58 1.76-.66.07-1.49.1-2.4-.18-.55-.17-1.26-.4-2.17-.78-3.82-1.62-6.31-5.39-6.5-5.64-.18-.25-1.55-2.02-1.55-3.85s.98-2.73 1.33-3.1c.35-.37.76-.46 1.02-.46.25 0 .51 0 .73.01.23.01.55-.09.86.64.32.76 1.08 2.63 1.17 2.82.1.19.16.42.03.67-.13.25-.19.4-.38.62-.19.22-.4.49-.57.66-.19.18-.39.38-.17.75.22.37.98 1.58 2.11 2.56 1.45 1.27 2.67 1.66 3.05 1.85.38.19.6.16.82-.09.22-.25.95-1.08 1.2-1.45.25-.37.51-.31.86-.19.35.12 2.22 1.02 2.6 1.21.38.19.63.28.73.43.09.16.09.91-.23 1.79Z"/></svg>`;

function showLoadError(error){
 console.error('WhatsApp groups load error',error);
 if(itemsContainer)itemsContainer.innerHTML=`<div class="group-empty">${t('تعذر تحميل مجموعات المواد حاليًا. حاول تحديث الصفحة بعد قليل.','Course groups could not be loaded right now. Please refresh in a moment.')}</div>`;
 toast(t('تعذر تحميل مجموعات المواد','Could not load course groups'),true);
}
async function load(){
 if(!itemsContainer)return;
 itemsContainer.innerHTML=`<div class="group-empty">${t('جاري تحميل المجموعات…','Loading groups…')}</div>`;
 try{
  rows=await get('public_whatsapp_groups','select=id,link,subject,college,description,approved,created_at,course_code,members_count,updated_at&order=created_at.desc');
  rows=Array.isArray(rows)?rows:[];
  render();
 }catch(error){showLoadError(error)}
}
function render(){
 const query=(searchInput?.value||'').trim().toLowerCase(),college=collegeFilter?.value||'';
 const filtered=rows.filter(item=>(!college||item.college===college)&&`${item.subject||''} ${item.course_code||''} ${item.college||''}`.toLowerCase().includes(query));
 if(!itemsContainer)return;
 itemsContainer.innerHTML=filtered.length?filtered.map(item=>`<article class="simple-group-card"><div class="simple-group-head"><span class="wa-logo-wrap">${whatsappLogo}</span><span class="badge">${esc(collegeLabel(item.college||t('مجموعة','Group')))}</span></div><div><h3>${esc(item.subject||t('مجموعة واتساب','WhatsApp group'))}</h3><p>${esc(item.course_code||'')}</p></div><a class="whatsapp-join-button" target="_blank" rel="noopener" href="${esc(item.link)}">${whatsappLogo}<span>${t('دخول المجموعة','Join group')}</span></a></article>`).join(''):`<div class="group-empty">${t('لا توجد مجموعات مطابقة حاليًا','No matching groups right now')}</div>`;
}

searchInput?.addEventListener('input',render);
collegeFilter?.addEventListener('change',render);
$('#clearGroupFilters')?.addEventListener('click',()=>{if(searchInput)searchInput.value='';if(collegeFilter)collegeFilter.value='';render()});
$('#openForm')?.addEventListener('click',()=>openModal('submitModal'));
$('#closeForm')?.addEventListener('click',()=>closeModal('submitModal'));

$('#submitForm')?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(event.currentTarget.dataset.submitting==='1')return;
 const raw=Object.fromEntries(new FormData(event.currentTarget));
 const body={subject:String(raw.subject||'').trim(),course_code:String(raw.course_code||'').trim().toUpperCase().replace(/\s+/g,''),college:String(raw.college||'').trim(),link:String(raw.link||'').trim(),description:String(raw.description||'').trim()};
 if(!body.subject||!body.college||!body.link){toast(t('أكمل البيانات المطلوبة','Complete the required fields'),true);return}
 const button=event.currentTarget.querySelector('[type="submit"]');
 event.currentTarget.dataset.submitting='1';button.disabled=true;
 const original=button.textContent;button.textContent=t('جاري الإرسال...','Submitting...');
 try{
  const id=await rpc('uon_submit_whatsapp_group_v2',{p_subject:body.subject,p_course_code:body.course_code||null,p_college:body.college,p_link:body.link,p_description:body.description||null,p_session_id:sessionId});
  await notifyPending('whatsapp_groups',id);
  toast(t('تم إرسال المجموعة للمراجعة','Group submitted for review'));
  event.currentTarget.reset();fillCollegeWithOther(collegeInput);closeModal('submitModal');
 }catch(error){
  console.error('WhatsApp group submit error',error);
  toast(error.message||t('تعذر إرسال المجموعة للمراجعة','Could not submit the group'),true);
 }finally{
  event.currentTarget.dataset.submitting='0';button.disabled=false;button.textContent=original;
 }
});

load();
