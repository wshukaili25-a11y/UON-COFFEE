/* Progressive enhancement only: the original page owns all forms and data. */
(()=>{
 const root=document.documentElement;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const en=()=>root.lang==='en';
 function decorate(){
  const main=document.querySelector('main');
  if(main&&!document.querySelector('.hub-skip')){
   if(!main.id)main.id='hubMain';
   const skip=document.createElement('a');skip.className='hub-skip';skip.href=`#${main.id}`;
   skip.textContent=en()?'Skip to content':'انتقل إلى المحتوى';
   main.tabIndex=-1;document.body.prepend(skip);
  }
  const intro=document.querySelector('.workspace-intro');
  if(intro&&!intro.querySelector('.hub-orbit')){
   const orbit=document.createElement('div');orbit.className='hub-orbit';orbit.setAttribute('aria-hidden','true');
   orbit.innerHTML='<svg viewBox="0 0 48 48" fill="none"><path d="m24 5 5 13 14 6-14 5-5 14-6-14L5 24l13-6Z" stroke="currentColor" stroke-width="1.5"/><path d="m24 16 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor"/></svg><i></i>';
   intro.prepend(orbit);
  }
  const actions=document.querySelector('.uon-rd-actions,.v176-nav-actions');
  if(actions&&!actions.querySelector('.hub-motion')){
   const button=document.createElement('button');button.type='button';button.className='hub-motion v176-nav-button uon-rd-icon';
   button.textContent='◌';
   button.addEventListener('click',()=>{root.dataset.hubMotion=root.dataset.hubMotion==='off'?'on':'off';try{localStorage.setItem('uon_hub_motion',root.dataset.hubMotion)}catch{}syncMotion()});
   actions.prepend(button);syncMotion();
  }
  document.querySelectorAll('.uon-rd-card,.uon-rd-support-card').forEach(card=>{
   if(card.dataset.hubObserved)return;card.dataset.hubObserved='1';reveal.observe(card);
  });
 }
 function syncMotion(){
  const off=root.dataset.hubMotion==='off'||reduced.matches;
  document.querySelectorAll('.hub-motion').forEach(button=>{button.setAttribute('aria-label',en()?'Reduce motion':'تقليل الحركة');button.setAttribute('aria-pressed',String(off));button.disabled=reduced.matches;button.title=reduced.matches?(en()?'Reduced motion follows your device settings':'تقليل الحركة مفعّل من إعدادات جهازك'):button.getAttribute('aria-label')});
 }
 const reveal=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('hub-arrive');reveal.unobserve(entry.target)}},{threshold:.08});
 let scheduled=false;
 new MutationObserver(records=>{
  if(scheduled||!records.some(record=>record.addedNodes.length))return;
  scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()});
 }).observe(document.body,{childList:true,subtree:true});
 // Legacy page bootstraps append styles after load; keep the single studio layer last.
 const style=document.querySelector('#hubStudioStyle');
 new MutationObserver(()=>{const styles=[...document.head.querySelectorAll('link[rel=stylesheet],style')];if(styles.at(-1)!==style)document.head.append(style)}).observe(document.head,{childList:true});
 reduced.addEventListener('change',syncMotion);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   const menu=document.querySelector('#rdMobile.open');
   if(menu){menu.classList.remove('open');const trigger=document.querySelector('#rdMenu');trigger?.setAttribute('aria-expanded','false');trigger?.focus()}
  }
 });
 decorate();
})();
