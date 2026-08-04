const PRIMARY_KEYS=[
 'schedule','courses','gpa','projects','confessions','useful-sites',
 'summaries','groups','university-guide','ratings','assistant','calendar'
];
const EXCLUDED_KEYS=new Set(['support-centers']);
const target=document.querySelector('#items');
let arranging=false;
let queued=false;

const language=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const text=(ar,en)=>language()==='en'?en:ar;

function group(cards,{kind='primary',titleAr,titleEn,descriptionAr='',descriptionEn='',badgeAr='',badgeEn=''}={}){
 if(!cards.length)return null;
 const section=document.createElement('section');
 section.className=`uon46-tools-group ${kind}`;
 section.innerHTML=`<div class="uon46-tools-group-head"><div><h2>${text(titleAr,titleEn)}</h2>${descriptionAr||descriptionEn?`<p>${text(descriptionAr,descriptionEn)}</p>`:''}</div>${badgeAr||badgeEn?`<span class="uon46-tools-group-badge">${text(badgeAr,badgeEn)}</span>`:''}</div><div class="uon46-tools-grid"></div>`;
 const grid=section.querySelector('.uon46-tools-grid');
 cards.forEach(card=>grid.append(card));
 return section;
}

function arrange(){
 if(!target||arranging)return;
 const directCards=[...target.children].filter(node=>node.matches?.('.uon44-tool-card'));
 if(!directCards.length)return;
 arranging=true;
 try{
  directCards.filter(card=>EXCLUDED_KEYS.has(card.dataset.toolKey)).forEach(card=>card.remove());
  const cards=directCards.filter(card=>!EXCLUDED_KEYS.has(card.dataset.toolKey));
  const byKey=new Map(cards.map(card=>[card.dataset.toolKey,card]));
  const primary=PRIMARY_KEYS.map(key=>byKey.get(key)).filter(Boolean);
  const primarySet=new Set(primary);
  const additional=cards.filter(card=>!primarySet.has(card));

  const fragment=document.createDocumentFragment();
  const primaryGroup=group(primary,{
   kind:'primary',
   titleAr:'الأدوات الأساسية',titleEn:'Essential tools',
   descriptionAr:'أهم خدمات الطالب في مكان واحد.',descriptionEn:'The main student services in one place.',
   badgeAr:'★ الخدمات الأساسية',badgeEn:'★ Essential'
  });
  const additionalGroup=group(additional,{
   kind:'additional',
   titleAr:'خدمات إضافية',titleEn:'Additional services',
   descriptionAr:'أدوات وخدمات مساندة مرتبة بشكل مستقل.',descriptionEn:'Supporting tools and services in a separate section.'
  });
  if(primaryGroup)fragment.append(primaryGroup);
  if(additionalGroup)fragment.append(additionalGroup);
  target.classList.add('uon46-tools-root');
  target.replaceChildren(fragment);
 }finally{
  arranging=false;
 }
}

function scheduleArrange(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{queued=false;arrange()});
}

if(target){
 new MutationObserver(scheduleArrange).observe(target,{childList:true});
 scheduleArrange();
 document.addEventListener('uon:tool-catalog-updated',scheduleArrange);
}
