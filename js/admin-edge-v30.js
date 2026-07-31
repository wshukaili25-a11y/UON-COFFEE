import {get,toast} from './core.js?v=30.0.1';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const passwordKey='uon_admin_password';
const getPassword=()=>sessionStorage.getItem(passwordKey)||'';

async function callAdminEdge(slug,payload={}){
 const password=getPassword();
 if(!password)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/${slug}`,{
  method:'POST',
  headers:{
   apikey:PUBLISHABLE_KEY,
   'Content-Type':'application/json',
   'x-admin-password':password
  },
  body:JSON.stringify(payload),
  cache:'no-store'
 });
 const text=await response.text();
 let data;
 try{data=text?JSON.parse(text):{}}catch{data={error:text}}
 if(response.status===401){
  sessionStorage.removeItem(passwordKey);
  sessionStorage.removeItem('uon_admin');
  sessionStorage.removeItem('uon_admin_session');
 }
 if(!response.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${response.status}`);
 return data;
}

async function callAdminMultipart(slug,formData){
 const password=getPassword();
 if(!password)throw new Error('انتهت جلسة الإدارة، سجّل الدخول مرة ثانية');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/${slug}`,{
  method:'POST',
  headers:{
   apikey:PUBLISHABLE_KEY,
   'x-admin-password':password
  },
  body:formData,
  cache:'no-store'
 });
 const text=await response.text();
 let data;
 try{data=text?JSON.parse(text):{}}catch{data={error:text}}
 if(response.status===401){
  sessionStorage.removeItem(passwordKey);
  sessionStorage.removeItem('uon_admin');
  sessionStorage.removeItem('uon_admin_session');
 }
 if(!response.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${response.status}`);
 return data;
}

function setLog(element,value){
 if(element)element.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
}

async function runButton(button,task,success,{log}={}){
 button.disabled=true;
 try{
  const result=await task();
  if(log)setLog(log,result);
  if(success)toast(success);
  return result;
 }catch(error){
  const message=error?.message||'تعذر تنفيذ العملية';
  if(log)setLog(log,message);
  toast(message,true);
  throw error;
 }finally{
  button.disabled=false;
 }
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForCompletedBackup(startedAt){
 for(let attempt=0;attempt<20;attempt++){
  const rows=await get('backup_runs','select=*&order=created_at.desc&limit=1');
  const backup=rows?.[0];
  if(backup&&new Date(backup.created_at).getTime()>=startedAt-5000){
   if(backup.status==='completed')return backup;
   if(backup.status==='failed')throw new Error(backup.error||'فشل إنشاء النسخة الاحتياطية');
  }
  await delay(1500);
 }
 throw new Error('لم يكتمل إنشاء النسخة خلال مهلة التحقق');
}

document.addEventListener('click',event=>{
 const drive=event.target.closest('#runDriveImport');
 const driveInfo=event.target.closest('#loadDriveConnectionInfo');
 const dropbox=event.target.closest('#runDropboxImport');
 const telegramBulk=event.target.closest('#runTelegramBulkImport');
 const telegramLocal=event.target.closest('#runTelegramLocalImport');
 const backup=event.target.closest('#runBackup');
 const validateRestore=event.target.closest('#validateRestore');
 const testTelegram=event.target.closest('#testTelegram');
 const testWhatsapp=event.target.closest('#testWhatsapp');
 const target=drive||driveInfo||dropbox||telegramBulk||telegramLocal||backup||validateRestore||testTelegram||testWhatsapp;
 if(!target)return;

 event.preventDefault();
 event.stopImmediatePropagation();

 if(driveInfo){
  const output=document.querySelector('#driveServiceAccountEmail');
  runButton(driveInfo,async()=>{
   const result=await callAdminEdge('google-drive-import',{action:'connection-info'});
   if(output)output.value=result.service_account_email||'';
   return result;
  },'تم تحميل بريد المشاركة').catch(()=>{});
  return;
 }

 if(drive){
  const log=document.querySelector('#importLog');
  setLog(log,'جاري الاستيراد الآمن...');
  runButton(drive,()=>callAdminEdge('google-drive-import',{
   source:document.querySelector('#driveFolderId')?.value.trim()||'',
   college:document.querySelector('#driveCollege')?.value||''
  }),'اكتمل استيراد Google Drive',{log}).catch(()=>{});
  return;
 }

 if(telegramLocal){
  const log=document.querySelector('#telegramImportLog');
  const input=document.querySelector('#telegramLocalPdf');
  const file=input?.files?.[0];
  const college=document.querySelector('#telegramBulkCollege')?.value||'';
  const subject=document.querySelector('#telegramBulkSubject')?.value.trim()||'';
  if(!file||!college){
   toast('اختر ملف PDF والكلية',true);
   return;
  }
  if(file.size<1||file.size>5*1024*1024||!/\.pdf$/i.test(file.name)||file.type!=='application/pdf'){
   toast('اختر ملف PDF صالحًا بحجم لا يتجاوز 5 MB',true);
   return;
  }
  const formData=new FormData();
  formData.set('file',file,file.name);
  formData.set('college',college);
  formData.set('subject',subject||'ملف اختبار Telegram V30');
  formData.set('title',file.name);
  setLog(log,'جاري رفع ملف PDF عبر Telegram Admin...');
  runButton(telegramLocal,async()=>{
   const result=await callAdminMultipart('telegram-admin-upload',formData);
   if(Number(result?.imported||0)!==1||result?.status!=='pending'){
    throw new Error('لم تتم إضافة ملف Telegram إلى المراجعة');
   }
   input.value='';
   return result;
  },'أضيف ملف PDF كمعلق للمراجعة',{log}).catch(()=>{});
  return;
 }

 if(dropbox){
  const log=document.querySelector('#importLog');
  setLog(log,'جاري استيراد Dropbox بشكل آمن...');
  runButton(dropbox,()=>callAdminEdge('dropbox-import',{
   path:document.querySelector('#dropboxPath')?.value.trim()||'',
   college:document.querySelector('#dropboxCollege')?.value||''
  }),'اكتمل استيراد Dropbox',{log}).catch(()=>{});
  return;
 }

 if(telegramBulk){
  const log=document.querySelector('#telegramImportLog');
  const college=document.querySelector('#telegramBulkCollege')?.value||'';
  const subject=document.querySelector('#telegramBulkSubject')?.value.trim()||'';
  const fileIds=(document.querySelector('#telegramBulkFileIds')?.value||'')
   .split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  if(!college||!fileIds.length||fileIds.length>100){
   toast('اختر الكلية وأدخل من 1 إلى 100 معرّف ملف Telegram',true);
   return;
  }
  const items=fileIds.map((file_id,index)=>({
   file_id,
   title:`ملف Telegram ${index+1}`,
   description:'استيراد تجريبي عبر لوحة UON Hub'
  }));
  setLog(log,'جاري استيراد ملفات Telegram...');
  runButton(telegramBulk,async()=>{
   const result=await callAdminEdge('telegram-bulk-import',{
    college,subject,content_type:'summary',items
   });
   if(Number(result?.imported||0)<1){
    const failure=result?.results?.find(item=>item?.ok===false)?.error;
    throw new Error(failure||'لم يتم استيراد أي ملف Telegram');
   }
   return result;
  },'أضيفت ملفات Telegram كمعلقة للمراجعة',{log}).catch(()=>{});
  return;
 }

 if(backup){
  const startedAt=Date.now();
  runButton(backup,async()=>{
   const response=await callAdminEdge('database-backup',{requested_by:'admin-panel-v30'});
   const completed=await waitForCompletedBackup(startedAt);
   window.dispatchEvent(new CustomEvent('uon:backups-refresh'));
   return {...response,verified_backup:completed};
  },'اكتملت النسخة الاحتياطية وتم التحقق من حالتها').catch(()=>{});
  return;
 }

 if(validateRestore){
  const log=document.querySelector('#restoreValidationLog');
  const backupId=document.querySelector('#restoreBackupId')?.value||'';
  if(!backupId){toast('اختر نسخة مكتملة لفحصها',true);return}
  setLog(log,'جاري فحص النسخة بدون كتابة أي بيانات...');
  runButton(validateRestore,()=>callAdminEdge('database-restore',{
   backup_id:backupId,
   dry_run:true,
   validate_only:true,
   requested_by:'admin-panel-v30-validation'
  }),'نجح فحص الاستعادة بدون المساس ببيانات الإنتاج',{log}).catch(()=>{});
  return;
 }

 if(testTelegram){
  runButton(testTelegram,()=>callAdminEdge('telegram-admin',{
   source:'admin-test',
   channel:'telegram'
  }),'تم إرسال اختبار Telegram الآمن').catch(()=>{});
  return;
 }

 if(testWhatsapp){
  const to=document.querySelector('#waTestPhone')?.value||'';
  runButton(testWhatsapp,()=>callAdminEdge('whatsapp-notify',{
   type:'test',
   to,
   message:'اختبار إشعارات UON Hub V30'
  }),'تم إرسال اختبار WhatsApp الآمن').catch(()=>{});
 }
},true);
