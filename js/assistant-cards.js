(function(){
 'use strict';
 const language=()=>{try{return localStorage.getItem('uon_language')==='en'?'en':'ar'}catch{return'ar'}};
 const t=(ar,en)=>language()==='en'?en:ar;
 const text=v=>String(v??'').slice(0,1200);
 function node(tag,className,value){const el=document.createElement(tag);if(className)el.className=className;if(value)el.textContent=text(value);return el}
 function safeUrl(value){try{const url=new URL(String(value||''),location.origin);return value&&['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}}
 function link(label,url){const a=node('a','uon-card-action',label);a.href=url;if(/^https?:/.test(url)){a.target='_blank';a.rel='noopener noreferrer'}return a}
 function copy(label,value){const b=node('button','uon-card-action',label);b.type='button';b.setAttribute('aria-label',label);b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(value);b.textContent=t('تم النسخ ✓','Copied ✓')}catch{b.textContent=t('تعذر النسخ','Could not copy')}});return b}
 function field(host,label,value,ltr=false){if(!value)return;const row=node('div','uon-card-field');row.append(node('span','uon-card-label',label));const val=node('span','uon-card-value',value);val.dir=ltr?'ltr':'auto';row.append(val);host.append(row)}
 function render(article,data){
  if(!article||!data)return;
  article.uonMeta={links:Array.isArray(data.links)?data.links.slice(0,8):[],staff_cards:Array.isArray(data.staff_cards)?data.staff_cards.slice(0,6):[],staff_ids:Array.isArray(data.staff_ids)?data.staff_ids.slice(0,6):[],source_cards:Array.isArray(data.source_cards)?data.source_cards.slice(0,4):[],mode:text(data.mode),request_id:text(data.request_id)};
  if(article.querySelector('.uon-answer-cards'))return;
  const meta=article.uonMeta,host=node('section','uon-answer-cards');host.setAttribute('aria-label',t('تفاصيل الإجابة','Answer details'));
  for(const [i,card] of meta.staff_cards.entries()){
   if(!card?.name)continue;
   const box=node('article','uon-person-card');
   const head=node('div','uon-person-heading');head.append(node('span','uon-person-symbol','♙'));const names=node('div','');names.append(node('small','uon-card-eyebrow',meta.mode==='staff_clarification'?`${t('الخيار','Option')} ${i+1}`:t('دليل الجامعة','University directory')),node('h3','',card.name));head.append(names);box.append(head);
   if(card.title)box.append(node('p','uon-person-title',card.title));
   field(box,t('القسم','Department'),card.department);field(box,t('الكلية','College'),card.college);
   const email=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(card.email||''))?String(card.email):'';
   const phone=String(card.phone||'').replace(/[^+\d]/g,'');
   if(email)field(box,t('البريد','Email'),email,true);
   if(phone.length>=7)field(box,t('الهاتف','Phone'),card.phone,true);
   field(box,t('التحويلة','Extension'),card.extension,true);field(box,t('المكتب','Office'),card.office);
   const actions=node('div','uon-card-actions');
   if(meta.mode==='staff_clarification'){
    const choose=node('button','uon-card-action uon-card-primary',t('هذا اللي أقصده','Choose this person'));choose.type='button';choose.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('uon-assistant-ask',{detail:{question:language()==='en'?`Tell me about ${card.name}`:`أقصد ${card.name}`}})));actions.append(choose);
   }
   if(email){actions.append(copy(t('نسخ الإيميل','Copy email'),email),link(t('إرسال بريد','Send email'),'mailto:'+encodeURIComponent(email)));}
   if(phone.length>=7)actions.append(link(t('اتصال','Call'),'tel:'+phone));
   const url=safeUrl(card.url);if(url)actions.append(link(t('المصدر','Source'),url));box.append(actions);host.append(box);
  }
  if(!meta.staff_cards.length)for(const card of meta.source_cards){
   const url=safeUrl(card?.url);if(!url||!card?.title)continue;
   const box=node('article','uon-source-card');box.append(node('small','uon-card-eyebrow',card.official?t('مصدر رسمي','Official source'):t('من بيانات المنصة','Platform source')),node('h3','',card.title));if(card.description)box.append(node('p','',String(card.description).slice(0,400)));box.append(link(t('فتح التفاصيل','Open details'),url));host.append(box);
  }
  if(host.childElementCount){article.querySelectorAll('.assistant-links').forEach(x=>x.remove());article.append(host)}
 }
 window.UonAssistantCards={render};
})();
