import{currentAcademicPulse}from'./student-pulse.js?v=61.2.0';

const LANG_KEY='uon_language';
const en=localStorage.getItem(LANG_KEY)==='en';

function arabicDayCount(value){
 const days=Math.max(0,Math.trunc(Number(value)||0));
 if(days===1)return'يوم';
 if(days===2)return'يومين';
 if(days>=3&&days<=10)return`${days} أيام`;
 return`${days} يوم`;
}

function academicText(){
 const academic=currentAcademicPulse(new Date());
 if(!academic)return{icon:'📅',text:en?'No upcoming academic date right now.':'ما فيه موعد أكاديمي قريب حاليًا.'};
 if(academic.state==='active')return{icon:academic.icon||'📅',text:`${academic.title} • ${en?'Happening now':'جاري الآن'}`};
 const days=Math.max(0,Number(academic.daysUntilStart)||0);
 let when='';
 if(days===0)when=en?'Today':'اليوم';
 else if(en)when=`in ${days} ${days===1?'day':'days'}`;
 else when=`بعد ${arabicDayCount(days)}`;
 return{icon:academic.icon||'📅',text:`${academic.title} • ${when}`};
}

function refreshAcademicCard(){
 const data=academicText();
 const card=document.querySelector('.uon-rd-academic');
 if(!card)return;
 const icon=card.querySelector('.uon-rd-academic-icon');
 const text=card.querySelector('strong');
 if(icon)icon.textContent=data.icon;
 if(text)text.textContent=data.text;
}

function normalizeHomeCards(){
 document.querySelectorAll('.uon-rd-card-featured').forEach(card=>card.classList.remove('uon-rd-card-featured'));
}

function refresh(){
 normalizeHomeCards();
 refreshAcademicCard();
}

refresh();
setInterval(refreshAcademicCard,60*1000);
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
