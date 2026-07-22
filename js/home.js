import {
 get,esc,getUonState,enforceUonMaintenance,watchUonMaintenance,
 trackEvent,trackClicks,applyFeatureStates,getSetting
} from './core.js';

await enforceUonMaintenance();
watchUonMaintenance();

function translateStatic(){
 const language=localStorage.getItem('uon_language')||'ar';
 document.querySelectorAll('[data-ar]').forEach(el=>{
  el.textContent=language==='ar'?el.dataset.ar:el.dataset.en;
 });
}

async function loadStats(){
 const target=document.querySelector('#v175LiveStats');
 const specs=[
  ['courses','select=id&active=eq.true','مقرر','Course'],
  ['summaries','select=id&approved=eq.true','ملخص','File'],
  ['whatsapp_groups','select=id&approved=eq.true','مجموعة','Group'],
  ['rating_submissions','select=id&status=eq.approved','تقييم','Rating']
 ];
 const lang=localStorage.getItem('uon_language')||'ar';
 const values=[];
 for(const [table,query,ar,en] of specs){
  try{values.push({label:lang==='ar'?ar:en,count:(await get(table,query)).length})}
  catch{values.push({label:lang==='ar'?ar:en,count:0})}
 }
 target.innerHTML=values.map(x=>`<div><strong>${x.count.toLocaleString()}</strong><span>${esc(x.label)}</span></div>`).join('');
}

async function loadFeatureStates(){
 const state=await applyFeatureStates(document);
 const map=state?.features||{};
 const unavailable=Object.values(map).some(status=>status&&status!=='active');
 document.querySelector('#v175UnavailableBanner').hidden=!unavailable;
}

async function loadActivity(){
 const topTarget=document.querySelector('#v16TopCourses');
 const latestTarget=document.querySelector('#v16LatestItems');

 try{
  const since=new Date(Date.now()-7*86400000).toISOString();
  const events=await get('usage_events',`select=event_type,metadata&created_at=gte.${encodeURIComponent(since)}&limit=5000`);
  const counts={};
  events.forEach(event=>{
   const code=event.event_type==='course_view'?event.metadata?.code:null;
   if(code)counts[String(code).toUpperCase()]=(counts[String(code).toUpperCase()]||0)+1;
  });
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  topTarget.innerHTML=top.length?top.map(([code,count],index)=>`
   <a href="course.html?code=${encodeURIComponent(code)}"><span>${index+1}</span><strong>${esc(code)}</strong><small>${count} زيارة</small></a>
  `).join(''):'<div class="empty">تظهر البيانات بعد استخدام الطلاب للمنصة.</div>';
 }catch{
  topTarget.innerHTML='<div class="empty">تعذر تحميل النشاط.</div>';
 }

 const all=[];
 for(const [table,query,type] of [
  ['summaries','select=id,title,subject,url,created_at&approved=eq.true&order=created_at.desc&limit=4','ملخص'],
  ['whatsapp_groups','select=id,subject,link,created_at&approved=eq.true&order=created_at.desc&limit=4','مجموعة'],
  ['site_announcements','select=id,title,button_url,created_at&active=eq.true&order=created_at.desc&limit=4','إعلان']
 ]){
  try{
   const rows=await get(table,query);
   rows.forEach(item=>all.push({
    title:item.title||item.subject||'إضافة جديدة',
    url:item.url||item.link||item.button_url||'#',
    created_at:item.created_at,type
   }));
  }catch{}
 }
 all.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 latestTarget.innerHTML=all.slice(0,6).map(item=>`
  <a href="${esc(item.url)}" target="${item.url.startsWith('http')?'_blank':'_self'}"><span>${esc(item.type)}</span><strong>${esc(item.title)}</strong><small>${new Date(item.created_at).toLocaleDateString('ar')}</small></a>
 `).join('')||'<div class="empty">لا توجد إضافات حديثة.</div>';
}

async function loadCenters(){
 const keys=['anjiz_title','anjiz_description','anjiz_booking_url','anjiz_image_url','anjiz_cta','masalik_title','masalik_description','masalik_booking_url','masalik_image_url','masalik_cta'];
 try{
  const rows=await get('site_settings',`select=key,value&key=in.(${keys.join(',')})`);
  const values=Object.fromEntries(rows.map(row=>[row.key,row.value]));
  document.querySelector('#anjizTitle').textContent=values.anjiz_title||'مركز أنجز';
  document.querySelector('#anjizDescription').textContent=values.anjiz_description||'دعم طلاب السنة التأسيسية.';
  document.querySelector('#anjizLink').href=values.anjiz_booking_url||'#';
  document.querySelector('#anjizLink').textContent=values.anjiz_cta||'احجز الآن';
  document.querySelector('#anjizCard .v175-support-image').style.backgroundImage=`url("${values.anjiz_image_url||'assets/unizwa-new-gate-v52.jpg'}")`;
  document.querySelector('#masalikTitle').textContent=values.masalik_title||'مركز مسالك التعلم';
  document.querySelector('#masalikDescription').textContent=values.masalik_description||'دعم أكاديمي لطلاب التخصص.';
  document.querySelector('#masalikLink').href=values.masalik_booking_url||'#';
  document.querySelector('#masalikLink').textContent=values.masalik_cta||'احجز الآن';
  document.querySelector('#masalikCard .v175-support-image').style.backgroundImage=`url("${values.masalik_image_url||'assets/unizwa-campus-aerial.jpg'}")`;
 }catch{}
}

translateStatic();
await Promise.all([loadStats(),loadFeatureStates(),loadActivity(),loadCenters()]);
trackClicks();
trackEvent('page_view',{page:'home'});
window.addEventListener('focus',loadFeatureStates);
