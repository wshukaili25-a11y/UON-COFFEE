const $=s=>document.querySelector(s);
const lang=()=>localStorage.getItem('uon_language')==='en'?'en':'ar';
const tr=(ar,en)=>lang()==='en'?en:ar;
function translate(){
 const en=lang()==='en';document.documentElement.lang=en?'en':'ar';document.documentElement.dir=en?'ltr':'rtl';
 document.querySelectorAll('[data-ar][data-en]').forEach(el=>el.textContent=en?el.dataset.en:el.dataset.ar);
 $('#question').placeholder=en?$('#question').dataset.placeholderEn:$('#question').dataset.placeholderAr;
 $('#studioLanguage').textContent=en?'عربي':'EN';$('#studioLanguage').setAttribute('aria-label',en?'التبديل للعربية':'Switch to English');
 $('#assistantSend').setAttribute('aria-label',tr('إرسال السؤال','Send question'));
 $('#assistantNewChat').setAttribute('aria-label',tr('محادثة جديدة','New chat'));
 $('#assistantHistoryOpen').setAttribute('aria-label',tr('سجل المحادثات','Chat history'));
 $('#assistantHistoryClose').setAttribute('aria-label',tr('إغلاق السجل','Close history'));
 $('#studioMotion').setAttribute('aria-label',tr('تقليل الحركة','Reduce motion'));sync();
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let quiet=localStorage.getItem('uon_studio_motion')==='off'||reduced.matches;
function motion(){document.documentElement.dataset.motion=quiet?'off':'on';$('#studioMotion').setAttribute('aria-pressed',String(quiet));}
$('#studioMotion').addEventListener('click',()=>{quiet=!quiet;localStorage.setItem('uon_studio_motion',quiet?'off':'on');motion()});
$('#studioLanguage').addEventListener('click',()=>{localStorage.setItem('uon_language',lang()==='en'?'ar':'en');translate()});
const input=$('#question'),chat=$('#chat');
function sizeInput(){input.style.height='auto';input.style.height=Math.min(130,input.scrollHeight)+'px'}
input.addEventListener('input',sizeInput);
document.querySelectorAll('[data-starter-ar]').forEach(button=>button.addEventListener('click',()=>{
 if($('#assistantSend').disabled)return;
 input.value=lang()==='en'?button.dataset.starterEn:button.dataset.starterAr;sizeInput();input.focus();$('#chatForm').requestSubmit();
}));
function sync(){
 const active=Boolean(chat.querySelector('.message.user'));
 document.body.classList.toggle('has-conversation',active);
 const busy=Boolean(chat.querySelector('.typing-message'));
 document.body.classList.toggle('is-busy',busy);
 $('#studioStatus').textContent=busy?tr('جارٍ تجهيز الرد…','Preparing your response…'):'';
 chat.setAttribute('aria-busy',String(busy));
}
new MutationObserver(sync).observe(chat,{childList:true,subtree:true});
$('#chatForm').addEventListener('submit',()=>setTimeout(sizeInput,0));
$('#assistantNewChat').addEventListener('click',()=>{setTimeout(()=>{sync();input.focus();sizeInput()},0)});
const drawer=$('#assistantHistoryDrawer'),backdrop=$('#studioBackdrop'),layout=$('.studio-layout');
let wasOpen=false;
new MutationObserver(()=>{
 const open=drawer.classList.contains('open');drawer.inert=!open;backdrop.hidden=!open;layout.inert=open;
 if(open&&!wasOpen)$('#assistantHistoryClose').focus();
 if(!open&&wasOpen)$('#assistantHistoryOpen').focus();
 wasOpen=open;
}).observe(drawer,{attributes:true,attributeFilter:['class']});
backdrop.addEventListener('click',()=>$('#assistantHistoryClose').click());
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&wasOpen)$('#assistantHistoryClose').click();
 if(event.key==='Tab'&&wasOpen){const items=[...drawer.querySelectorAll('button,a,[tabindex="0"]')].filter(x=>!x.disabled);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
 if(event.key==='/'&&!wasOpen&&!event.target.closest('input,textarea,[contenteditable]')){event.preventDefault();input.focus()}
});
motion();translate();
