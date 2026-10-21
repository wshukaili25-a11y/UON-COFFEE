import {get,enforceUonMaintenance} from './core.js?v=67.0.0';
await enforceUonMaintenance();
const title=document.getElementById('title'),status=document.getElementById('status'),frame=document.getElementById('viewer'),download=document.getElementById('download');
const safe=value=>{try{const u=new URL(value);return u.protocol==='https:'?u:null}catch{return null}};
export function previewUrl(value){
 const u=safe(value);if(!u)return '';
 if(u.hostname==='drive.google.com'){
  const file=u.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
  if(file)return 'https://drive.google.com/file/d/'+file[1]+'/preview';
  const folder=u.pathname.match(/^\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  if(folder)return 'https://drive.google.com/embeddedfolderview?id='+folder[1]+'#list';
  return '';
 }
 if(u.hostname==='irkhvydgxpseflggbeqq.supabase.co'&&u.pathname.startsWith('/storage/v1/object/public/summaries/')&&u.pathname.endsWith('.pdf'))return u.href;
 return '';
}
try{
 const id=new URLSearchParams(location.search).get('id');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))throw Error('رابط الملف غير صالح.');
 const rows=await get('public_summaries','select=id,title,url,link,pdf_url,description&id=eq.'+encodeURIComponent(id)+'&limit=1');
 const item=rows[0];if(!item)throw Error('هذا الملف غير متاح حاليًا.');
 title.textContent=item.title||'ملف دراسي';document.title=title.textContent+' | UON Hub';
 const url=safe(item.url||item.link||item.pdf_url);if(!url)throw Error('رابط الملف غير صالح.');
 download.href=url.href;download.hidden=false;
 const source=String(item.description||'').match(/https:\/\/uoncafe\.org\/notes\/\d+/)?.[0];
 if(source){document.getElementById('source').href=source;document.getElementById('sourceDetails').hidden=false}
 const preview=previewUrl(url.href);
 if(!preview){status.textContent='هذا النوع من الروابط لا يدعم العرض الداخلي. يمكنك فتحه من الزر أعلاه.'}
 else{frame.src=preview;frame.hidden=false;document.getElementById('help').hidden=false;status.textContent='يمكنك قراءة الملف أدناه.'}
}catch(error){title.textContent='تعذر عرض الملف';status.textContent=error.message||'تعذر تحميل الملف. حاول مرة أخرى.'}
