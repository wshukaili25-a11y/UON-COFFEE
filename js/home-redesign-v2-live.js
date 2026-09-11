import{currentAcademicPulse}from'./student-pulse.js?v=61.2.0';

const LANG_KEY='uon_language';
const en=localStorage.getItem(LANG_KEY)==='en';
const t=(ar,enText)=>en?enText:ar;

document.documentElement.lang=en?'en':'ar';
document.documentElement.dir=en?'ltr':'rtl';

const ACADEMIC_TITLES={
 'فترة التسجيل الثانية':'Second registration period',
 'بداية الدراسة + أسبوع الحذف والإضافة':'Classes begin + Add/Drop week',
 'فترة الحذف والإضافة':'Add/Drop period',
 'أسبوع التهيئة للطلبة الجدد':'New student orientation week',
 'الاختبار الأول – الأسبوع الأول':'First exam period – Week 1',
 'الاختبار الأول – الأسبوع الثاني':'First exam period – Week 2',
 'الاختبار الثاني – الأسبوع الأول':'Second exam period – Week 1',
 'الاختبار الثاني – الأسبوع الثاني':'Second exam period – Week 2',
 'آخر يوم للانسحاب بدرجة (W)':'Last day to withdraw with (W)',
 'فترة التسجيل الأولى لفصل الربيع':'First registration period for Spring',
 'آخر يوم للانسحاب بدرجة (WF)':'Last day to withdraw with (WF)',
 'آخر يوم للدراسة':'Last day of classes',
 'الاختبارات النهائية':'Final examinations'
};

const SUPPORT_COPY=[
 {
  match:/أنجز|anjiz/i,
  ar:{name:'مركز أنجز',audience:'لطلاب السنة التأسيسية',description:'دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.'},
  en:{name:'Anjiz Center',audience:'Foundation students',description:'Support for foundation-year students in English, mathematics, computing, and study skills.'}
 },
 {
  match:/مسالك|learning pathways/i,
  ar:{name:'مركز تعزيز مسالك التعلم',audience:'لطلاب التخصص',description:'جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.'},
  en:{name:'Learning Pathways Enhancement Center',audience:'Major students',description:'Academic support sessions and small workshops for major students in foundational courses.'}
 }
];

function titleOf(academic){
 const title=String(academic?.title||'').trim();
 return en?(ACADEMIC_TITLES[title]||title):title;
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
 if(icon)icon.textContent=data.icon;
 if(text){text.textContent=data.text;text.dir=en?'ltr':'rtl'}
}
function normalizeHomeCards(){
 document.querySelectorAll('.uon-rd-card-featured').forEach(card=>card.classList.remove('uon-rd-card-featured'));
}
function refreshHomeControls(){
 const ai=document.querySelector('.uon-rd-shortcuts a[href*="assistant"]');
 if(ai)ai.textContent='🤖 UON AI';
 const search=document.querySelector('#rdSearch button[type="submit"]');
 if(search)search.textContent=`🔍 ${t('بحث','Search')}`;
}
function refreshSupportCards(){
 document.querySelectorAll('.uon-rd-support-card').forEach(card=>{
  const heading=card.querySelector('h3');
  if(!heading)return;
  const current=`${heading.textContent||''} ${card.querySelector('p')?.textContent||''}`;
  const entry=SUPPORT_COPY.find(item=>item.match.test(current));
  if(!entry)return;
  const copy=en?entry.en:entry.ar;
  heading.textContent=copy.name;
  const label=card.querySelector('.uon-rd-support-label');if(label)label.textContent=copy.audience;
  const description=card.querySelector('p');if(description)description.textContent=copy.description;
  card.dir=en?'ltr':'rtl';
 });
}
function refreshLegalNotice(){
 const note=document.querySelector('.uon-rd-note');
 if(!note)return;
 note.innerHTML=en
  ?'<strong>Notice:</strong> UON Hub is an independent student project and is not officially affiliated with the University of Nizwa. All logos and names belong to their respective owners. The website aims to make student services and information easier to access.'
  :'<strong>تنبيه:</strong> UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى. جميع الشعارات والأسماء المستخدمة تعود لمالكيها، ويهدف الموقع إلى تسهيل وصول الطلبة إلى الخدمات والمعلومات.';
}
function refreshEnglishFooter(){
 if(!en)return;
 const footer=document.querySelector('#rdManagedFooter');if(!footer)return;
 const prayer=footer.querySelector('.uon-rd-footer-prayer');if(prayer)prayer.textContent='My Lord, increase me in knowledge';
 const credit=footer.querySelector('.uon-rd-footer-credit');if(credit)credit.textContent='Designed with love by University of Nizwa students ❤️.';
 const rights=footer.querySelector('.uon-rd-footer-rights');if(rights)rights.textContent='All rights reserved © 2026 UON Hub';
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
setInterval(refreshAcademicCard,60*1000);
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
