
import {get,insert} from './api.js';import {$,esc,toast,setupNav} from './ui.js';setupNav();
async function load(){try{const r=await get('confessions','select=*&status=eq.approved&order=created_at.desc');$('#confessionsGrid').innerHTML=r.length?r.map(x=>`<article class="card feature-card"><p>${esc(x.content)}</p></article>`).join(''):'<div class="empty">لا توجد اعترافات معتمدة بعد</div>'}catch{}}
$('#submitConfession').onclick=async()=>{const content=$('#confessionText').value.trim();if(content.length<5)return toast('اكتب نصًا أطول',true);try{await insert('confessions',{content,status:'pending'});$('#confessionText').value='';toast('تم الإرسال للمراجعة')}catch(e){toast(e.message,true)}};load();
