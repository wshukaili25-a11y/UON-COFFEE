import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
import { extractText } from 'npm:unpdf@1.2.2';
import mammoth from 'npm:mammoth@1.8.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('STUDY_PLANS_SYNC_SECRET') || '';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const BASE = 'https://www.unizwa.edu.om/';
const START_PAGES = [1,2,3,4,5,6].flatMap(college => [
  `${BASE}program_details.php?college=${college}&comingfrom=761&lang=en`,
  `${BASE}program_details.php?college=${college}&comingfrom=761&lang=ar`,
]);

type ParsedCourse = { code:string; name_ar?:string|null; name_en?:string|null; credit_hours?:number|null; requirement_type:string; source_url:string; semester_no?:number|null };
const clean = (s:string) => s.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const abs = (href:string, base=BASE) => new URL(href, base).toString();
const decodeHtml = (s:string) => clean(s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"'));

async function fetchBytes(url:string){
  const r = await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(35000),headers:{'user-agent':'UON-Hub Study Plan Sync/31.7'}});
  if(!r.ok) throw new Error(`download_${r.status}`);
  return { bytes:new Uint8Array(await r.arrayBuffer()), type:r.headers.get('content-type')||'', finalUrl:r.url };
}
async function docText(url:string){
  const {bytes,type}=await fetchBytes(url);
  if(/pdf/i.test(type)||/\.pdf(?:$|\?)/i.test(url)){const x:any=await extractText(bytes,{mergePages:true});return String(x?.text||x||'');}
  if(/word|officedocument/i.test(type)||/\.docx?(?:$|\?)/i.test(url)){const x:any=await mammoth.extractRawText({arrayBuffer:bytes.buffer});return String(x.value||'');}
  return new TextDecoder('utf-8',{fatal:false}).decode(bytes);
}
function requirement(text:string){const s=text.toLowerCase();if(/university requirements?|متطلبات الجامعة/.test(s))return'university';if(/college requirements?|متطلبات الكلية/.test(s))return'college';if(/elective|اختياري/.test(s))return'elective';return'major';}
function parseCourses(text:string,source:string,lang:'ar'|'en'):ParsedCourse[]{
  const lines=text.split(/\r?\n/).map(clean).filter(Boolean); const out:ParsedCourse[]=[];
  let currentReq='major'; let semester:number|null=null;
  for(let i=0;i<lines.length;i++){
    const line=lines[i]; currentReq=requirement(line)||currentReq;
    const sem=line.match(/(?:semester|الفصل)\s*(?:no\.?\s*)?([1-9])/i); if(sem)semester=Number(sem[1]);
    const matches=[...line.matchAll(/\b([A-Z]{2,10})\s*[- ]?\s*(\d{2,4}[A-Z]?)\b/g)];
    for(const m of matches){
      const code=(m[1]+m[2]).toUpperCase(); if(code.length<5||code.length>14)continue;
      const near=clean(lines.slice(Math.max(0,i-1),Math.min(lines.length,i+3)).join(' '));
      let name=clean(line.replace(m[0],' ').replace(/^[-–—:|\d.() ]+|[-–—:|\d.() ]+$/g,''));
      name=name.replace(/\b(?:[1-6]\s*(?:cr|credit|hours?))\b.*$/i,'').trim();
      const h=near.match(/\b([1-6])\s*(?:cr(?:edit)?s?|credit hours?|hours?|hrs?|ساعة|ساعات)\b/i);
      out.push({code,[lang==='ar'?'name_ar':'name_en']:name&&name.length<180?name:null,credit_hours:h?Number(h[1]):null,requirement_type:requirement(near)||currentReq,source_url:source,semester_no:semester});
    }
  }
  return out;
}
function linksFromHtml(html:string,pageUrl:string){
  const links:any[]=[];
  for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    try{links.push({url:abs(m[1],pageUrl),label:decodeHtml(m[2])});}catch{/* ignore */}
  }
  return links;
}
function languageOf(url:string):'ar'|'en'{return /(?:[?&]lang=ar\b|\/ar\/)/i.test(url)?'ar':'en';}

Deno.serve(async (req:Request)=>{
  const headers={'content-type':'application/json','access-control-allow-origin':'*'};
  if(req.method==='OPTIONS')return new Response('',{status:204,headers});
  try{
    const auth=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const supplied=req.headers.get('x-sync-secret')||'';
    if(auth!==SERVICE_KEY && (!SYNC_SECRET || supplied!==SYNC_SECRET)) return new Response(JSON.stringify({ok:false,error:'unauthorized'}),{status:401,headers});
    const body=await req.json().catch(()=>({}));
    const pages=[...new Set([...(Array.isArray(body.pages)?body.pages:[]),...START_PAGES])].slice(0,40);
    const docs=new Map<string,{label:string,lang:'ar'|'en'}>(); const pageErrors:any[]=[];
    for(const page of pages){
      try{
        const html=await docText(page);
        for(const l of linksFromHtml(html,page)){
          if(/\.(?:pdf|docx?)(?:$|\?)/i.test(l.url) && /(study|degree|plan|الخطة|خطة|برنامج|curriculum)/i.test(`${l.url} ${l.label}`)) docs.set(l.url,{label:l.label,lang:languageOf(page)});
        }
      }catch(e){pageErrors.push({page,error:String((e as Error).message||e)});}
    }
    const merged=new Map<string,ParsedCourse>(); let failed=0,parsedRows=0;
    for(const [url,meta] of [...docs.entries()].slice(0,220)){
      try{
        const rows=parseCourses(await docText(url),url,meta.lang); parsedRows+=rows.length;
        for(const row of rows){const old=merged.get(row.code)||{code:row.code,requirement_type:row.requirement_type,source_url:row.source_url};merged.set(row.code,{...old,...row,name_ar:row.name_ar||old.name_ar,name_en:row.name_en||old.name_en,credit_hours:row.credit_hours||old.credit_hours});}
      }catch{failed++;}
    }
    let inserted=0,updated=0,duplicates=Math.max(0,parsedRows-merged.size);
    for(const row of merged.values()){
      const {data:old}=await db.from('courses').select('id,name_ar,name_en,credit_hours').eq('code',row.code).maybeSingle();
      const payload={code:row.code,name_ar:row.name_ar||old?.name_ar||row.name_en||row.code,name_en:row.name_en||old?.name_en||row.name_ar||row.code,credit_hours:row.credit_hours||old?.credit_hours||null,requirement_type:row.requirement_type||'major',source_url:row.source_url,active:true,status:'approved',updated_at:new Date().toISOString()};
      const {error}=await db.from('courses').upsert(payload,{onConflict:'code'}); if(error)throw error; old?updated++:inserted++;
    }
    await db.from('platform_events').insert({event_type:'study_plans_sync',source:'sync-study-plans',payload:{pages:pages.length,documents:docs.size,inserted,updated,duplicates,failed,page_errors:pageErrors.slice(0,10)}}).catch(()=>{});
    return new Response(JSON.stringify({ok:true,pages:pages.length,documents:docs.size,inserted,updated,duplicates,failed,pageErrors}),{headers});
  }catch(e){return new Response(JSON.stringify({ok:false,error:String((e as Error).message||e)}),{status:500,headers});}
});
