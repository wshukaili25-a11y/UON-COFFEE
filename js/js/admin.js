
import {get,update,remove,insert,rpc} from './api.js';import {$,$$,esc,toast,formatDate} from './ui.js';
let authenticated=false;
const defs={
 announcements:{table:'site_announcements',filter:'',title:'الإعلانات'},
 summaries:{table:'summaries',filter:'approved=eq.false',title:'الملخصات'},
 groups:{table:'whatsapp_groups',filter:'approved=eq.false',title:'المجموعات'},
 projects:{table:'student_projects',filter:'status=eq.pending',title:'المشاريع'},
 ratings:{table:'rating_submissions',filter:'status=eq.pending',title:'التقييمات'},
 tools:{table:'tools_items',filter:'',title:'الأدوات'},
 confessions:{table:'confessions',filter:'status=eq.pending',title:'الاعترافات'},
 programs:{table:'university_programs',filter:'',title:'دليل الجامعة'},
 telegram:{table:'telegram_admins',filter:'',title:'مشرفو تلجرام'}
};
window.login=async()=>{
 const password=$('#adminPassword').value.trim();
 if(!password)return toast('أدخل كلمة المرور',true);
 try{
  const result=await rpc('check_admin_password',{p_password:password});
  const ok=result===true||result==='true'||result?.ok===true;
  if(!ok)throw new Error(result?.message||'كلمة المرور غير صحيحة');
  sessionStorage.setItem('uon_admin_password',password);
  authenticated=true;
  $('#loginOverlay').style.display='none';
  loadDashboard();
 }catch(e){toast(e.message||'تعذر تسجيل الدخول',true)}
};
window.showSection=(name,btn)=>{$$('.admin-section').forEach(x=>x.classList.remove('active'));$(`#section-${name}`)?.classList.add('active');$$('.admin-nav button').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');if(defs[name])loadList(name)};
function row(name,x){
 const title=x.title||x.subject||x.target_name||x.name||'بدون عنوان';
 const desc=x.body||x.description||x.comment||x.content||x.college||'';
 let actions='';

 if(name==='announcements'){
   actions=`<button onclick="toggleAnnouncement('${x.id}',${!x.active})">${x.active?'إيقاف':'تشغيل'}</button><button class="reject" onclick="deleteItem('${name}','${x.id}')">حذف</button>`;
 }else if(name==='tools'){
   actions=`<select class="status-select" onchange="setToolStatus('${x.id}',this.value)"><option value="active" ${x.status==='active'?'selected':''}>تشغيل</option><option value="disabled" ${x.status==='disabled'?'selected':''}>إيقاف</option><option value="coming_soon" ${x.status==='coming_soon'?'selected':''}>قريبًا</option><option value="maintenance" ${x.status==='maintenance'?'selected':''}>صيانة</option></select><button onclick="editTool(\'${x.id}\')">تعديل</button><button class="feature" onclick="featureTool('${x.id}',${!x.featured})">${x.featured?'إلغاء التمييز':'تمييز'}</button><button class="reject" onclick="deleteItem('${name}','${x.id}')">حذف</button>`;
 }else{
   actions=`<button class="approve" onclick="approveItem('${name}','${x.id}')">قبول</button><button class="reject" onclick="rejectItem('${name}','${x.id}')">رفض</button>`;
 }

 return `<div class="admin-row"><div><strong>${esc(title)}</strong><p>${esc(desc)}</p><small>${formatDate(x.created_at)}</small></div><div class="row-actions">${actions}</div></div>`
}
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


window.createTool=async()=>{
 const body={
  id:`custom-${Date.now()}`,
  category_id:$('#toolCategoryId').value.trim()||'ai',
  name:$('#toolName').value.trim(),
  description:$('#toolDescription').value.trim(),
  url:$('#toolUrl').value.trim(),
  emoji:$('#toolEmoji').value.trim()||'🧰',
  featured:false,disabled:false,status:'active'
 };
 if(!body.name||!body.url)return toast('أكمل اسم الأداة والرابط',true);
 try{await insert('tools_items',body);toast('تمت إضافة الأداة');loadList('tools')}
 catch(e){toast(e.message,true)}
};

window.toggleTool=async(id,disabled)=>{
 try{await update('tools_items',`id=eq.${encodeURIComponent(id)}`,{disabled});toast('تم التحديث');loadList('tools')}
 catch(e){toast(e.message,true)}
};

window.featureTool=async(id,featured)=>{
 try{await update('tools_items',`id=eq.${encodeURIComponent(id)}`,{featured});toast('تم التحديث');loadList('tools')}
 catch(e){toast(e.message,true)}
};

window.setToolStatus=async(id,status)=>{try{await update('tools_items',`id=eq.${encodeURIComponent(id)}`,{status,disabled:status!=='active'});toast('تم تحديث حالة الأداة');loadList('tools')}catch(e){toast(e.message,true)}};
window.createProgram=async()=>{const body={name_ar:$('#progName').value.trim(),college:$('#progCollege').value.trim(),degree:$('#progDegree').value.trim(),credit_hours:Number($('#progHours').value)||null,credit_hour_price:Number($('#progPrice').value)||null,official_url:$('#progOfficial').value.trim(),study_plan_url:$('#progPlan').value.trim()||null,active:true};if(!body.name_ar||!body.official_url)return toast('أكمل الاسم والرابط الرسمي',true);try{await insert('university_programs',body);toast('تم حفظ البرنامج');loadList('programs')}catch(e){toast(e.message,true)}};

async function getSetting(key){
 try{
  const rows=await get('site_settings',`select=key,value&key=eq.${encodeURIComponent(key)}`);
  return rows?.[0]?.value;
 }catch{return null}
}
async function saveSetting(key,value){
 const existing=await get('site_settings',`select=key&key=eq.${encodeURIComponent(key)}`);
 if(existing?.length){
  return update('site_settings',`key=eq.${encodeURIComponent(key)}`,{value,updated_at:new Date().toISOString()});
 }
 return insert('site_settings',{key,value});
}
async function loadSiteControls(){
 const [maintenance,message,whatsapp]=await Promise.all([
  getSetting('maintenance_enabled'),
  getSetting('maintenance_message'),
  getSetting('whatsapp_channel_url')
 ]);
 const on=maintenance===true||maintenance==='true';
 if($('#maintenanceToggle'))$('#maintenanceToggle').checked=on;
 if($('#maintenanceStatusText'))$('#maintenanceStatusText').textContent=on?'الموقع الآن تحت الصيانة':'الموقع متاح للزوار';
 if($('#maintenanceMessageInput'))$('#maintenanceMessageInput').value=message||'نعمل حاليًا على تحسين UON Hub. بنرجع لكم قريبًا.';
 if($('#whatsappChannelInput'))$('#whatsappChannelInput').value=whatsapp||'';
}
window.setMaintenance=async on=>{
 try{
  await saveSetting('maintenance_enabled',on);
  $('#maintenanceStatusText').textContent=on?'الموقع الآن تحت الصيانة':'الموقع متاح للزوار';
  toast(on?'تم تشغيل الصيانة الكاملة':'تم فتح الموقع للزوار');
 }catch(e){toast(e.message,true)}
};
window.saveMaintenanceMessage=async()=>{
 try{await saveSetting('maintenance_message',$('#maintenanceMessageInput').value.trim());toast('تم حفظ رسالة الصيانة')}
 catch(e){toast(e.message,true)}
};
window.saveWhatsappChannel=async()=>{
 try{await saveSetting('whatsapp_channel_url',$('#whatsappChannelInput').value.trim());toast('تم حفظ رابط قناة واتساب')}
 catch(e){toast(e.message,true)}
};
window.createTelegramAdmin=async()=>{
 const body={
  name:$('#tgAdminName').value.trim(),
  chat_id:$('#tgAdminChatId').value.trim(),
  role:$('#tgAdminRole').value,
  notifications_enabled:$('#tgAdminNotifications').value==='true',
  active:true
 };
 if(!body.name||!body.chat_id)return toast('أدخل الاسم وChat ID',true);
 try{await insert('telegram_admins',body);toast('تمت إضافة مشرف تلجرام');loadList('telegram')}
 catch(e){toast(e.message,true)}
};
window.toggleTelegramAdmin=async(id,active)=>{
 try{await update('telegram_admins',`id=eq.${id}`,{active});toast('تم التحديث');loadList('telegram')}
 catch(e){toast(e.message,true)}
};
const originalRow=row;
row=function(name,x){
 if(name==='telegram'){
  return `<div class="admin-row"><div><strong>${esc(x.name)}</strong><p>Chat ID: ${esc(x.chat_id)} — ${esc(x.role)}</p><small>${x.notifications_enabled?'الإشعارات مفعلة':'الإشعارات متوقفة'}</small></div><div class="row-actions"><button onclick="toggleTelegramAdmin('${x.id}',${!x.active})">${x.active?'إيقاف':'تشغيل'}</button><button class="reject" onclick="deleteItem('telegram','${x.id}')">حذف</button></div></div>`;
 }
 return originalRow(name,x);
};
loadSiteControls();

window.editTool=async id=>{
 try{
  const rows=await get('tools_items',`select=*&id=eq.${encodeURIComponent(id)}`);
  const t=rows?.[0];if(!t)return;
  $('#toolEditId').value=t.id;$('#toolName').value=t.name||'';$('#toolCategoryId').value=t.category_id||'';$('#toolDescription').value=t.description||'';$('#toolUrl').value=t.url||'';$('#toolEmoji').value=t.emoji||'';
  window.scrollTo({top:0,behavior:'smooth'});
 }catch(e){toast(e.message,true)}
};
window.resetToolForm=()=>{$('#toolEditId').value='';['toolName','toolCategoryId','toolDescription','toolUrl','toolEmoji'].forEach(id=>$('#'+id).value='')};
window.saveTool=async()=>{
 const id=$('#toolEditId').value.trim();
 const body={category_id:$('#toolCategoryId').value.trim()||'ai',name:$('#toolName').value.trim(),description:$('#toolDescription').value.trim(),url:$('#toolUrl').value.trim(),emoji:$('#toolEmoji').value.trim()||'🧰'};
 if(!body.name||!body.url)return toast('أكمل اسم الأداة والرابط',true);
 try{new URL(body.url)}catch{return toast('رابط الأداة غير صالح',true)}
 try{
  if(id)await update('tools_items',`id=eq.${encodeURIComponent(id)}`,body);
  else await insert('tools_items',{id:`custom-${Date.now()}`,...body,featured:false,disabled:false,status:'active'});
  resetToolForm();toast(id?'تم تعديل الأداة':'تمت إضافة الأداة');loadList('tools')
 }catch(e){toast(e.message,true)}
};

document.getElementById('adminPassword')?.addEventListener('keydown',event=>{
 if(event.key==='Enter'){
  event.preventDefault();
  window.login();
 }
});

window.logoutAdmin=()=>{
 sessionStorage.removeItem('uon_admin_password');
 sessionStorage.removeItem('uon_admin_entry');
 location.reload();
};
