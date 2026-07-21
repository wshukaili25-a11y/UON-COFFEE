
import {get,update,remove,insert,rpc} from './api.js';import {$,$$,esc,toast,formatDate} from './ui.js';
let authenticated=false;
const defs={
 announcements:{table:'site_announcements',filter:'',title:'الإعلانات'},
 summaries:{table:'summaries',filter:'approved=eq.false',title:'الملخصات'},
 groups:{table:'whatsapp_groups',filter:'approved=eq.false',title:'المجموعات'},
 projects:{table:'student_projects',filter:'status=eq.pending',title:'المشاريع'},
 ratings:{table:'rating_submissions',filter:'status=eq.pending',title:'التقييمات'}
};
window.login=async()=>{try{const password=$('#adminPassword').value;const result=await rpc('check_admin_password',{p_password:password});if(result===true||result?.ok===true){sessionStorage.setItem('uon_admin_password',password);authenticated=true;$('#loginOverlay').style.display='none';loadDashboard()}else throw new Error('كلمة المرور غير صحيحة')}catch(e){toast(e.message,true)}};
window.showSection=(name,btn)=>{$$('.admin-section').forEach(x=>x.classList.remove('active'));$(`#section-${name}`)?.classList.add('active');$$('.admin-nav button').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');if(defs[name])loadList(name)};
function row(name,x){const title=x.title||x.subject||x.target_name||x.name||'بدون عنوان';const desc=x.body||x.description||x.comment||x.college||'';let actions='';
 if(name==='announcements')actions=`<button onclick="toggleAnnouncement('${x.id}',${!x.active})">${x.active?'إيقاف':'تشغيل'}</button><button class="reject" onclick="deleteItem('${name}','${x.id}')">حذف</button>`;
 else actions=`<button class="approve" onclick="approveItem('${name}','${x.id}')">قبول</button><button class="reject" onclick="rejectItem('${name}','${x.id}')">رفض</button>${name==='projects'&&x.status==='approved'?`<button class="feature" onclick="featureProject('${x.id}',${!x.featured})">تمييز</button>`:''}`;
 return `<div class="admin-row"><div><strong>${esc(title)}</strong><p>${esc(desc)}</p><small>${formatDate(x.created_at)}</small></div><div class="row-actions">${actions}</div></div>`}
async function loadList(name){const d=defs[name],el=$(`#list-${name}`);if(!el)return;try{const query=`select=*&${d.filter?d.filter+'&':''}order=created_at.desc`;const rows=await get(d.table,query);el.innerHTML=rows.length?rows.map(x=>row(name,x)).join(''):'<div class="empty">لا توجد طلبات</div>'}catch(e){el.innerHTML=`<div class="empty">${esc(e.message)}</div>`}}
window.approveItem=async(name,id)=>{const d=defs[name];const body=name==='summaries'||name==='groups'?{approved:true}:name==='projects'?{status:'approved',reviewed_at:new Date().toISOString()}:{status:'approved',reviewed_at:new Date().toISOString()};try{await update(d.table,`id=eq.${encodeURIComponent(id)}`,body);toast('تم القبول');loadList(name);loadStats()}catch(e){toast(e.message,true)}};
window.rejectItem=async(name,id)=>{const d=defs[name];if(name==='summaries'||name==='groups')return deleteItem(name,id);try{await update(d.table,`id=eq.${encodeURIComponent(id)}`,{status:'rejected',reviewed_at:new Date().toISOString()});toast('تم الرفض');loadList(name);loadStats()}catch(e){toast(e.message,true)}};
window.deleteItem=async(name,id)=>{if(!confirm('حذف نهائي؟'))return;try{await remove(defs[name].table,`id=eq.${encodeURIComponent(id)}`);toast('تم الحذف');loadList(name);loadStats()}catch(e){toast(e.message,true)}};
window.toggleAnnouncement=async(id,active)=>{try{await update('site_announcements',`id=eq.${id}`,{active});toast('تم التحديث');loadList('announcements')}catch(e){toast(e.message,true)}};
window.featureProject=async(id,featured)=>{try{if(featured)await update('student_projects','featured=eq.true',{featured:false});await update('student_projects',`id=eq.${id}`,{featured});toast('تم التحديث');loadList('projects')}catch(e){toast(e.message,true)}};
window.createAnnouncement=async()=>{const body={title:$('#annTitle').value.trim(),body:$('#annBody').value.trim(),type:$('#annType').value,priority:Number($('#annPriority').value),button_text:$('#annButtonText').value.trim(),button_url:$('#annButtonUrl').value.trim(),active:true,expires_at:$('#annExpires').value||null};if(!body.title||!body.body)return toast('أكمل العنوان والنص',true);try{await insert('site_announcements',body);toast('تم نشر الإعلان');loadList('announcements');loadStats()}catch(e){toast(e.message,true)}};
async function count(table,query=''){try{return (await get(table,`select=id&${query}${query?'&':''}limit=1000`)).length}catch{return 0}}
async function loadStats(){const vals=await Promise.all([count('summaries','approved=eq.false'),count('whatsapp_groups','approved=eq.false'),count('student_projects','status=eq.pending'),count('rating_submissions','status=eq.pending')]);['statSummaries','statGroups','statProjects','statRatings'].forEach((id,i)=>$(`#${id}`).textContent=vals[i])}
async function loadDashboard(){await loadStats();loadList('announcements')}
const saved=sessionStorage.getItem('uon_admin_password');if(saved){$('#adminPassword').value=saved;login()}
