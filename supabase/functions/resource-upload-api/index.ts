import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function origin(req:Request){const value=req.headers.get('origin')||'';try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}return 'https://uonhub.space'}
function headers(req:Request){return{'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers(req),'Content-Type':'application/json'}})}
function safe(value:string){return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,90)}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 let path='';
 try{
  const form=await req.formData();
  const file=form.get('file');
  if(!(file instanceof File))throw new Error('اختر ملف PDF');
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('يسمح بملفات PDF فقط');
  if(file.size<100||file.size>20*1024*1024)throw new Error('حجم الملف يجب أن يكون أقل من 20MB');
  const code=String(form.get('course_code')||'').trim().toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z]{2,10}[0-9]{2,4}[A-Z]?$/.test(code))throw new Error('رمز المقرر غير صالح');
  const session=String(form.get('session_id')||'');
  if(!/^[0-9a-f-]{36}$/i.test(session))throw new Error('تعذر التحقق من الجلسة');
  const stamp=new Date().toISOString().slice(0,10);
  path=`pending/${stamp}/${crypto.randomUUID()}-${safe(file.name||`${code}.pdf`)}`;
  const bytes=new Uint8Array(await file.arrayBuffer());
  const{error:uploadError}=await db.storage.from('summaries').upload(path,bytes,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
  if(uploadError)throw uploadError;
  const{data:publicData}=db.storage.from('summaries').getPublicUrl(path);
  const{data:id,error}=await db.rpc('uon_submit_resource_v42',{
   p_title:String(form.get('title')||file.name.replace(/\.pdf$/i,'')),p_course_code:code,p_college:String(form.get('college')||''),p_content_type:String(form.get('content_type')||'summary'),p_url:publicData.publicUrl,p_description:String(form.get('description')||'')||null,p_instructor_name:String(form.get('instructor_name')||'')||null,p_semester:String(form.get('semester')||'')||null,p_academic_year:String(form.get('academic_year')||'')||null,p_language:String(form.get('language')||'')||null,p_page_count:Number(form.get('page_count')||0)||null,p_original_filename:file.name,p_file_size_bytes:file.size,p_uploader_contact:String(form.get('uploader_contact')||'')||null,p_session_id:session
  });
  if(error)throw error;
  return reply(req,{ok:true,id,url:publicData.publicUrl});
 }catch(error){if(path)await db.storage.from('summaries').remove([path]);return reply(req,{ok:false,error:String((error as Error)?.message||error)},400)}
});
