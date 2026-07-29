
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};const response=(b:any,s=200)=>new Response(typeof b==='string'?b:JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json'}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const GOOGLE_SERVICE_ACCOUNT_JSON=Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
async function accessToken(){
 if(!GOOGLE_SERVICE_ACCOUNT_JSON)throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing');
 const sa=JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
 const enc=(o:any)=>btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const now=Math.floor(Date.now()/1000);const header=enc({alg:'RS256',typ:'JWT'});const claim=enc({iss:sa.client_email,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const pem=sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g,'');const bin=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',bin,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(`${header}.${claim}`));const s=btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${header}.${claim}.${s}`})});const j=await r.json();if(!r.ok)throw new Error(JSON.stringify(j));return j.access_token;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response('',204);
 try{const {folder_id,college}=await req.json();if(!folder_id)throw new Error('folder_id required');const {data:run,error}=await db.from('drive_import_runs').insert({folder_id,college,status:'running'}).select().single();if(error)throw error;
 const token=await accessToken();let pageToken='';let imported=0,skipped=0;
 do{const q=new URLSearchParams({q:`'${folder_id}' in parents and trashed=false`,fields:'nextPageToken,files(id,name,mimeType,webViewLink)',pageSize:'1000'});if(pageToken)q.set('pageToken',pageToken);const r=await fetch(`https://www.googleapis.com/drive/v3/files?${q}`,{headers:{Authorization:`Bearer ${token}`}});const j=await r.json();if(!r.ok)throw new Error(JSON.stringify(j));pageToken=j.nextPageToken||'';
 for(const f of j.files||[]){const {error:itemErr}=await db.from('drive_import_items').insert({run_id:run.id,drive_file_id:f.id,file_name:f.name,web_view_link:f.webViewLink,mime_type:f.mimeType,status:'pending'});if(itemErr){skipped++;continue}
 const {error:sumErr}=await db.from('summaries').insert({title:f.name,subject:'استيراد Google Drive',college,url:f.webViewLink,description:'تم استيراده تلقائيًا من Google Drive — بانتظار موافقة المشرف',approved:false});if(sumErr)skipped++;else imported++;
 } }while(pageToken);
 await db.from('drive_import_runs').update({status:'completed',imported_count:imported,skipped_count:skipped,completed_at:new Date().toISOString()}).eq('id',run.id);
 return response({ok:true,run_id:run.id,imported,skipped});
 }catch(e){return response({ok:false,error:String(e.message||e)},500)}
});
