
import {get} from './api.js';
import {$,esc,setupNav} from './ui.js';
import {initI18n} from './i18n.js';

setupNav();
initI18n();

let categories=[];
let tools=[];

const fallbackCategories=[
 {id:'ai',name:'الذكاء الاصطناعي',emoji:'🤖'},
 {id:'pdf',name:'PDF والملفات',emoji:'📄'},
 {id:'math',name:'الرياضيات',emoji:'🧮'},
 {id:'writing',name:'الكتابة واللغة',emoji:'✍️'},
 {id:'design',name:'التصميم والعروض',emoji:'🎨'}
];

const fallbackTools=[
 {id:'chatgpt',category_id:'ai',name:'ChatGPT',description:'مساعد للشرح والكتابة وتوليد الأفكار.',url:'https://chatgpt.com',emoji:'🤖',featured:true},
 {id:'notebooklm',category_id:'ai',name:'NotebookLM',description:'أنشئ مساعدًا معرفيًا من ملفاتك ومصادرك.',url:'https://notebooklm.google.com',emoji:'📚',featured:true},
 {id:'perplexity',category_id:'ai',name:'Perplexity',description:'بحث ذكي مع مصادر وروابط.',url:'https://www.perplexity.ai',emoji:'🔎',featured:false},
 {id:'chatpdf',category_id:'pdf',name:'ChatPDF',description:'اسأل ملفات PDF واستخرج أهم النقاط.',url:'https://www.chatpdf.com',emoji:'💬',featured:true},
 {id:'ilovepdf',category_id:'pdf',name:'iLovePDF',description:'دمج وضغط وتحويل ملفات PDF.',url:'https://www.ilovepdf.com',emoji:'📄',featured:false},
 {id:'pdf24',category_id:'pdf',name:'PDF24',description:'أدوات PDF مجانية ومتنوعة.',url:'https://tools.pdf24.org',emoji:'🗂️',featured:false},
 {id:'wolfram',category_id:'math',name:'Wolfram Alpha',description:'حسابات وبيانات ومسائل علمية.',url:'https://www.wolframalpha.com',emoji:'📊',featured:false},
 {id:'symbolab',category_id:'math',name:'Symbolab',description:'حل المسائل الرياضية خطوة بخطوة.',url:'https://www.symbolab.com',emoji:'➗',featured:false},
 {id:'desmos',category_id:'math',name:'Desmos',description:'رسم الدوال والمنحنيات بسهولة.',url:'https://www.desmos.com/calculator',emoji:'📈',featured:false},
 {id:'grammarly',category_id:'writing',name:'Grammarly',description:'تحسين الكتابة الإنجليزية والتدقيق.',url:'https://www.grammarly.com',emoji:'✅',featured:false},
 {id:'quillbot',category_id:'writing',name:'QuillBot',description:'إعادة صياغة وتلخيص النصوص.',url:'https://quillbot.com',emoji:'✍️',featured:false},
 {id:'deepl',category_id:'writing',name:'DeepL',description:'ترجمة احترافية للنصوص والملفات.',url:'https://www.deepl.com',emoji:'🌐',featured:false},
 {id:'canva',category_id:'design',name:'Canva',description:'تصميم العروض والمنشورات بسهولة.',url:'https://www.canva.com',emoji:'🎨',featured:false},
 {id:'gamma',category_id:'design',name:'Gamma',description:'إنشاء عروض تقديمية بالذكاء الاصطناعي.',url:'https://gamma.app',emoji:'🖥️',featured:false}
];

function render(){
 const q=$('#toolSearch').value.toLowerCase();
 const cat=$('#toolCategory').value;
 const list=tools.filter(t=>(!cat||t.category_id===cat)&&`${t.name||''} ${t.description||''}`.toLowerCase().includes(q));
 const categoryMap=Object.fromEntries(categories.map(c=>[c.id,c]));
 $('#toolsGrid').innerHTML=list.length?list.map(t=>{
   const c=categoryMap[t.category_id]||{};
   return `<article class="card tool-app-card">
    <div class="tool-app-icon">${esc(t.emoji||c.emoji||'🧰')}</div>
    <span class="tool-category-label">${esc(c.name||'أداة')}</span>
    <h3>${esc(t.name)}</h3>
    <p>${esc(t.description||'')}</p>
    <div class="actions"><a href="${esc(t.url||'#')}" target="_blank" rel="noopener">فتح الأداة <i class="fas fa-arrow-up-right-from-square"></i></a></div>
   </article>`
 }).join(''):'<div class="empty">لا توجد أدوات مطابقة</div>';

 const featured=tools.filter(t=>t.featured).slice(0,3);
 $('#featuredTools').innerHTML=featured.map(t=>`<div class="featured-tool"><span class="badge">مقترحة</span><h3>${esc(t.name)}</h3><p>${esc(t.description||'')}</p><a class="outline-btn" href="${esc(t.url)}" target="_blank">فتح</a></div>`).join('');
}

async function load(){
 try{
   const [dbCategories,dbTools]=await Promise.all([
     get('tools_categories','select=*&order=sort_order.asc'),
     get('tools_items','select=*&disabled=eq.false&order=name.asc')
   ]);
   categories=dbCategories?.length?dbCategories:fallbackCategories;
   tools=dbTools?.length?dbTools:fallbackTools;
 }catch{
   categories=fallbackCategories;
   tools=fallbackTools;
 }
 $('#toolCategory').innerHTML='<option value="">كل التصنيفات</option>'+categories.map(c=>`<option value="${esc(c.id)}">${esc(c.emoji||'')} ${esc(c.name)}</option>`).join('');
 render();
}
$('#toolSearch').addEventListener('input',render);
$('#toolCategory').addEventListener('change',render);
load();
