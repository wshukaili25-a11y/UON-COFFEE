import {esc,toast} from './core.js?v=30.0.1';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

if(!document.querySelector('#notificationsAdminList')){
 const legacy=document.createElement('div');
 legacy.id='notificationsAdminList';
 legacy.hidden=true;
 document.body.appendChild(legacy);
}

async function adminReadNotifications(){
 const password=sessionStorage.getItem('uon_admin_password')||'';
 if(!password)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/admin-api`,{
  method:'POST',
  headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json','x-admin-password':password},
  body:JSON.stringify({action:'read',table:'site_notifications',query:'select=id,title,body,icon,url,active,created_at&order=created_at.desc&limit=100'}),
  cache:'no-store'
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload?.ok===false)throw new Error(payload?.error||`HTTP ${response.status}`);
 return Array.isArray(payload.data)?payload.data:[];
}

export async function loadSiteNotificationsV65(){
 const host=document.querySelector('#siteNotificationsList');
 if(!host)return;
 host.innerHTML='<div class="empty">جاري تحميل الإشعارات...</div>';
 try{
  const rows=await adminReadNotifications();
  host.innerHTML=rows.length?rows.map(row=>`<div class="list-row"><div><strong>${esc(row.icon||'🔔')} ${esc(row.title||'إشعار')}</strong><small>${esc(row.body||'')}${row.url?` • ${esc(row.url)}`:''}</small></div><button class="btn danger" data-notify-del="${esc(row.id)}">حذف</button></div>`).join(''):'<div class="empty">لا توجد إشعارات منشورة</div>';
 }catch(error){
  host.innerHTML=`<div class="empty">${esc(error.message||'تعذر تحميل الإشعارات')}</div>`;
 }
}

document.querySelector('[data-section="notifications-admin"]')?.addEventListener('click',()=>loadSiteNotificationsV65());
document.querySelector('#refreshSiteNotifications')?.addEventListener('click',event=>{event.preventDefault();loadSiteNotificationsV65().catch(error=>toast(error.message,true))});
