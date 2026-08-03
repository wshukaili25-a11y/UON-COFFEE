import{get,esc,enforceUonMaintenance,watchUonMaintenance,trackEvent,trackClicks}from'./core.js?v=45.0.0';

await enforceUonMaintenance();
watchUonMaintenance();

const $=selector=>document.querySelector(selector);
const language=()=>localStorage.getItem('uon_language')==='en'||document.documentElement.lang?.startsWith('en')?'en':'ar';
const t=(ar,en)=>language()==='en'?en:ar;
const PROFILE_KEY='uon-v44-schedule-profiles';
const ACTIVE_KEY='uon-v44-active-schedule';
const LEGACY_KEY='uon-v7-schedule';
const dayMap={0:'الأحد',1:'الاثنين',2:'الثلاثاء',3:'الأربعاء',4:'الخميس'};
const dayEn={'الأحد':'Sunday','الاثنين':'Monday','الثلاثاء':'Tuesday','الأربعاء':'Wednesday','الخميس':'Thursday'};

function parseTime(value){
 const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));
 if(!match)return null;
 const hour=Number(match[1]),minute=Number(match[2]);
 if(hour<0||hour>23||minute<0||minute>59)return null;
 return hour*60+minute;
}
function formatTime(value){
 const total=parseTime(value);
 if(total==null)return String(value||'');
 const hour24=Math.floor(total/60),minute=String(total%60).padStart(2,'0'),hour12=hour24%12||12;
 return language()==='en'?`${hour12}:${minute} ${hour24<12?'AM':'PM'}`:`${hour12}:${minute} ${hour24<12?'ص':'م'}`;
}
function readActiveRows(){
 try{
  const store=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');
  if(store?.profiles?.length){
   const requested=localStorage.getItem(ACTIVE_KEY);
   const profile=store.profiles.find(item=>item.id===requested)||store.profiles[0];
   if(Array.isArray(profile?.rows))return profile.rows;
  }
 }catch{}
 try{
  const rows=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]');
  return Array.isArray(rows)?rows:[];
 }catch{return[]}
}
function currentDayName(){return dayMap[new Date().getDay()]||null}
function nowMinutes(){const now=new Date();return now.getHours()*60+now.getMinutes()}
function dateLabel(){return new Intl.DateTimeFormat(language()==='en'?'en-GB':'ar-OM',{weekday:'long',day:'numeric',month:'short'}).format(new Date())}

function renderToday(){
 const date=$('#homeTodayDate'),title=$('#homeNextClassTitle'),meta=$('#homeNextClassMeta'),list=$('#homeTodayList'),label=$('#homeTodayLabel');
 if(!date||!title||!meta||!list)return;
 date.textContent=dateLabel();
 const day=currentDayName();
 if(label)label.textContent=day?(language()==='en'?dayEn[day]:day):t('نهاية الأسبوع','Weekend');
 if(!day){
  title.textContent=t('ما عندك محاضرات اليوم','No classes today');
  meta.textContent=t('خذ راحتك وراجع جدول الأسبوع القادم.','Take a break and check the coming week.');
  list.innerHTML=`<div class="home45-empty-day">${t('اليوم خارج أيام الجدول الدراسي.','Today is outside the study week.')}</div>`;
  return;
 }
 const rows=readActiveRows().filter(item=>item?.day===day&&parseTime(item.start)!=null&&parseTime(item.end)!=null).sort((a,b)=>parseTime(a.start)-parseTime(b.start));
 const now=nowMinutes();
 const current=rows.find(item=>parseTime(item.start)<=now&&parseTime(item.end)>now);
 const next=rows.find(item=>parseTime(item.start)>now);
 const focus=current||next;
 if(focus){
  title.textContent=current?t(`أنت الآن في ${focus.course}`,`Now: ${focus.course}`):focus.course;
  const status=current?t('تنتهي','Ends'):t('تبدأ','Starts');
  const time=current?formatTime(focus.end):formatTime(focus.start);
  meta.textContent=[`${status} ${time}`,focus.room?t(`القاعة ${focus.room}`,`Room ${focus.room}`):'',focus.teacher||''].filter(Boolean).join(' • ');
 }else if(rows.length){
  title.textContent=t('خلصت محاضرات اليوم 👏','Classes are done for today 👏');
  meta.textContent=t('راجع جدول باكر أو افتح الملخصات للمذاكرة.','Check tomorrow’s schedule or open summaries to study.');
 }else{
  title.textContent=t('ما أضفت محاضرات لهذا اليوم','No classes added for today');
  meta.textContent=t('افتح الجدول الدراسي وأضف موادك في أقل من دقيقة.','Open the study schedule and add your classes in under a minute.');
 }
 list.innerHTML=rows.length?rows.slice(0,5).map(item=>`<div class="home45-day-item"><span class="home45-day-time">${formatTime(item.start)} – ${formatTime(item.end)}</span><strong class="home45-day-course">${esc(item.course||t('مادة','Course'))}</strong><span class="home45-day-room">${esc(item.room||'')}</span></div>`).join(''):`<div class="home45-empty-day">${t('جدول اليوم فاضي. أضف موادك عشان تظهر لك المحاضرة القادمة هنا.','Today is empty. Add classes to see your next lecture here.')}</div>`;
}

function setupSearch(){
 const form=$('#homeSearch'),input=$('#homeSearchInput');
 form?.addEventListener('submit',event=>{
  event.preventDefault();
  const query=input?.value.trim();
  if(query)location.href=`search.html?q=${encodeURIComponent(query)}`;
  else input?.focus();
 });
}

function latestItem(item){
 const title=item.title||item.subject||item.course_code||t('ملف جديد','New file');
 const subtitle=[item.course_code,item.subject].filter(Boolean).join(' • ')||t('محتوى طلابي','Student content');
 return `<a class="home45-latest-item" href="summaries.html"><span class="home45-latest-icon">📄</span><span class="home45-latest-body"><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span><span class="home45-latest-tag">${t('جديد','New')}</span></a>`;
}
async function loadLatest(){
 const target=$('#homeLatestList');
 if(!target)return;
 try{
  const rows=await get('summaries','select=id,title,subject,course_code,created_at&approved=eq.true&order=created_at.desc&limit=5');
  target.innerHTML=rows.length?rows.map(latestItem).join(''):`<div class="home45-load-note">${t('ما فيه إضافات جديدة حاليًا.','No new additions right now.')}</div>`;
 }catch(error){
  console.warn('Latest homepage content skipped',error);
  target.innerHTML=`<div class="home45-load-note">${t('تعذر تحميل آخر الإضافات، وباقي خدمات الموقع تعمل عادي.','Latest additions could not load; the rest of the site still works.')}</div>`;
 }
}

function deferLatest(){
 const run=()=>void loadLatest();
 if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1800});
 else setTimeout(run,450);
}

setupSearch();
renderToday();
deferLatest();
trackClicks();
trackEvent('page_view',{page:'home_v45',language:language(),performance_mode:'lean'});

setInterval(renderToday,60000);
window.addEventListener('storage',event=>{if([PROFILE_KEY,ACTIVE_KEY,LEGACY_KEY].includes(event.key))renderToday()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderToday()});
new MutationObserver(mutations=>{if(mutations.some(item=>item.attributeName==='lang')){renderToday();void loadLatest()}}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
