const RIGHTS_VERSION='UONH-RIGHTS-2026-08-v1';
const OFFICIAL_HOSTS=new Set(['uonhub.space','www.uonhub.space','uon-hub.vercel.app','localhost','127.0.0.1']);

function addRightsMetadata(){
  const entries={
    'application-name':'UON Hub',
    'copyright':'UON Hub — Student project content and original interface elements',
    'uonhub:rights-id':RIGHTS_VERSION,
    'uonhub:canonical-origin':'https://uonhub.space'
  };
  Object.entries(entries).forEach(([name,content])=>{
    let meta=document.head.querySelector(`meta[name="${name}"]`);
    if(!meta){meta=document.createElement('meta');meta.name=name;document.head.append(meta)}
    meta.content=content;
  });
  document.documentElement.dataset.uonhubRights=RIGHTS_VERSION;
}

function addVisibleRightsLink(){
  if(document.querySelector('[data-uonhub-rights-link]'))return;
  const footer=document.querySelector('.site-footer');
  if(!footer)return;
  const link=document.createElement('a');
  link.href='/rights.html';
  link.dataset.uonhubRightsLink='1';
  link.textContent='حقوق المشروع وسياسة الاستخدام';
  link.style.cssText='display:inline-flex;margin-top:.65rem;font-size:.85rem;opacity:.82;text-decoration:none';
  footer.append(link);
}

function warnOnlyOnUnauthorizedCopy(){
  const host=location.hostname.toLowerCase();
  if(OFFICIAL_HOSTS.has(host))return;
  // This notice only appears when these exact project files are copied and served on another host.
  // It does not contact, alter, or inject anything into third-party websites.
  const notice=document.createElement('aside');
  notice.setAttribute('role','alert');
  notice.style.cssText='position:fixed;inset:auto 12px 12px;z-index:2147483647;padding:12px 14px;border-radius:14px;background:#5b1b1b;color:#fff;font:600 14px/1.6 system-ui;text-align:center;box-shadow:0 12px 40px #0006';
  notice.innerHTML='تنبيه حقوق: هذه النسخة تتضمن ملفات أصلية من مشروع <b>UON Hub</b> وقد تم تشغيلها خارج النطاق الرسمي. يرجى إزالة المحتوى المنسوخ أو التواصل مع إدارة المشروع.';
  document.body.append(notice);
}

export function bootRightsProtection(){
  addRightsMetadata();
  addVisibleRightsLink();
  warnOnlyOnUnauthorizedCopy();
}
