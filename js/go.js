import{rpc}from'./core.js?v=44.0.0';
const title=document.querySelector('#goTitle'),message=document.querySelector('#goMessage'),spinner=document.querySelector('#goSpinner'),home=document.querySelector('#goHome');
const slug=(new URLSearchParams(location.search).get('slug')||location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase();
function fail(text){title.textContent='الرابط غير متاح';message.textContent=text;spinner.hidden=true;home.hidden=false}
try{
 if(!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug))throw new Error('invalid_slug');
 const destination=await rpc('uon_resolve_short_link',{p_slug:slug});
 if(!destination)throw new Error('not_found');
 const url=new URL(destination,location.origin);
 if(!['http:','https:'].includes(url.protocol))throw new Error('unsafe_url');
 location.replace(url.href);
}catch(error){console.error(error);fail('قد يكون الرابط منتهيًا أو غير صحيح. ارجع للرئيسية وحاول من هناك.')}
