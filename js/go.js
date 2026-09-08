import{rpc}from'./core.js?v=67.0.1';
const title=document.querySelector('#goTitle'),message=document.querySelector('#goMessage'),spinner=document.querySelector('#goSpinner'),home=document.querySelector('#goHome');
const lang=(()=>{try{return localStorage.getItem('uon_language')==='en'?'en':'ar'}catch{return'ar'}})();
const theme=(()=>{try{return localStorage.getItem('uon_theme')==='light'?'light':'dark'}catch{return'dark'}})();
const en=lang==='en';
document.documentElement.lang=lang;document.documentElement.dir=en?'ltr':'rtl';document.documentElement.dataset.theme=theme;
document.title=en?'Opening link | UON Hub':'فتح الرابط | UON Hub';
const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='light'?'#f2f7f4':'#07110d';
if(title)title.textContent=en?'Opening link':'جاري فتح الرابط';
if(message)message.textContent=en?'We’re checking the link, then we’ll take you to the destination.':'نتحقق من الرابط ثم ننقلك للوجهة المطلوبة.';
if(home)home.textContent=en?'Back to home':'العودة للرئيسية';
const slug=(new URLSearchParams(location.search).get('slug')||location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase();
function fail(text){if(title)title.textContent=en?'Link unavailable':'الرابط غير متاح';if(message)message.textContent=text;if(spinner)spinner.hidden=true;if(home)home.hidden=false}
try{
 if(!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug))throw new Error('invalid_slug');
 const destination=await rpc('uon_resolve_short_link',{p_slug:slug});
 if(!destination)throw new Error('not_found');
 const url=new URL(destination,location.origin);
 if(!['http:','https:'].includes(url.protocol))throw new Error('unsafe_url');
 location.replace(url.href);
}catch(error){console.error(error);fail(en?'This link may be invalid or expired. Go back home and try again from there.':'قد يكون الرابط منتهيًا أو غير صحيح. ارجع للرئيسية وحاول من هناك.')}
