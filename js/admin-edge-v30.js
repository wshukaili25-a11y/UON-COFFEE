import {toast} from './core.js?v=26.1';

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
  body:JSON.stringify(payload)
 });
 const text=await response.text();
 let data;
 try{data=JSON.parse(text)}catch{data={error:text}}
 if(!response.ok||data?.ok===false)throw new Error(data?.error||'تعذر تنفيذ العملية');
 return data;
}

function runButton(button,task,success){
 button.disabled=true;
 Promise.resolve(task()).then(result=>{
  toast(success);
  return result;
 }).catch(error=>toast(error.message||'تعذر تنفيذ العملية',true)).finally(()=>{button.disabled=false});
}

document.addEventListener('click',event=>{
 const drive=event.target.closest('#runDriveImport');
 const dropbox=event.target.closest('#runDropboxImport');
 const backup=event.target.closest('#runBackup');
 const target=drive||dropbox||backup;
 if(!target)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 if(drive){
  const log=document.querySelector('#importLog');
  if(log)log.textContent='جاري الاستيراد الآمن...';
  runButton(drive,async()=>{
   const result=await callAdminEdge('google-drive-import',{
    folder_id:document.querySelector('#driveFolderId')?.value||'',
    college:document.querySelector('#driveCollege')?.value||''
   });
   if(log)log.textContent=JSON.stringify(result,null,2);
   return result;
  },'اكتمل استيراد Google Drive');
 }
 if(dropbox){
  const log=document.querySelector('#importLog');
  if(log)log.textContent='جاري استيراد Dropbox بشكل آمن...';
  runButton(dropbox,async()=>{
   const result=await callAdminEdge('dropbox-import',{
    path:document.querySelector('#dropboxPath')?.value||'',
    college:document.querySelector('#dropboxCollege')?.value||''
   });
   if(log)log.textContent=JSON.stringify(result,null,2);
   return result;
  },'اكتمل استيراد Dropbox');
 }
 if(backup){
  runButton(backup,()=>callAdminEdge('database-backup',{requested_by:'admin-panel'}),'تم إنشاء النسخة الاحتياطية');
 }
},true);
