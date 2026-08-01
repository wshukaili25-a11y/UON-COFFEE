import{
 setupNav,enforceUonMaintenance,watchUonMaintenance,$,get,rpc,notifyPending,
 toast,esc,openModal,closeModal,trackEvent,installErrorCapture
}from'./core.js?v=39.0.0';

setupNav();
enforceUonMaintenance();
watchUonMaintenance();
installErrorCapture();

let rows=[];
const safeUrl=value=>{
 try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}
};
const formatDate=value=>value?new Date(value).toLocaleDateString('ar-OM'):'—';

async function load(){
 const target=$('#items');
 target.innerHTML='<div class="empty">جاري تحميل المشاريع...</div>';
 try{
  rows=await get('student_projects','select=*&status=eq.approved&order=featured.desc,created_at.desc&limit=200');
  render();trackEvent('page_view',{page:'projects',count:rows.length});
 }catch(error){target.innerHTML='<div class="empty">تعذر تحميل المشاريع حاليًا.</div>';toast(error.message||'تعذر تحميل المشاريع',true)}
}
function render(){
 const query=($('#search')?.value||'').trim().toLowerCase();
 const list=rows.filter(item=>`${item.title||''} ${item.major||''} ${item.description||''} ${item.owner_name||''}`.toLowerCase().includes(query));
 $('#items').innerHTML=list.length?list.map(item=>{
  const demo=safeUrl(item.demo_url||item.url),github=safeUrl(item.github_url),image=safeUrl(item.image_url);
  return `<article class="project-card${item.featured?' featured':''}">${image?`<img src="${esc(image)}" alt="صورة مشروع ${esc(item.title)}" loading="lazy">`:''}<div class="project-card-body"><div class="project-card-tags"><span class="badge">${esc(item.major||'مشروع طلابي')}</span>${item.featured?'<span class="badge">مميز</span>':''}</div><h3>${esc(item.title)}</h3><p>${esc(item.description||'')}</p><small>${esc(item.owner_name||'طالب')} • ${formatDate(item.created_at)}</small><div class="actions">${demo?`<a class="btn primary" target="_blank" rel="noopener noreferrer" href="${esc(demo)}" data-project-open="${esc(item.id)}">فتح المشروع</a>`:''}${github?`<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(github)}">GitHub</a>`:''}</div></div></article>`;
 }).join(''):'<div class="empty">لا توجد مشاريع مطابقة حاليًا.</div>';
}
$('#search')?.addEventListener('input',render);
$('#openForm')?.addEventListener('click',()=>openModal('modal'));
$('#close')?.addEventListener('click',()=>closeModal('modal'));
$('#modal')?.addEventListener('click',event=>{if(event.target.id==='modal')closeModal('modal')});
$('#items')?.addEventListener('click',event=>{
 const link=event.target.closest('[data-project-open]');
 if(link)trackEvent('student_project_open',{id:link.dataset.projectOpen});
});
$('#form')?.addEventListener('submit',async event=>{
 event.preventDefault();
 const form=event.currentTarget;
 const button=event.submitter||form.querySelector('[type="submit"]');
 const body=Object.fromEntries(new FormData(form));
 const demo=safeUrl(body.demo_url),github=safeUrl(body.github_url),image=safeUrl(body.image_url);
 if(!demo&&!github)return toast('أضف رابط المشروع أو رابط GitHub',true);
 if(body.github_url&&!github)return toast('رابط GitHub غير صالح',true);
 if(body.image_url&&!image)return toast('رابط الصورة غير صالح',true);
 button.disabled=true;const original=button.textContent;button.textContent='جاري الإرسال...';
 try{
  const id=await rpc('uon_submit_student_project',{
   p_title:String(body.title||'').trim(),p_owner_name:String(body.owner_name||'').trim(),
   p_major:String(body.major||'').trim()||null,p_study_year:String(body.study_year||'').trim()||null,
   p_description:String(body.description||'').trim(),p_demo_url:demo||null,p_github_url:github||null,
   p_image_url:image||null,p_contact:String(body.contact||'').trim()
  });
  await notifyPending('student_projects',id);
  toast('تم إرسال المشروع للمراجعة');form.reset();closeModal('modal');
  trackEvent('student_project_submit',{has_demo:Boolean(demo),has_github:Boolean(github)});
 }catch(error){toast(error.message||'تعذر إرسال المشروع',true)}finally{button.disabled=false;button.textContent=original}
});
load();
