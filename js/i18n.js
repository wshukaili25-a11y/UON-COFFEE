
import {$,$$} from './ui.js';
const lang=localStorage.getItem('uon-lang')||'ar';
export async function initI18n(){
 try{
  const r=await fetch(`locales/${lang}.json?v=4`,{cache:'no-store'});const d=await r.json();
  document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  $$('[data-i18n]').forEach(el=>{const value=el.dataset.i18n.split('.').reduce((o,k)=>o?.[k],d);if(value)el.textContent=value});
  $('#langBtn span')?.replaceChildren(document.createTextNode(lang==='ar'?'EN':'AR'));
 }catch(e){console.warn('i18n',e)}
}
