import {startMaintenanceWatcher,getUonState,enforceUonMaintenance,watchUonMaintenance} from './core.js';

import {setupNav,enforceMaintenance,platformStatuses,get,$$,get as fetchRows,esc} from './core.js';
setupNav();await enforceUonMaintenance();watchUonMaintenance();startMaintenanceWatcher();
async function refresh(){
 try{
  const state=await getUonState();const map=state.features||{};
  $$('[data-feature]').forEach(card=>{
   const status=map[card.dataset.feature]||'active';card.dataset.status=status;
   card.querySelector('.status-badge')?.remove();
   if(status!=='active'){const b=document.createElement('span');b.className='status-badge';b.textContent=status==='maintenance'?'صيانة':status==='coming_soon'?'قريبًا':'متوقفة';card.append(b)}
  })
 }catch(e){console.warn(e)}
}
document.addEventListener('click',e=>{const c=e.target.closest('[data-feature]');if(c&&c.dataset.status&&c.dataset.status!=='active'){e.preventDefault();alert('الخدمة غير متاحة حاليًا')}} ,true);
async function ads(){
 try{const rows=await fetchRows('site_announcements','select=*&active=eq.true&order=priority.desc,created_at.desc&limit=6');document.querySelector('#announcements').innerHTML=rows.length?rows.map(a=>`<article class="card item-card"><span class="badge">إعلان</span><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p>${a.button_url?`<a class="btn" target="_blank" href="${esc(a.button_url)}">${esc(a.button_text||'التفاصيل')}</a>`:''}</article>`).join(''):'<div class="empty">لا توجد إعلانات حاليًا</div>'}catch{}
}
try{const rows=await get('site_settings','select=key,value&key=eq.whatsapp_channel_url');if(rows[0]?.value)document.querySelector('#waChannel').href=rows[0].value}catch{}
refresh();ads();setInterval(refresh,3000);window.addEventListener('focus',refresh);

async function loadLiveStats(){const specs=[['summaries','approved=eq.true','الملخصات','📚'],['whatsapp_groups','approved=eq.true','المجموعات','🟢'],['student_projects','status=eq.approved','المشاريع','💻'],['rating_submissions','status=eq.approved','التقييمات','⭐']];const vals=[];for(const [t,f,l,i] of specs){try{const r=await get(t,`select=id&${f}`);vals.push({l,i,n:r.length})}catch{vals.push({l,i,n:0})}}document.querySelector('#liveStats').innerHTML=vals.map(x=>`<div class="card stat"><span>${x.i} ${x.l}</span><strong>${x.n}</strong></div>`).join('')}loadLiveStats();setInterval(loadLiveStats,30000);
