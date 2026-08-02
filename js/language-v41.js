const LANGUAGE_KEY='uon_language';
const supported=new Set(['ar','en']);

export const getLanguage=()=>{
 const saved=localStorage.getItem(LANGUAGE_KEY);
 return supported.has(saved)?saved:'ar';
};

function translatedValue(element,lang){
 return lang==='ar'?element.dataset.ar:element.dataset.en;
}

function translateElement(element,lang){
 if(!(element instanceof Element))return;
 if(element.matches('[data-ar][data-en]')){
  const value=translatedValue(element,lang);
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

function updateDocument(lang){
 document.documentElement.lang=lang;
 document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.body?.setAttribute('data-language',lang);
 document.body?.classList.toggle('is-english',lang==='en');
 document.querySelectorAll('[data-language-toggle]').forEach(button=>{
  button.dataset.currentLanguage=lang;
  const label=button.querySelector('[data-language-label]');
  if(label)label.textContent=lang==='ar'?'English':'العربية';
  else if(button.children.length===0)button.textContent=lang==='ar'?'EN':'ع';
  button.setAttribute('aria-label',lang==='ar'?'Switch to English':'التبديل إلى العربية');
 });
 translateTree(document,lang);
 window.dispatchEvent(new CustomEvent('uon:languagechange',{detail:{language:lang}}));
}

let observer;
export function applyLanguage(lang=getLanguage()){
 if(!supported.has(lang))lang='ar';
 localStorage.setItem(LANGUAGE_KEY,lang);
 updateDocument(lang);
 return lang;
}

export function toggleLanguage(){
 return applyLanguage(getLanguage()==='ar'?'en':'ar');
}

export function installLanguageLayer(){
 if(document.documentElement.dataset.languageV41==='1')return;
 document.documentElement.dataset.languageV41='1';
 applyLanguage();
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-language-toggle]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleLanguage();
 },true);
 observer=new MutationObserver(mutations=>{
  const lang=getLanguage();
  mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
   if(node.nodeType===1)translateTree(node,lang);
  }));
 });
 observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installLanguageLayer,{once:true});
else installLanguageLayer();
