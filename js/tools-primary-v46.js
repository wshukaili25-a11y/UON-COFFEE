const PRIMARY_KEYS=[
 'schedule','courses','gpa','projects','confessions','useful-sites',
 'summaries','groups','university-guide','ratings','assistant','calendar'
];
const target=document.querySelector('#items');
let arranging=false;
let queued=false;

const language=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const text=(ar,en)=>language()==='en'?en:ar;

function group(cards){
 if(!cards.length)return null;
 const section=document.createElement('section');
 section.className='uon46-tools-group primary';
 section.innerHTML=`<div class="uon46-tools-group-head"><div><h2>${text('الأدوات الأساسية','Essential tools')}</h2><p>${text('كل أدوات وخدمات الطالب في مكان واحد.','All student tools and services in one place.')}</p></div><span class="uon46-tools-group-badge">★ ${text('كل الخدمات','All services')}</span></div><div class="uon46-tools-grid"></div>`;
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
  const ordered=PRIMARY_KEYS.map(key=>byKey.get(key)).filter(Boolean);
  const orderedSet=new Set(ordered);
  directCards.filter(card=>!orderedSet.has(card)).forEach(card=>ordered.push(card));
  const mainGroup=group(ordered);
  target.classList.add('uon46-tools-root');
  target.replaceChildren(mainGroup||document.createDocumentFragment());
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
