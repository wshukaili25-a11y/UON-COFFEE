const CSS_HREF='/css/schedule-home-align-v2.css?v=66.5.0';
const LANG_KEY='uon_language';
const LEGACY_LANG_KEY='uon_hub_lang';

const EN_TEXT=new Map([
 ['أداتك الأكاديمية الذكية','Your smart academic tool'],
 ['جدولك الدراسي','Your Study Schedule'],
 ['رتّب أسبوعك بطريقتك، أو خلّ UON AI يبنيه من صور الشعب في EduWave.','Plan your week your way, or let UON AI build it from EduWave section screenshots.'],
 ['✨ ولّد من EduWave','✨ Generate from EduWave'],
 ['＋ إضافة محاضرة','+ Add a class'],
 ['الجدول الحالي','Current schedule'],
 ['محفوظ على جهازك','Saved on your device'],
 ['جدول جديد','New schedule'],
 ['تغيير الاسم','Rename'],
 ['إنشاء نسخة','Duplicate'],
 ['تصدير صورة','Export image'],
 ['طباعة','Print'],
 ['حفظ ملف','Save file'],
 ['استيراد ملف','Import file'],
 ['مسح الجدول','Clear schedule'],
 ['الأسبوع الدراسي','Study week'],
 ['محاضراتك بنظرة واحدة','Your classes at a glance'],
 ['اليوم','Today'],
 ['جدولك ينتظر أول مادة','Your schedule is waiting for its first course'],
 ['أضفها يدويًا أو ارفع صور الشعب المتاحة وخذ أكثر من اقتراح بدون تعارض.','Add it manually or upload available-section screenshots to get conflict-free options.'],
 ['ولّد من صور EduWave','Generate from EduWave images'],
 ['إضافة يدويًا','Add manually'],
 ['تحليل الجدول','Schedule analysis'],
 ['التعارضات والفراغات تظهر هنا','Conflicts and gaps appear here'],
 ['تعديل الجدول','Edit schedule'],
 ['إضافة محاضرة','Add a class'],
 ['اختر الأيام التي تتكرر فيها المادة.','Choose the days when this course repeats.'],
 ['وضع التعديل','Editing mode'],
 ['المادة','Course'],
 ['نوع الحصة','Class type'],
 ['أيام المادة','Course days'],
 ['من','From'],
 ['إلى','To'],
 ['القاعة','Room'],
 ['الدكتور','Instructor'],
 ['إضافة للجدول','Add to schedule'],
 ['إلغاء التعديل','Cancel editing'],
 ['محاضرة','Lecture'],
 ['مختبر / عملي','Lab / Practical'],
 ['تمارين','Tutorial'],
 ['ورشة','Workshop'],
 ['أخرى','Other'],
 ['صباحًا','AM'],
 ['مساءً','PM'],
 ['الأحد','Sunday'],
 ['الاثنين','Monday'],
 ['الثلاثاء','Tuesday'],
 ['الأربعاء','Wednesday'],
 ['الخميس','Thursday'],
 ['مولّد الجداول الذكي','Smart schedule generator'],
 ['من صور EduWave إلى جدول مرتب','From EduWave images to an organized schedule'],
 ['ارفع صورة لكل مادة، وسنقرأ جميع الشعب ونقترح لك جداول بدون تعارض.','Upload an image for each course. We’ll read all sections and suggest conflict-free schedules.'],
 ['رفع الصور','Upload images'],
 ['مراجعة القراءة','Review extraction'],
 ['اختيار الاقتراح','Choose a suggestion'],
 ['كيف تحصل على صور السكاشن من EduWave؟','How do you get section screenshots from EduWave?'],
 ['سجّل الدخول إلى موقع','Sign in to'],
 ['التابع لجامعة نزوى.','for the University of Nizwa.'],
 ['اضغط أيقونة','Tap the'],
 ['المربعات الصفراء','yellow squares'],
 ['أعلى الصفحة، ثم اختر','at the top of the page, then choose'],
 ['خطة المرشد','Advisor Plan'],
 ['ستظهر مواد خطتك: متطلبات واختياري الجامعة، الكلية، والتخصص.','Your plan courses will appear: university, college, and major requirements/electives.'],
 ['حرّك جدول المواد إلى اليسار حتى عمود','Move the course table left until you reach the'],
 ['الشُعب المتاحة','Available Sections'],
 ['اضغط كلمة','Tap the'],
 ['الشُعب','Sections'],
 ['الزرقاء بجانب المادة.','shown in blue next to the course.'],
 ['التقط صورة واضحة تشمل اسم ورمز المادة وجميع الشعب والأيام والأوقات والقاعات.','Take a clear screenshot showing the course name/code, all sections, days, times, and rooms.'],
 ['كرر لكل مادة، ثم ارفع الصور كلها هنا مرة واحدة.','Repeat for every course, then upload all images here at once.'],
 ['مهم:','Important:'],
 ['تأكد أن جميع الشعب ظاهرة. إذا كانت القائمة طويلة يمكنك رفع أكثر من صورة للمادة نفسها.','Make sure all sections are visible. If the list is long, you can upload more than one image for the same course.'],
 ['اسحب صور الشعب هنا','Drop section images here'],
 ['أو اضغط للاختيار · PNG / JPG / WEBP','or tap to choose · PNG / JPG / WEBP'],
 ['قراءة الصور بالذكاء الاصطناعي ←','Read images with AI →'],
 ['رجوع','Back'],
 ['تأكيد وتوليد الجداول ←','Confirm & generate schedules →'],
 ['رجوع للمراجعة','Back to review'],
 ['راجع القراءة قبل التوليد','Review the extraction before generating'],
 ['تأكد من رمز المادة والشعب، وألغِ أي شعبة لا تريدها.','Check the course code and sections, and deselect any section you do not want.'],
 ['رمز المادة','Course code'],
 ['اسم المادة','Course name'],
 ['اختر الجدول الأنسب لك','Choose the schedule that suits you best'],
 ['كل الاقتراحات أدناه خالية من التعارضات.','All suggestions below are conflict-free.'],
 ['اعتماد هذا الجدول','Use this schedule'],
 ['أقل أيام دوام','Fewer campus days'],
 ['يجمع محاضراتك في أقل عدد من الأيام','Groups your classes into the fewest possible days'],
 ['أقل فراغات','Fewer gaps'],
 ['يقلل وقت الانتظار بين المحاضرات','Reduces waiting time between classes'],
 ['جدول صباحي','Morning schedule'],
 ['يقدم الشعب المبكرة قدر الإمكان','Prefers earlier sections when possible'],
 ['جدول متأخر','Later schedule'],
 ['يتجنب المحاضرات الصباحية قدر الإمكان','Avoids morning classes when possible'],
 ['جدول متوازن','Balanced schedule'],
 ['توازن بين الأيام والفراغات','Balances campus days and gaps'],
 ['التعارضات','Conflicts'],
 ['الفراغ الأسبوعي','Weekly gaps'],
 ['اقتراح UON AI','UON AI suggestion'],
 ['لا يوجد ✓','None ✓'],
 ['جاهز لتحليل جدولك','Ready to analyze your schedule'],
 ['أضف موادك أولًا','Add your courses first'],
 ['جدولك خالٍ من التعارضات','Your schedule is conflict-free'],
 ['تمت مزامنته مع UON AI','Synced with UON AI'],
 ['جاهز للمزامنة مع UON AI','Ready to sync with UON AI'],
 ['فارغ','Empty'],
 ['تعديل','Edit'],
 ['حذف هذا اليوم','Delete this day'],
 ['حذف كل الأيام','Delete all days'],
 ['حذف','Delete']
]);

function language(){
 const direct=localStorage.getItem(LANG_KEY),legacy=localStorage.getItem(LEGACY_LANG_KEY);
 return direct==='en'||(direct!=='ar'&&legacy==='en')?'en':'ar';
}
function isEnglish(){return language()==='en'}
function ensureCss(){
 if(document.querySelector('link[data-schedule-home-align]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href=CSS_HREF;
 link.dataset.scheduleHomeAlign='v2';
 document.head.append(link);
}
function syncHeaderBrand(){
 document.querySelectorAll('.site-header .v176-brand > span,#v176SideMenu .v176-brand > span').forEach(mark=>{
  if(mark.querySelector('img[data-schedule-brand-logo]'))return;
  mark.classList.add('schedule-shell-logo');
  mark.replaceChildren();
  const img=document.createElement('img');
  img.src='/assets/uonhub-logo-original-20260904.jpeg';
  img.alt='';
  img.width=42;img.height=42;
  img.dataset.scheduleBrandLogo='1';
  mark.append(img);
 });
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
 const html=isEnglish()
  ?'<b>Your privacy comes first</b><br>The images themselves are not stored in the UON Hub database. After extraction, we only keep the academic data found in them — course code/name, section, instructor, days, times, and room — to improve section data and UON AI, even if you do not adopt a schedule. Unconfirmed data remains marked as AI-extracted until a student confirms it.'
  :'<b>خصوصيتك أولًا</b><br>الصور نفسها لا تُحفظ في قاعدة بيانات UON Hub. بعد القراءة نحفظ فقط البيانات الأكاديمية المستخرجة — رمز واسم المادة، الشعبة، الدكتور، الأيام، الأوقات والقاعة — لتحسين بيانات الشعب وUON AI حتى لو لم تعتمد جدولًا. البيانات غير المعتمدة تبقى مميزة كقراءة آلية إلى أن يؤكدها طالب.';
 if(paragraph.innerHTML!==html)paragraph.innerHTML=html;
 paragraph.closest('.eduwave-privacy')?.classList.add('knowledge-enabled');
}
function updateNoticeAndFooter(){
 const notice=document.querySelector('.uon-independent-notice');
 if(notice){
  notice.classList.add('schedule-home-notice');
  notice.innerHTML=isEnglish()
   ?'<p><strong>Notice:</strong> UON Hub is an independent student project and is not officially affiliated with the University of Nizwa. All logos and names used belong to their respective owners. The website aims to make student services and information easier to access.</p>'
   :'<p><strong>تنبيه:</strong> UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى. جميع الشعارات والأسماء المستخدمة تعود لمالكيها، ويهدف الموقع إلى تسهيل وصول الطلبة إلى الخدمات والمعلومات.</p>';
 }
 const footer=document.querySelector('.site-footer');
 if(footer){
  footer.classList.add('schedule-home-footer');
  footer.innerHTML=isEnglish()
   ?'<div class="container schedule-home-footer-main"><p class="schedule-footer-prayer">My Lord, increase me in knowledge</p><p class="schedule-footer-credit">Designed with love by University of Nizwa students ❤️.</p><a class="schedule-footer-handle" dir="ltr" href="https://www.instagram.com/uonhub" target="_blank" rel="noopener noreferrer">@uonhub</a><p class="schedule-footer-rights">All rights reserved © 2026 UON Hub</p></div>'
   :'<div class="container schedule-home-footer-main"><p class="schedule-footer-prayer">رَبِّ زِدْنِي عِلْمًا</p><p class="schedule-footer-credit">صمم بحب من طلاب جامعة نزوى❤️.</p><a class="schedule-footer-handle" dir="ltr" href="https://www.instagram.com/uonhub" target="_blank" rel="noopener noreferrer">@uonhub</a><p class="schedule-footer-rights">جميع الحقوق محفوظة © 2026 UON Hub</p></div>';
 }
}
function translateDynamicPhrase(text){
 if(!isEnglish())return text;
 if(EN_TEXT.has(text))return EN_TEXT.get(text);
 let m=text.match(/^(\d+)\s+مواد$/);if(m)return`${m[1]} courses`;
 m=text.match(/^(\d+)\s+مادة$/);if(m)return`${m[1]} ${m[1]==='1'?'course':'courses'}`;
 m=text.match(/^(\d+)\s+أيام$/);if(m)return`${m[1]} days`;
 m=text.match(/^(\d+)\s+يوم$/);if(m)return`${m[1]} ${m[1]==='1'?'day':'days'}`;
 m=text.match(/^(\d+)\s+اقتراحات$/);if(m)return`${m[1]} suggestions`;
 m=text.match(/^(\d+)\s+طالب$/);if(m)return`${m[1]} students`;
 m=text.match(/^الشعبة\s+(.+)$/);if(m)return`Section ${m[1]}`;
 m=text.match(/^شعبة\s+(.+)$/);if(m)return`Section ${m[1]}`;
 m=text.match(/^اقتراح\s+(\d+)$/);if(m)return`Suggestion ${m[1]}`;
 m=text.match(/^يتكرر\s+يومين$/);if(m)return'Repeats 2 days';
 m=text.match(/^يتكرر\s+يوم واحد$/);if(m)return'Repeats 1 day';
 m=text.match(/^يتكرر\s+(\d+)\s+أيام$/);if(m)return`Repeats ${m[1]} days`;
 m=text.match(/^(\d+)\s+تعارض يحتاج انتباه$/);if(m)return`${m[1]} conflict${m[1]==='1'?'':'s'} need attention`;
 m=text.match(/^(\d+)\s+تعارض$/);if(m)return`${m[1]} conflict${m[1]==='1'?'':'s'}`;
 m=text.match(/^تمت قراءة\s+(\d+)\s+مواد/);if(m)return`Read ${m[1]} courses successfully ✅ Review the sections, then generate schedules`;
 m=text.match(/^تجهيز الصورة\s+(\d+)\s+من\s+(\d+)…$/);if(m)return`Preparing image ${m[1]} of ${m[2]}…`;
 m=text.match(/^(\d+)س\s*(\d+)?د?$/);if(m)return`${m[1]}h${m[2]?` ${m[2]}m`:''}`;
 if(text==='قراءة المواد والشعب…')return'Reading courses and sections…';
 if(text==='جاري قراءة الصور…')return'Reading images…';
 return text;
}
function translateTree(root){
 if(!isEnglish()||!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(node=>{
  const parent=node.parentElement;if(!parent||parent.closest('script,style'))return;
  const raw=node.nodeValue||'',trimmed=raw.trim();if(!trimmed)return;
  const translated=translateDynamicPhrase(trimmed);if(translated===trimmed)return;
  const start=raw.indexOf(trimmed);node.nodeValue=raw.slice(0,start)+translated+raw.slice(start+trimmed.length);
 });
}
function translateAttributes(){
 if(!isEnglish())return;
 const placeholders={course:'Example: INFS102',room:'Example: 17A',teacher:'Instructor name'};
 Object.entries(placeholders).forEach(([id,value])=>document.querySelector('#'+id)?.setAttribute('placeholder',value));
 document.querySelectorAll('[aria-label="إغلاق"]').forEach(el=>el.setAttribute('aria-label','Close'));
 document.querySelector('[aria-label="اختر الجدول"]')?.setAttribute('aria-label','Choose schedule');
 document.querySelector('[aria-label="أيام الأسبوع"]')?.setAttribute('aria-label','Weekdays');
 document.querySelector('[aria-label="الجدول الدراسي الأسبوعي"]')?.setAttribute('aria-label','Weekly study schedule');
 document.querySelectorAll('[aria-label="حذف الصورة"]').forEach(el=>el.setAttribute('aria-label','Remove image'));
}
function applyEnglishQuickStats(){
 if(!isEnglish())return;
 const spans=[...document.querySelectorAll('#scheduleQuickStats > span')];
 if(spans[0]){const n=spans[0].querySelector('b')?.textContent?.trim()||'0';spans[0].childNodes.forEach(n=>{if(n.nodeType===3&&n.nodeValue.trim())n.nodeValue=' courses'});}
 if(spans[1]){spans[1].childNodes.forEach(n=>{if(n.nodeType===3&&n.nodeValue.trim())n.nodeValue=' days'});}
 if(spans[2]){spans[2].childNodes.forEach(n=>{if(n.nodeType===3&&n.nodeValue.trim())n.nodeValue=' weekly'});const b=spans[2].querySelector('b');if(b)b.textContent=translateDynamicPhrase(b.textContent.trim());}
}
function applyAll(){
 ensureCss();syncHeaderBrand();updateEduwaveNotice();updateNoticeAndFooter();polishRepeatBadges();translateAttributes();
 if(isEnglish()){document.title='Study Schedule | UON Hub';translateTree(document.querySelector('.schedule-app'));translateTree(document.querySelector('#lectureModal'));translateTree(document.querySelector('#eduwaveModal'));translateTree(document.querySelector('#toast'));applyEnglishQuickStats();}
}
function boot(){
 applyAll();
 requestAnimationFrame(()=>{syncHeaderBrand();applyAll()});
 setTimeout(()=>{syncHeaderBrand();applyAll()},180);
 const observed=[document.querySelector('#week'),document.querySelector('#scheduleQuickStats'),document.querySelector('#scheduleInsightSummary'),document.querySelector('#scheduleInsightBody'),document.querySelector('#redesignDayTabs'),document.querySelector('#eduwaveReview'),document.querySelector('#eduwaveProposals'),document.querySelector('#scheduleSyncState'),document.querySelector('#toast')].filter(Boolean);
 observed.forEach(root=>new MutationObserver(mutations=>{
  mutations.forEach(m=>m.addedNodes.forEach(node=>{if(node.nodeType===1)translateTree(node);else if(node.nodeType===3&&isEnglish()){const raw=node.nodeValue||'',trim=raw.trim(),next=translateDynamicPhrase(trim);if(next!==trim)node.nodeValue=raw.replace(trim,next)}}));
  polishRepeatBadges(root);applyEnglishQuickStats();
 }).observe(root,{childList:true,subtree:true}));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();