import {setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,toast,esc} from './core.js';setupNav();await enforceUonMaintenance();watchUonMaintenance();let rows=[],cats=[];async function load(){try{[rows,cats]=await Promise.all([get('tools_items','select=*&order=featured.desc,name.asc'),get('tools_categories','select=*&order=sort_order.asc')]);$('#category').innerHTML='<option value="">كل التصنيفات</option>'+cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');render()}catch(e){toast(e.message,true)}}function render(){const q=$('#search').value.toLowerCase(),c=$('#category').value;const a=rows.filter(x=>(!c||x.category_id===c)&&`${x.name} ${x.description}`.toLowerCase().includes(q));$('#items').innerHTML=a.length?a.map(x=>`<article class="card feature-card" data-status="${esc(x.status||'active')}"><i>${esc(x.emoji||'🧰')}</i><h3>${esc(x.name)}</h3><p>${esc(x.description||'')}</p>${(x.status||'active')==='active'?`<a class="btn" target="_blank" href="${esc(x.url)}">فتح</a>`:`<span class="badge">${x.status==='maintenance'?'صيانة':x.status==='coming_soon'?'قريبًا':'متوقفة'}</span>`}</article>`).join(''):'<div class="empty">لا توجد أدوات</div>'}$('#search').oninput=render;$('#category').onchange=render;load();


async function reorderToolsByUsage(){
 const container=document.querySelector('#items');
 if(!container)return;
 try{
  const since=new Date(Date.now()-30*86400000).toISOString();
  const events=await get('usage_events',`select=metadata,event_type&created_at=gte.${encodeURIComponent(since)}&event_type=eq.feature_open&limit=5000`);
  const counts={};
  events.forEach(event=>{
   const feature=event.metadata?.feature;
   if(feature)counts[feature]=(counts[feature]||0)+1;
  });

  const cards=[...container.children];
  cards.sort((a,b)=>(counts[b.dataset.feature]||0)-(counts[a.dataset.feature]||0));
  cards.forEach(card=>container.appendChild(card));
 }catch{}
}

setTimeout(reorderToolsByUsage,500);
