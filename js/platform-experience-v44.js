import {rpc,notifyPending,toast,esc} from './core.js?v=44.0.0';
import {getToolCatalog} from './tool-registry-v44.js?v=44.0.0';

let booted=false;
const lang=()=>localStorage.getItem('uon_language')==='en'||document.documentElement.lang?.startsWith('en')?'en':'ar';
const t=(ar,en)=>lang()==='en'?en:ar;

function safeHref(value,fallback='#'){
 try{
  const url=new URL(String(value||fallback),location.origin);
  return ['http:','https:'].includes(url.protocol)?url.href:fallback;
 }catch{return fallback}
}
function sessionId(){
 const key='uon_anon_session';
 let id=localStorage.getItem(key);
 if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}
 return id;
}

function installCommandButton(){
 if(document.querySelector('#uon44CommandButton'))return;
 const button=document.createElement('button');button.id='uon44CommandButton';button.className='uon44-command-button';button.type='button';
 button.innerHTML=`<span>🔎</span><span>${t('بحث شامل','Global search')}</span><kbd>Ctrl K</kbd>`;
 button.addEventListener('click',openSearch);
 document.body.append(button);
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   event.preventDefault();openSearch();
  }
 });
}
function openSearch(){
 const current=window.getSelection()?.toString().trim()||'';
 location.href=`/search.html${current?`?q=${encodeURIComponent(current)}`:''}`;
}

function currentFeature(){return document.querySelector('[data-feature].active')?.dataset.feature||document.body.dataset.feature||null}
async function loadAnnouncement(){
 if(sessionStorage.getItem('uon44_announcement_dismissed')==='1')return;
 try{
  const rows=await rpc('uon_public_announcements',{p_college:localStorage.getItem('uon_college')||null,p_feature:currentFeature()});
  const item=Array.isArray(rows)?rows[0]:null;
  if(!item)return;
  const notice=document.createElement('aside');notice.className='uon44-announcement';notice.setAttribute('role','status');
  const buttonUrl=safeHref(item.button_url,'');
  notice.innerHTML=`<span>${esc(item.type==='urgent'?'🚨':item.type==='important'?'⚠️':item.type==='event'?'📅':'📢')}</span><div><strong>${esc(item.title||'')}</strong><small>${esc(item.body||'')}</small></div>${buttonUrl?`<a class="btn primary" href="${esc(buttonUrl)}" rel="noopener">${esc(item.button_text||t('فتح','Open'))}</a>`:''}<button type="button" aria-label="${t('إغلاق','Close')}">✕</button>`;
  notice.querySelector('button').onclick=()=>{sessionStorage.setItem('uon44_announcement_dismissed','1');notice.remove()};
  document.body.append(notice);
 }catch(error){console.warn('Targeted announcement skipped',error)}
}

function createReportDialog(){
 if(document.querySelector('#uon44ReportDialog'))return document.querySelector('#uon44ReportDialog');
 const dialog=document.createElement('dialog');dialog.id='uon44ReportDialog';dialog.className='uon44-report-dialog';
 dialog.innerHTML=`<form class="uon44-report-form" method="dialog"><h2>${t('إبلاغ عن مشكلة','Report a problem')}</h2><p id="uon44ReportTarget"></p><input id="uon44ReportTool" type="hidden"><label>${t('نوع المشكلة','Problem type')}<select id="uon44ReportType"><option value="broken_link">${t('الرابط لا يعمل','Broken link')}</option><option value="wrong_content">${t('معلومة غير صحيحة','Incorrect information')}</option><option value="outdated">${t('محتوى قديم','Outdated content')}</option><option value="duplicate">${t('محتوى مكرر','Duplicate content')}</option><option value="other">${t('مشكلة أخرى','Other')}</option></select></label><label>${t('التفاصيل','Details')}<textarea id="uon44ReportDetails" maxlength="1000" required placeholder="${t('اشرح المشكلة باختصار…','Describe the problem briefly…')}"></textarea></label><label>${t('وسيلة تواصل اختيارية','Optional contact')}<input id="uon44ReportContact" maxlength="120" placeholder="Telegram / email"></label><div class="uon44-report-actions"><button class="btn" value="cancel" type="button" data-close-report>${t('إلغاء','Cancel')}</button><button class="btn primary" type="submit" value="submit">${t('إرسال البلاغ','Send report')}</button></div></form>`;
 document.body.append(dialog);
 dialog.querySelector('[data-close-report]').onclick=()=>dialog.close();
 dialog.querySelector('form').addEventListener('submit',submitReport);
 return dialog;
}
function openReport(key=''){
 const dialog=createReportDialog();
 const item=getToolCatalog().items?.find(row=>row.key===key);
 dialog.querySelector('#uon44ReportTool').value=key;
 dialog.querySelector('#uon44ReportTarget').textContent=item?`${t('الأداة','Tool')}: ${lang()==='en'?(item.name_en||item.name_ar):item.name_ar}`:t('سيتم إرفاق الصفحة تلقائيًا.','The page will be attached automatically.');
 dialog.querySelector('#uon44ReportDetails').value='';
 dialog.showModal();
}
async function submitReport(event){
 event.preventDefault();
 const dialog=event.currentTarget.closest('dialog');
 const toolKey=dialog.querySelector('#uon44ReportTool').value;
 const item=getToolCatalog().items?.find(row=>row.key===toolKey);
 const details=dialog.querySelector('#uon44ReportDetails').value.trim();
 const contact=dialog.querySelector('#uon44ReportContact').value.trim();
 if(details.length<5){toast(t('اكتب تفاصيل أوضح للمشكلة','Add a little more detail'),true);return}
 try{
  const reportId=await rpc('uon_submit_content_report',{
   p_source_table:item?'tool_registry':null,
   p_source_id:item?.key||null,
   p_content_title:item?.name_ar||document.title,
   p_source_url:item?.url||location.href,
   p_report_type:dialog.querySelector('#uon44ReportType').value,
   p_details:contact?`${details}\nالتواصل: ${contact}`:details,
   p_page_url:location.href,
   p_session_id:sessionId()
  });
  dialog.close();toast(t('تم إرسال البلاغ للمشرف','Report sent to the moderator'));
  if(reportId)notifyPending('content_reports',reportId).catch(()=>{});
 }catch(error){console.error(error);toast(error?.message||t('تعذر إرسال البلاغ الآن','Could not send the report now'),true)}
}

function installReporting(){
 createReportDialog();
 document.addEventListener('uon:report-tool',event=>openReport(event.detail?.key||''));
 const button=document.createElement('button');button.type='button';button.className='uon44-report-page';button.hidden=true;button.onclick=()=>openReport('');document.body.append(button);
}

async function logError(source,message,details={}){
 const clean=String(message||'').trim().slice(0,500);
 if(clean.length<3)return;
 try{
  await rpc('uon_report_client_error',{
   p_message:clean,
   p_source:String(source||'browser').slice(0,80),
   p_details:{...details,page:location.href,user_agent:navigator.userAgent.slice(0,300)}
  });
 }catch{}
}
function installErrorCapture(){
 window.addEventListener('error',event=>logError('browser',event.message||'Browser error',{file:event.filename,line:event.lineno,column:event.colno}),true);
 window.addEventListener('unhandledrejection',event=>logError('promise',String(event.reason?.message||event.reason||'Unhandled rejection')));
}

export function bootPlatformExperience(){
 if(booted)return;booted=true;
 installCommandButton();installReporting();installErrorCapture();loadAnnouncement();
}
