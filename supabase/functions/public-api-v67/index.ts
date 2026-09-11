import postgres from 'npm:postgres@3.4.7';

const DB_URL=Deno.env.get('SUPABASE_DB_URL')||'';
const sql=DB_URL?postgres(DB_URL,{prepare:false,max:1,idle_timeout:20,connect_timeout:10}):null;

const ALLOWED_ORIGIN_PATTERNS=[
  /^https:\/\/(?:www\.)?uonhub\.space$/i,
  /^https:\/\/uon-hub\.vercel\.app$/i,
  /^https:\/\/(?:uon|uon-hub)[a-z0-9-]*\.vercel\.app$/i,
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i
];

function cors(req:Request){
  const origin=req.headers.get('origin')||'';
  const allowed=!origin||ALLOWED_ORIGIN_PATTERNS.some(rx=>rx.test(origin));
  return {
    allowed,
    headers:{
      'Access-Control-Allow-Origin':allowed&&origin?origin:'https://uonhub.space',
      'Access-Control-Allow-Headers':'content-type, apikey',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Max-Age':'86400',
      'Vary':'Origin',
      'Cache-Control':'no-store'
    }
  };
}

function json(req:Request,body:unknown,status=200){
  const c=cors(req);
  return new Response(JSON.stringify(body),{status,headers:{...c.headers,'Content-Type':'application/json; charset=utf-8'}});
}

function requestHeadersForDb(req:Request){
  const out:Record<string,string>={};
  for(const key of ['x-forwarded-for','cf-connecting-ip','x-real-ip','user-agent','accept-language']){
    const value=req.headers.get(key);
    if(value)out[key]=value.slice(0,500);
  }
  return out;
}

async function visibleContacts(req:Request){
  if(!sql){console.error('public_api_missing_db_url');return json(req,{ok:false,code:'contacts_unavailable'},503)}
  try{
    const rows=await sql`
      select label,phone,sort_order
      from public.contact_numbers
      where is_visible is true
      order by sort_order asc,label asc
    `;
    return json(req,{ok:true,rows:rows.map(row=>({label:String(row.label||''),phone:String(row.phone||''),sort_order:Number(row.sort_order||0)}))});
  }catch(error){
    console.error('contacts_db_read_failed',String((error as Error)?.message||error));
    return json(req,{ok:false,code:'contacts_unavailable'},503);
  }
}

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function submitQuestion(req:Request,input:any){
  const session=String(input?.session_id||'').trim();
  const college=String(input?.college||'').trim();
  const subject=String(input?.subject||'').trim().replace(/\s+/g,'').toUpperCase();
  const text=String(input?.text||'').trim();
  const answer=input?.answer==null?'':String(input.answer).trim();
  const year=input?.year==null?'':String(input.year).trim();
  const type=String(input?.type||'mcq').trim().toLowerCase();

  if(!UUID_RE.test(session))return json(req,{ok:false,code:'invalid_session',message:'invalid_session'},400);
  if(college.length<2||college.length>100)return json(req,{ok:false,code:'invalid_college',message:'invalid_college'},400);
  if(subject.length<2||subject.length>100)return json(req,{ok:false,code:'invalid_subject',message:'invalid_subject'},400);
  if(text.length<5||text.length>1200)return json(req,{ok:false,code:'invalid_question',message:'invalid_question'},400);
  if(answer.length>1200)return json(req,{ok:false,code:'invalid_answer',message:'invalid_answer'},400);
  if(year.length>40)return json(req,{ok:false,code:'invalid_year',message:'invalid_year'},400);
  if(!['mcq','essay','tf','calc'].includes(type))return json(req,{ok:false,code:'invalid_question_type',message:'invalid_question_type'},400);
  if(!sql)return json(req,{ok:false,code:'service_unavailable',message:'service_unavailable'},503);

  try{
    const headersJson=JSON.stringify(requestHeadersForDb(req));
    const id=await sql.begin(async tx=>{
      await tx`select pg_catalog.set_config('request.headers',${headersJson},true)`;
      const sessionRate=await tx`select public.uon_public_rate_allow('exam_question_submit_edge',${session},10,3600) as allowed`;
      if(sessionRate?.[0]?.allowed!==true)throw new Error('rate_limited');
      const clientRate=await tx`select public.uon_public_rate_allow('exam_question_submit_total',${null},30,3600) as allowed`;
      if(clientRate?.[0]?.allowed!==true)throw new Error('rate_limited');
      const rows=await tx`
        insert into public.exam_questions(college,subject,text,answer,type,year,votes,approved)
        values(${college},${subject},${text},${answer||null},${type},${year||null},0,false)
        returning id::text as id
      `;
      return rows?.[0]?.id?String(rows[0].id):'';
    });
    if(!id)return json(req,{ok:false,code:'submit_failed',message:'submit_failed'},503);
    return json(req,{ok:true,id});
  }catch(error){
    const message=String((error as Error)?.message||error);
    if(message.includes('rate_limited'))return json(req,{ok:false,code:'rate_limited',message:'rate_limited'},429);
    console.error('question_db_submit_failed',message);
    return json(req,{ok:false,code:'submit_failed',message:'submit_failed'},503);
  }
}

Deno.serve(async(req:Request)=>{
  const c=cors(req);
  if(req.method==='OPTIONS')return new Response(null,{status:c.allowed?204:403,headers:c.headers});
  if(req.method!=='POST')return json(req,{ok:false,code:'method_not_allowed'},405);
  if(!c.allowed)return json(req,{ok:false,code:'origin_not_allowed'},403);
  const length=Number(req.headers.get('content-length')||0);
  if(length>20000)return json(req,{ok:false,code:'payload_too_large'},413);

  let body:any;
  try{body=await req.json()}catch{return json(req,{ok:false,code:'invalid_json'},400)}
  const action=String(body?.action||'').trim();
  try{
    if(action==='contacts')return await visibleContacts(req);
    if(action==='submit_exam_question')return await submitQuestion(req,body);
    return json(req,{ok:false,code:'invalid_action'},400);
  }catch(error){
    console.error('public_api_error',String((error as Error)?.message||error));
    return json(req,{ok:false,code:'service_unavailable'},503);
  }
});
