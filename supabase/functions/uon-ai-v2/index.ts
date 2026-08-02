import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLIC_KEY=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(['https://uonhub.space','https://www.uonhub.space']);
function origin(req:Request){const value=req.headers.get('origin')||'';try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{}return 'https://uonhub.space'}
function headers(req:Request){return{'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json',Vary:'Origin'}}
function reply(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
function courseCode(text:string){return text.toUpperCase().match(/\b[A-Z]{2,10}\s*\d{2,4}[A-Z]?\b/)?.[0]?.replace(/\s+/g,'')||''}
function summarizeCourse(hub:any,lang:string){const c=hub.course||{};const stats=hub.stats||{};const name=lang==='en'?(c.name_en||c.name_ar):(c.name_ar||c.name_en);if(lang==='en')return `${c.code} — ${name}. ${c.credit_hours??'—'} credit hours. Available content: ${stats.summaries||0} summaries, ${stats.exams||0} exams, ${stats.groups||0} groups, ${stats.ratings||0} ratings, and ${stats.resources||0} resources.`;return `${c.code} — ${name}. عدد الساعات: ${c.credit_hours??'—'}. المحتوى المتاح: ${stats.summaries||0} ملخص، ${stats.exams||0} اختبار، ${stats.groups||0} مجموعة، ${stats.ratings||0} تقييم، و${stats.resources||0} مصدر.`}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});if(req.method!=='POST')return reply(req,{error:'method_not_allowed'},405);
 try{
  const body=await req.json().catch(()=>({}));const question=String(body.question||'').trim().slice(0,800);const lang=body.language==='en'?'en':'ar';if(question.length<2)throw new Error(lang==='en'?'Write a clearer question':'اكتب سؤالًا أوضح');
  const code=courseCode(question);const links:any[]=[];let answer='';let sources=0;
  if(code){const{data,error}=await db.rpc('uon_course_hub_v42',{p_code:code,p_language:lang});if(!error&&data?.course){answer=summarizeCourse(data,lang);links.push({title:lang==='en'?`Open ${code} course page`:`فتح صفحة ${code}`,url:`/course.html?code=${encodeURIComponent(code)}`,type:lang==='en'?'Course':'مقرر'},{title:lang==='en'?'Search all related content':'البحث في كل المحتوى المرتبط',url:`/search.html?q=${encodeURIComponent(code)}`,type:lang==='en'?'Search':'بحث'});sources++}}
  const{data:search}=await db.rpc('uon_global_search_v42',{p_query:question,p_limit:8,p_language:lang});for(const item of search||[]){if(links.some(link=>link.url===item.url))continue;links.push({title:item.title,url:item.url,type:item.type,official:item.official===true});sources++}
  if(!answer){try{const response=await fetch(`${SUPABASE_URL}/functions/v1/uon-ai`,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY||SERVICE_ROLE_KEY,Authorization:`Bearer ${PUBLIC_KEY||SERVICE_ROLE_KEY}`},body:JSON.stringify({question,history:Array.isArray(body.history)?body.history.slice(-4):[]}),signal:AbortSignal.timeout(9000)});const old=await response.json().catch(()=>({}));if(response.ok&&old.answer){answer=old.answer;for(const link of old.links||[])if(!links.some(x=>x.url===link.url))links.push(link)}}catch{}}
  if(!answer)answer=lang==='en'?(links.length?'I found related results below.':'I could not find a reliable answer. Try a course code or a more specific phrase.'):(links.length?'حصلت لك نتائج مرتبطة بالسؤال وتظهر تحت.':'ما حصلت جواب موثوق حاليًا. جرّب رمز مقرر أو اكتب السؤال بشكل أدق.');
  return reply(req,{answer,links:links.slice(0,10),grounded:sources>0,sources_count:sources,confidence:sources?Math.min(.95,.6+sources*.05):.45,mode:code?'course':'search'});
 }catch(error){return reply(req,{error:String((error as Error)?.message||error)},400)}
});
