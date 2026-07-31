import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';
import {extractText} from 'npm:unpdf@1.2.2';
import mammoth from 'npm:mammoth@1.8.0';

declare const Deno:any;
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET=Deno.env.get('STUDY_PLANS_SYNC_SECRET')||'';
const db=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const BASE='https://www.unizwa.edu.om/';
const START_PAGES=[1,2,3,4,5,6].flatMap(college=>[
 `${BASE}program_details.php?college=${college}&comingfrom=761&lang=en`,
 `${BASE}program_details.php?college=${college}&comingfrom=761&lang=ar`,
]);

const COURSE_CODE=/^[A-Z]{2,5}\d{3}[A-Z]?$/;
const COURSE_IN_TEXT=/\b([A-Z]{2,5})\s*[- ]?\s*(\d{3}[A-Z]?)\b/g;
const PLAN_LINK=/\.(?:pdf|docx)(?:$|\?)/i;
const PLAN_WORDS=/(study|degree|curriculum|plan|الخطة|خطة|برنامج)/i;

type Program={id:string;name_ar:string;name_en:string;degree_ar?:string|null;degree_en?:string|null};
type ParsedCourse={code:string;name_ar?:string|null;name_en?:string|null;credit_hours?:number|null;requirement_type:string;source_url:string;semester_no?:number|null};
type DocumentMeta={label:string;lang:'ar'|'en';program_id?:string|null;match_score?:number};

const clean=(value:string)=>String(value||'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();
const abs=(href:string,base=BASE)=>new URL(href,base).toString();
const hasArabic=(value:string)=>/[\u0600-\u06ff]/.test(value);
const hasLatin=(value:string)=>/[A-Za-z]/.test(value);
const safeText=(value:string)=>{
 const text=clean(value);
 if(!text||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))return false;
 const printable=[...text].filter(char=>/[\p{L}\p{N}\p{P}\p{Z}\n]/u.test(char)).length;
 return printable/Math.max(text.length,1)>0.9;
};
const safeTitle=(value:string)=>{
 const title=clean(value);
 return title.length>=3&&title.length<=180&&safeText(title)&&(hasArabic(title)||hasLatin(title));
};
const decodeHtml=(value:string)=>clean(value
 .replace(/<script[\s\S]*?<\/script>/gi,' ')
 .replace(/<style[\s\S]*?<\/style>/gi,' ')
 .replace(/<[^>]+>/g,' ')
 .replace(/&nbsp;/gi,' ')
 .replace(/&amp;/gi,'&')
 .replace(/&#39;/g,"'")
 .replace(/&quot;/gi,'"'));

function normalizedName(value:string){
 return clean(value).toLowerCase()
  .replace(/\b(?:study|degree|curriculum|academic|plan|programme|program|bachelor|master|diploma|b\.?sc\.?|b\.?a\.?|m\.?sc\.?|m\.?a\.?)\b/g,' ')
  .replace(/(?:الخطة|الدراسية|برنامج|بكالوريوس|ماجستير|دبلوم)/g,' ')
  .replace(/(?:before|after)\s*20\d{2}|20\d{2}(?:\s*[-–]\s*20\d{2})?/g,' ')
  .replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ')
  .trim();
}
function tokens(value:string){return new Set(normalizedName(value).split(' ').filter(token=>token.length>1))}
function similarity(a:string,b:string){
 const na=normalizedName(a),nb=normalizedName(b);
 if(!na||!nb)return 0;
 if(na===nb)return 1;
 if(na.length>=5&&nb.includes(na))return Math.min(0.96,0.78+na.length/Math.max(nb.length,1)*0.18);
 if(nb.length>=5&&na.includes(nb))return Math.min(0.94,0.76+nb.length/Math.max(na.length,1)*0.18);
 const ta=tokens(na),tb=tokens(nb);if(!ta.size||!tb.size)return 0;
 const shared=[...ta].filter(token=>tb.has(token)).length;
 const precision=shared/ta.size,recall=shared/tb.size;
 return precision+recall?2*precision*recall/(precision+recall):0;
}
function matchProgram(label:string,programs:Program[]){
 const ranked=programs.map(program=>{
  const score=Math.max(similarity(label,program.name_ar||''),similarity(label,program.name_en||''));
  return {program,score};
 }).sort((a,b)=>b.score-a.score);
 const best=ranked[0],second=ranked[1];
 if(!best||best.score<0.78)return null;
 if(second&&best.score-second.score<0.12)return null;
 return {id:best.program.id,score:Number(best.score.toFixed(3))};
}

async function fetchBytes(url:string){
 const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(35000),headers:{'user-agent':'UON-Hub Study Plan Sync/32.1','accept':'text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*'}});
 if(!response.ok)throw new Error(`download_${response.status}`);
 const length=Number(response.headers.get('content-length')||0);
 if(length>20*1024*1024)throw new Error('document_too_large');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength>20*1024*1024)throw new Error('document_too_large');
 return {bytes,type:(response.headers.get('content-type')||'').toLowerCase(),finalUrl:response.url};
}
function decodePage(bytes:Uint8Array){
 const utf8=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
 const replacements=(utf8.match(/�/g)||[]).length;
 if(replacements/Math.max(utf8.length,1)<0.005)return utf8;
 try{return new TextDecoder('windows-1256',{fatal:false}).decode(bytes)}catch{return utf8}
}
async function documentText(url:string){
 const {bytes,type}=await fetchBytes(url);
 if(/pdf/.test(type)||/\.pdf(?:$|\?)/i.test(url)){
  const result:any=await extractText(bytes,{mergePages:true});
  const text=String(result?.text||result||'');
  if(!safeText(text))throw new Error('unsafe_pdf_text');
  return text;
 }
 if(/officedocument|wordprocessingml/.test(type)||/\.docx(?:$|\?)/i.test(url)){
  const result:any=await mammoth.extractRawText({arrayBuffer:bytes.buffer});
  const text=String(result.value||'');
  if(!safeText(text))throw new Error('unsafe_docx_text');
  return text;
 }
 if(/\.doc(?:$|\?)/i.test(url))throw new Error('legacy_doc_not_supported');
 const text=decodePage(bytes);
 if(!safeText(text))throw new Error('unsafe_html_text');
 return text;
}
function requirement(value:string){
 const text=value.toLowerCase();
 if(/university requirements?|متطلبات الجامعة/.test(text))return'university';
 if(/college requirements?|متطلبات الكلية/.test(text))return'college';
 if(/elective|اختياري/.test(text))return'elective';
 return'major';
}
function parseCourses(text:string,source:string,lang:'ar'|'en'){
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean);
 const rows:ParsedCourse[]=[];
 const rejected:{value:string;reason:string}[]=[];
 let currentRequirement='major';
 let semester:number|null=null;
 for(let index=0;index<lines.length;index++){
  const line=lines[index];
  if(/requirements?|متطلبات|elective|اختياري/i.test(line))currentRequirement=requirement(line);
  const semesterMatch=line.match(/(?:semester|الفصل)\s*(?:no\.?\s*)?([1-9])/i);
  if(semesterMatch)semester=Number(semesterMatch[1]);
  COURSE_IN_TEXT.lastIndex=0;
  for(const match of line.matchAll(COURSE_IN_TEXT)){
   const code=(match[1]+match[2]).toUpperCase();
   if(!COURSE_CODE.test(code)){rejected.push({value:code,reason:'invalid_code'});continue}
   const nearby=clean(lines.slice(Math.max(0,index-1),Math.min(lines.length,index+3)).join(' '));
   let title=clean(line.replace(match[0],' ').replace(/^[-–—:|\d.() ]+|[-–—:|\d.() ]+$/g,''));
   title=title.replace(/\b(?:[1-6]\s*(?:cr|credit|hours?))\b.*$/i,'').trim();
   if(!safeTitle(title)){
    const next=lines[index+1]&&!COURSE_IN_TEXT.test(lines[index+1])?lines[index+1]:'';
    COURSE_IN_TEXT.lastIndex=0;
    title=safeTitle(next)?next:'';
   }
   if(!safeTitle(title)){rejected.push({value:code,reason:'unsafe_title'});continue}
   const hourMatch=nearby.match(/\b([1-6])\s*(?:cr(?:edit)?s?|credit hours?|hours?|hrs?|ساعة|ساعات)\b/i);
   rows.push({
    code,
    [lang==='ar'?'name_ar':'name_en']:title,
    credit_hours:hourMatch?Number(hourMatch[1]):null,
    requirement_type:requirement(nearby)||currentRequirement,
    source_url:source,
    semester_no:semester,
   });
  }
 }
 return {rows,rejected};
}
function linksFromHtml(html:string,pageUrl:string,programs:Program[]){
 const links:{url:string;label:string;program_id?:string|null;match_score?:number}[]=[];
 for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  try{
   const url=abs(match[1],pageUrl);
   const label=decodeHtml(match[2]);
   if(!PLAN_LINK.test(url)||!PLAN_WORDS.test(`${url} ${label}`))continue;
   const programMatch=matchProgram(`${label} ${decodeURIComponent(url.split('/').pop()||'')}`,programs);
   links.push({url,label,program_id:programMatch?.id||null,match_score:programMatch?.score});
  }catch{/* ignore malformed links */}
 }
 return links;
}
const languageOf=(url:string):'ar'|'en'=>(/(?:[?&]lang=ar\b|\/ar\/)/i.test(url)?'ar':'en');

Deno.serve(async(req:Request)=>{
 const headers={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'};
 if(req.method==='OPTIONS')return new Response('',{status:204,headers});
 try{
  const auth=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const supplied=req.headers.get('x-sync-secret')||'';
  if(auth!==SERVICE_KEY&&(!SYNC_SECRET||supplied!==SYNC_SECRET))return new Response(JSON.stringify({ok:false,error:'unauthorized'}),{status:401,headers});
  const body=await req.json().catch(()=>({}));
  const dryRun=body.dry_run===true;
  const pages=[...new Set([...(Array.isArray(body.pages)?body.pages:[]),...START_PAGES])].slice(0,40);
  const [{data:programRows,error:programError},{data:quarantineRows,error:quarantineError}]=await Promise.all([
   db.from('academic_programs').select('id,name_ar,name_en,degree_ar,degree_en').eq('active',true),
   db.from('course_import_quarantine').select('course_code'),
  ]);
  if(programError)throw programError;
  if(quarantineError)throw quarantineError;
  const programs=(programRows||[]) as Program[];
  const quarantined=new Set((quarantineRows||[]).map((row:any)=>String(row.course_code||'').toUpperCase()));
  const documents=new Map<string,DocumentMeta>();
  const pageErrors:any[]=[];
  for(const page of pages){
   try{
    const html=await documentText(page);
    for(const link of linksFromHtml(html,page,programs)){
     const old=documents.get(link.url);
     if(!old||Number(link.match_score||0)>Number(old.match_score||0))documents.set(link.url,{label:link.label,lang:languageOf(page),program_id:link.program_id,match_score:link.match_score});
    }
   }catch(error){pageErrors.push({page,error:String((error as Error).message||error)});}
  }

  const merged=new Map<string,ParsedCourse>();
  const programLinks=new Map<string,Map<string,string>>();
  const rejectedSamples:any[]=[];
  let failed=0,parsedRows=0,rejected=0,matchedDocuments=0;
  for(const [url,meta] of [...documents.entries()].slice(0,220)){
   try{
    const parsed=parseCourses(await documentText(url),url,meta.lang);
    parsedRows+=parsed.rows.length;
    rejected+=parsed.rejected.length;
    rejectedSamples.push(...parsed.rejected.slice(0,3).map(item=>({...item,source:url})));
    if(meta.program_id)matchedDocuments++;
    for(const row of parsed.rows){
     if(quarantined.has(row.code)){rejected++;continue}
     const old=merged.get(row.code)||{code:row.code,requirement_type:row.requirement_type,source_url:row.source_url};
     merged.set(row.code,{...old,...row,name_ar:row.name_ar||old.name_ar,name_en:row.name_en||old.name_en,credit_hours:row.credit_hours||old.credit_hours});
     if(meta.program_id){
      if(!programLinks.has(row.code))programLinks.set(row.code,new Map());
      programLinks.get(row.code)!.set(meta.program_id,row.requirement_type||'major');
     }
    }
   }catch{failed++;}
  }

  let inserted=0,updated=0,linked=0,writeErrors=0;
  if(!dryRun){
   for(const row of merged.values()){
    try{
     const {data:old,error:readError}=await db.from('courses').select('id,name_ar,name_en,credit_hours').eq('code',row.code).maybeSingle();
     if(readError)throw readError;
     const arabic=safeTitle(row.name_ar||'')&&hasArabic(row.name_ar||'')?row.name_ar:null;
     const english=safeTitle(row.name_en||'')&&hasLatin(row.name_en||'')?row.name_en:null;
     const payload={
      code:row.code,
      name_ar:arabic||old?.name_ar||english||row.code,
      name_en:english||old?.name_en||arabic||row.code,
      credit_hours:row.credit_hours||old?.credit_hours||null,
      requirement_type:row.requirement_type||'major',
      source_url:row.source_url,
      active:true,
      status:'approved',
      updated_at:new Date().toISOString(),
     };
     const {error:writeError}=await db.from('courses').upsert(payload,{onConflict:'code'});
     if(writeError)throw writeError;
     old?updated++:inserted++;
     const mappings=programLinks.get(row.code);
     if(mappings?.size){
      const linkRows=[...mappings].map(([program_id,requirement_type])=>({course_code:row.code,program_id,requirement_type}));
      const {error:linkError}=await db.from('course_programs').upsert(linkRows,{onConflict:'course_code,program_id'});
      if(linkError)throw linkError;
      linked+=linkRows.length;
     }
    }catch{writeErrors++;}
   }
   try{await db.from('platform_events').insert({event_type:'study_plans_sync',source:'sync-study-plans',payload:{pages:pages.length,documents:documents.size,matched_documents:matchedDocuments,parsed_rows:parsedRows,accepted_courses:merged.size,inserted,updated,linked,rejected,failed,write_errors:writeErrors,page_errors:pageErrors.slice(0,10)}})}catch{}
  }

  return new Response(JSON.stringify({
   ok:true,dryRun,pages:pages.length,documents:documents.size,matchedDocuments,
   parsedRows,acceptedCourses:merged.size,inserted,updated,linked,
   duplicates:Math.max(0,parsedRows-merged.size),rejected,failed,writeErrors,
   sampleCodes:[...merged.keys()].slice(0,30),
   rejectedSamples:rejectedSamples.slice(0,20),
   pageErrors:pageErrors.slice(0,10),
  }),{headers});
 }catch(error){
  return new Response(JSON.stringify({ok:false,error:String((error as Error).message||error)}),{status:500,headers});
 }
});
