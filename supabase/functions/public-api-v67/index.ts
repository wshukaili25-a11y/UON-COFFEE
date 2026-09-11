const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';

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

function forwardedHeaders(req:Request){
  const h:Record<string,string>={
    apikey:SERVICE_ROLE,
    Authorization:`Bearer ${SERVICE_ROLE}`,
    'Content-Type':'application/json'
  };
  for(const key of ['x-forwarded-for','cf-connecting-ip','x-real-ip','user-agent','accept-language']){
    const value=req.headers.get(key);
    if(value)h[key]=value.slice(0,500);
  }
  return h;
}

async function rateAllow(req:Request,action:string,target:string|null,limit:number,windowSeconds:number){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_public_rate_allow`,{
    method:'POST',
    headers:forwardedHeaders(req),
    body:JSON.stringify({p_action:action,p_target_key:target,p_limit:limit,p_window_seconds:windowSeconds}),
    cache:'no-store'
  });
  if(!r.ok)return false;
  try{return (await r.json())===true}catch{return false}
}

async function visibleContacts(req:Request){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/contact_numbers?select=label,phone,sort_order&is_visible=eq.true&order=sort_order.asc,label.asc`,{
    headers:forwardedHeaders(req),cache:'no-store'
  });
  if(!r.ok){
    console.error('contacts_read_failed',r.status,await r.text().catch(()=>''));
    return json(req,{ok:false,code:'contacts_unavailable'},503);
  }
  const rows=await r.json();
  return json(req,{ok:true,rows:Array.isArray(rows)?rows:[]});
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

  const sessionOk=await rateAllow(req,'exam_question_submit_edge',session,10,3600);
  if(!sessionOk)return json(req,{ok:false,code:'rate_limited',message:'rate_limited'},429);
  const clientOk=await rateAllow(req,'exam_question_submit_total',null,30,3600);
  if(!clientOk)return json(req,{ok:false,code:'rate_limited',message:'rate_limited'},429);

  const insert=await fetch(`${SUPABASE_URL}/rest/v1/exam_questions?select=id`,{
    method:'POST',
    headers:{...forwardedHeaders(req),Prefer:'return=representation'},
    body:JSON.stringify({
      college,
      subject,
      text,
      answer:answer||null,
      type,
      year:year||null,
      votes:0,
      approved:false
    }),
    cache:'no-store'
  });
  const raw=await insert.text();
  if(!insert.ok){
    console.error('question_insert_failed',insert.status,raw.slice(0,500));
    return json(req,{ok:false,code:'submit_failed',message:'submit_failed'},503);
  }
  let rows:any[]=[];
  try{rows=JSON.parse(raw)}catch{}
  const id=rows?.[0]?.id;
  if(id==null)return json(req,{ok:false,code:'submit_failed',message:'submit_failed'},503);
  return json(req,{ok:true,id:String(id)});
}

Deno.serve(async(req:Request)=>{
  const c=cors(req);
  if(req.method==='OPTIONS')return new Response(null,{status:c.allowed?204:403,headers:c.headers});
  if(req.method!=='POST')return json(req,{ok:false,code:'method_not_allowed'},405);
  if(!c.allowed)return json(req,{ok:false,code:'origin_not_allowed'},403);
  if(!SUPABASE_URL||!SERVICE_ROLE){
    console.error('public_api_missing_server_config');
    return json(req,{ok:false,code:'service_unavailable'},503);
  }
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
