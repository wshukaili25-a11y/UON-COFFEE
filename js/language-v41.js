const LANGUAGE_KEY='uon_language';
const supported=new Set(['ar','en']);

export const getLanguage=()=>{
 const saved=localStorage.getItem(LANGUAGE_KEY);
 return supported.has(saved)?saved:'ar';
};

function translateElement(element,lang){
 if(!(element instanceof Element))return;
 if(element.matches('[data-ar][data-en]')){
  const value=lang==='ar'?element.dataset.ar:element.dataset.en;
  if(value!==undefined){
   if(element.matches('input,textarea'))element.value=value;
   else element.textContent=value;
  }
 }
 if(element.matches('[data-placeholder-ar][data-placeholder-en]')){
  element.placeholder=lang==='ar'?element.dataset.placeholderAr:element.dataset.placeholderEn;
 }
 if(element.matches('[data-title-ar][data-title-en]')){
  element.title=lang==='ar'?element.dataset.titleAr:element.dataset.titleEn;
 }
 if(element.matches('[data-label-ar][data-label-en]')){
  element.setAttribute('aria-label',lang==='ar'?element.dataset.labelAr:element.dataset.labelEn);
 }
}

function translateTree(root,lang){
 if(root instanceof Element)translateElement(root,lang);
 root.querySelectorAll?.('[data-ar][data-en],[data-placeholder-ar][data-placeholder-en],[data-title-ar][data-title-en],[data-label-ar][data-label-en]').forEach(element=>translateElement(element,lang));
}

export function applyLanguage(lang=getLanguage()){
 if(!supported.has(lang))lang='ar';
 document.documentElement.lang=lang;
 document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.body?.setAttribute('data-language',lang);
 document.body?.classList.toggle('is-english',lang==='en');
 translateTree(document,lang);
 return lang;
}

export function installLanguageLayer(){
 if(document.documentElement.dataset.languageV411==='1')return;
 document.documentElement.dataset.languageV411='1';
 applyLanguage();
 new MutationObserver(mutations=>{
  const lang=getLanguage();
  mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
   if(node.nodeType===1)translateTree(node,lang);
  }));
 }).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installLanguageLayer,{once:true});
else installLanguageLayer();
