import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno:any;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const ALLOWED_ORIGINS=new Set(['https://uonhub.space','https://www.uonhub.space']);
function allowedOrigin(req:Request){
 const origin=req.headers.get('origin')||'';
 if(ALLOWED_ORIGINS.has(origin))return origin;
 try{const host=new URL(origin).hostname.toLowerCase();if(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.includes('uon-hub')))return origin}catch{}
 return 'https://uonhub.space';
}
function cors(req:Request){return {'Access-Control-Allow-Origin':allowedOrigin(req),'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-admin-password','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function reply(req:Request,body:any,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8'}})}
async function authorized(req:Request){const password=req.headers.get('x-admin-password')||'';if(!password)return false;const {data,error}=await db.rpc('uon_admin_authorized',{p_password:password});return !error&&data===true}
function normalizeCode(value:any){return String(value||'').trim().toUpperCase().replace(/\s+/g,'')}
function validCourseCode(code:string){return /^[A-Z]{2,5}[0-9]{3}[A-Z]?$/.test(code)}

async function dashboard(){
 const [courses,colleges,departments,programs,links,quarantine]=await Promise.all([
  db.from('courses').select('*').order('code'),
  db.from('academic_colleges').select('*').eq('active',true).order('sort_order'),
  db.from('academic_departments').select('*').eq('active',true).order('sort_order'),
  db.from('academic_programs').select('*').eq('active',true).order('sort_order'),
  db.from('course_programs').select('course_code,program_id,requirement_type,semester_no,source_url'),
  db.from('course_import_quarantine').select('source_course_id,course_code,reason,snapshot,quarantined_at').order('quarantined_at',{ascending:false}).limit(250)
 ]);
 for(const result of [courses,colleges,departments,programs,links,quarantine])if(result.error)throw result.error;
 const quarantineRows=quarantine.data||[],quarantineIds=new Set(quarantineRows.map((x:any)=>String(x.source_course_id)));
 const cleanCourses=(courses.data||[]).filter((x:any)=>!quarantineIds.has(String(x.id))),linkedCodes=new Set((links.data||[]).map((x:any)=>String(x.course_code||'').toUpperCase()));
 const active=cleanCourses.filter((x:any)=>x.active!==false),service=active.filter((x:any)=>x.requirement_type==='service');
 return {courses:cleanCourses,colleges:colleges.data||[],departments:departments.data||[],programs:programs.data||[],links:links.data||[],quarantine:quarantineRows,
  metrics:{total:cleanCourses.length,active:active.length,inactive:cleanCourses.length-active.length,linked:active.filter((x:any)=>linkedCodes.has(String(x.code||'').toUpperCase())).length,unlinked:active.filter((x:any)=>x.requirement_type!=='service'&&!linkedCodes.has(String(x.code||'').toUpperCase())).length,service:service.length,quarantined:quarantineRows.length}}
}

async function saveCourse(body:any){
 const course=body.course||{},code=normalizeCode(course.code),nameAr=String(course.name_ar||'').trim();
 if(!validCourseCode(code))throw new Error('رمز المقرر غير صحيح');
 if(nameAr.length<2)throw new Error('اسم المقرر مطلوب');
 const programIds=Array.isArray(body.program_ids)?[...new Set(body.program_ids.map(String))]:[];
 const requirement=String(body.requirement_type||course.requirement_type||'major').trim().toLowerCase();
 const {data,error}=await db.rpc('admin_upsert_course_with_programs',{p_course:{...course,code,name_ar:nameAr},p_program_ids:programIds,p_requirement_type:requirement});
 if(error)throw error;
 await db.from('admin_audit_log').insert({admin_name:'web-admin',action:'course_upsert_v323',entity:'courses',entity_id:data?.course?.id||null,details:{code,program_ids:programIds,requirement_type:requirement}});
 return data;
}

async function toggleCourse(body:any){
 const id=String(body.id||'');if(!id)throw new Error('معرّف المقرر مطلوب');
 const active=Boolean(body.active);
 const {data,error}=await db.from('courses').update({active,status:active?'approved':'inactive',updated_at:new Date().toISOString()}).eq('id',id).select('*').single();if(error)throw error;return data;
}

async function deleteCourse(body:any){
 const id=String(body.id||'');if(!id)throw new Error('معرّف المقرر مطلوب');
 const {data:course,error:readError}=await db.from('courses').select('id,code,name_ar').eq('id',id).single();if(readError)throw readError;
 const linkDelete=await db.from('course_programs').delete().eq('course_code',course.code);if(linkDelete.error)throw linkDelete.error;
 const {error}=await db.from('courses').delete().eq('id',id);if(error)throw error;
 await db.from('admin_audit_log').insert({admin_name:'web-admin',action:'course_delete_v323',entity:'courses',entity_id:id,details:course});return {id};
}

async function bulkCourses(body:any){
 const input=Array.isArray(body.rows)?body.rows.slice(0,1000):[];if(!input.length)throw new Error('لا توجد مقررات للاستيراد');
 const {data:quarantine}=await db.from('course_import_quarantine').select('course_code');const blocked=new Set((quarantine||[]).map((x:any)=>normalizeCode(x.course_code)));
 const normalized=input.map((row:any)=>({
  code:normalizeCode(row.code),name_ar:String(row.name_ar||row.name||'').trim(),name_en:String(row.name_en||'').trim()||null,
  college:String(row.college||row.college_ar||'').trim()||null,department:String(row.department||row.department_ar||'').trim()||null,
  credit_hours:row.credit_hours===''||row.credit_hours==null?null:Number(row.credit_hours),level:row.level===''||row.level==null?null:Number(row.level),
  description:String(row.description||'').trim()||null,requirement_type:String(row.requirement_type||'major').trim().toLowerCase(),
  active:false,status:'pending_link',updated_at:new Date().toISOString()
 })).filter((x:any)=>validCourseCode(x.code)&&x.name_ar.length>=2&&!blocked.has(x.code)&&['university','college','major','elective','service'].includes(x.requirement_type));
 if(!normalized.length)throw new Error('ما حصلنا صفوف صالحة');
 const {data,error}=await db.from('courses').upsert(normalized,{onConflict:'code'}).select('id,code');if(error)throw error;
 await db.from('admin_audit_log').insert({admin_name:'web-admin',action:'course_bulk_import_pending_v323',entity:'courses',details:{imported:data?.length||0,skipped:input.length-normalized.length}});
 return {imported:data?.length||0,skipped:input.length-normalized.length};
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 try{
  if(!(await authorized(req)))return reply(req,{ok:false,error:'unauthorized'},401);
  const body=await req.json().catch(()=>({}));let data:any;
  if(body.action==='dashboard')data=await dashboard();
  else if(body.action==='save')data=await saveCourse(body);
  else if(body.action==='toggle')data=await toggleCourse(body);
  else if(body.action==='delete')data=await deleteCourse(body);
  else if(body.action==='bulk')data=await bulkCourses(body);
  else return reply(req,{ok:false,error:'unknown_action'},400);
  return reply(req,{ok:true,data});
 }catch(error){const message=String((error as Error)?.message||error);const client=/required|invalid|مطلوب|غير صحيح|already exists|موجود|select|اختر/i.test(message);return reply(req,{ok:false,error:message},client?400:500)}
});