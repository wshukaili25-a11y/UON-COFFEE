const LANGUAGE_KEY='uon_language';
const LEGACY_LANGUAGE_KEY='uon_hub_lang';
const THEME_KEY='uon_theme';
const LEGACY_THEME_KEYS=['theme','uon_theme_mode','uon_hub_theme'];
const supported=new Set(['ar','en']);
const themes=new Set(['dark','light']);

export const getLanguage=()=>{
 const saved=localStorage.getItem(LANGUAGE_KEY);
 const legacy=localStorage.getItem(LEGACY_LANGUAGE_KEY);
 if(supported.has(saved)) return saved;
 if(supported.has(legacy)) return legacy;
 return 'ar';
};

export const getTheme=()=>{
 const saved=localStorage.getItem(THEME_KEY);
 if(themes.has(saved)) return saved;
 for(const key of LEGACY_THEME_KEYS){const value=localStorage.getItem(key);if(themes.has(value))return value;}
 return 'dark';
};

function syncState(){
 try{
  const lang=getLanguage();
  const theme=getTheme();
  localStorage.setItem(LANGUAGE_KEY,lang);
  localStorage.setItem(LEGACY_LANGUAGE_KEY,lang);
  localStorage.setItem(THEME_KEY,theme);
 }catch{}
}

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
  element.setAttribute('placeholder',lang==='ar'?element.dataset.placeholderAr:element.dataset.placeholderEn);
 }
 if(element.matches('[data-title-ar][data-title-en]')){
  element.setAttribute('title',lang==='ar'?element.dataset.titleAr:element.dataset.titleEn);
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
 try{localStorage.setItem(LANGUAGE_KEY,lang);localStorage.setItem(LEGACY_LANGUAGE_KEY,lang)}catch{}
 document.documentElement.lang=lang;
 document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.body?.setAttribute('data-language',lang);
 document.body?.classList.toggle('is-english',lang==='en');
 translateTree(document,lang);
 return lang;
}

export function applyTheme(theme=getTheme()){
 if(!themes.has(theme))theme='dark';
 try{localStorage.setItem(THEME_KEY,theme)}catch{}
 const root=document.documentElement;
 root.setAttribute('data-theme',theme);
 root.style.colorScheme=theme;
 document.body?.setAttribute('data-theme',theme);
 document.body?.classList.toggle('theme-light',theme==='light');
 document.body?.classList.toggle('theme-dark',theme==='dark');
 document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
  button.setAttribute('aria-pressed',theme==='light'?'true':'false');
  button.dataset.theme=theme;
 });
 const label=document.querySelector('#themeText');
 if(label)label.textContent=theme==='dark'?'الوضع الفاتح':'الوضع الداكن';
}

function installThemeStyles(){
 if(document.getElementById('uonUnifiedThemeStyles'))return;
 const style=document.createElement('style');
 style.id='uonUnifiedThemeStyles';
 style.textContent=`
:root{color-scheme:dark}
html[data-theme="light"]{color-scheme:light;--bg:#f4f7fb;--surface:#ffffff;--surface2:#edf2f8;--line:#d6deeb;--text:#172033;--muted:#657089;--shadow:0 18px 50px rgba(23,32,51,.09)}
html[data-theme="dark"]{color-scheme:dark}
body[data-theme="light"]{background:var(--bg)!important;color:var(--text)!important}
body[data-theme="light"] .site-header{background:rgba(255,255,255,.94)!important;border-bottom:1px solid var(--line)!important}
body[data-theme="light"] .nav-links a{color:var(--muted)!important}
body[data-theme="light"] .nav-links a:hover,body[data-theme="light"] .nav-links a.active{color:var(--text)!important;background:var(--surface2)!important}
body[data-theme="light"] .card,body[data-theme="light"] .feature-card,body[data-theme="light"] .item-card,body[data-theme="light"] .form-card,body[data-theme="light"] .list-row,body[data-theme="light"] .empty{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important;box-shadow:0 14px 40px rgba(23,32,51,.07)}
body[data-theme="light"] input,body[data-theme="light"] select,body[data-theme="light"] textarea{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] input::placeholder,body[data-theme="light"] textarea::placeholder{color:#8994a9!important}
body[data-theme="light"] label,body[data-theme="light"] .feature-card h3,body[data-theme="light"] .item-card h3,body[data-theme="light"] .section-head h2,body[data-theme="light"] .page-hero h1{color:var(--text)!important}
body[data-theme="light"] .feature-card p,body[data-theme="light"] .item-card p,body[data-theme="light"] .section-head p,body[data-theme="light"] .page-hero p,body[data-theme="light"] .muted{color:var(--muted)!important}
body[data-theme="light"] .icon-btn,body[data-theme="light"] .btn:not(.primary){background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] .site-footer{background:#fff!important;color:var(--muted)!important;border-top-color:var(--line)!important}
body[data-theme="light"] .modal{background:rgba(23,32,51,.42)!important}
body[data-theme="light"] .modal-card,body[data-theme="light"] .toast{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] .table-wrap,body[data-theme="light"] table{color:var(--text)!important}
body[data-theme="light"] th,body[data-theme="light"] td{border-bottom-color:var(--line)!important}
body[data-theme="light"] .v176-side-menu{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] .v176-side-menu a{color:var(--muted)!important}
body[data-theme="light"] .v176-side-menu a.active{background:var(--surface2)!important;color:var(--text)!important}
body[data-theme="light"] .v176-nav-button{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] .v176-menu-settings button{background:var(--surface2)!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] .notification-drawer{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}
body[data-theme="light"] .notification-drawer *{color:inherit}
body[data-theme="light"] .page-hero{background:radial-gradient(circle at 50% -20%,rgba(28,200,245,.10),transparent 45%)!important}
html[dir="ltr"] body{text-align:left}
html[dir="rtl"] body{text-align:initial}
.site-footer .footer-managed,.site-footer .footer-row{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;text-align:center!important;width:100%!important}
.site-footer .footer-managed>*,.site-footer .footer-row>*{width:100%!important;text-align:center!important;margin:.35rem 0!important}
.site-footer a,.site-footer p{text-align:center!important}
`;
 document.head.appendChild(style);
}

export function installLanguageLayer(){
 if(document.documentElement.dataset.languageV411==='1')return;
 document.documentElement.dataset.languageV411='1';
 syncState();
 installThemeStyles();
 applyTheme();
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
