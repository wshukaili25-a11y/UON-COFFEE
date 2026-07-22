
import {$,get,esc,fillCollege,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();fillCollege($('#courseCollege'));
let rows=[];
async function load(){rows=await get('courses','select=*&active=eq.true&order=code.asc');render();trackEvent('page_view',{page:'courses'})}
function render(){const q=$('#courseSearch').value.toLowerCase(),c=$('#courseCollege').value;const list=rows.filter(x=>(!c||x.college===c)&&`${x.code} ${x.name_ar} ${x.name_en||''}`.toLowerCase().includes(q));$('#courseCards').innerHTML=list.length?list.map(x=>`<a class="card course-card" href="course.html?code=${encodeURIComponent(x.code)}"><span class="badge">${esc(x.college||'مادة')}</span><h3>${esc(x.code)}</h3><strong>${esc(x.name_ar)}</strong><p>${esc(x.description||'')}</p></a>`).join(''):'<div class="empty">لا توجد مواد مطابقة</div>'}
$('#courseSearch').oninput=render;$('#courseCollege').onchange=render;load();
