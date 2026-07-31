import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno:any;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const COURSE_CODE=/^[A-Z]{2,8}\d{3}[A-Z]?$/;
const COURSE_RE=/\b([A-Z]{2,8})\s*[- ]?\s*(\d{3}[A-Z]?)\b/g;
const clean=(value:any)=>String(value??'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').trim();
const normalizeCode=(value:string)=>value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();

function authorized(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 return token===SERVICE_KEY;
}
function safeOfficialUrl(value:any){
 const url=new URL(String(value||''));
 const host=url.hostname.toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||!(host==='unizwa.edu.om'||host.endsWith('.unizwa.edu.om')))throw new Error('invalid_official_url');
 if(!/\.(?:pdf|docx)(?:$|[?#])/i.test(url.toString()))throw new Error('unsupported_file_type');
 return url.toString();
}
async function download(url:string){
 const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(45000),headers:{'user-agent':'UON-Hub Official Plan Review/32.4'}});
 if(!response.ok)throw new Error(`download_${response.status}`);
 const length=Number(response.headers.get('content-length')||0);
 if(length>18*1024*1024)throw new Error('file_too_large');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength>18*1024*1024)throw new Error('file_too_large');
 return {bytes,type:(response.headers.get('content-type')||'').toLowerCase(),finalUrl:response.url};
}
async function extract(url:string){
 const {bytes,type,finalUrl}=await download(url);
 if(/pdf/.test(type)||/\.pdf(?:$|[?#])/i.test(finalUrl)){
  const {extractText}=await import('npm:unpdf@1.2.2');
  const result:any=await extractText(bytes,{mergePages:false});
  const raw=result?.text??result;
  return {text:Array.isArray(raw)?raw.map((page:any)=>String(page||'')).join('\n\n'):String(raw||''),finalUrl,type:'pdf'};
 }
 const mammoth=await import('npm:mammoth@1.8.0');
 const result:any=await mammoth.default.extractRawText({arrayBuffer:bytes.buffer});
 return {text:String(result.value||''),finalUrl,type:'docx'};
}
function requirement(value:string){
 const text=value.toLowerCase();
 if(/university requirements?|general requirements?|متطلبات الجامعة|المتطلبات العامة/.test(text))return'university';
 if(/college requirements?|متطلبات الكلية/.test(text))return'college';
 if(/elective|اختياري/.test(text))return'elective';
 return'major';
}
function matches(value:string){COURSE_RE.lastIndex=0;const rows=[...value.matchAll(COURSE_RE)];COURSE_RE.lastIndex=0;return rows;}
function cleanTitle(value:string){return clean(value)
 .replace(/^\/?L\b\s*/i,'')
 .replace(/^[-–—:|,;.)\d\s]+/,'')
 .replace(/\s+[1-6](?:\.0)?\s*$/,'')
 .replace(/\s+[1-6]\s*(?:credits?|credit hours?|crs?|hrs?|hours?|ساعة|ساعات)\b.*$/i,'')
 .replace(/\s+(?:pre-?requisites?|prerequisites?|should have)\b.*$/i,'')
 .trim();}
function parse(raw:string,source:string,lang:'ar'|'en'){
 const text=String(raw||'').replace(/\r/g,'\n').replace(/\u00a0/g,' ');
 let lines=text.split(/\n+/).map(clean).filter(Boolean);
 if(lines.length<8)lines=text.replace(/\s+(?=[A-Z]{2,8}\s*[- ]?\s*\d{3}[A-Z]?\b)/g,'\n').split(/\n+/).map(clean).filter(Boolean);
 const best=new Map<string,any>();let currentRequirement='major';let semester:number|null=null;
 for(let index=0;index<lines.length;index++){
  const line=lines[index];
  if(/requirements?|متطلبات|elective|اختياري/i.test(line))currentRequirement=requirement(line);
  const sem=line.match(/(?:semester|الفصل)\s*(?:no\.?\s*)?([1-9])/i);if(sem)semester=Number(sem[1]);
  const found=matches(line);
  for(let position=0;position<found.length;position++){
   const match=found[position];const code=normalizeCode(match[0]);if(!COURSE_CODE.test(code))continue;
   const end=found[position+1]?.index??line.length;
   const segment=clean(line.slice(Number(match.index||0)+match[0].length,end));
   const cells=segment.split(/\s*\|\s*|\t+/).map(clean).filter(Boolean);
   let title=cleanTitle(cells.find(cell=>!/^[1-6](?:\.0)?$/.test(cell)&&!COURSE_CODE.test(normalizeCode(cell)))||segment);
   let credits:number|null=null;
   const hourCell=cells.find(cell=>/^[1-6](?:\.0)?$/.test(cell));if(hourCell)credits=Number.parseInt(hourCell,10);
   const next=lines[index+1]||'';
   if((!title||title.length<3)&&!matches(next).length)title=cleanTitle(next);
   if(!title||title.length<2||title.length>180||!/\p{L}/u.test(title))continue;
   const row={code,name_ar:lang==='ar'?title:null,name_en:lang==='en'?title:null,credit_hours:credits,requirement_type:currentRequirement,semester_no:semester,source_url:source};
   const score=title.length+(credits?10:0);
   if(!best.has(code)||score>best.get(code).score)best.set(code,{...row,score});
  }
 }
 return [...best.values()].sort((a,b)=>a.code.localeCompare(b.code));
}

Deno.serve(async(req:Request)=>{
 const headers={'content-type':'application/json; charset=utf-8'};
 if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'method_not_allowed'}),{status:405,headers});
 if(!authorized(req))return new Response(JSON.stringify({ok:false,error:'unauthorized'}),{status:401,headers});
 try{
  const body=await req.json().catch(()=>({}));
  const url=safeOfficialUrl(body.url);
  const programId=String(body.program_id||'');
  const lang=body.lang==='ar'?'ar':'en';
  const {data:program,error}=await db.from('academic_programs').select('id,name_ar,name_en,degree_ar,degree_en').eq('id',programId).eq('active',true).single();
  if(error)throw error;
  const extracted=await extract(url);
  const rows=parse(extracted.text,extracted.finalUrl,lang);
  return new Response(JSON.stringify({ok:true,read_only:true,review_required:true,program,file_type:extracted.type,source_url:extracted.finalUrl,courses:rows.length,rows}),{headers});
 }catch(error){return new Response(JSON.stringify({ok:false,error:String((error as Error)?.message||error)}),{status:500,headers});}
});
