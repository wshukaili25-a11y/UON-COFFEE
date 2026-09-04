const CSS_HREF='/css/schedule-home-align-v2.css?v=66.2.0';

function ensureCss(){
 if(document.querySelector('link[data-schedule-home-align]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href=CSS_HREF;
 link.dataset.scheduleHomeAlign='v2';
 document.head.append(link);
}

function polishRepeatBadges(){
 document.querySelectorAll('.schedule-repeat-badge').forEach(badge=>{
  const text=String(badge.textContent||'').trim();
  const ar=text.match(/يتكرر\s+(\d+)\s+أيام/);
  if(ar){
   const count=Number(ar[1]);
   badge.textContent=count===2?'يتكرر يومين':`يتكرر ${count} أيام`;
   return;
  }
  const en=text.match(/Repeats\s+(\d+)\s+days/i);
  if(en){
   const count=Number(en[1]);
   badge.textContent=`Repeats ${count} ${count===1?'day':'days'}`;
  }
 });
}

function updateEduwaveNotice(){
 const host=document.querySelector('.eduwave-privacy');
 const paragraph=host?.querySelector('p');
 if(!paragraph)return;
 paragraph.innerHTML='<b>خصوصيتك أولًا</b><br>الصور نفسها لا تُحفظ في قاعدة بيانات UON Hub. بعد القراءة نحفظ فقط البيانات الأكاديمية المستخرجة — رمز واسم المادة، الشعبة، الدكتور، الأيام، الأوقات والقاعة — لتحسين بيانات الشعب وUON AI حتى لو لم تعتمد جدولًا. البيانات غير المعتمدة تبقى مميزة كقراءة آلية إلى أن يؤكدها طالب.';
 host.classList.add('knowledge-enabled');
}

function boot(){
 ensureCss();
 updateEduwaveNotice();
 polishRepeatBadges();
 const week=document.querySelector('#week');
 if(week)new MutationObserver(polishRepeatBadges).observe(week,{childList:true,subtree:true,characterData:true});
 const modal=document.querySelector('#eduwaveModal');
 if(modal)new MutationObserver(updateEduwaveNotice).observe(modal,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
