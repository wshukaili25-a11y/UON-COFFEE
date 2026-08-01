import{setupNav,enforceUonMaintenance,watchUonMaintenance,$,rpc,submitPending,notifyPending,toast,esc,colleges,get,trackEvent}from'./core.js';
setupNav();await enforceUonMaintenance();watchUonMaintenance();

const SESSION_KEY='uon_confession_session_v1';
let sessionId=localStorage.getItem(SESSION_KEY);
if(!sessionId){sessionId=crypto.randomUUID();localStorage.setItem(SESSION_KEY,sessionId)}
let sort='latest';
const reactionMeta={heart:['❤️','إعجاب'],laugh:['😂','ضحك'],sad:['😭','حزن'],wow:['😮','تفاجؤ'],fire:['🔥','نار']};
const fmt=v=>{try{return new Intl.RelativeTimeFormat('ar',{numeric:'auto'}).format(-Math.max(1,Math.round((Date.now()-new Date(v))/60000)),'minute')}catch{return new Date(v).toLocaleString('ar-OM')}};

function fillColleges(){const options=colleges.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('#confessionCollege').insertAdjacentHTML('beforeend',options);$('#feedCollege').insertAdjacentHTML('beforeend',options)}
fillColleges();

$('#confessionText').addEventListener('input',e=>$('#confessionCount').textContent=e.target.value.length);

$('#submitConfession').onclick=async()=>{
 const text=$('#confessionText').value.trim();
 if(text.length<5)return toast('اكتب اعترافًا أطول شوي',true);
 if(text.length>1000)return toast('الاعتراف طويل جدًا',true);
 const college=$('#confessionCollege').value||null;
 const program=$('#confessionProgram').value.trim()||null;
 const btn=$('#submitConfession');btn.disabled=true;btn.textContent='جاري النشر...';
 try{
  await rpc('uon_submit_confession',{p_text:text,p_college:college,p_program:program});
  $('#confessionText').value='';$('#confessionCount').textContent='0';$('#confessionProgram').value='';
  toast('تم نشر اعترافك مباشرة 👀');
  trackEvent('confession_published',{college:college||''});
  sort='latest';
  document.querySelectorAll('[data-sort]').forEach(x=>x.classList.toggle('active',x.dataset.sort==='latest'));
  await loadFeed();
 }catch(error){toast(error.message||'تعذر نشر الاعتراف',true)}finally{btn.disabled=false;btn.textContent='📨 نشر الاعتراف'}
};

function reactionButtons(row){const counts=row.reactions||{};return Object.entries(reactionMeta).map(([key,[emoji,label]])=>`<button class="conf-reaction" data-reaction="${key}" title="${label}">${emoji} <span>${Number(counts[key]||0)}</span></button>`).join('')}

function confessionCard(row){const location=[row.college,row.program].filter(Boolean).join(' • ');return `<article class="conf-card" data-id="${row.id}"><div class="conf-meta"><span>👤 مجهول</span><span>${esc(fmt(row.created_at))}</span>${location?`<span>🏫 ${esc(location)}</span>`:''}</div><div class="conf-text">${esc(row.text)}</div><div class="conf-actions">${reactionButtons(row)}<button class="conf-reaction comment-toggle">💬 <span>${Number(row.comments_count||0)}</span></button></div><div class="comments-box" hidden><div class="comments-list"><div class="conf-empty">جاري تحميل التعليقات...</div></div><form class="comment-form"><input maxlength="500" placeholder="اكتب تعليقًا مجهولًا..."><button class="btn" type="submit">إرسال</button></form><p class="conf-note">التعليقات تمر بالمراجعة قبل ظهورها.</p></div></article>`}

async function loadFeed(){const target=$('#confessionsFeed');target.innerHTML='<div class="conf-empty">جاري تحميل الاعترافات...</div>';try{const rows=await rpc('uon_confessions_feed',{p_sort:sort,p_college:$('#feedCollege').value||null,p_limit:60});target.innerHTML=rows?.length?rows.map(confessionCard).join(''):'<div class="conf-empty">ما فيه اعترافات منشورة للحين 👀</div>'}catch(error){target.innerHTML=`<div class="conf-empty">${esc(error.message||'تعذر تحميل الاعترافات')}</div>`}}

async function loadComments(card){const list=card.querySelector('.comments-list');list.innerHTML='<div class="conf-empty">جاري التحميل...</div>';try{const rows=await get('confession_comments',`select=id,content,created_at&confession_id=eq.${encodeURIComponent(card.dataset.id)}&status=eq.approved&order=created_at.asc&limit=100`);list.innerHTML=rows.length?rows.map(x=>`<div class="comment"><div>${esc(x.content)}</div><small>👤 مجهول • ${esc(fmt(x.created_at))}</small></div>`).join(''):'<div class="conf-empty">لا توجد تعليقات بعد.</div>'}catch(error){list.innerHTML='<div class="conf-empty">تعذر تحميل التعليقات.</div>'}}

$('#confessionsFeed').addEventListener('click',async event=>{
 const card=event.target.closest('[data-id]');if(!card)return;
 const reaction=event.target.closest('[data-reaction]');
 if(reaction){reaction.disabled=true;try{const counts=await rpc('uon_toggle_confession_reaction',{p_confession_id:card.dataset.id,p_session_id:sessionId,p_reaction:reaction.dataset.reaction});card.querySelectorAll('[data-reaction]').forEach(button=>{const key=button.dataset.reaction;button.querySelector('span').textContent=Number(counts?.[key]||0);button.classList.toggle('active',counts?.mine===key)});trackEvent('confession_reaction',{reaction:reaction.dataset.reaction})}catch(error){toast(error.message,true)}finally{reaction.disabled=false}return}
 const toggle=event.target.closest('.comment-toggle');if(toggle){const box=card.querySelector('.comments-box');box.hidden=!box.hidden;if(!box.hidden)loadComments(card)}
});

$('#confessionsFeed').addEventListener('submit',async event=>{
 const form=event.target.closest('.comment-form');if(!form)return;event.preventDefault();const card=form.closest('[data-id]');const input=form.querySelector('input');const content=input.value.trim();if(content.length<2)return toast('اكتب تعليقًا أولًا',true);const btn=form.querySelector('button');btn.disabled=true;try{const row=await submitPending('confession_comments',{confession_id:card.dataset.id,content,status:'pending'});await notifyPending('confession_comments',row.id);input.value='';toast('وصل تعليقك للمراجعة 💬');trackEvent('confession_comment_submitted',{})}catch(error){toast(error.message,true)}finally{btn.disabled=false}
});

document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{sort=button.dataset.sort;document.querySelectorAll('[data-sort]').forEach(x=>x.classList.toggle('active',x===button));loadFeed()});
$('#feedCollege').onchange=loadFeed;
loadFeed();