import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const ALLOWED_ORIGINS=new Set(['https://uonhub.space','https://www.uonhub.space']);
const ADMIN_TABLES=new Set([
 'academic_calendar_events','academic_colleges','academic_departments','academic_programs',
 'admin_audit_log','ai_supervisor_reviews','ai_supervisor_settings','backup_runs','bot_audit_log','bot_settings',
 'broken_link_reports','confession_comments','confessions','content_reports','course_programs','course_requests','courses',
 'drive_import_items','drive_import_runs','dropbox_import_items','dropbox_import_runs','feature_suggestions',
 'footer_social_links','home_slides','moderation_assignments','moderation_decisions','platform_features','platform_stats_items',
 'rating_submissions','restore_runs','search_index','site_announcements','site_notifications','site_settings',
 'student_projects','study_plan_sources','summaries','support_centers','system_errors','telegram_admins',
 'tools_categories','tools_items','university_programs','usage_events','whatsapp_groups'
]);
const IDENTIFIER=/^[a-z_][a-z0-9_]*$/i;
const SELECT_EXPRESSION=/^[a-z0-9_*.,:()!]+$/i;
const FILTER_OPERATORS=new Set(['eq','neq','gt','gte','lt','lte','like','ilike']);

function requestOrigin(req:Request){
 const origin=req.headers.get('origin')||'';
 if(ALLOWED_ORIGINS.has(origin))return origin;
 try{
  const host=new URL(origin).hostname.toLowerCase();
  if(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.includes('uon-hub')))return origin;
 }catch{}
 return 'https://www.uonhub.space';
}
function corsHeaders(req:Request){return{
 'Access-Control-Allow-Origin':requestOrigin(req),
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-admin-password',
 'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'86400',Vary:'Origin'
}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(req),'content-type':'application/json; charset=utf-8'}})}
async function authorized(req:Request){
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(bearer&&bearer===SERVICE_ROLE_KEY)return true;
 const password=req.headers.get('x-admin-password')||'';
 if(!password)return false;
 const {data,error}=await db.rpc('uon_admin_authorized',{p_password:password});
 return !error&&data===true;
}
function scalar(value:string):string|number|boolean|null{
 const decoded=decodeURIComponent(value);
 if(decoded==='null')return null;if(decoded==='true')return true;if(decoded==='false')return false;
 if(/^-?\d+(?:\.\d+)?$/.test(decoded))return Number(decoded);
 return decoded;
}
function assertIdentifier(value:string,label='identifier'){if(!IDENTIFIER.test(value))throw new Error(`Invalid ${label}`)}
function assertTable(table:string){if(!ADMIN_TABLES.has(table))throw new Error('Table is not available to the admin API')}
function parseParams(raw:unknown){return new URLSearchParams(String(raw||'').replace(/^\?/,''))}
function applyFilters(query:any,params:URLSearchParams,{skipMeta=true}={}){
 let count=0;
 for(const [column,expression] of params.entries()){
  if(skipMeta&&['select','order','limit'].includes(column))continue;
  assertIdentifier(column,'filter column');
  const separator=expression.indexOf('.');
  if(separator<=0)throw new Error(`Invalid filter for ${column}`);
  const operator=expression.slice(0,separator),rawValue=expression.slice(separator+1);
  if(operator==='in'){
   if(!rawValue.startsWith('(')||!rawValue.endsWith(')'))throw new Error(`Invalid in filter for ${column}`);
   query=query.in(column,rawValue.slice(1,-1).split(',').filter(Boolean).map(scalar));count++;continue;
  }
  if(operator==='is'){
   if(!['null','true','false'].includes(rawValue))throw new Error(`Invalid is filter for ${column}`);
   query=query.is(column,scalar(rawValue));count++;continue;
  }
  if(!FILTER_OPERATORS.has(operator))throw new Error(`Unsupported filter: ${operator}`);
  query=query.filter(column,operator,scalar(rawValue));count++;
 }
 return {query,count};
}
function applyOrderAndLimit(query:any,params:URLSearchParams){
 const order=params.get('order');
 if(order){for(const item of order.split(',')){const[column,direction='asc']=item.split('.');assertIdentifier(column,'order column');if(!['asc','desc'].includes(direction))throw new Error('Invalid order direction');query=query.order(column,{ascending:direction==='asc'})}}
 const requested=Number(params.get('limit')||1000);
 if(!Number.isInteger(requested)||requested<1)throw new Error('Invalid limit');
 return query.limit(Math.min(requested,5000));
}
async function adminRead(body:Record<string,unknown>){
 const table=String(body.table||'');assertTable(table);
 const params=parseParams(body.query),select=params.get('select')||'*';
 if(!SELECT_EXPRESSION.test(select))throw new Error('Invalid select expression');
 let query:any=db.from(table).select(select);
 query=applyFilters(query,params).query;
 query=applyOrderAndLimit(query,params);
 const {data,error}=await query;if(error)throw error;return data||[];
}
async function writeAudit(action:string,table:string,query:string,data:any){
 if(table==='admin_audit_log')return;
 const fields=Array.isArray(data)?Object.keys(data[0]||{}):Object.keys(data||{});
 await db.from('admin_audit_log').insert({admin_name:'web-admin',action,entity:table,details:{query,fields}}).then(()=>{}).catch(()=>{});
}
async function adminMutate(body:Record<string,unknown>){
 const table=String(body.table||''),method=String(body.method||'').toUpperCase();
 assertTable(table);
 const params=parseParams(body.query),payload=body.data;
 let query:any;
 if(method==='POST'){
  if(payload===undefined||payload===null)throw new Error('Mutation data is required');
  query=db.from(table).insert(payload as any).select('*');
 }else if(method==='PATCH'){
  if(!payload||typeof payload!=='object')throw new Error('Mutation data is required');
  query=db.from(table).update(payload as any);
  const applied=applyFilters(query,params);query=applied.query;
  if(applied.count===0)throw new Error('Update filter is required');
  query=query.select('*');
 }else if(method==='DELETE'){
  query=db.from(table).delete();
  const applied=applyFilters(query,params);query=applied.query;
  if(applied.count===0)throw new Error('Delete filter is required');
  query=query.select('*');
 }else throw new Error('Unsupported mutation method');
 const {data,error}=await query;if(error)throw error;
 await writeAudit(`admin_${method.toLowerCase()}`,table,String(body.query||''),payload);
 return data||[];
}

async function courseUpsert(course:any){
 const code=String(course.code||'').trim().toUpperCase().replace(/\s+/g,''),nameAr=String(course.name_ar||'').trim();
 if(!/^[A-Z]{2,10}[0-9]{3}[A-Z]?$/.test(code))throw new Error('Invalid course code');
 if(nameAr.length<2)throw new Error('Course Arabic name is required');
 const payload={
  code,name_ar:nameAr,name_en:String(course.name_en||'').trim()||null,
  college:String(course.college||course.college_ar||'').trim()||null,college_ar:String(course.college_ar||course.college||'').trim()||null,
  department:String(course.department||course.department_ar||'').trim()||null,department_ar:String(course.department_ar||course.department||'').trim()||null,
  credit_hours:course.credit_hours===''||course.credit_hours==null?null:Number(course.credit_hours),
  level:course.level===''||course.level==null?null:Number(course.level),description:String(course.description||'').trim()||null,
  learning_outcomes:String(course.learning_outcomes||'').trim()||null,active:course.active!==false,status:'approved',updated_at:new Date().toISOString()
 };
 const {data,error}=await db.from('courses').upsert(payload,{onConflict:'code'}).select('*').single();if(error)throw error;
 await writeAudit('course_upsert','courses',`code=${code}`,payload);return data;
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 try{
  const body=await req.json().catch(()=>({}));
  if(body.action==='health'){
   const {data:state,error}=await db.rpc('uon_public_state');if(error)throw error;
   return reply(req,{ok:true,checks:{database:'ok',maintenance:state?.maintenance_enabled?'maintenance':'active',features:Object.keys(state?.features||{}).length,version:'39.0.0'}});
  }
  if(!(await authorized(req)))return reply(req,{ok:false,error:'unauthorized'},401);
  if(body.action==='read')return reply(req,{ok:true,data:await adminRead(body)});
  if(body.action==='mutate')return reply(req,{ok:true,data:await adminMutate(body)});
  if(body.action==='course_upsert')return reply(req,{ok:true,data:await courseUpsert(body.course||{})});
  if(body.action==='course_toggle'){
   const id=String(body.id||'');if(!id)throw new Error('Course id is required');
   const {data,error}=await db.from('courses').update({active:Boolean(body.active),updated_at:new Date().toISOString()}).eq('id',id).select('*').single();if(error)throw error;
   await writeAudit('course_toggle','courses',`id=${id}`,{active:Boolean(body.active)});return reply(req,{ok:true,data});
  }
  if(body.action==='course_delete'){
   const id=String(body.id||'');if(!id)throw new Error('Course id is required');
   const {error}=await db.from('courses').delete().eq('id',id);if(error)throw error;
   await writeAudit('course_delete','courses',`id=${id}`,{});return reply(req,{ok:true});
  }
  if(body.action==='course_bulk_upsert'){
   const rows=Array.isArray(body.rows)?body.rows.slice(0,1000):[];if(!rows.length)throw new Error('No course rows supplied');
   const normalized=rows.map((course:any)=>({
    code:String(course.code||'').trim().toUpperCase().replace(/\s+/g,''),name_ar:String(course.name_ar||course.name||'').trim(),name_en:String(course.name_en||'').trim()||null,
    college:String(course.college||'').trim()||null,college_ar:String(course.college_ar||course.college||'').trim()||null,
    department:String(course.department||'').trim()||null,department_ar:String(course.department_ar||course.department||'').trim()||null,
    credit_hours:course.credit_hours===''||course.credit_hours==null?null:Number(course.credit_hours),level:course.level===''||course.level==null?null:Number(course.level),
    description:String(course.description||'').trim()||null,active:String(course.active??'true').toLowerCase()!=='false',status:'approved',updated_at:new Date().toISOString()
   })).filter((item:any)=>/^[A-Z]{2,10}[0-9]{3}[A-Z]?$/.test(item.code)&&item.name_ar.length>=2);
   if(!normalized.length)throw new Error('No valid course rows');
   const {data,error}=await db.from('courses').upsert(normalized,{onConflict:'code'}).select('id,code');if(error)throw error;
   await writeAudit('course_bulk_upsert','courses','',{count:normalized.length});return reply(req,{ok:true,data,imported:data?.length||0,skipped:rows.length-normalized.length});
  }
  if(body.action==='reindex'){
   const response=await fetch(`${SUPABASE_URL}/functions/v1/search-reindex`,{method:'POST',headers:{Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:'{}'});
   return new Response(await response.text(),{status:response.status,headers:{...corsHeaders(req),'content-type':'application/json'}});
  }
  return reply(req,{ok:false,error:'unknown_action'},400);
 }catch(error){
  const message=String((error as Error)?.message||error),clientError=/Invalid|Unsupported|not available|required|filter/i.test(message);
  return reply(req,{ok:false,error:message},clientError?400:500);
 }
});
