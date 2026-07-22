import {
 setupNav,
 get,
 $$,
 esc,
 getUonState,
 enforceUonMaintenance,
 watchUonMaintenance
,trackEvent,trackClicks} from './core.js';
setupNav();await enforceUonMaintenance();watchUonMaintenance();
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
 try{const rows=await get('site_announcements','select=*&active=eq.true&order=priority.desc,created_at.desc&limit=6');document.querySelector('#announcements').innerHTML=rows.length?rows.map(a=>`<article class="card item-card"><span class="badge">إعلان</span><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p>${a.button_url?`<a class="btn" target="_blank" href="${esc(a.button_url)}">${esc(a.button_text||'التفاصيل')}</a>`:''}</article>`).join(''):'<div class="empty">لا توجد إعلانات حاليًا</div>'}catch{}
}
try{const rows=await get('site_settings','select=key,value&key=eq.whatsapp_channel_url');if(rows[0]?.value)document.querySelector('#waChannel').href=rows[0].value}catch{}
refresh();ads();setInterval(refresh,15000);window.addEventListener('focus',refresh);

async function loadLiveStats(){const specs=[['summaries','approved=eq.true','الملخصات','📚'],['whatsapp_groups','approved=eq.true','المجموعات','🟢'],['student_projects','status=eq.approved','المشاريع','💻'],['rating_submissions','status=eq.approved','التقييمات','⭐']];const vals=[];for(const [t,f,l,i] of specs){try{const r=await get(t,`select=id&${f}`);vals.push({l,i,n:r.length})}catch{vals.push({l,i,n:0})}}document.querySelector('#liveStats').innerHTML=vals.map(x=>`<div class="card stat"><span>${x.i} ${x.l}</span><strong>${x.n}</strong></div>`).join('')}loadLiveStats();setInterval(loadLiveStats,30000);


const quickSearch=document.querySelector('#quickSearch');
document.querySelector('#quickSearchBtn')?.addEventListener('click',()=>{
 const q=quickSearch?.value.trim();
 if(q)location.href=`search.html?q=${encodeURIComponent(q)}`;
});
quickSearch?.addEventListener('keydown',event=>{
 if(event.key==='Enter'){
  const q=quickSearch.value.trim();
  if(q)location.href=`search.html?q=${encodeURIComponent(q)}`;
 }
});

function setupHeroSlider(){
 const root=document.querySelector('#heroSlider');if(!root)return;
 const slides=[...root.querySelectorAll('.hero-slide')],dotsRoot=root.querySelector('#heroDots');
 const prev=root.querySelector('#heroPrev'),next=root.querySelector('#heroNext'),pause=root.querySelector('#heroPause');
 let index=0,timer=null,paused=false;const delay=6000;
 dotsRoot.innerHTML=slides.map((_,i)=>`<button class="hero-dot ${i===0?'active':''}" data-i="${i}" aria-label="الشريحة ${i+1}"></button>`).join('');
 const dots=[...dotsRoot.querySelectorAll('.hero-dot')];
 const stop=()=>{if(timer){clearInterval(timer);timer=null}};
 const start=()=>{if(paused)return;stop();timer=setInterval(()=>show(index+1,false),delay)};
 function show(i,restart=true){index=(i+slides.length)%slides.length;slides.forEach((s,n)=>s.classList.toggle('active',n===index));dots.forEach((d,n)=>d.classList.toggle('active',n===index));if(restart)start()}
 prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);pause.onclick=()=>{paused=!paused;pause.textContent=paused?'▶':'❚❚';paused?stop():start()};
 dots.forEach(d=>d.onclick=()=>show(Number(d.dataset.i)));
 let x=0;root.addEventListener('touchstart',e=>x=e.changedTouches[0].clientX,{passive:true});root.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-x;if(Math.abs(dx)>45)show(dx>0?index+1:index-1)},{passive:true});
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());show(0);
}
setupHeroSlider();

trackClicks();trackEvent('page_view',{page:'home'});

async function loadWeeklySearches(){
 const target=document.querySelector('#weeklySearches');if(!target)return;
 const since=new Date(Date.now()-7*86400000).toISOString();
 try{
  const rows=await get('usage_events',`select=event_type,metadata&created_at=gte.${encodeURIComponent(since)}&or=(event_type.eq.search,event_type.eq.assistant_question,event_type.eq.course_view)&limit=5000`);
  const counts={};
  rows.forEach(x=>{const q=x.metadata?.query||x.metadata?.code||x.metadata?.feature;if(q)counts[String(q).trim().toUpperCase()]=(counts[String(q).trim().toUpperCase()]||0)+1});
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  target.innerHTML=top.length?top.map(([q,n],i)=>`<a class="weekly-search-card" href="search.html?q=${encodeURIComponent(q)}"><span>${i+1}</span><strong>${esc(q)}</strong><small>${n} عملية بحث</small></a>`).join(''):'<div class="empty">تبدأ الإحصائيات بالظهور بعد استخدام الطلاب للبحث.</div>';
 }catch(e){target.innerHTML='<div class="empty">تعذر تحميل بيانات البحث.</div>'}
}
loadWeeklySearches();


async function loadV13Stats(){
 const specs=[
  ['summaries','select=id&approved=eq.true','#heroStatSummaries'],
  ['courses','select=id&active=eq.true','#heroStatCourses'],
  ['rating_submissions','select=id&status=eq.approved','#heroStatRatings']
 ];
 for(const [table,query,target] of specs){
  try{
   const rows=await get(table,query);
   const el=document.querySelector(target);
   if(el)el.textContent=rows.length;
  }catch{}
 }
}

async function loadV13Trending(){
 const target=document.querySelector('#v13Trending');if(!target)return;
 try{
  const since=new Date(Date.now()-7*86400000).toISOString();
  const events=await get('usage_events',`select=event_type,metadata&created_at=gte.${encodeURIComponent(since)}&limit=5000`);
  const counts={};
  events.forEach(x=>{
   const key=x.metadata?.code||x.metadata?.feature||x.metadata?.query;
   if(key)counts[String(key).toUpperCase()]=(counts[String(key).toUpperCase()]||0)+1;
  });
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  target.innerHTML=top.length?top.map(([key,count],i)=>`<a class="v13-trending-card" href="search.html?q=${encodeURIComponent(key)}"><span class="v13-rank">0${i+1}</span><div><small>نشط هذا الأسبوع</small><h3>${esc(key)}</h3><p>${count} تفاعل</p></div><span>↗</span></a>`).join(''):'<div class="empty">ستظهر البيانات بعد بدء استخدام الطلاب للمنصة.</div>';
 }catch{target.innerHTML='<div class="empty">تعذر تحميل النشاط.</div>'}
}

async function loadV13Latest(){
 const target=document.querySelector('#v13Latest');if(!target)return;
 const all=[];
 const sources=[
  ['summaries','select=id,title,created_at,url&approved=eq.true&order=created_at.desc&limit=4','ملخص'],
  ['student_projects','select=id,title,created_at,url&status=eq.approved&order=created_at.desc&limit=4','مشروع'],
  ['site_announcements','select=id,title,created_at,button_url&active=eq.true&order=created_at.desc&limit=4','إعلان']
 ];
 for(const [table,query,type] of sources){
  try{
   const rows=await get(table,query);
   rows.forEach(x=>all.push({...x,type,url:x.url||x.button_url||'#'}));
  }catch{}
 }
 all.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 target.innerHTML=all.slice(0,8).map(x=>`<a class="v13-timeline-item" href="${esc(x.url||'#')}" target="${x.url&&x.url!=='#'?'_blank':'_self'}"><span class="v13-timeline-dot"></span><div><small>${esc(x.type)} • ${new Date(x.created_at).toLocaleDateString('ar')}</small><strong>${esc(x.title)}</strong></div><span>↗</span></a>`).join('')||'<div class="empty">لا توجد إضافات حديثة.</div>';
}

async function loadCenterSettings(){
 const keys=['anjiz_title','anjiz_description','anjiz_booking_url','anjiz_image_url','anjiz_cta','masalik_title','masalik_description','masalik_booking_url','masalik_image_url','masalik_cta'];
 try{
  const rows=await get('site_settings',`select=key,value&key=in.(${keys.join(',')})`);
  const m=Object.fromEntries(rows.map(x=>[x.key,x.value]));
  document.querySelector('#anjizTitle').textContent=m.anjiz_title||'ابدأ أقوى مع مركز أنجز';
  document.querySelector('#anjizDescription').textContent=m.anjiz_description||'';
  document.querySelector('#anjizLink').href=m.anjiz_booking_url||'#';
  document.querySelector('#anjizLink').textContent=m.anjiz_cta||'احجز موعدك';
  document.querySelector('#anjizCard .v13-center-media').style.backgroundImage=`url("${m.anjiz_image_url||'/assets/unizwa-new-gate-v52.jpg'}")`;
  document.querySelector('#masalikTitle').textContent=m.masalik_title||'طوّر مستواك مع مركز تعزيز مسالك التعلم';
  document.querySelector('#masalikDescription').textContent=m.masalik_description||'';
  document.querySelector('#masalikLink').href=m.masalik_booking_url||'#';
  document.querySelector('#masalikLink').textContent=m.masalik_cta||'احجز موعدك';
  document.querySelector('#masalikCard .v13-center-media').style.backgroundImage=`url("${m.masalik_image_url||'/assets/unizwa-campus-aerial.jpg'}")`;
 }catch(error){console.warn(error)}
}

loadV13Stats();
loadV13Trending();
loadV13Latest();
loadCenterSettings();


document.querySelector('#v16HomeSearch')?.addEventListener('submit',event=>{
 event.preventDefault();
 const value=document.querySelector('#v16HomeSearchInput')?.value.trim();
 if(value)location.href=`search.html?q=${encodeURIComponent(value)}`;
});

async function loadV16Home(){
 const topTarget=document.querySelector('#v16TopCourses');
 const latestTarget=document.querySelector('#v16LatestItems');

 try{
  const since=new Date(Date.now()-7*86400000).toISOString();
  const events=await get('usage_events',`select=event_type,metadata&created_at=gte.${encodeURIComponent(since)}&limit=5000`);
  const counts={};
  events.forEach(event=>{
   if(event.event_type==='course_view'&&event.metadata?.code){
    const code=String(event.metadata.code).toUpperCase();
    counts[code]=(counts[code]||0)+1;
   }
  });

  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  topTarget.innerHTML=top.length?top.map(([code,count],index)=>`
   <a href="course.html?code=${encodeURIComponent(code)}">
    <span>${index+1}</span><strong>${esc(code)}</strong><small>${count} زيارة</small>
   </a>`).join(''):'<div class="empty">تظهر البيانات بعد استخدام الطلاب للمنصة.</div>';
 }catch{
  topTarget.innerHTML='<div class="empty">تعذر تحميل النشاط.</div>';
 }

 const all=[];
 const sources=[
  ['summaries','select=id,title,subject,url,created_at&approved=eq.true&order=created_at.desc&limit=4','ملخص'],
  ['whatsapp_groups','select=id,subject,link,created_at&approved=eq.true&order=created_at.desc&limit=4','مجموعة'],
  ['site_announcements','select=id,title,button_url,created_at&active=eq.true&order=created_at.desc&limit=4','إعلان']
 ];

 for(const [table,query,type] of sources){
  try{
   const rows=await get(table,query);
   rows.forEach(item=>all.push({
    ...item,
    type,
    title:item.title||item.subject||'إضافة جديدة',
    url:item.url||item.link||item.button_url||'#'
   }));
  }catch{}
 }

 all.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 latestTarget.innerHTML=all.length?all.slice(0,6).map(item=>`
  <a href="${esc(item.url)}" target="${item.url&&item.url!=='#'?'_blank':'_self'}">
   <span>${esc(item.type)}</span><strong>${esc(item.title)}</strong><small>${new Date(item.created_at).toLocaleDateString('ar')}</small>
  </a>`).join(''):'<div class="empty">لا توجد إضافات حديثة.</div>';
}

loadV16Home();
