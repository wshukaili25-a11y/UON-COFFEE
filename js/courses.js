
import {checkFeature,whatsappShare,installErrorCapture,$,get,esc,fillCollege,enforceUonMaintenance,watchUonMaintenance,trackEvent} from './core.js';
await enforceUonMaintenance();watchUonMaintenance();installErrorCapture();
const featureState=await checkFeature('courses');
if(featureState!=='active'){
 document.querySelector('main').innerHTML=`<section class="page-hero"><div class="container"><h1>نادي المواد</h1><p>${featureState==='maintenance'?'الخدمة تحت الصيانة حاليًا':featureState==='coming_soon'?'الخدمة قادمة قريبًا':'الخدمة متوقفة حاليًا'}</p></div></section>`;
 throw new Error('COURSES_FEATURE_DISABLED');
}
fillCollege($('#courseCollege'));
let rows=[];
async function load(){rows=await get('courses','select=*&active=eq.true&order=code.asc');render();trackEvent('page_view',{page:'courses'})}
function render(){const q=$('#courseSearch').value.toLowerCase(),c=$('#courseCollege').value;const list=rows.filter(x=>(!c||x.college===c)&&`${x.code} ${x.name_ar} ${x.name_en||''}`.toLowerCase().includes(q));$('#courseCards').innerHTML=list.length?list.map(x=>`<article class="card course-card"><a href="course.html?code=${encodeURIComponent(x.code)}"><span class="badge">${esc(x.college||'مادة')}</span><h3>${esc(x.code)}</h3><strong>${esc(x.name_ar)}</strong><p>${esc(x.description||'')}</p></a><a class="btn share-btn" target="_blank" href="${whatsappShare(`${x.code} — ${x.name_ar}`,`${location.origin}/course.html?code=${encodeURIComponent(x.code)}`)}">مشاركة</a></article>`).join(''):'<div class="empty">لا توجد مواد مطابقة</div>'}
$('#courseSearch').oninput=render;$('#courseCollege').onchange=render;load();
