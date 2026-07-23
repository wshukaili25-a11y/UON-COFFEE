import {
 get,esc,count,loadSocialLinks,enforceUonMaintenance,watchUonMaintenance,
 trackEvent,trackClicks,applyFeatureStates
} from './core.js';

await enforceUonMaintenance();
watchUonMaintenance();

const qs=(selector)=>document.querySelector(selector);

function translateStatic(){
 const language=localStorage.getItem('uon_language')||'ar';
 document.querySelectorAll('[data-ar][data-en]').forEach(element=>{
  element.textContent=language==='ar'?element.dataset.ar:element.dataset.en;
 });
}

async function loadFeatureStates(){
 try{
  await applyFeatureStates(document);
 }catch(error){
  console.warn('Feature states skipped',error);
 }
}

async function loadActivity(){
 const topTarget=qs('#v16TopCourses');
 const latestTarget=qs('#v16LatestItems');

 if(topTarget){
  try{
   const since=new Date(Date.now()-7*86400000).toISOString();
   const events=await get(
    'usage_events',
    `select=event_type,metadata&created_at=gte.${encodeURIComponent(since)}&limit=5000`
   );
   const counts={};

   events.forEach(event=>{
    const code=event.event_type==='course_view'?event.metadata?.code:null;
    if(code){
     const normalized=String(code).toUpperCase();
     counts[normalized]=(counts[normalized]||0)+1;
    }
   });

   const top=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5);

   topTarget.innerHTML=top.length
    ?top.map(([code,count],index)=>`
      <a href="course.html?code=${encodeURIComponent(code)}">
       <span>${index+1}</span>
       <strong>${esc(code)}</strong>
       <small>${count} زيارة</small>
      </a>`).join('')
    :'<div class="empty">تظهر البيانات بعد استخدام الطلاب للمنصة.</div>';
  }catch(error){
   console.warn('Top courses skipped',error);
   topTarget.innerHTML='<div class="empty">تعذر تحميل النشاط حاليًا.</div>';
  }
 }

 if(latestTarget){
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
     title:item.title||item.subject||'إضافة جديدة',
     url:item.url||item.link||item.button_url||'#',
     created_at:item.created_at,
     type
    }));
   }catch(error){
    console.warn(`Latest ${table} skipped`,error);
   }
  }

  all.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  latestTarget.innerHTML=all.length
   ?all.slice(0,6).map(item=>`
     <a href="${esc(item.url)}" target="${String(item.url).startsWith('http')?'_blank':'_self'}">
      <span>${esc(item.type)}</span>
      <strong>${esc(item.title)}</strong>
      <small>${new Date(item.created_at).toLocaleDateString('ar')}</small>
     </a>`).join('')
   :'<div class="empty">لا توجد إضافات حديثة.</div>';
 }
}

async function loadStats(){
 const el={
  summaries:qs('#statSummaries'),
  groups:qs('#statGroups'),
  courses:qs('#statCourses'),
  activity:qs('#statActivity')
 };
 if(!el.summaries&&!el.groups&&!el.courses&&!el.activity)return;

 const [summaries,groups,courses,activity]=await Promise.all([
  count('summaries','approved=eq.true'),
  count('whatsapp_groups','approved=eq.true'),
  count('courses','active=eq.true'),
  count('usage_events','')
 ]);

 if(el.summaries)el.summaries.textContent=summaries?`+${summaries}`:'—';
 if(el.groups)el.groups.textContent=groups?`+${groups}`:'—';
 if(el.courses)el.courses.textContent=courses?`+${courses}`:'—';
 if(el.activity)el.activity.textContent=activity?`+${activity}`:'—';
}

async function loadCenters(){
 const anjizCard=qs('#anjizCard');
 const masalikCard=qs('#masalikCard');
 if(!anjizCard&&!masalikCard)return;

 const keys=[
  'anjiz_title','anjiz_description','anjiz_booking_url','anjiz_image_url','anjiz_cta',
  'masalik_title','masalik_description','masalik_booking_url','masalik_image_url','masalik_cta'
 ];

 try{
  const rows=await get('site_settings',`select=key,value&key=in.(${keys.join(',')})`);
  const values=Object.fromEntries(rows.map(row=>[row.key,row.value]));

  const setText=(selector,value)=>{
   const element=qs(selector);
   if(element&&value!==undefined&&value!==null&&value!=='')element.textContent=value;
  };
  const setHref=(selector,value)=>{
   const element=qs(selector);
   if(element&&value)element.href=value;
  };
  const setBackground=(cardSelector,value,fallback)=>{
   const element=qs(`${cardSelector} .v18-center-img, ${cardSelector} .v175-support-image, ${cardSelector} .support-thumb`);
   if(element)element.style.backgroundImage=`url("${value||fallback}")`;
  };

  setText('#anjizTitle',values.anjiz_title||'مركز أنجز');
  setText('#anjizDescription',values.anjiz_description||'دعم طلاب السنة التأسيسية.');
  setText('#anjizLink',values.anjiz_cta||'احجز الآن');
  setHref('#anjizLink',values.anjiz_booking_url||'#');
  setBackground('#anjizCard',values.anjiz_image_url,'assets/unizwa-new-gate-v52.jpg');

  setText('#masalikTitle',values.masalik_title||'مركز مسالك التعلم');
  setText('#masalikDescription',values.masalik_description||'دعم أكاديمي لطلاب التخصص.');
  setText('#masalikLink',values.masalik_cta||'احجز الآن');
  setHref('#masalikLink',values.masalik_booking_url||'#');
  setBackground('#masalikCard',values.masalik_image_url,'assets/unizwa-campus-aerial.jpg');
 }catch(error){
  console.warn('Centers settings skipped',error);
 }
}

translateStatic();
await Promise.allSettled([
 loadFeatureStates(),
 loadActivity(),
 loadStats(),
 loadCenters(),
 loadSocialLinks()
]);

trackClicks();
trackEvent('page_view',{page:'home'});
window.addEventListener('focus',loadFeatureStates);
