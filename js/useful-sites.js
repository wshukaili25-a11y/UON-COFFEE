import {get,esc,enforceUonMaintenance,watchUonMaintenance,applyFeatureStates,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();

const fallback=[{"title_ar": "البوابة الأكاديمية", "title_en": "Academic Portal", "description_ar": "التسجيل والدرجات والخدمات الأكاديمية", "description_en": "Registration, grades and academic services", "category": "university", "url": "https://portal.unizwa.edu.om/", "icon": "🎓"}, {"title_ar": "نظام التعلم الإلكتروني", "title_en": "Moodle", "description_ar": "المقررات والواجبات والمحتوى الإلكتروني", "description_en": "Courses, assignments and learning content", "category": "university", "url": "https://elearn.unizwa.edu.om/", "icon": "🖥️"}, {"title_ar": "الموقع الرسمي للجامعة", "title_en": "University Website", "description_ar": "الكليات والبرامج والأخبار الرسمية", "description_en": "Official colleges, programs and news", "category": "university", "url": "https://www.unizwa.edu.om/", "icon": "🏛️"}, {"title_ar": "البريد الجامعي", "title_en": "University Email", "description_ar": "الدخول إلى البريد الجامعي", "description_en": "Access university email", "category": "university", "url": "https://outlook.office.com/", "icon": "✉️"}, {"title_ar": "Wolfram Alpha", "title_en": "Wolfram Alpha", "description_ar": "حسابات علمية ورياضية", "description_en": "Scientific and math computation", "category": "math", "url": "https://www.wolframalpha.com/", "icon": "∑"}, {"title_ar": "Symbolab", "title_en": "Symbolab", "description_ar": "شرح خطوات المسائل الرياضية", "description_en": "Step-by-step math help", "category": "math", "url": "https://www.symbolab.com/", "icon": "📐"}, {"title_ar": "Omni Calculator", "title_en": "Omni Calculator", "description_ar": "حاسبات جاهزة لمجالات متعددة", "description_en": "Calculators for many fields", "category": "math", "url": "https://www.omnicalculator.com/", "icon": "🧮"}, {"title_ar": "iLovePDF", "title_en": "iLovePDF", "description_ar": "ضغط ودمج وتحويل ملفات PDF", "description_en": "Compress, merge and convert PDF files", "category": "files", "url": "https://www.ilovepdf.com/", "icon": "📄"}, {"title_ar": "Convertio", "title_en": "Convertio", "description_ar": "تحويل صيغ الملفات", "description_en": "Convert file formats", "category": "files", "url": "https://convertio.co/", "icon": "🔄"}, {"title_ar": "TinyWow", "title_en": "TinyWow", "description_ar": "أدوات مجانية للملفات والصور", "description_en": "Free file and image tools", "category": "files", "url": "https://tinywow.com/", "icon": "🧰"}, {"title_ar": "ChatPDF", "title_en": "ChatPDF", "description_ar": "تلخيص ومحادثة ملفات PDF", "description_en": "Summarize and chat with PDFs", "category": "ai", "url": "https://www.chatpdf.com/", "icon": "🤖"}, {"title_ar": "Napkin AI", "title_en": "Napkin AI", "description_ar": "تحويل النصوص إلى رسوم توضيحية", "description_en": "Turn text into visuals", "category": "ai", "url": "https://www.napkin.ai/", "icon": "🎨"}, {"title_ar": "GPTZero", "title_en": "GPTZero", "description_ar": "فحص احتمالية النص المولد بالذكاء الاصطناعي", "description_en": "AI-generated text detection", "category": "academic", "url": "https://gptzero.me/", "icon": "🔍"}, {"title_ar": "Standard Ebooks", "title_en": "Standard Ebooks", "description_ar": "كتب مجانية من الملكية العامة", "description_en": "Free public-domain ebooks", "category": "books", "url": "https://standardebooks.org/", "icon": "📖"}];
const categories={
 all:['الكل','All'],university:['جامعة نزوى','University'],math:['رياضيات','Math'],
 files:['PDF والملفات','PDF & Files'],ai:['الذكاء الاصطناعي','Artificial Intelligence'],academic:['أدوات الدراسة','Study Tools'],books:['المكتبات والكتب','Libraries & Books'],general:['أخرى','Other']
};
let rows=[],active='all';
const language=localStorage.getItem('uon_language')||'ar';

async function load(){
 try{rows=await get('useful_sites','select=*&active=eq.true&order=sort_order.asc,title_ar.asc')}
 catch{rows=fallback}
 if(!rows.length)rows=fallback;
 renderFilters();render();
}

function renderFilters(){
 const available=['all',...new Set(rows.map(item=>item.category||'general'))];
 document.querySelector('#siteFilters').innerHTML=available.map(key=>`
  <button class="${active===key?'active':''}" data-category="${key}">${categories[key]?.[language==='ar'?0:1]||key}</button>
 `).join('');
 document.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{active=button.dataset.category;renderFilters();render()});
}

function render(){
 const filtered=active==='all'?rows:rows.filter(item=>(item.category||'general')===active);
 document.querySelector('#usefulSites').innerHTML=filtered.map(item=>`
  <a class="v175-site-card" target="_blank" rel="noopener" href="${esc(item.url)}">
   <span>${esc(item.icon||'🔗')}</span>
   <div><h3>${esc(language==='ar'?(item.title_ar||item.title_en):(item.title_en||item.title_ar))}</h3>
   <p>${esc(language==='ar'?(item.description_ar||''):(item.description_en||item.description_ar||''))}</p></div>
   <b>↗</b>
  </a>
 `).join('');
}
await applyFeatureStates(document);load();trackEvent('feature_open',{feature:'useful-sites'});
