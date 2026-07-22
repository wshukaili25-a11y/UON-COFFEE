document.documentElement.classList.remove('maintenance-check');

import {$,$$,get,insert,update,remove,rpc,toast,esc,edge,fillCollege,saveAdminSession,clearAdminSession,formatDate} from './core.js';
let authed=false;

function showLogin(){
 const login=$('#login');
 const dashboard=$('#dashboard');
 if(login){login.hidden=false;login.style.display='grid'}
 if(dashboard){dashboard.hidden=true;dashboard.style.display='none'}
}

function showDashboard(){
 const login=$('#login');
 const dashboard=$('#dashboard');
 if(login){login.hidden=true;login.style.display='none'}
 if(dashboard){dashboard.hidden=false;dashboard.style.display='grid'}
}

showLogin();
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{const r=await rpc('uon_admin_login',{p_password:$('#password').value});if(!(r?.ok??r===true))throw new Error('كلمة المرور غير صحيحة');authed=true;sessionStorage.setItem('uon_admin','1');saveAdminSession(r);showDashboard();loadAll().catch(err=>toast(err.message,true))}catch(err){toast(err.message,true)}};
if(sessionStorage.getItem('uon_admin')==='1'){authed=true;showDashboard();loadAll().catch(err=>toast(err.message,true))}
$('#logout').onclick=()=>{clearAdminSession();location.href='admin.html'};$('#menuAdmin').onclick=()=>$('#sidebar').classList.toggle('open');
$$('[data-section]').forEach(b=>b.onclick=()=>{$$('.admin-section').forEach(x=>x.classList.remove('active'));$('#sec-'+b.dataset.section).classList.add('active');$('#sidebar').classList.remove('open');if(b.dataset.section==='pending')loadPending()});
async function settings(){const r=await get('site_settings','select=key,value');const m=Object.fromEntries(r.map(x=>[x.key,x.value]));$('#maintenance').checked=m.maintenance_enabled===true||String(m.maintenance_enabled).toLowerCase()==='true';$('#maintenanceMessage').value=m.maintenance_message||'';$('#maintenanceUntil').value=m.maintenance_until?String(m.maintenance_until).slice(0,16):'';$('#whatsappUrl').value=m.whatsapp_channel_url||'';if($('#instagramUrl'))$('#instagramUrl').value=m.instagram_url||''}
async function upsertSetting(key,value){const r=await get('site_settings',`select=key&key=eq.${encodeURIComponent(key)}`);return r.length?update('site_settings',`key=eq.${encodeURIComponent(key)}`,{value,updated_at:new Date().toISOString()}):insert('site_settings',{key,value})}
$('#saveSite').onclick=async()=>{try{await Promise.all([upsertSetting('maintenance_enabled',$('#maintenance').checked),upsertSetting('maintenance_message',$('#maintenanceMessage').value),upsertSetting('maintenance_until',$('#maintenanceUntil').value||null),upsertSetting('whatsapp_channel_url',$('#whatsappUrl').value),upsertSetting('instagram_url',$('#instagramUrl')?.value||'')]);toast('تم حفظ إعدادات الموقع');await settings()}catch(e){toast(e.message,true)}};
async function features(){const r=await get('platform_features','select=*&order=sort_order.asc');$('#featuresList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.key)}</small></div><select data-feature="${esc(x.key)}"><option value="active" ${x.status==='active'?'selected':''}>تشغيل</option><option value="disabled" ${x.status==='disabled'?'selected':''}>إيقاف</option><option value="coming_soon" ${x.status==='coming_soon'?'selected':''}>قريبًا</option><option value="maintenance" ${x.status==='maintenance'?'selected':''}>صيانة</option></select></div>`).join('');$$('[data-feature]').forEach(s=>s.onchange=async()=>{await update('platform_features',`key=eq.${encodeURIComponent(s.dataset.feature)}`,{status:s.value,updated_at:new Date().toISOString()});toast('تم تحديث الخدمة')})}
const defs={summaries:['title','approved'],whatsapp_groups:['subject','approved'],student_projects:['title','status'],rating_submissions:['target_name','status'],confessions:['content','status']};
async function loadPending(){const t=$('#pendingTable').value,[title,col]=defs[t];const q=col==='approved'?`${col}=eq.false`:`${col}=eq.pending`;const r=await get(t,`select=*&${q}&order=created_at.desc`);$('#pendingList').innerHTML=r.length?r.map(x=>`<div class="list-row"><div><strong>${esc(x[title])}</strong><small>${new Date(x.created_at).toLocaleString('ar')}</small></div><div class="actions"><button class="btn success" data-ok="${x.id}">قبول</button><button class="btn danger" data-no="${x.id}">رفض</button></div></div>`).join(''):'<div class="empty">لا توجد طلبات</div>';$$('[data-ok]').forEach(b=>b.onclick=()=>moderate(t,b.dataset.ok,true));$$('[data-no]').forEach(b=>b.onclick=()=>moderate(t,b.dataset.no,false))}
async function moderate(t,id,ok){const col=defs[t][1];if(!ok&&col==='approved')await remove(t,`id=eq.${id}`);else await update(t,`id=eq.${id}`,col==='approved'?{approved:true}:{status:ok?'approved':'rejected'});toast(ok?'تم القبول':'تم الرفض');loadPending()}
$('#pendingTable').onchange=loadPending;
async function ads(){const r=await get('site_announcements','select=*&order=created_at.desc');$('#adsList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.title)}</strong><small>${x.active?'نشط':'متوقف'} • ${formatDate(x.starts_at)} إلى ${formatDate(x.ends_at)}</small></div><div class="actions"><button class="btn" data-togglead="${x.id}" data-active="${x.active}">${x.active?'إيقاف':'تشغيل'}</button><button class="btn danger" data-delad="${x.id}">حذف</button></div></div>`).join('');
$$('[data-togglead]').forEach(b=>b.onclick=async()=>{await update('site_announcements',`id=eq.${b.dataset.togglead}`,{active:b.dataset.active!=='true'});ads()});$$('[data-delad]').forEach(b=>b.onclick=async()=>{await remove('site_announcements',`id=eq.${b.dataset.delad}`);ads()})}
$('#addAd').onclick=async()=>{await insert('site_announcements',{
 title:$('#adTitle').value,
 body:$('#adBody').value,
 button_url:$('#adUrl').value||null,
 active:true,
 priority:10,
 starts_at:$('#adStartsAt')?.value||null,
 ends_at:$('#adEndsAt')?.value||null
});toast('تمت الإضافة');ads()}
async function tools(){const r=await get('tools_items','select=*&order=name.asc');$('#toolsList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.url||'')}</small></div><select data-tool="${esc(x.id)}"><option value="active" ${x.status==='active'?'selected':''}>تشغيل</option><option value="disabled" ${x.status==='disabled'?'selected':''}>إيقاف</option><option value="coming_soon" ${x.status==='coming_soon'?'selected':''}>قريبًا</option><option value="maintenance" ${x.status==='maintenance'?'selected':''}>صيانة</option></select></div>`).join('');$$('[data-tool]').forEach(s=>s.onchange=()=>update('tools_items',`id=eq.${encodeURIComponent(s.dataset.tool)}`,{status:s.value,disabled:s.value!=='active'}))}
async function programs(){const r=await get('university_programs','select=*&order=college.asc,name_ar.asc');$('#programsList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.name_ar)}</strong><small>${esc(x.college)}</small></div><span>${x.credit_hours||'—'} ساعة</span></div>`).join('')}
async function tg(){const r=await get('telegram_admins','select=*&order=created_at.desc');$('#tgList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.chat_id)} • ${esc(x.role)}</small></div><button class="btn danger" data-deltg="${x.id}">حذف</button></div>`).join('');$$('[data-deltg]').forEach(b=>b.onclick=async()=>{await remove('telegram_admins',`id=eq.${b.dataset.deltg}`);tg()})}
$('#addTg').onclick=async()=>{await insert('telegram_admins',{name:$('#tgName').value,chat_id:$('#tgChat').value,role:$('#tgRole').value,active:true,notifications_enabled:true});toast('تمت الإضافة');tg()}
async function stats(){const names=['summaries','whatsapp_groups','student_projects','rating_submissions'];const counts=[];for(const t of names){const r=await get(t,'select=id');counts.push(r.length)}$('#stats').innerHTML=names.map((n,i)=>`<div class="card stat"><span>${n}</span><strong>${counts[i]}</strong></div>`).join('')}
async function loadAll(){await Promise.allSettled([settings(),features(),loadPending(),ads(),tools(),programs(),tg(),stats()])}

async function audit(action,entity,entityId=null,details={}){
 try{await insert('admin_audit_log',{action,entity,entity_id:entityId,details})}catch{}
}
$('#testTelegram').onclick=async()=>{try{await edge({source:'admin-test',channel:'telegram'});toast('تم إرسال اختبار Telegram')}catch(e){toast(e.message,true)}};
$('#testWhatsapp').onclick=async()=>{try{await fetch('https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/whatsapp-notify',{method:'POST',headers:{apikey:'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH','Content-Type':'application/json'},body:JSON.stringify({type:'test',to:$('#waTestPhone').value})}).then(async r=>{if(!r.ok)throw new Error(await r.text())});toast('تم إرسال طلب الاختبار')}catch(e){toast(e.message,true)}};
$('#runDriveImport').onclick=async()=>{try{$('#importLog').textContent='جاري الاستيراد...';const r=await fetch('https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/google-drive-import',{method:'POST',headers:{apikey:'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH','Content-Type':'application/json'},body:JSON.stringify({folder_id:$('#driveFolderId').value,college:$('#driveCollege').value})});const text=await r.text();if(!r.ok)throw new Error(text);$('#importLog').textContent=text;toast('اكتمل الاستيراد')}catch(e){$('#importLog').textContent=e.message;toast(e.message,true)}};
async function loadBackups(){try{const r=await get('backup_runs','select=*&order=created_at.desc&limit=20');$('#backupList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.status)}</strong><small>${new Date(x.created_at).toLocaleString('ar')} • ${esc(x.file_path||'')}</small></div></div>`).join('')}catch{}}
$('#runBackup').onclick=async()=>{try{const r=await fetch('https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/database-backup',{method:'POST',headers:{apikey:'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH','Content-Type':'application/json'},body:'{}'});const text=await r.text();if(!r.ok)throw new Error(text);toast('تم إنشاء النسخة الاحتياطية');loadBackups()}catch(e){toast(e.message,true)}};
async function loadAudit(){try{const r=await get('admin_audit_log','select=*&order=created_at.desc&limit=100');$('#auditList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.action)} — ${esc(x.entity)}</strong><small>${new Date(x.created_at).toLocaleString('ar')} • ${esc(JSON.stringify(x.details||{}))}</small></div></div>`).join('')}catch{}}
document.querySelector('[data-section="backups"]')?.addEventListener('click',loadBackups);
document.querySelector('[data-section="audit"]')?.addEventListener('click',loadAudit);

async function loadWeeklyChart(){const tables=['summaries','whatsapp_groups','student_projects','rating_submissions','confessions'];const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d});const totals=days.map(()=>0);for(const t of tables){try{const since=days[0].toISOString().slice(0,10);const rows=await get(t,`select=created_at&created_at=gte.${since}T00:00:00Z`);rows.forEach(r=>{const k=new Date(r.created_at).toISOString().slice(0,10),i=days.findIndex(d=>d.toISOString().slice(0,10)===k);if(i>=0)totals[i]++})}catch{}}const max=Math.max(...totals,1);$('#weeklyChart').innerHTML=totals.map((n,i)=>`<div class="chart-bar" style="height:${Math.max(5,n/max*145)}px"><span>${days[i].toLocaleDateString('ar',{weekday:'short'})}</span></div>`).join('')}async function loadRecentActivity(){try{const r=await get('admin_audit_log','select=*&order=created_at.desc&limit=8');$('#recentActivity').innerHTML=r.length?r.map(x=>`<div class="list-row"><div><strong>${esc(x.action)}</strong><small>${esc(x.entity)} • ${new Date(x.created_at).toLocaleString('ar')}</small></div></div>`).join(''):'<div class="empty">لا توجد نشاطات</div>'}catch{}}$('#runDropboxImport').onclick=async()=>{try{$('#importLog').textContent='جاري الاستيراد...';const r=await fetch('https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/dropbox-import',{method:'POST',headers:{apikey:'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH','Content-Type':'application/json'},body:JSON.stringify({path:$('#dropboxPath').value,college:$('#dropboxCollege').value})});const txt=await r.text();if(!r.ok)throw new Error(txt);$('#importLog').textContent=txt;toast('اكتمل استيراد Dropbox')}catch(e){toast(e.message,true)}};const _old=loadAll;loadAll=async function(){await _old();await Promise.allSettled([loadWeeklyChart(),loadRecentActivity()])};


async function loadHealth(){
 const cards=$('#healthCards');
 cards.innerHTML='<div class="empty">جاري الفحص...</div>';

 const checks=[
  ['قاعدة البيانات',async()=>{await get('platform_features','select=key&limit=1');return 'متصلة'}],
  ['حالة الموقع',async()=>{const s=await rpc('uon_public_state',{});return s.maintenance_enabled?'صيانة':'يعمل'}],
  ['Telegram',async()=>{await edge({source:'admin-test',channel:'telegram'});return 'يعمل'}],
  ['النسخ الاحتياطي',async()=>{const r=await get('backup_runs','select=status,created_at&order=created_at.desc&limit=1');return r[0]?`${r[0].status} — ${formatDate(r[0].created_at)}`:'لا توجد نسخة'}],
  ['Google Drive',async()=>{const r=await get('drive_import_runs','select=status,created_at&order=created_at.desc&limit=1');return r[0]?`${r[0].status} — ${formatDate(r[0].created_at)}`:'لم يُستخدم'}],
  ['فهرس البحث',async()=>{const r=await get('search_index','select=id&limit=5000');return `${r.length} عنصر`}],
 ];

 const results=[];
 for(const [name,fn] of checks){
  try{results.push({name,status:'ok',value:await fn()})}
  catch(error){results.push({name,status:'error',value:error.message})}
 }

 cards.innerHTML=results.map(x=>`<div class="card health-card ${x.status}"><span>${x.status==='ok'?'✅':'⚠️'} ${esc(x.name)}</span><strong>${esc(x.value)}</strong></div>`).join('');
}

$('#refreshHealth')?.addEventListener('click',loadHealth);
document.querySelector('[data-section="health"]')?.addEventListener('click',loadHealth);


async function loadAnalytics(){
 const events=await get('usage_events','select=event_type,metadata,created_at&order=created_at.desc&limit=5000');
 const today=new Date().toISOString().slice(0,10);
 const todayEvents=events.filter(x=>String(x.created_at).startsWith(today));
 const views=events.filter(x=>x.event_type==='page_view').length;
 const suggestions=await get('feature_suggestions','select=id&status=eq.pending');
 const cards=[
  ['أحداث اليوم',todayEvents.length],
  ['مشاهدات مسجلة',views],
  ['اقتراحات معلقة',suggestions.length],
  ['إجمالي الأحداث',events.length]
 ];
 $('#analyticsCards').innerHTML=cards.map(x=>`<div class="card stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
 const featureCounts={},searchCounts={};
 events.forEach(x=>{
  if(x.event_type==='feature_open'&&x.metadata?.feature)featureCounts[x.metadata.feature]=(featureCounts[x.metadata.feature]||0)+1;
  if((x.event_type==='search'||x.event_type==='assistant_question')&&x.metadata?.query){const q=String(x.metadata.query).toLowerCase();searchCounts[q]=(searchCounts[q]||0)+1}
 });
 const render=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`<div class="list-row"><strong>${esc(k)}</strong><span>${v}</span></div>`).join('')||'<div class="empty">لا توجد بيانات بعد</div>';
 $('#topFeatures').innerHTML=render(featureCounts);$('#topSearches').innerHTML=render(searchCounts);
}
$('#refreshAnalytics')?.addEventListener('click',loadAnalytics);
document.querySelector('[data-section="analytics"]')?.addEventListener('click',loadAnalytics);

async function loadCalendarAdmin(){
 const rows=await get('academic_calendar_events','select=*&order=start_date.asc');
 $('#calendarAdminList').innerHTML=rows.map(x=>`<div class="list-row"><div><strong>${esc(x.title)}</strong><small>${x.start_date} • ${esc(x.event_type)}</small></div><button class="btn danger" data-cal-del="${x.id}">حذف</button></div>`).join('')||'<div class="empty">لا توجد مواعيد</div>';
 $$('[data-cal-del]').forEach(b=>b.onclick=async()=>{await remove('academic_calendar_events',`id=eq.${b.dataset.calDel}`);loadCalendarAdmin()});
}
$('#calendarForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.active=true;await insert('academic_calendar_events',body);toast('تمت إضافة الموعد');e.target.reset();loadCalendarAdmin()});
document.querySelector('[data-section="calendar-admin"]')?.addEventListener('click',loadCalendarAdmin);

async function loadSuggestions(){
 const rows=await get('feature_suggestions','select=*&order=created_at.desc');
 $('#suggestionsList').innerHTML=rows.map(x=>`<div class="list-row"><div><span class="badge">${esc(x.category)}</span><strong>${esc(x.title)}</strong><small>${esc(x.details)} • ${new Date(x.created_at).toLocaleString('ar')}</small></div><div class="actions"><button class="btn success" data-sug-ok="${x.id}">تمت المراجعة</button><button class="btn danger" data-sug-del="${x.id}">حذف</button></div></div>`).join('')||'<div class="empty">لا توجد اقتراحات</div>';
 $$('[data-sug-ok]').forEach(b=>b.onclick=async()=>{await update('feature_suggestions',`id=eq.${b.dataset.sugOk}`,{status:'reviewed'});loadSuggestions()});
 $$('[data-sug-del]').forEach(b=>b.onclick=async()=>{await remove('feature_suggestions',`id=eq.${b.dataset.sugDel}`);loadSuggestions()});
}
document.querySelector('[data-section="suggestions"]')?.addEventListener('click',loadSuggestions);


fillCollege($('#courseAdminCollege'),{other:true});
async function loadCoursesAdmin(){const r=await get('courses','select=*&order=code.asc');$('#coursesAdminList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.code)} — ${esc(x.name_ar)}</strong><small>${esc(x.college||'')}</small></div><button class="btn danger" data-course-del="${x.id}">حذف</button></div>`).join('');$$('[data-course-del]').forEach(b=>b.onclick=async()=>{await remove('courses',`id=eq.${b.dataset.courseDel}`);loadCoursesAdmin()})}
$('#courseForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.active=true;if(body.credit_hours)body.credit_hours=Number(body.credit_hours);await insert('courses',body);toast('تمت إضافة المادة');e.target.reset();loadCoursesAdmin()});
document.querySelector('[data-section="courses-admin"]')?.addEventListener('click',loadCoursesAdmin);

async function loadNotificationsAdmin(){const r=await get('site_notifications','select=*&order=created_at.desc');$('#notificationsAdminList').innerHTML=r.map(x=>`<div class="list-row"><div><strong>${esc(x.icon||'🔔')} ${esc(x.title)}</strong><small>${esc(x.body||'')}</small></div><button class="btn danger" data-notify-del="${x.id}">حذف</button></div>`).join('');$$('[data-notify-del]').forEach(b=>b.onclick=async()=>{await remove('site_notifications',`id=eq.${b.dataset.notifyDel}`);loadNotificationsAdmin()})}
$('#notificationForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.active=true;await insert('site_notifications',body);toast('تم نشر الإشعار');e.target.reset();loadNotificationsAdmin()});
document.querySelector('[data-section="notifications-admin"]')?.addEventListener('click',loadNotificationsAdmin);
