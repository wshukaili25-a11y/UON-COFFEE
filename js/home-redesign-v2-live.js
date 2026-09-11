import{currentAcademicPulse}from'./student-pulse.js?v=61.2.0';

const LANG_KEY='uon_language';
const LEGACY_LANG_KEY='uon_hub_lang';
function readLanguage(){const current=localStorage.getItem(LANG_KEY),legacy=localStorage.getItem(LEGACY_LANG_KEY);return current==='en'||current==='ar'?current:(legacy==='en'||legacy==='ar'?legacy:'ar')}
const en=readLanguage()==='en';
const t=(ar,enText)=>en?enText:ar;
const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value};
const hasArabic=value=>/[\u0600-\u06FF]/.test(String(value||''));
const normalizeArabic=value=>String(value||'').trim().toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ـ]/g,'').replace(/\s+/g,' ');

document.documentElement.lang=en?'en':'ar';
document.documentElement.dir=en?'ltr':'rtl';
document.body?.setAttribute('data-language',en?'en':'ar');

const ACADEMIC_TITLES=new Map([
 ['فترة التسجيل الثانية','Second registration period'],
 ['بداية الدراسة + أسبوع الحذف والإضافة','Classes begin + Add/Drop week'],
 ['فترة الحذف والإضافة','Add/Drop period'],
 ['أسبوع التهيئة للطلبة الجدد','New student orientation week'],
 ['الاختبار الأول – الأسبوع الأول','First exam period – Week 1'],
 ['الاختبار الأول – الأسبوع الثاني','First exam period – Week 2'],
 ['الاختبار الثاني – الأسبوع الأول','Second exam period – Week 1'],
 ['الاختبار الثاني – الأسبوع الثاني','Second exam period – Week 2'],
 ['آخر يوم للانسحاب بدرجة (W)','Last day to withdraw with (W)'],
 ['فترة التسجيل الأولى لفصل الربيع','First registration period for Spring'],
 ['آخر يوم للانسحاب بدرجة (WF)','Last day to withdraw with (WF)'],
 ['آخر يوم للدراسة','Last day of classes'],
 ['الاختبارات النهائية','Final examinations']
].map(([ar,enText])=>[normalizeArabic(ar),enText]));

const SUPPORT_COPY=[
 {
  key:'anjiz',
  matches:value=>{const n=normalizeArabic(value);return n.includes('انجز')||/anjiz/i.test(String(value||''))},
  ar:{name:'مركز أنجز',audience:'لطلاب السنة التأسيسية',description:'دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.'},
  en:{name:'Anjiz Center',audience:'Foundation students',description:'Support for foundation-year students in English, mathematics, computing, and study skills.'}
 },
 {
  key:'masalik',
  matches:value=>{const n=normalizeArabic(value);return n.includes('مسالك')||/learning pathways/i.test(String(value||''))},
  ar:{name:'مركز تعزيز مسالك التعلم',audience:'لطلاب التخصص',description:'جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.'},
  en:{name:'Learning Pathways Enhancement Center',audience:'Major students',description:'Academic support sessions and small workshops for major students in foundational courses.'}
 }
];

function titleOf(academic){
 const raw=String(academic?.title||'').trim();
 if(!en)return raw;
 const explicit=String(academic?.title_en||academic?.titleEn||'').trim();
 if(explicit&&!hasArabic(explicit))return explicit;
 return ACADEMIC_TITLES.get(normalizeArabic(raw))||(hasArabic(raw)?'Upcoming academic event':raw);
}
function arabicDayCount(value){
 const days=Math.max(0,Math.trunc(Number(value)||0));
 if(days===1)return'يوم';
 if(days===2)return'يومين';
 if(days>=3&&days<=10)return`${days} أيام`;
 return`${days} يوم`;
}
function academicText(){
 const academic=currentAcademicPulse(new Date());
 if(!academic)return{icon:'📅',text:t('ما فيه موعد أكاديمي قريب حاليًا.','No upcoming academic date right now.')};
 const title=titleOf(academic);
 if(academic.state==='active')return{icon:academic.icon||'📅',text:`${title} • ${t('جاري الآن','Happening now')}`};
 const days=Math.max(0,Number(academic.daysUntilStart)||0);
 let when='';
 if(days===0)when=t('اليوم','Today');
 else if(en)when=`in ${days} ${days===1?'day':'days'}`;
 else when=`بعد ${arabicDayCount(days)}`;
 return{icon:academic.icon||'📅',text:`${title} • ${when}`};
}
function refreshAcademicCard(){
 const data=academicText();
 const card=document.querySelector('.uon-rd-academic');
 if(!card)return;
 const icon=card.querySelector('.uon-rd-academic-icon');
 const text=card.querySelector('strong');
 setText(icon,data.icon);
 if(text){setText(text,data.text);text.dir=en?'ltr':'rtl'}
}
function normalizeHomeCards(){document.querySelectorAll('.uon-rd-card-featured').forEach(card=>card.classList.remove('uon-rd-card-featured'))}
function refreshHomeControls(){
 const ai=document.querySelector('.uon-rd-shortcuts a[href*="assistant"]');
 setText(ai,'🤖 UON AI');
 const search=document.querySelector('#rdSearch button[type="submit"]');
 setText(search,`🔍 ${t('بحث','Search')}`);
}
function supportEntry(card){
 if(card.classList.contains('anjiz'))return SUPPORT_COPY[0];
 if(card.classList.contains('masalik'))return SUPPORT_COPY[1];
 const heading=card.querySelector('h3');
 const paragraph=card.querySelector('p');
 const current=`${heading?.textContent||''} ${paragraph?.textContent||''}`;
 return SUPPORT_COPY.find(item=>item.matches(current))||null;
}
function refreshSupportCards(){
 document.querySelectorAll('.uon-rd-support-card').forEach(card=>{
  const heading=card.querySelector('h3');
  const paragraph=card.querySelector('p');
  const entry=supportEntry(card);
  card.dir=en?'ltr':'rtl';
  if(heading){heading.dir='auto';heading.style.unicodeBidi='plaintext'}
  if(paragraph){paragraph.dir='auto';paragraph.style.unicodeBidi='plaintext'}
  if(entry){
   const copy=en?entry.en:entry.ar;
   setText(heading,copy.name);
   setText(card.querySelector('.uon-rd-support-label'),copy.audience);
   setText(paragraph,copy.description);
  }else if(en){
   if(heading&&hasArabic(heading.textContent))setText(heading,'Student Support Center');
   if(paragraph&&hasArabic(paragraph.textContent))setText(paragraph,'Academic support service available to University of Nizwa students.');
   setText(card.querySelector('.uon-rd-support-label'),'Support center');
  }
  const button=card.querySelector('.uon-rd-support-actions a,.uon-rd-support-actions button');
  setText(button,t('احجز موعدك','Book a session'));
 });
}
function refreshLegalNotice(){
 const note=document.querySelector('.uon-rd-note');
 if(!note)return;
 const html=en
  ?'<strong>Notice:</strong> UON Hub is an independent student project and is not officially affiliated with the University of Nizwa. All logos and names belong to their respective owners. The website aims to make student services and information easier to access.'
  :'<strong>تنبيه:</strong> UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى. جميع الشعارات والأسماء المستخدمة تعود لمالكيها، ويهدف الموقع إلى تسهيل وصول الطلبة إلى الخدمات والمعلومات.';
 if(note.innerHTML!==html)note.innerHTML=html;
}
function refreshEnglishFooter(){
 if(!en)return;
 const footer=document.querySelector('#rdManagedFooter');if(!footer)return;
 setText(footer.querySelector('.uon-rd-footer-prayer'),'My Lord, increase me in knowledge');
 setText(footer.querySelector('.uon-rd-footer-credit'),'Designed with love by University of Nizwa students ❤️.');
 setText(footer.querySelector('.uon-rd-footer-rights'),'All rights reserved © 2026 UON Hub');
 footer.dir='ltr';
}
function refresh(){
 normalizeHomeCards();
 refreshAcademicCard();
 refreshHomeControls();
 refreshSupportCards();
 refreshLegalNotice();
 refreshEnglishFooter();
}
function watchAsyncContent(){
 const support=document.querySelector('#rdSupportCenters');
 if(support)new MutationObserver(()=>refreshSupportCards()).observe(support,{childList:true,subtree:true});
 const footer=document.querySelector('#rdManagedFooter');
 if(footer)new MutationObserver(()=>refreshEnglishFooter()).observe(footer,{childList:true,subtree:true});
}

refresh();
watchAsyncContent();
requestAnimationFrame(refresh);
setTimeout(refresh,80);
setTimeout(refresh,250);
setTimeout(refresh,900);
setInterval(refreshAcademicCard,60*1000);
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
