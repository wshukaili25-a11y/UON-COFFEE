
import {get,insert} from './api.js';import {$,esc,toast,setupNav} from './ui.js';import {initI18n} from './i18n.js';
setupNav();initI18n();let rows=[];
function render(){const q=$('#search').value.toLowerCase();const list=rows.filter(x=>`${x.title||''} ${x.subject||''} ${x.college||''}`.toLowerCase().includes(q));$('#grid').innerHTML=list.length?list.map(x=>`<article class="card item-card"><div class="item-body"><span class="badge">${esc(x.college||'ملخص')}</span><h3>${esc(x.title||x.subject)}</h3><p>${esc(x.description||x.tags||'')}</p><div class="actions"><a href="${esc(x.url||x.link)}" target="_blank">فتح الملخص</a></div></div></article>`).join(''):'<div class="empty">لا توجد ملخصات</div>'}
async function load(){try{rows=await get('summaries','select=*&approved=eq.true&order=created_at.desc');render()}catch(e){toast(e.message,true)}}
window.openSubmit=()=>$('#modal').classList.add('show');window.closeSubmit=()=>$('#modal').classList.remove('show');
window.submitSummary=async()=>{const body={title:$('#sTitle').value.trim(),subject:$('#sSubject').value.trim(),college:$('#sCollege').value.trim(),url:$('#sUrl').value.trim(),link:$('#sUrl').value.trim(),description:$('#sDescription').value.trim(),approved:false,submitter_name:'طالب'};if(!body.title||!body.url)return toast('أكمل الحقول المطلوبة',true);try{await insert('summaries',body);toast('تم الإرسال للمراجعة');closeSubmit()}catch(e){toast(e.message,true)}};
$('#search').addEventListener('input',render);load();
