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
