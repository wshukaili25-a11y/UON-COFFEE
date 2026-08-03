import{rpc,esc,toast}from'./core.js?v=44.1.0';
const params=new URLSearchParams(location.search),token=params.get('token')||'',mode=params.get('mode')==='mobile'?'mobile':'desktop',stage=document.querySelector('#preview44Stage'),grid=document.querySelector('#preview44Grid');
stage.className=`preview44-stage ${mode}`;
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{stage.className=`preview44-stage ${button.dataset.mode}`;history.replaceState(null,'',`?token=${encodeURIComponent(token)}&mode=${button.dataset.mode}`)});
function statusLabel(status){return status==='active'?'تشغيل':status==='maintenance'?'صيانة':status==='coming_soon'?'قريبًا':'إيقاف'}
try{
 if(!/^[0-9a-f-]{36}$/i.test(token))throw new Error('invalid_preview_token');
 const item=await rpc('uon_public_tool_preview',{p_token:token});
 if(!item?.key)throw new Error('preview_expired');
 const color=/^#[0-9a-f]{6}$/i.test(item.color||'')?item.color:'#765cff';
 grid.innerHTML=`<article class="preview44-card" style="--tool-color:${esc(color)}"><span class="preview44-icon">${esc(item.icon||'🧰')}</span><strong>${esc(item.name_ar||item.name_en||item.key)}</strong><small>${esc(item.description_ar||item.description_en||'')}</small><div class="preview44-badges"><span>${esc(statusLabel(item.status||'active'))}</span><span>${item.is_visible===false?'مخفي':'ظاهر'}</span><span>${esc(item.placement||'tools_only')}</span><span>#${Number(item.sort_order)||100}</span></div></article>`;
}catch(error){console.error(error);grid.innerHTML='<div class="preview44-error">انتهت المعاينة أو أن الرابط غير صحيح.</div>';toast('تعذر فتح المعاينة',true)}
