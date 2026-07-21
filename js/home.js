
import {get} from './api.js';import {$,esc,setupNav,formatDate} from './ui.js';import {initI18n} from './i18n.js';
setupNav();initI18n();
async function safe(table,query){try{return await get(table,query)}catch(e){console.warn(table,e);return[]}}
function renderList(id,rows,mapper){const el=$(id);if(!el)return;el.innerHTML=rows.length?rows.map(mapper).join(''):'<div class="empty">لا توجد بيانات بعد</div>'}
async function load(){
 const [ann,sums,groups,projects,ratings]=await Promise.all([
  safe('site_announcements','select=*&active=eq.true&order=priority.desc,created_at.desc&limit=5'),
  safe('summaries','select=*&approved=eq.true&order=created_at.desc&limit=4'),
  safe('whatsapp_groups','select=*&approved=eq.true&order=created_at.desc&limit=4'),
  safe('student_projects','select=*&status=eq.approved&order=featured.desc,created_at.desc&limit=4'),
  safe('rating_public_summary','select=*&order=overall_rating.desc&limit=4')
 ]);
 const now=new Date();const current=ann.find(x=>!x.expires_at||new Date(x.expires_at)>now);
 if(current){$('#announcement').hidden=false;$('#announcementTitle').textContent=current.title;$('#announcementBody').textContent=current.body;const a=$('#announcementAction');if(current.button_url){a.hidden=false;a.href=current.button_url;a.textContent=current.button_text||'التفاصيل'}}
 $('#announcementClose')?.addEventListener('click',()=>$('#announcement').hidden=true);
 $('#statSummaries').textContent=sums.length;$('#statGroups').textContent=groups.length;$('#statProjects').textContent=projects.length;$('#statRatings').textContent=ratings.reduce((n,r)=>n+Number(r.reviews_count||0),0);
 renderList('#latestSummaries',sums,s=>`<div class="list-item"><div><p>${esc(s.title||s.subject)}</p><small>${esc(s.college||'')}</small></div><a class="list-link" href="${esc(s.url||s.link||'#')}" target="_blank">فتح</a></div>`);
 renderList('#latestGroups',groups,g=>`<div class="list-item"><div><p>${esc(g.subject||g.name||'مجموعة')}</p><small>${esc(g.college||'')}</small></div><a class="list-link" href="${esc(g.link||g.url||'#')}" target="_blank">انضم</a></div>`);
 renderList('#latestProjects',projects,p=>`<div class="list-item"><div><p>${esc(p.title)}</p><small>${esc(p.major||p.owner_name||'')}</small></div><a class="list-link" href="projects.html">عرض</a></div>`);
}
load();

async function loadWhatsappChannel(){
 try{
  const rows=await get('site_settings','select=key,value&key=eq.whatsapp_channel_url');
  const url=rows?.[0]?.value;
  if(url){
    $('#whatsappChannelLink').href=url;
    $('#whatsappChannelBanner').hidden=false;
  }
 }catch{}
}
loadWhatsappChannel();
