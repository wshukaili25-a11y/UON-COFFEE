import {emailTemplate,attachmentUrl,validEmail,cleanName,cleanSchedule,cleanPng} from './email.mjs';
const base=Deno.env.get('SUPABASE_URL')||'';
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const mailKey=Deno.env.get('RESEND_API_KEY')||'';
const from=Deno.env.get('UON_EMAIL_FROM')||'UON Hub <noreply@uonhub.space>';
const replyTo=Deno.env.get('UON_EMAIL_REPLY_TO')||'';
// OTP pepper: explicit secret if set, otherwise derived from the server-only service key.
const pepper=Deno.env.get('UON_EMAIL_OTP_SECRET')||(service.length>=32?'uon-email-otp:v1:'+service:'');
// Kill switch: set UON_EMAIL_ENABLED=false to turn delivery off without a deploy.
const enabled=Boolean(mailKey&&from&&pepper.length>=32&&Deno.env.get('UON_EMAIL_ENABLED')!=='false');
const publicKey='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxBytes=12*1024*1024;
const maxBody=2_300_000; // verify for schedules may carry a PNG (≤1.5 MB) as base64
async function db(path:string,method='GET',body?:unknown){const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('db');return r.status===204?null:r.json()}
async function digest(id:string,code:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+':'+code)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function summary(id:string){const rows=await db('public_summaries?select=id,title,url,link,pdf_url&id=eq.'+id+'&limit=1');const item=rows?.[0];if(!item||!attachmentUrl(item,base))throw Error('unsupported_pdf');return item}
async function send(to:string,template:any,requestId:string,attachments?:unknown){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+mailKey,'Content-Type':'application/json','Idempotency-Key':requestId},body:JSON.stringify({from,to:[to],...(replyTo?{reply_to:replyTo}:{}),...template,...(attachments?{attachments}:{})}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('mail');return r.json()}
async function pdf(url:string){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok||Number(r.headers.get('content-length'))>maxBytes||!r.body)throw Error('pdf');const reader=r.body.getReader();let size=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw Error('too_large')}chunks.push(value)}const data=new Uint8Array(size);let pos=0;for(const c of chunks){data.set(c,pos);pos+=c.length}if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw Error('pdf');let raw='';for(let i=0;i<data.length;i+=8192)raw+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(raw)}
const safeFile=(v:string)=>String(v).replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,50)||'schedule';
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';let allowed=false;try{const u=new URL(origin);allowed=['https://uonhub.space','https://www.uonhub.space','https://uon-hub.vercel.app'].includes(origin)||(u.protocol==='https:'&&/^uon(?:-hub)?-[a-z0-9-]+-wshukaili25-1447s-projects\.vercel\.app$/.test(u.hostname))}catch{}
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed?origin:'https://www.uonhub.space','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(!allowed)return json(403,{error:'origin'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST'||req.headers.get('apikey')!==publicKey)return json(403,{error:'forbidden'});
 if(Number(req.headers.get('content-length')||0)>maxBody)return json(413,{error:'invalid_request'});
 let body;try{const text=await req.text();if(text.length>maxBody)return json(413,{error:'invalid_request'});body=JSON.parse(text)}catch{return json(400,{error:'invalid_request'})}
 if(!body||typeof body!=='object')return json(400,{error:'invalid_request'});
 if(body.action==='status')return json(200,{available:enabled,max_mb:12,kinds:['summary','schedule']});
 if(!enabled)return json(503,{error:'email_not_configured'});
 let claimed='';
 try{
  if(body.action==='request'){
   const kind=body.kind==='schedule'?'schedule':'summary';
   const email=String(body.email||'').trim().toLowerCase(),name=cleanName(body.name);
   if(!validEmail(email)||!name)return json(400,{error:'invalid_input'});
   let summaryId:string|null=null,payload:unknown=null,title='';
   if(kind==='summary'){if(!uuid.test(body.summary_id||''))return json(400,{error:'invalid_input'});const item=await summary(body.summary_id);summaryId=item.id;title=item.title}
   else{const schedule=cleanSchedule(body.schedule);if(!schedule)return json(400,{error:'invalid_schedule'});payload=schedule;title=schedule.title}
   const id=crypto.randomUUID();const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
   if(!await db('rpc/uon_email_request_v2','POST',{p_id:id,p_kind:kind,p_summary:summaryId,p_payload:payload,p_email:email,p_name:name,p_hash:await digest(id,code)}))return json(429,{error:'rate_limited'});
   try{await send(email,emailTemplate({kind:'otp',subject:kind,name,title,otp:code}),id+'-otp')}catch{await db('summary_email_requests?id=eq.'+id,'PATCH',{state:'failed',otp_hash:'',payload:null});throw Error('mail')}
   return json(200,{request_id:id,expires_in:600});
  }
  if(body.action==='verify'){
   if(!uuid.test(body.request_id||'')||!/^\d{6}$/.test(body.code||''))return json(400,{error:'invalid_code'});
   const r=await db('rpc/uon_email_claim','POST',{p_id:body.request_id,p_hash:await digest(body.request_id,body.code)});if(!r)return json(400,{error:'invalid_code'});
   claimed=body.request_id;let result;
   if(r.kind==='schedule'){
    const schedule=cleanSchedule(r.payload);if(!schedule)throw Error('schedule');
    const image=body.image?cleanPng(body.image):null;
    const attachments=image?[{filename:'UON-Hub-'+safeFile(schedule.title)+'.png',content:image,content_type:'image/png'}]:undefined;
    result=await send(r.email,emailTemplate({kind:'schedule',name:r.name,schedule,hasImage:Boolean(image)}),claimed+'-schedule',attachments);
   }else{
    const item=await summary(r.summary_id);const content=await pdf(attachmentUrl(item,base)!);
    result=await send(r.email,emailTemplate({kind:'summary',name:r.name,title:item.title,id:item.id}),claimed+'-pdf',[{filename:'UON-Hub-'+item.id+'.pdf',content,content_type:'application/pdf'}]);
   }
   await db('summary_email_requests?id=eq.'+claimed,'PATCH',{state:'sent',sent_at:new Date().toISOString(),provider_id:result.id});
   return json(200,{sent:true});
  }
  return json(400,{error:'invalid_request'});
 }catch(error){if(claimed)await db('summary_email_requests?id=eq.'+claimed,'PATCH',{state:'failed',otp_hash:'',payload:null}).catch(()=>{});const reason=error instanceof Error?error.message:'';return json(reason==='unsupported_pdf'?422:502,{error:['unsupported_pdf','too_large'].includes(reason)?reason:'delivery_failed'})}
});
