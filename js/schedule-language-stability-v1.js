const LANG_KEY='uon_language';
const LEGACY_LANG_KEY='uon_hub_lang';
let switching=false;

function currentLanguage(){
  const direct=localStorage.getItem(LANG_KEY);
  const legacy=localStorage.getItem(LEGACY_LANG_KEY);
  return direct==='en'||(direct!=='ar'&&legacy==='en')?'en':'ar';
}

function installStableLanguageToggle(){
  if(document.documentElement.dataset.scheduleLanguageStable==='1')return;
  document.documentElement.dataset.scheduleLanguageStable='1';
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-language-toggle]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(switching)return;
    switching=true;
    const next=currentLanguage()==='en'?'ar':'en';
    try{
      localStorage.setItem(LANG_KEY,next);
      localStorage.setItem(LEGACY_LANG_KEY,next);
    }catch{}
    document.documentElement.lang=next;
    document.documentElement.dir=next==='ar'?'rtl':'ltr';
    const target=location.pathname+location.search+location.hash;
    location.replace(target);
  },true);
}

function ensureStyle(){
  if(document.querySelector('#scheduleLanguageFooterFix'))return;
  const style=document.createElement('style');
  style.id='scheduleLanguageFooterFix';
  style.textContent=`
    .schedule-legal-stack{width:100%;margin:0;padding:0;display:block;position:relative;clear:both}
    .schedule-legal-note{width:min(1160px,calc(100% - 32px));margin:34px auto 0;padding:24px 26px;border:1px solid rgba(63,211,139,.17);border-radius:26px;background:linear-gradient(145deg,rgba(10,31,22,.84),rgba(7,24,17,.88));color:var(--uon-muted,#91a89c);text-align:center}
    .schedule-legal-note p{margin:0;font-size:clamp(16px,2vw,20px);line-height:1.9}.schedule-legal-note strong{color:var(--uon-text,#fff)}
    .schedule-legal-footer{display:block!important;position:relative!important;inset:auto!important;transform:none!important;visibility:visible!important;opacity:1!important;min-height:0!important;height:auto!important;margin:0!important;padding:38px 0 34px!important;border-top:1px solid var(--uon-border,rgba(255,255,255,.1))!important;background:transparent!important;color:var(--uon-muted,#91a89c)!important}
    .schedule-legal-footer-main{width:min(1160px,calc(100% - 32px));margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center}
    .schedule-legal-footer-main p{margin:0;text-align:center}.schedule-legal-prayer{font-size:clamp(20px,3vw,28px);line-height:1.8;font-weight:500}.schedule-legal-credit{font-size:clamp(18px,2.6vw,25px);line-height:1.8;font-weight:500}.schedule-legal-handle{display:inline-flex;align-items:center;justify-content:center;color:var(--uon-text,#fff);font-size:clamp(19px,2.3vw,24px);font-weight:900;text-decoration:none;padding:2px 10px;border-radius:12px;direction:ltr;unicode-bidi:isolate}.schedule-legal-rights{font-size:clamp(15px,1.8vw,19px);line-height:1.7;color:var(--uon-text,#fff);font-weight:800}
    html[data-theme="light"] .schedule-legal-note{background:#fff;border-color:rgba(7,88,58,.14)}
    @media(max-width:760px){.schedule-legal-note{margin-top:26px;padding:20px 18px;border-radius:22px}.schedule-legal-footer{padding:30px 0 32px!important}.schedule-legal-prayer{font-size:20px}.schedule-legal-credit{font-size:18px}.schedule-legal-handle{font-size:20px}.schedule-legal-rights{font-size:15px}}
  `;
  document.head.append(style);
}

function rebuildLegal(){
  if(!document.body?.classList.contains('schedule-redesign'))return;
  ensureStyle();
  document.querySelectorAll('.schedule-legal-stack').forEach(node=>node.remove());
  document.querySelector('.uon-independent-notice')?.remove();
  document.querySelector('.site-footer')?.remove();
  const en=currentLanguage()==='en';
  const stack=document.createElement('section');
  stack.className='schedule-legal-stack';
  stack.innerHTML=en
    ?`<div class="schedule-legal-note" role="note"><p><strong>Notice:</strong> UON Hub is an independent student project and is not officially affiliated with the University of Nizwa. All logos and names used belong to their respective owners. The website aims to make student services and information easier to access.</p></div><footer class="schedule-legal-footer"><div class="schedule-legal-footer-main"><p class="schedule-legal-prayer">My Lord, increase me in knowledge</p><p class="schedule-legal-credit">Designed with love by University of Nizwa students ❤️.</p><a class="schedule-legal-handle" href="https://www.instagram.com/uonhub" target="_blank" rel="noopener noreferrer">@uonhub</a><p class="schedule-legal-rights">All rights reserved © 2026 UON Hub</p></div></footer>`
    :`<div class="schedule-legal-note" role="note"><p><strong>تنبيه:</strong> UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى. جميع الشعارات والأسماء المستخدمة تعود لمالكيها، ويهدف الموقع إلى تسهيل وصول الطلبة إلى الخدمات والمعلومات.</p></div><footer class="schedule-legal-footer"><div class="schedule-legal-footer-main"><p class="schedule-legal-prayer">رَبِّ زِدْنِي عِلْمًا</p><p class="schedule-legal-credit">صمم بحب من طلاب جامعة نزوى❤️.</p><a class="schedule-legal-handle" href="https://www.instagram.com/uonhub" target="_blank" rel="noopener noreferrer">@uonhub</a><p class="schedule-legal-rights">جميع الحقوق محفوظة © 2026 UON Hub</p></div></footer>`;
  const main=document.querySelector('.schedule-app');
  if(main)main.after(stack);else document.body.append(stack);
}

installStableLanguageToggle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(rebuildLegal,0);setTimeout(rebuildLegal,180)},{once:true});
else{setTimeout(rebuildLegal,0);setTimeout(rebuildLegal,180)}
