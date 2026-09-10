const LANG_KEY='uon_language';
const lang=localStorage.getItem(LANG_KEY)==='en'?'en':'ar';
const en=lang==='en';
const logo='/assets/uonhub-logo-original-20260904.jpeg';
function applyBrandLogo(){document.querySelectorAll('.v176-brand>span:first-child').forEach(host=>{host.innerHTML=`<img src="${logo}" alt="" width="42" height="42">`})}
function applySmartPrompts(){document.querySelectorAll('[data-prompt-ar][data-prompt-en]').forEach(button=>{button.dataset.prompt=en?button.dataset.promptEn:button.dataset.promptAr})}
function applyStaticLanguage(){document.documentElement.lang=lang;document.documentElement.dir=en?'ltr':'rtl';document.title=en?'UON AI Assistant | UON Hub':'مساعد UON AI | UON Hub';document.querySelectorAll('[data-ar][data-en]').forEach(el=>{const value=en?el.dataset.en:el.dataset.ar;if(el.matches('input,textarea'))el.value=value;else el.textContent=value});document.querySelectorAll('[data-placeholder-ar][data-placeholder-en]').forEach(el=>el.setAttribute('placeholder',en?el.dataset.placeholderEn:el.dataset.placeholderAr));document.querySelectorAll('[data-label-ar][data-label-en]').forEach(el=>el.setAttribute('aria-label',en?el.dataset.labelEn:el.dataset.labelAr))}
function boot(){applyBrandLogo();applySmartPrompts();applyStaticLanguage();setTimeout(applyBrandLogo,120)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
