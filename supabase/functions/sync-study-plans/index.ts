import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno:any;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET=Deno.env.get('STUDY_PLANS_SYNC_SECRET')||'';
const db=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const BASE='https://www.unizwa.edu.om/';
const DEFAULT_PAGES=[`${BASE}program_details.php?lang=en`];
const PLAN_LINK=/\.(?:pdf|docx?|htm|html)(?:$|[?#])/i;
const PLAN_WORDS=/(study|degree|curriculum|plan|الخطة|خطة|برنامج|content_files)/i;
const clean=(value:any)=>String(value??'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').trim();

function authorized(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const supplied=req.headers.get('x-sync-secret')||'';
 return token===SERVICE_KEY||Boolean(SYNC_SECRET&&supplied===SYNC_SECRET);
}
function safePage(value:any){
 const url=new URL(String(value||''),BASE);
 const host=url.hostname.toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||!(host==='unizwa.edu.om'||host.endsWith('.unizwa.edu.om')))throw new Error('invalid_official_page');
 return url.toString();
}
function decodeEntities(value:string){return value.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/<[^>]+>/g,' ');}
async function html(url:string){
 const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'user-agent':'UON-Hub Official Plan Discovery/32.4'}});
 if(!response.ok)throw new Error(`download_${response.status}`);
 const length=Number(response.headers.get('content-length')||0);if(length>8*1024*1024)throw new Error('page_too_large');
 return await response.text();
}
function priority(label:string,url:string){
 const value=`${label} ${decodeURIComponent(url)}`.toLowerCase();let score=0;
 if(/202[5-9]|203\d/.test(value))score+=120;else if(/202[0-4]/.test(value))score+=80;
 if(/after\s*2019|بعد\s*2019/.test(value))score+=55;
 if(/before\s*2019|قبل\s*2019/.test(value))score-=80;
 if(/degree\s*plan|study\s*plan|الخطة\s*الدراسية/.test(value))score+=20;
 return score;
}
function discover(source:string,pageUrl:string){
 const rows:any[]=[];
 for(const match of source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  try{
   const url=new URL(match[1],pageUrl).toString();const label=clean(decodeEntities(match[2]));
   if(!PLAN_LINK.test(url)||!PLAN_WORDS.test(`${url} ${label}`))continue;
   const host=new URL(url).hostname.toLowerCase();if(!(host==='unizwa.edu.om'||host.endsWith('.unizwa.edu.om')))continue;
   const score=priority(label,url);
   rows.push({label,url,priority:score,modern:score>=50});
  }catch{}
 }
 return rows;
}

Deno.serve(async(req:Request)=>{
 const headers={'content-type':'application/json; charset=utf-8'};
 if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'method_not_allowed'}),{status:405,headers});
 if(!authorized(req))return new Response(JSON.stringify({ok:false,error:'unauthorized'}),{status:401,headers});
 try{
  const body=await req.json().catch(()=>({}));
  const pages=[...new Set((Array.isArray(body.pages)&&body.pages.length?body.pages:DEFAULT_PAGES).map(safePage))].slice(0,3);
  const documents:any[]=[];const errors:any[]=[];
  for(const page of pages){try{documents.push(...discover(await html(page),page));}catch(error){errors.push({page,error:String((error as Error)?.message||error)});}}
  const unique=[...new Map(documents.map(item=>[item.url,item])).values()].sort((a,b)=>b.priority-a.priority);
  const modern=unique.filter(item=>item.modern);
  const {count:programs}=await db.from('academic_programs').select('id',{count:'exact',head:true}).eq('active',true);
  return new Response(JSON.stringify({
   ok:true,read_only:true,review_required:true,pages:pages.length,active_programs:programs||0,
   discovered:unique.length,modern_documents:modern.length,documents:modern.slice(0,120),errors,
   inserted:0,updated:0,duplicates:0
  }),{headers});
 }catch(error){return new Response(JSON.stringify({ok:false,error:String((error as Error)?.message||error)}),{status:500,headers});}
});
