
import {get,insert} from './api.js';import {$,esc,toast,setupNav} from './ui.js';import {initI18n} from './i18n.js';
setupNav();initI18n();let rows=[];
function render(){const q=$('#search').value.toLowerCase();const list=rows.filter(x=>`${x.subject||''} ${x.college||''}`.toLowerCase().includes(q));$('#grid').innerHTML=list.length?list.map(x=>`<article class="card item-card"><div class="item-body"><span class="badge"><i class="fab fa-whatsapp"></i> واتساب</span><h3>${esc(x.subject||x.name||'مجموعة')}</h3><p>${esc(x.college||'')}</p><div class="actions"><a href="${esc(x.link||x.url)}" target="_blank">انضم للمجموعة</a></div></div></article>`).join(''):'<div class="empty">لا توجد مجموعات</div>'}
async function load(){try{rows=await get('whatsapp_groups','select=*&approved=eq.true&order=created_at.desc');render()}catch(e){toast(e.message,true)}}
window.openSubmit=()=>$('#modal').classList.add('show');window.closeSubmit=()=>$('#modal').classList.remove('show');
window.submitGroup=async()=>{const body={subject:$('#gSubject').value.trim(),college:$('#gCollege').value.trim(),link:$('#gUrl').value.trim(),approved:false};if(!body.subject||!body.link)return toast('أكمل الحقول المطلوبة',true);try{await insert('whatsapp_groups',body);toast('تم الإرسال للمراجعة');closeSubmit()}catch(e){toast(e.message,true)}};
$('#search').addEventListener('input',render);load();
