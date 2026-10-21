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
async function showPdf(url){
 const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.mjs';
 const doc=await pdfjs.getDocument({url,isEvalSupported:false,cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/standard_fonts/',wasmUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/wasm/'}).promise;
 const host=document.getElementById('pdfPanel'),canvas=document.getElementById('pdfCanvas'),pageInput=document.getElementById('pageNumber'),prev=document.getElementById('previousPage'),next=document.getElementById('nextPage'),out=document.getElementById('zoomOut'),inside=document.getElementById('zoomIn');
 host.hidden=false;pageInput.max=doc.numPages;document.getElementById('pageTotal').textContent=' / '+doc.numPages;
 let pageNo=1,zoom=1,busy=false;
 async function render(){
  if(busy)return;busy=true;[prev,next,out,inside,pageInput].forEach(x=>x.disabled=true);status.textContent='جاري عرض الصفحة…';
  try{
   const page=await doc.getPage(pageNo),base=page.getViewport({scale:1});
   const width=Math.min(1100,Math.max(240,host.clientWidth-32));
   const viewport=page.getViewport({scale:width/base.width*zoom}),ratio=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
   canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
   await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;
   canvas.setAttribute('aria-label','الصفحة '+pageNo+' من '+doc.numPages);
   const text=await page.getTextContent();document.getElementById('pageText').textContent=text.items.map(x=>x.str||'').join(' ');
   pageInput.value=pageNo;status.textContent='الصفحة '+pageNo+' من '+doc.numPages;
  }catch(e){status.textContent='تعذر عرض هذه الصفحة. جرّب تنزيل الملف.';console.error(e)}
  finally{busy=false;[prev,next,out,inside,pageInput].forEach(x=>x.disabled=false);prev.disabled=pageNo<=1;next.disabled=pageNo>=doc.numPages;out.disabled=zoom<=0.5;inside.disabled=zoom>=2}
 }
 prev.onclick=()=>{if(!busy&&pageNo>1){pageNo--;render()}};
 next.onclick=()=>{if(!busy&&pageNo<doc.numPages){pageNo++;render()}};
 pageInput.onchange=()=>{if(!busy){pageNo=Math.max(1,Math.min(doc.numPages,Number(pageInput.value)||1));render()}};
 out.onclick=()=>{if(!busy){zoom=Math.max(0.5,zoom-0.25);render()}};
 inside.onclick=()=>{if(!busy){zoom=Math.min(2,zoom+0.25);render()}};
 await render();
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
 else{document.getElementById('help').hidden=false;if(url.hostname==='irkhvydgxpseflggbeqq.supabase.co'){await showPdf(preview)}else{frame.src=preview;frame.hidden=false;status.textContent='مجلد الملفات أدناه.'}}
}catch(error){title.textContent='تعذر عرض الملف';status.textContent=error.message||'تعذر تحميل الملف. حاول مرة أخرى.'}
