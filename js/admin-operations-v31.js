import {get,insert,update,remove,toast,esc,formatDate,trackEvent} from './core.js?v=31.1.0';

const $=(s,r=document)=>r.querySelector(s);
const password=()=>sessionStorage.getItem('uon_admin_password')||'';

async function adminEdge(payload){
 const res=await fetch('https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/admin-api',{
  method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH','x-admin-password':password()},
  body:JSON.stringify(payload),cache:'no-store'
 });
 const data=await res.json().catch(()=>({}));
 if(!res.ok||data.ok===false)throw new Error(data.error||`HTTP ${res.status}`);
 return data.data??data;
}

function card(label,value,note=''){
 return `<article class="card form-card"><small>${esc(label)}</small><h2>${esc(value)}</h2>${note?`<p class="muted">${esc(note)}</p>`:''}</article>`;
}

async function loadOpsAnalytics(){
 const box=$('#opsAnalyticsCards'); if(!box)return;
 box.innerHTML='<div class="empty">جاري التحميل...</div>';
 try{
  const [events,feedback,subs,batches]=await Promise.all([
   adminEdge({action:'read',table:'usage_events',query:'select=event_type,page_path,session_id,created_at&order=created_at.desc&limit=5000'}),
   adminEdge({action:'read',table:'resource_feedback',query:'select=resource_table,resource_id,useful,rating,status&status=eq.approved&limit=5000'}),
   adminEdge({action:'read',table:'notification_subscriptions',query:'select=id,active&active=eq.true'}),
   adminEdge({action:'read',table:'bulk_upload_batches',query:'select=id,status,total_files,imported_files,failed_files&order=created_at.desc&limit=200'})
  ]);
  const sessions=new Set(events.map(x=>x.session_id).filter(Boolean)).size;
  const searches=events.filter(x=>x.event_type==='search').length;
  const avg=feedback.filter(x=>x.rating).reduce((a,x)=>a+Number(x.rating),0)/Math.max(1,feedback.filter(x=>x.rating).length);
  box.innerHTML=[card('الأحداث المسجلة',events.length,'آخر 5000 حدث'),card('الجلسات',sessions),card('عمليات البحث',searches),card('متوسط التقييم',avg.toFixed(1)),card('الاشتراكات النشطة',subs.length),card('دفعات الرفع',batches.length)].join('');
  const pages={};events.forEach(x=>pages[x.page_path]=(pages[x.page_path]||0)+1);
  $('#opsTopPages').innerHTML=Object.entries(pages).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`<div class="list-item"><strong>${esc(k||'—')}</strong><span>${v}</span></div>`).join('')||'<div class="empty">لا توجد بيانات</div>';
 }catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}

async function loadBatches(){
 const box=$('#bulkBatchesList');if(!box)return;
 try{
  const rows=await adminEdge({action:'read',table:'bulk_upload_batches',query:'select=*&order=created_at.desc&limit=50'});
  box.innerHTML=rows.map(x=>`<div class="list-item"><div><strong>${esc(x.course_code||x.college||'دفعة ملفات')}</strong><small>${esc(x.source)} • ${formatDate(x.created_at)}</small></div><span class="badge">${esc(x.status)} — ${x.imported_files||0}/${x.total_files||0}</span></div>`).join('')||'<div class="empty">لا توجد دفعات</div>';
 }catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}

async function loadRoles(){
 const box=$('#rolesList');if(!box)return;
 try{
  const roles=await adminEdge({action:'read',table:'admin_roles',query:'select=*&order=created_at.asc'});
  box.innerHTML=roles.map(x=>`<div class="list-item"><div><strong>${esc(x.label_ar)}</strong><small>${esc(x.name)}</small></div><code>${esc(JSON.stringify(x.permissions))}</code></div>`).join('');
 }catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}

async function loadAudit(){
 const box=$('#opsAuditList');if(!box)return;
 try{
  const rows=await adminEdge({action:'read',table:'admin_audit_log',query:'select=*&order=created_at.desc&limit=100'});
  box.innerHTML=rows.map(x=>`<div class="list-item"><div><strong>${esc(x.action)}</strong><small>${esc(x.entity||'')} ${esc(x.entity_id||'')} • ${formatDate(x.created_at)}</small></div><span>${esc(x.actor||'system')}</span></div>`).join('')||'<div class="empty">لا توجد عمليات بعد</div>';
 }catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}


async function loadContentReports(){
 const box=$('#contentReportsList');if(!box)return;
 try{const rows=await adminEdge({action:'read',table:'content_reports',query:'select=*&order=created_at.desc&limit=100'});box.innerHTML=rows.map(x=>`<div class="list-item"><div><strong>${esc(x.page_title||x.content_title||x.reason)}</strong><small>${esc(x.reason)} • ${formatDate(x.created_at)}</small><p>${esc(x.details||'')}</p></div><span class="badge">${esc(x.status)}</span></div>`).join('')||'<div class="empty">لا توجد بلاغات</div>'}catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
$('#opsRefresh')?.addEventListener('click',()=>Promise.all([loadOpsAnalytics(),loadBatches(),loadRoles(),loadAudit(),loadContentReports()]));
$('#exportOpsReport')?.addEventListener('click',async()=>{
 try{
  const report=await adminEdge({action:'read',table:'daily_usage_analytics',query:'select=*&order=day.desc&limit=2000'});
  const blob=new Blob([JSON.stringify({generated_at:new Date().toISOString(),report},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`uon-analytics-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('تم تصدير التقرير');trackEvent('admin_export',{type:'analytics'});
 }catch(e){toast(e.message,true)}
});

window.addEventListener('uon:admin-ready',()=>Promise.all([loadOpsAnalytics(),loadBatches(),loadRoles(),loadAudit(),loadContentReports()]));
setTimeout(()=>{if($('#dashboard')&&!$('#dashboard').hidden)window.dispatchEvent(new Event('uon:admin-ready'))},900);
