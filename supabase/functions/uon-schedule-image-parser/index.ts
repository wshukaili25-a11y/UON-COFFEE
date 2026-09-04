import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';
declare const Deno:any;

const URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const GEMINI=Deno.env.get('GEMINI_API_KEY')||'';
const MODEL='gemini-3.7-flash';
const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});

const allowedOrigins=new Set(['https://uonhub.space','https://www.uonhub.space']);
function clean(v:any,max=160){return String(v??'').replace(/\s+/g,' ').trim().slice(0,max)}
function allowedOrigin(req:Request){const value=req.headers.get('origin')||'';if(allowedOrigins.has(value))return value;try{const host=new URL(value).hostname;if(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-')))return value}catch{}return''}
function headers(req:Request){return{'access-control-allow-origin':allowedOrigin(req)||'https://uonhub.space','access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS','content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin'}}
function out(req:Request,body:any,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
function validPublishable(req:Request){const key=req.headers.get('apikey')||'';if(!key)return false;try{const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');return Object.values(keys).includes(key)}catch{return key===Deno.env.get('SUPABASE_ANON_KEY')}}
const uuid=(v:any)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
function imagePart(v:any){const m=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(v||''));return m?{inlineData:{mimeType:m[1],data:m[2]}}:null}
function normalizeDay(v:any){const raw=clean(v,30).replace(/[أإآ]/g,'ا').toLowerCase();const map:any={'ح':'الأحد','الاحد':'الأحد','الأحد':'الأحد','sun':'الأحد','sunday':'الأحد','ن':'الاثنين','الاثنين':'الاثنين','mon':'الاثنين','monday':'الاثنين','ث':'الثلاثاء','الثلاثاء':'الثلاثاء','tue':'الثلاثاء','tuesday':'الثلاثاء','ر':'الأربعاء','الاربعاء':'الأربعاء','الأربعاء':'الأربعاء','wed':'الأربعاء','wednesday':'الأربعاء','خ':'الخميس','الخميس':'الخميس','thu':'الخميس','thursday':'الخميس'};return map[raw]||''}
function normalTime(v:any){const raw=clean(v,20).replace(/[.]/g,':').toLowerCase();const m=raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm|ص|م)?$/i);if(!m)return'';let h=Number(m[1]),min=Number(m[2]);if(h>23||min>59)return'';const p=(m[3]||'').toLowerCase();if((p==='pm'||p==='م')&&h<12)h+=12;if((p==='am'||p==='ص')&&h===12)h=0;return`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`}
function termNow(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Muscat',year:'numeric',month:'numeric'}).formatToParts(new Date());const y=Number(parts.find(p=>p.type==='year')?.value||new Date().getUTCFullYear()),m=Number(parts.find(p=>p.type==='month')?.value||1);return m<=5?`${y}-Spring`:m<=8?`${y}-Summer`:`${y}-Fall`}
function normalizeTerm(v:any){const raw=clean(v,100);if(/^20\d{2}-(Fall|Spring|Summer)$/i.test(raw)){const [y,s]=raw.split('-');return`${y}-${s[0].toUpperCase()+s.slice(1).toLowerCase()}`}const years=raw.match(/20\d{2}/g)||[];const first=Number(years[0]||0),second=Number(years[1]||0),n=raw.replace(/[أإآ]/g,'ا').toLowerCase();if(first&&/(الفصل الدراسي الاول|الفصل الاول|الاول|first|fall)/.test(n))return`${first}-Fall`;if((first||second)&&/(الفصل الدراسي الثاني|الفصل الثاني|الثاني|second|spring)/.test(n))return`${second||first}-Spring`;if((first||second)&&/(صيف|summer)/.test(n))return`${second||first}-Summer`;return termNow()}
function parseJson(text:string){const s=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(s)}catch{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(s.slice(a,b+1));throw new Error('invalid_json')}}
function normalize(data:any){const source=Array.isArray(data?.courses)?data.courses:[];const courses=source.slice(0,30).map((course:any,index:number)=>({course_code:clean(course.course_code||course.code,40).toUpperCase().replace(/\s+/g,'')||`مادة-${index+1}`,course_name:clean(course.course_name||course.name,120),sections:(Array.isArray(course.sections)?course.sections:[]).slice(0,40).map((section:any)=>({section_no:clean(section.section_no||section.number,20),instructor:clean(section.instructor||section.teacher,100),capacity:0,enrolled:Math.max(0,Math.min(999,Number(section.enrolled||section.students_no||0)||0)),meetings:(Array.isArray(section.meetings)?section.meetings:[]).slice(0,12).map((meeting:any)=>({day:normalizeDay(meeting.day),start:normalTime(meeting.start),end:normalTime(meeting.end),room:clean(meeting.room,50)})).filter((m:any)=>m.day&&m.start&&m.end&&m.end>m.start)})).filter((s:any)=>s.section_no&&s.meetings.length)})).filter((c:any)=>c.sections.length);return{term:normalizeTerm(data?.term||data?.semester||data?.academic_term),courses}}
function mergeCourses(courses:any[]){const map=new Map<string,any>();for(const course of courses){const code=clean(course.course_code,40).toUpperCase(),name=clean(course.course_name,120);const generated=/^مادة-\d+$/.test(code);const key=!generated&&code?`code:${code}`:name?`name:${name}`:`generated:${map.size}`;if(!map.has(key))map.set(key,{course_code:code,course_name:name,sections:[]});const target=map.get(key);for(const section of course.sections||[]){let current=target.sections.find((x:any)=>x.section_no===section.section_no);if(!current){current={...section,meetings:[]};target.sections.push(current)}if(!current.instructor&&section.instructor)current.instructor=section.instructor;current.enrolled=Math.max(Number(current.enrolled||0),Number(section.enrolled||0));for(const meeting of section.meetings||[]){const mk=`${meeting.day}|${meeting.start}|${meeting.end}|${meeting.room||''}`;if(!current.meetings.some((m:any)=>`${m.day}|${m.start}|${m.end}|${m.room||''}`===mk))current.meetings.push(meeting)}}}return[...map.values()].filter((c:any)=>c.sections.length)}

async function callBatch(parts:any[]){
 const prompt=`اقرأ جميع صور EduWave المرفوعة من جامعة نزوى كدفعة واحدة. غالبًا كل صورة تخص مادة مختلفة، وقد تكون بعض الصور مقصوصة. يجب أن تستخرج كل مادة ظاهرة في أي صورة، ولا تكتفِ بأول مادة. إذا تكرر نفس رمز المادة في أكثر من صورة فادمج الشعب تحت المادة نفسها فقط. لا تدمج مادتين مختلفتين لمجرد تشابه القاعة أو الوقت.\n\nأعد JSON فقط بالشكل:\n{"term":"الفصل الظاهر","courses":[{"course_code":"INFS205","course_name":"اسم المادة","sections":[{"section_no":"1","instructor":"اسم الدكتور","capacity":0,"enrolled":43,"meetings":[{"day":"الأحد","start":"09:00","end":"09:50","room":"17A"}]}]}]}\n\nقواعد مهمة جدًا:\n- Students No. هو عدد الطلبة المسجلين فقط => enrolled، وليس السعة. capacity دائمًا 0.\n- الصور مأخوذة من الشعب المتاحة، فلا تستبعد شعبة بسبب عدد الطلبة.\n- اختصارات الأيام: ح=الأحد، ن=الاثنين، ث=الثلاثاء، ر=الأربعاء، خ=الخميس.\n- حوّل AM/PM إلى 24 ساعة HH:MM.\n- Building-Class / Building-Class = القاعة.\n- اقرأ كل صف شعبة وكل أيامها.\n- لا تخمّن رمز مادة غير ظاهر؛ إذا الاسم ظاهر فقط اترك الرمز فارغًا.\n- المطلوب استخراج جميع المواد الموجودة في جميع الصور.`;
 const content:any[]=[{text:prompt}];
 parts.forEach((part,index)=>{content.push({text:`الصورة رقم ${index+1}:`});content.push(part)});
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),56000);
 try{
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'x-goog-api-key':GEMINI,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:content}],generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:9000,thinkingConfig:{thinkingLevel:'low'}}}),signal:controller.signal});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`provider_${response.status}_${clean(payload?.error?.message,120)}`);const text=payload?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'';if(!text)throw new Error('empty_response');return normalize(parseJson(text));
 }finally{clearTimeout(timer)}
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return out(req,{error:'method_not_allowed'},405);
 if(!allowedOrigin(req))return out(req,{error:'origin_not_allowed'},403);
 if(!validPublishable(req))return out(req,{error:'invalid_api_key'},401);
 try{
  const body=await req.json().catch(()=>({}));if(!uuid(body.session_id)||!uuid(body.client_token))return out(req,{error:'invalid_session'},400);
  const values=Array.isArray(body.images)?body.images:[];if(!values.length||values.length>10)return out(req,{error:'invalid_image_count'},400);if(values.reduce((n:number,v:any)=>n+String(v||'').length,0)>28_000_000)return out(req,{error:'images_too_large'},413);
  const parts=values.map(imagePart);if(parts.some((p:any)=>!p))return out(req,{error:'invalid_image'},400);
  const{data:allowedRate,error:rateError}=await db.rpc('uon_public_rate_allow',{p_action:'schedule_image_parse',p_target_key:body.client_token,p_limit:20,p_window_seconds:3600});if(rateError||!allowedRate)return out(req,{error:'rate_limited'},429);
  if(!GEMINI)return out(req,{error:'vision_unavailable'},503);
  let parsed:any;try{parsed=await callBatch(parts as any[])}catch(error){const message=clean((error as Error)?.message||error,180);return out(req,{error:/abort/i.test(message)?'vision_timeout':'vision_provider_failed',detail:message},/abort/i.test(message)?504:502)}
  parsed.courses=mergeCourses(parsed.courses||[]);if(!parsed.courses.length)return out(req,{error:'no_sections_found'},422);
  let knowledgeSaved=false,knowledge:any=null;try{const{data,error}=await db.rpc('uon_ingest_schedule_extraction',{p_session_id:body.session_id,p_client_token:body.client_token,p_term:parsed.term,p_model:MODEL,p_courses:parsed.courses});if(error)throw error;knowledgeSaved=true;knowledge=data}catch(error){console.warn('schedule knowledge ingest skipped',clean((error as Error)?.message||error,180))}
  return out(req,{ok:true,model:MODEL,term:parsed.term,courses:parsed.courses,images_total:values.length,images_read:values.length,partial:false,knowledge_saved:knowledgeSaved,knowledge});
 }catch(error){console.error(error);return out(req,{error:'parser_unavailable'},500)}
});
