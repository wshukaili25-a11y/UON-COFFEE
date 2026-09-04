const CSS_HREF='/css/schedule-home-align-v2.css?v=66.2.1';

function ensureCss(){
 if(document.querySelector('link[data-schedule-home-align]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href=CSS_HREF;
 link.dataset.scheduleHomeAlign='v2';
 document.head.append(link);
}

function polishRepeatBadges(root=document){
 root.querySelectorAll?.('.schedule-repeat-badge').forEach(badge=>{
  const text=String(badge.textContent||'').trim();
  const ar=text.match(/يتكرر\s+(\d+)\s+أيام/);
  if(ar){
   const count=Number(ar[1]);
   const next=count===2?'يتكرر يومين':count===1?'يتكرر يوم واحد':`يتكرر ${count} أيام`;
   if(next!==text)badge.textContent=next;
   return;
  }
  const en=text.match(/Repeats\s+(\d+)\s+days/i);
  if(en){
   const count=Number(en[1]);
   const next=`Repeats ${count} ${count===1?'day':'days'}`;
   if(next!==text)badge.textContent=next;
  }
 });
}

function updateEduwaveNotice(){
 const paragraph=document.querySelector('.eduwave-privacy p');
 if(!paragraph)return;
 const html='<b>خصوصيتك أولًا</b><br>الصور نفسها لا تُحفظ في قاعدة بيانات UON Hub. بعد القراءة نحفظ فقط البيانات الأكاديمية المستخرجة — رمز واسم المادة، الشعبة، الدكتور، الأيام، الأوقات والقاعة — لتحسين بيانات الشعب وUON AI حتى لو لم تعتمد جدولًا. البيانات غير المعتمدة تبقى مميزة كقراءة آلية إلى أن يؤكدها طالب.';
 if(paragraph.innerHTML!==html)paragraph.innerHTML=html;
 paragraph.closest('.eduwave-privacy')?.classList.add('knowledge-enabled');
}

function boot(){
 ensureCss();
 updateEduwaveNotice();
 polishRepeatBadges();
 const week=document.querySelector('#week');
 if(week){
  new MutationObserver(mutations=>{
   const changed=mutations.some(m=>m.type==='childList'&&m.addedNodes.length);
   if(changed)polishRepeatBadges(week);
  }).observe(week,{childList:true,subtree:true});
 }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
