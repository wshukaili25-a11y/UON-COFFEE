const PRIMARY_KEYS=['schedule','courses','gpa','projects','confessions','useful-sites'];
const target=document.querySelector('#items');
let arranging=false;
let queued=false;

const language=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const text=(ar,en)=>language()==='en'?en:ar;

function group(title,description,cards,kind){
 if(!cards.length)return null;
 const section=document.createElement('section');
 section.className=`uon46-tools-group ${kind}`;
 section.innerHTML=`<div class="uon46-tools-group-head"><div><h2>${title}</h2><p>${description}</p></div>${kind==='primary'?`<span class="uon46-tools-group-badge">★ ${text('الأكثر استخدامًا','Most used')}</span>`:''}</div><div class="uon46-tools-grid"></div>`;
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
  const byKey=new Map(directCards.map(card=>[card.dataset.toolKey,card]));
  const primary=PRIMARY_KEYS.map(key=>byKey.get(key)).filter(Boolean);
  const primarySet=new Set(primary);
  const others=directCards.filter(card=>!primarySet.has(card));
  const fragment=document.createDocumentFragment();
  const mainGroup=group(
   text('الأدوات الأساسية','Essential tools'),
   text('أهم الأدوات التي يحتاجها الطالب يوميًا.','The tools students use most often.'),
   primary,
   'primary'
  );
  const otherGroup=group(
   text('خدمات وأدوات أخرى','Other services and tools'),
   text('بقية خدمات UON Hub والأدوات الطلابية.','More UON Hub services and student tools.'),
   others,
   'secondary'
  );
  if(mainGroup)fragment.append(mainGroup);
  if(otherGroup)fragment.append(otherGroup);
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
