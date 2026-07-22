import {
 setupNav,
 enforceUonMaintenance,
 watchUonMaintenance,
 $,
 get,
 insert,
 notifyPending,
 toast,
 fillCollege,
 esc,
 openModal,
 closeModal
} from './core.js';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();

fillCollege($('#collegeFilter'));
fillCollege($('#collegeInput'),{other:true});

let rows=[];

const whatsappLogo=`
<svg class="wa-card-logo" viewBox="0 0 32 32" aria-hidden="true">
 <path fill="currentColor" d="M16.04 3C8.86 3 3.02 8.7 3.02 15.72c0 2.47.73 4.86 2.11 6.91L3 29l6.58-2.06a13.14 13.14 0 0 0 6.45 1.69h.01c7.17 0 13.01-5.7 13.01-12.72C29.05 8.7 23.21 3 16.04 3Zm7.65 18.1c-.32.88-1.87 1.68-2.58 1.76-.66.07-1.49.1-2.4-.18-.55-.17-1.26-.4-2.17-.78-3.82-1.62-6.31-5.39-6.5-5.64-.18-.25-1.55-2.02-1.55-3.85s.98-2.73 1.33-3.1c.35-.37.76-.46 1.02-.46.25 0 .51 0 .73.01.23.01.55-.09.86.64.32.76 1.08 2.63 1.17 2.82.1.19.16.42.03.67-.13.25-.19.4-.38.62-.19.22-.4.49-.57.66-.19.18-.39.38-.17.75.22.37.98 1.58 2.11 2.56 1.45 1.27 2.67 1.66 3.05 1.85.38.19.6.16.82-.09.22-.25.95-1.08 1.2-1.45.25-.37.51-.31.86-.19.35.12 2.22 1.02 2.6 1.21.38.19.63.28.73.43.09.16.09.91-.23 1.79Z"/>
</svg>`;

async function load(){
 try{
  rows=await get('whatsapp_groups','select=*&approved=eq.true&order=created_at.desc');
  render();
 }catch(error){
  toast(error.message,true);
 }
}

function render(){
 const query=$('#search').value.trim().toLowerCase();
 const college=$('#collegeFilter').value;

 const filtered=rows.filter(item=>
  (!college||item.college===college)&&
  `${item.subject||''} ${item.course_code||''} ${item.college||''}`.toLowerCase().includes(query)
 );

 $('#items').innerHTML=filtered.length
  ?filtered.map(item=>`
   <article class="simple-group-card">
    <div class="simple-group-head">
     <span class="wa-logo-wrap">${whatsappLogo}</span>
     <span class="badge">${esc(item.college||'مجموعة')}</span>
    </div>
    <div>
     <h3>${esc(item.subject||'مجموعة واتساب')}</h3>
     <p>${esc(item.course_code||'')}</p>
    </div>
    <a class="whatsapp-join-button" target="_blank" rel="noopener" href="${esc(item.link)}">
     ${whatsappLogo}
     <span>دخول المجموعة</span>
    </a>
   </article>`).join('')
  :'<div class="empty">لا توجد مجموعات مطابقة حاليًا</div>';
}

$('#collegeInput').onchange=()=>{
 $('#otherCollegeField').hidden=$('#collegeInput').value!=='أخرى';
};

$('#search').oninput=render;
$('#collegeFilter').onchange=render;
$('#openForm').onclick=()=>openModal('submitModal');
$('#closeForm').onclick=()=>closeModal('submitModal');

$('#submitForm').onsubmit=async event=>{
 event.preventDefault();
 const body=Object.fromEntries(new FormData(event.target));

 if(body.college==='أخرى'){
  body.college=$('#otherCollege').value.trim();
 }

 body.approved=false;

 try{
  const result=await insert('whatsapp_groups',body);
  await notifyPending('whatsapp_groups',result[0].id);
  toast('تم إرسال المجموعة للمراجعة');
  event.target.reset();
  closeModal('submitModal');
 }catch(error){
  toast(error.message,true);
 }
};

load();
