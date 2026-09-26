import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const BASE_AI = `${SUPABASE_URL}/functions/v1/uon-ai-chat-v64`;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GENERAL_MODELS = [...new Set(['gemini-3.8-flash', Deno.env.get('GEMINI_PRIMARY_MODEL') || '', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const RATE_CLIENT_LIMIT = 18;
const RATE_IP_LIMIT = 45;
const allowedOrigins = new Set(['https://uonhub.space', 'https://www.uonhub.space']);

const clean = (v:any,n=1600) => String(v ?? '').replace(/\s+/g,' ').trim().slice(0,n);
const norm = (v:any) => clean(v,2000).normalize('NFKD').toLowerCase()
  .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const isUuid = (v:any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));

function requestOrigin(req:Request){
  const value=req.headers.get('origin')||'';
  if(!value) return '';
  try{
    const u=new URL(value);
    if(allowedOrigins.has(value)) return value;
    if(u.protocol==='https:' && u.hostname.endsWith('.vercel.app') && (u.hostname.startsWith('uon-')||u.hostname.startsWith('uon-hub-'))) return value;
  }catch{}
  return null;
}
function cors(req:Request){
  const o=requestOrigin(req);
  return {
    'Access-Control-Allow-Origin': o || 'https://uonhub.space',
    'Access-Control-Allow-Headers':'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Vary':'Origin'
  };
}
function reply(req:Request, body:any, status=200){ return new Response(JSON.stringify(body),{status,headers:cors(req)}); }
async function digest(v:string){
  const b=new TextEncoder().encode(v);
  const h=await crypto.subtle.digest('SHA-256',b);
  return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function clientIp(req:Request){
  for(const key of ['cf-connecting-ip','x-real-ip','x-forwarded-for']){
    const x=(req.headers.get(key)||'').split(',')[0]?.trim();
    if(x&&x.length<90)return x;
  }
  return '';
}
async function rateHit(key:string,limit:number){
  const d=new Date(); d.setSeconds(0,0);
  const {data,error}=await db.rpc('uon_ai_rate_limit',{p_client_key:key,p_window_start:d.toISOString(),p_limit:limit});
  if(error) throw error;
  const row=(Array.isArray(data)?data[0]:data)||{};
  return {allowed:Boolean(row.allowed),retry_after:Number(row.retry_after||60)};
}
async function enforceRate(req:Request,body:any){
  const checks:{key:string,limit:number}[]=[];
  if(isUuid(body?.client_token))checks.push({key:`agent-client:${body.client_token}`,limit:RATE_CLIENT_LIMIT});
  const internal=req.headers.get('authorization')===`Bearer ${SERVICE_ROLE_KEY}`;
  const ip=internal?'':clientIp(req); if(ip)checks.push({key:`agent-ip:${await digest(ip)}`,limit:RATE_IP_LIMIT});
  if(!checks.length)checks.push({key:`agent-anon:${await digest(req.headers.get('user-agent')||'unknown')}`,limit:RATE_CLIENT_LIMIT});
  for(const c of checks){const hit=await rateHit(c.key,c.limit);if(!hit.allowed)return hit;}
  return {allowed:true,retry_after:0};
}

function contextualQuestion(body:any,question:string){
  const q=norm(question).replace(/[؟?!.،,]+$/g,'').trim();
  const history=Array.isArray(body?.history)?body.history:[];
  const previous=[...history].reverse().find((x:any)=>x?.role==='user'&&clean(x?.content,800)&&norm(x.content)!==norm(question));
  if(!previous)return question;
  const directFollowup=/^(?:و?ايميله|و?ايميلها|و?بريده|و?بريدها|و?رقمه|و?رقمها|و?مكتبه|و?مكتبها|وين مكتبه|وين مكتبها|وين مكانه|وين مكانها|طيب ايميله|طيب رقمها|طيب رقمه|his email|her email|his phone|her phone|his office|her office|where is his office|where is her office)$/i.test(q);
  const shortFollowup=q.length<=90&&/^(?:و|طيب|زين|تمام بس|كم|وين|اين|متى|كيف|وش|ويش|ايش|وعن|وبعدين|بعدها|نفس|هذا|هذي|هاذا|هل)/i.test(q);
  if(directFollowup || (shortFollowup&&universitySignal(previous.content)))return `${clean(previous.content,600)} — ${question}`;
  return question;
}

async function persistDirect(body:any,question:string,answer:string){
  if(!isUuid(body?.session_id)||!isUuid(body?.client_token))return null;
  const {data:binding,error}=await db.rpc('uon_ai_bind_conversation_client',{p_session_id:body.session_id,p_client_token:body.client_token});
  const bound=Array.isArray(binding)?binding[0]:binding;
  if(error||!bound?.allowed)return null;
  let cid=bound.conversation_id||null;
  if(!cid){
    const channel=['web','instagram','whatsapp','telegram'].includes(body?.channel)?body.channel:'web';
    const {data:created,error:insertError}=await db.from('uon_ai_conversations').insert({
      session_id:body.session_id,
      client_token_hash:await digest(body.client_token),
      channel,
      status:'ai',
      page_context:clean(body?.page_context,240)||null,
      last_message_at:new Date().toISOString()
    }).select('id').single();
    if(insertError)return null;
    cid=created?.id||null;
  }
  if(!cid)return null;
  const requestId=crypto.randomUUID();
  await db.from('uon_ai_messages').insert([
    {conversation_id:cid,role:'user',content:question},
    {conversation_id:cid,role:'assistant',content:answer,request_id:requestId}
  ]);
  await db.from('uon_ai_conversations').update({last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',cid);
  return requestId;
}

const stop = new Set(norm('دكتور دكتوره الدكتور الدكتوره استاذ استاذه موظف جامعه الجامعه نزوى اريد ابا ابغى ابغي عطني عطيني اعطني وين اين كيف وش ويش ايش هل في من عن على الى لي عندك عندي اسم اسمه ايميل بريده رقم مكتبه مكتب تخصص مادة مساق مقرر رابط the a an of to in for at university nizwa doctor professor staff course where what how email office').split(/\s+/));
function tokens(v:any){
  return [...new Set(norm(v).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(x=>x.length>1&&!stop.has(x)))];
}
function scoreText(query:string,text:string){
  const qs=tokens(query),t=norm(text); if(!qs.length)return 0;
  let score=0; for(const q of qs){ if(t.includes(q))score+=q.length>=5?4:2; }
  return score;
}
function tool(name:string,start:number,count=0,status='ok'){return {name,status,count,ms:Math.max(0,Date.now()-start)}}
function link(title:string,url:any,official=true,type='source'){
  const u=clean(url,1000); if(!/^https?:\/\//i.test(u))return null;
  return {title:clean(title,180),url:u,official,type};
}
function uniqueLinks(items:any[]){const seen=new Set();return items.filter(Boolean).filter((x:any)=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,5)}

function casualReply(question:string,language:string){
  const q=norm(question).replace(/[!؟?.,،\s]+$/g,'').trim();
  const en=language==='en';
  const rows:[RegExp,string,string][]=[
    [/^(?:السلام عليكم|سلام عليكم|السلام عليكم ورحمة الله|السلام عليكم ورحمه الله)$/i,'وعليكم السلام ورحمة الله وبركاته 👋 ويش أقدر أساعدك فيه؟','Wa alaikum assalam 👋 How can I help?'],
    [/^(?:وعليكم السلام|وعليكم السلام ورحمة الله|وعليكم السلام ورحمه الله)$/i,'وعليكم السلام ورحمة الله وبركاته 🌿','Wa alaikum assalam 🌿'],
    [/^(?:هلا|هلا والله|هلا بك|هلو|يا هلا|يا مرحبا|مرحبا|مرحبتين|مرحبا الساع|حياك|حيك|حياك الله|حي الله|الله يحييك)$/i,'هلا والله 👋 ويش تحتاج؟','Hi 👋 What can I help you with?'],
    [/^(?:صباح الخير|صباح النور)$/i,'صباح النور ☀️ وش أقدر أساعدك فيه؟','Good morning ☀️ How can I help?'],
    [/^(?:مساء الخير|مساء النور)$/i,'مساء النور 🌙 وش أقدر أساعدك فيه؟','Good evening 🌙 How can I help?'],
    [/^(?:كيفك|كيف حالك|هلا كيفك|شخبارك|وش اخبارك|ويش اخبارك|كيف امورك|شلونك|علومك|how are you)$/i,'بخير دامك بخير 😄 حاضر، ويش عندك؟','Doing well 😄 I’m ready. What do you need?'],
    [/^(?:شكرا|شكرا لك|مشكور|تسلم|يعطيك العافيه|يعطيك العافية|thanks|thank you)$/i,'العفو وحاضرين 🙌','You’re welcome 🙌'],
    [/^(?:تمام|زين|اوكي|اوك|ok|okay)$/i,'تمام 🙌 كمل، أنا معك.','Sounds good 🙌 Go ahead.'],
    [/^(?:مع السلامه|مع السلامة|باي|bye)$/i,'في أمان الله 👋','Goodbye 👋'],
    [/^(?:من انت|منو انت|وش اسمك|ويش اسمك|ايش اسمك|who are you)$/i,'أنا UON Agent 🤖 مساعد UON Hub الذكي لطلبة جامعة نزوى. أبحث في بيانات المنصة والمصادر المتاحة قبل ما أعطيك معلومة جامعية.','I’m UON Agent 🤖, UON Hub’s assistant for University of Nizwa students.'],
    [/^(?:وش تقدر تسوي|ويش تقدر تسوي|ايش تقدر تسوي|كيف تساعدني|what can you do)$/i,'أقدر أبحث عن الدكاترة والمواد والمواعيد والخدمات والمباني، وأستخدم جدولك المحفوظ، وأساعدك في الأسئلة الدراسية والمحادثة العادية.','I can search staff, courses, dates, services and campus information, use your saved schedule, and help with study questions and normal conversation.']
  ];
  for(const [re,ar,enText] of rows)if(re.test(q))return en?enText:ar;
  return '';
}

function universitySignal(question:string){
  const q=norm(question);
  return /جامعه نزوى|جامعة نزوى|university of nizwa|\buon\b|uonhub|eduwave|مودل|moodle|البوابه|البوابة|portal|الرقم الجامعي|البريد الجامعي|تحديد المستوى|linguaskill|فاونديشن|تاسيسي|تأسيسي|سكشن|سكاشن|شعبه|شعبة|الشعب|القبول|التسجيل|حذف واضاف|حذف وإضاف|الانسحاب|الخطة الدراسيه|الخطة الدراسية|المعدل التراكمي|gpa|الساعات المعتمده|الساعات المعتمدة|الحرم|الكليه|الكلية|القسم|انجز|انجاز|مسالك|رسوم الجامعه|رسوم الجامعة|السكن الجامعي|المكتبه|المكتبة|واي فاي|wifi|الجدول الدراسي|جدولي|محاضراتي|قاعة|قاعه|مبنى|موظف|دكتور|دكتوره|استاذ|استاذه|عميد|مرشد/.test(q);
}

function route(question:string){
  const q=norm(question);
  const writing=/اكتب|اكتبلي|صيغ|صياغ|اعد صياغ|عدّل|عدل لي|ترجم|لخص|لخّص|اشرح|فهمني|حل لي|حللي|ساعدني|سوي لي|سو لي|write|rewrite|translate|summari[sz]e|explain|solve|help me|code|برمج|كود/.test(q);
  const conversational=/رايك|رأيك|وش رايك|ويش رايك|ايش رايك|سالف|امزح|نكت|طفشان|متضايق|مبسوط|احب|اكره|what do you think|joke|chat/.test(q);

  if(/جدولي|محاضراتي|محاضرتي|وش عندي اليوم|ويش عندي اليوم|ايش عندي اليوم|my schedule|my classes|next class/.test(q))return 'schedule';

  if(/انجز|انجاز|مسالك|مركز.*(?:دعم|تعلم)|anjiz|support center|learning pathways/.test(q))return 'support';

  if(/(?:رئيس|مدير|عميد|نائب رئيس|president|vice president|dean|director).*(?:جامع|university)/i.test(q)
    || /^(?:من|مين|منو|من هو|من هي|who is).*?(?:رئيس|مدير|عميد|نائب رئيس|president|vice president|dean|director)/i.test(q))return 'search';

  const staffWords=/(?:دكتور|دكتوره|استاذ|استاذه|موظف|عميد|مدير|رئيس|مرشد|doctor|professor|staff|dean|director|advisor)/;
  const staffLookup=(
    /(?:وين|اين|أين|من هو|من هي|عطني|اعطني|ابي|ابا|اريد|ابغى|ابغي|دور|ابحث|find|where|who).*(?:دكتور|دكتوره|استاذ|استاذه|موظف|عميد|مدير|رئيس|مرشد|doctor|professor|staff|dean|director|advisor)/.test(q)
    || /(?:ايميل|بريد|رقم|هاتف|تحويله|تحويلة|مكتب|مكان|email|phone|extension|office).*(?:دكتور|دكتوره|استاذ|استاذه|موظف|عميد|مدير|رئيس|مرشد|doctor|professor|staff|dean|director|advisor)/.test(q)
    || (!writing&&!conversational&&new RegExp('^'+staffWords.source).test(q))
  );
  if(staffLookup)return 'staff';

  const calendarSpecific=/التقويم الاكاديمي|التقويم الأكاديمي|حذف واضاف|حذف وإضاف|موعد التسجيل|متى التسجيل|فتره التسجيل|فترة التسجيل|موعد الاختبار|متى الاختبار|موعد الامتحان|متى الامتحان|بدايه الفصل|بداية الفصل|نهايه الفصل|نهاية الفصل|academic calendar|registration date|add.?drop|exam date|semester date/.test(q);
  if(calendarSpecific || ((/موعد|متى|تاريخ|يوم|اسبوع|أسبوع|calendar|when/.test(q))&&(/تسجيل|اختبار|امتحان|دوام|اجازه|إجازة|semester|registration|exam|holiday/.test(q))))return 'calendar';

  if(/\b[A-Z]{2,10}[ -]*\d{2,4}[A-Z]?\b/i.test(question))return 'course';
  if(!writing && (/كم.*ساع.*معتمد|متطلب.*(?:ماده|مادة|مساق|مقرر)|prerequisite|credit hours/.test(q)))return 'course';

  if(/مبنى|المبنى|قاعه|قاعة|مختبر|خريط|مكان.*(?:جامعه|جامعة|حرم)|موقع.*(?:جامعه|جامعة|حرم)|building|room|lab|campus|campus location/.test(q))return 'campus';

  if(writing||conversational)return 'chat';
  return universitySignal(question)?'search':'chat';
}

async function staffTool(question:string){
  const started=Date.now();
  const {data,error}=await db.from('uon_staff_directory').select('id,full_name,job_title,department,college,email,phone,extension,office_location,source_url,last_verified_at').eq('active',true).eq('official',true).limit(1000);
  if(error)throw error;
  const ranked=(data||[]).map((r:any)=>({...r,_score:scoreText(question,[r.full_name,r.job_title,r.department,r.college].join(' '))}))
    .filter((r:any)=>r._score>0).sort((a:any,b:any)=>b._score-a._score||String(a.full_name).localeCompare(String(b.full_name))).slice(0,6);
  return {kind:'staff',rows:ranked,trace:tool('search_staff',started,ranked.length)};
}
async function courseTool(question:string){
  const started=Date.now();
  const match=question.toUpperCase().match(/\b([A-Z]{2,10})[ -]*(\d{2,4}[A-Z]?)\b/);
  let rows:any[]=[];
  if(match){
    const code=(match[1]+match[2]).replace(/[ -]/g,'');
    const {data,error}=await db.from('courses').select('code,name_ar,name_en,college_ar,college_en,department_ar,department_en,credit_hours,level,requirement_type,description,source_url,status').eq('active',true).eq('status','approved').limit(600);
    if(error)throw error;
    rows=(data||[]).filter((r:any)=>String(r.code||'').toUpperCase().replace(/[ -]/g,'')===code).slice(0,5);
  }else{
    const {data,error}=await db.from('courses').select('code,name_ar,name_en,college_ar,college_en,department_ar,department_en,credit_hours,level,requirement_type,description,source_url,status').eq('active',true).eq('status','approved').limit(600);
    if(error)throw error;
    rows=(data||[]).map((r:any)=>({...r,_score:scoreText(question,[r.code,r.name_ar,r.name_en,r.college_ar,r.college_en,r.department_ar,r.department_en].join(' '))}))
      .filter((r:any)=>r._score>0).sort((a:any,b:any)=>b._score-a._score).slice(0,6);
  }
  return {kind:'course',rows,trace:tool('search_courses',started,rows.length)};
}
function muscatDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
async function calendarTool(question:string){
  const started=Date.now();
  const {data,error}=await db.from('academic_calendar_events').select('title,description,event_type,start_date,end_date,college').eq('active',true).order('start_date',{ascending:true}).limit(80);
  if(error)throw error;
  const q=norm(question),today=muscatDate();
  let ranked=(data||[]).map((r:any)=>({...r,_score:scoreText(question,[r.title,r.description,r.event_type].join(' '))}));
  if(/القادم|الجاي|متى|موعد|when|next/.test(q)) ranked=ranked.filter((r:any)=>String(r.end_date||r.start_date)>=today);
  const relevant=ranked.filter((r:any)=>r._score>0);
  const rows=(relevant.length?relevant:ranked.filter((r:any)=>String(r.end_date||r.start_date)>=today)).sort((a:any,b:any)=>(b._score||0)-(a._score||0)||String(a.start_date).localeCompare(String(b.start_date))).slice(0,6);
  return {kind:'calendar',rows,trace:tool('academic_calendar',started,rows.length)};
}
async function supportTool(question:string){
  const started=Date.now();
  const {data,error}=await db.from('support_centers').select('name,description,booking_url,location_url').eq('active',true).order('sort_order',{ascending:true});
  if(error)throw error;
  const ranked=(data||[]).map((r:any)=>({...r,_score:scoreText(question,[r.name,r.description].join(' '))})).sort((a:any,b:any)=>b._score-a._score);
  const rows=(ranked.some((r:any)=>r._score>0)?ranked.filter((r:any)=>r._score>0):ranked).slice(0,4);
  return {kind:'support',rows,trace:tool('support_centers',started,rows.length)};
}
async function campusTool(question:string){
  const started=Date.now();
  const [a,b]=await Promise.all([
    db.from('uon_campus_buildings').select('building_code,name_ar,name_en,aliases,campus,source_url').eq('active',true).eq('official',true).limit(200),
    db.rpc('uon_ai_search_fast',{p_question:question,p_limit:12})
  ]);
  if(a.error)throw a.error;
  const buildings=(a.data||[]).map((r:any)=>({...r,_score:scoreText(question,[r.building_code,r.name_ar,r.name_en,(r.aliases||[]).join(' ')].join(' '))})).filter((r:any)=>r._score>0).sort((x:any,y:any)=>y._score-x._score).slice(0,5);
  const context=(b.data||[]).filter((r:any)=>scoreText(question,[r.title,r.description].join(' '))>0).slice(0,5);
  return {kind:'campus',rows:buildings,context,trace:tool('campus_search',started,buildings.length+context.length)};
}
function dayKey(v:any){
  const q=norm(v);
  const map:any={sunday:'sun',sun:'sun','الاحد':'sun','الأحد':'sun',monday:'mon',mon:'mon','الاثنين':'mon',tuesday:'tue',tue:'tue','الثلاثاء':'tue',wednesday:'wed',wed:'wed','الاربعاء':'wed','الأربعاء':'wed',thursday:'thu',thu:'thu','الخميس':'thu',friday:'fri',fri:'fri','الجمعه':'fri','الجمعة':'fri',saturday:'sat',sat:'sat','السبت':'sat'};
  return map[q]||q.slice(0,3);
}
function todayKey(){
  return dayKey(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Muscat',weekday:'long'}).format(new Date()));
}
function extractMeetings(schedule:any){
  const root=Array.isArray(schedule)?schedule:(Array.isArray(schedule?.courses)?schedule.courses:(Array.isArray(schedule?.rows)?schedule.rows:(Array.isArray(schedule?.schedule?.courses)?schedule.schedule.courses:[])));
  const out:any[]=[];
  for(const c of root){
    const ms=Array.isArray(c.meetings)?c.meetings:(Array.isArray(c.times)?c.times:[c]);
    for(const m of ms){
      const day=clean(m.day_name||m.day||c.day_name||c.day,40);
      const start=clean(m.start_time||m.start||c.start_time||c.start,20);
      const end=clean(m.end_time||m.end||c.end_time||c.end,20);
      const code=clean(c.course_code||c.code||c.course||m.course_code||m.code,60);
      if(day&&start&&code)out.push({course_code:code,course_name:clean(c.course_name||c.name||'',160),day,start:start.slice(0,5),end:end.slice(0,5),room:clean(m.room||c.room||'',80),instructor:clean(m.instructor||c.instructor||'',160)});
    }
  }
  return out;
}
async function scheduleTool(body:any){
  const started=Date.now();
  if(!isUuid(body?.session_id)||!isUuid(body?.client_token))return {kind:'schedule',rows:[],reason:'missing_session',trace:tool('my_schedule',started,0,'needs_context')};
  const tokenHash=await digest(body.client_token);
  const {data,error}=await db.from('uon_ai_schedule_snapshots').select('schedule,timezone,updated_at').eq('session_id',body.session_id).eq('client_token_hash',tokenHash).maybeSingle();
  if(error)throw error;
  if(!data)return {kind:'schedule',rows:[],reason:'not_saved',trace:tool('my_schedule',started,0,'not_found')};
  const all=extractMeetings(data.schedule),today=all.filter((x:any)=>dayKey(x.day)===todayKey());
  return {kind:'schedule',rows:today,all_count:all.length,updated_at:data.updated_at,trace:tool('my_schedule',started,today.length)};
}
async function searchTool(question:string){
  const started=Date.now();
  const {data,error}=await db.rpc('uon_ai_search_fast',{p_question:question,p_limit:20});
  if(error)throw error;
  const ranked=(data||[]).map((r:any)=>({
    ...r,
    _local:scoreText(question,[r.title,r.description,r.type].join(' ')),
    _backend:Number(r.score||0)
  })).filter((r:any)=>r._local>0)
    .sort((a:any,b:any)=>b._local-a._local||b._backend-a._backend)
    .slice(0,6);
  return {kind:'search',rows:ranked,trace:tool('uon_knowledge_search',started,ranked.length)};
}

function groundingLinks(data:any){
  const candidate=data?.candidates?.[0]||{};
  const meta=candidate?.groundingMetadata||candidate?.grounding_metadata||{};
  const chunks=meta?.groundingChunks||meta?.grounding_chunks||[];
  const links:any[]=[];
  for(const chunk of chunks){
    const web=chunk?.web||chunk?.grounding_chunk?.web;
    const url=clean(web?.uri||web?.url,1600);
    if(!/^https?:\/\//i.test(url))continue;
    let host='';
    try{host=new URL(url).hostname.replace(/^www\./,'')}catch{}
    links.push({
      title:clean(web?.title||host||'Web source',180),
      url,
      official:host==='unizwa.edu.om'||host.endsWith('.unizwa.edu.om'),
      type:host==='unizwa.edu.om'||host.endsWith('.unizwa.edu.om')?'University of Nizwa':'Web'
    });
  }
  return uniqueLinks(links);
}

function searchQueriesFrom(data:any){
  const candidate=data?.candidates?.[0]||{};
  const meta=candidate?.groundingMetadata||candidate?.grounding_metadata||{};
  const values=meta?.webSearchQueries||meta?.web_search_queries||[];
  return Array.isArray(values)?values.map((x:any)=>clean(x,300)).filter(Boolean).slice(0,6):[];
}

async function generateWithGemini(system:string,prompt:string,temperature=.3,maxOutputTokens=1400,googleSearch=false){
  if(!GEMINI_API_KEY)return null;
  for(const model of GENERAL_MODELS){
    try{
      const generationConfig:any={temperature,maxOutputTokens};
      if(!googleSearch && /^gemini-3\.(7|8)-flash$/.test(model))generationConfig.thinkingConfig={thinkingLevel:'low'};
      const payload:any={
        system_instruction:{parts:[{text:system}]},
        contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig
      };
      if(googleSearch)payload.tools=[{google_search:{}}];
      const started=Date.now();
      const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
      const r=await fetch(endpoint,{
        method:'POST',
        headers:{'content-type':'application/json','x-goog-api-key':GEMINI_API_KEY},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(18000)
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        if(googleSearch)console.error('uon-agent-google-search',model,r.status,clean(JSON.stringify(d),900));
        continue;
      }
      const answer=String(d?.candidates?.[0]?.content?.parts?.filter((x:any)=>!x?.thought).map((x:any)=>x?.text||'').join('')||'').trim().slice(0,6500);
      if(answer)return {
        answer,
        model,
        modelVersion:clean(d?.modelVersion,120)||model,
        links:googleSearch?groundingLinks(d):[],
        search_queries:googleSearch?searchQueriesFrom(d):[],
        used_search:googleSearch&&groundingLinks(d).length>0,
        ms:Date.now()-started
      };
    }catch{}
  }
  return null;
}

async function liveWebAnswer(question:string,language:string,internalRows:any[]=[],kind='university'){
  const internal=internalRows.slice(0,6).map((r:any,i:number)=>{
    const title=clean(r.title||r.full_name||r.code,220);
    const desc=clean(r.description||[r.job_title,r.department,r.college,r.email,r.phone,r.office_location].filter(Boolean).join(' • '),1200);
    const url=clean(r.url||r.source_url,900);
    return '[UON-HUB '+(i+1)+'] '+title+'\n'+desc+'\nURL: '+url;
  }).join('\n\n');
  const university=kind==='university';
  const system=language==='en'
    ? (university
      ? 'You are UON Agent. Answer University of Nizwa questions using live Google Search plus any supplied UON Hub context. Search the official University of Nizwa website (unizwa.edu.om) first and prefer it over third-party sources. Use other credible web sources only when the official site is insufficient. For current leadership, dates, fees, contacts, policies, and services, verify with live sources before answering. Never invent a missing fact. Do not print raw URLs in the answer because source cards are shown separately.'
      : 'You are UON Agent, a capable general assistant. Use live Google Search when it helps answer factual or current questions. Prefer primary and authoritative sources. Answer naturally and do not invent facts. Do not print raw URLs because source cards are shown separately.')
    : (university
      ? 'أنت UON Agent. جاوب أسئلة جامعة نزوى باستخدام بحث Google الحي مع سياق UON Hub المتاح. ابحث أولًا في الموقع الرسمي لجامعة نزوى unizwa.edu.om وفضّله على أي مصدر خارجي، واستخدم مصادر ويب موثوقة أخرى فقط إذا الموقع الرسمي ما كفى. المعلومات المتغيرة مثل رئيس الجامعة والإدارة والمواعيد والرسوم والتواصل والسياسات والخدمات لازم تتحقق منها من مصدر حي قبل الجواب. لا تخمن أي معلومة ناقصة. رد بعربي عماني طبيعي وخفيف، ولا تطبع الروابط داخل نص الرد لأن بطاقات المصادر تظهر بشكل منفصل.'
      : 'أنت UON Agent، مساعد ذكي عام. استخدم بحث Google الحي إذا كان يفيد في سؤال واقعي أو حديث، وفضّل المصادر الأصلية والموثوقة. رد بعربي عماني طبيعي إذا المستخدم عامي، ولا تخمن معلومات غير مؤكدة. لا تطبع الروابط داخل نص الرد لأن المصادر تظهر بشكل منفصل.');
  const prompt=(internal?'UON HUB CONTEXT (may help, but live official sources take priority for changing facts):\n'+internal+'\n\n':'')+'USER QUESTION:\n'+question;
  return generateWithGemini(system,prompt,.16,1200,true);
}

async function generalChat(body:any,question:string,language:string){
  const history=(Array.isArray(body?.history)?body.history:[]).slice(-10)
    .filter((x:any)=>['user','assistant'].includes(x?.role)&&clean(x?.content,1800))
    .map((x:any)=>({role:x.role,content:clean(x.content,1800)}));
  const system=language==='en'
    ? 'You are UON Agent, a capable general-purpose assistant for UON Hub students. Answer naturally and directly. You can help with study, coding, writing, translation, brainstorming, explanations, and normal conversation. Do not invent current University of Nizwa facts; those are handled by verified tools. If something needs live/current data you do not have, say so plainly. Follow the user language and tone.'
    : 'أنت UON Agent، مساعد ذكي عام لطلبة UON Hub. رد بعربي عماني طبيعي وخفيف إذا المستخدم يتكلم عامي عماني، بدون تصنع أو مبالغة في اللهجة. افهم كلمات مثل: ويش، أبا، واجد، زين، تو، حيك، من صوب. فضّل تعابير عمانية طبيعية مثل «ويش»، «زين»، «حاضرين»، «ما حصلت»، «ما قدرت» عند مناسبتها، وتجنب التعابير السعودية المصطنعة مثل «أبشر» و«يا الغالي». في الواجبات والرسائل والشرح الأكاديمي استخدم أسلوبًا واضحًا ومناسبًا للمهمة، والفصحى إذا كانت أنسب. تقدر تساعد في الدراسة والبرمجة والكتابة والترجمة والأفكار والأسئلة العامة والسوالف العادية. لا تخترع معلومات حالية خاصة بجامعة نزوى؛ المعلومات الجامعية الدقيقة لها أدوات موثوقة منفصلة. إذا السؤال يحتاج معلومة حية أو حديثة وما عندك مصدر مباشر، وضّح هذا باختصار.';
  const prompt=`CONVERSATION (for continuity only):\n${JSON.stringify(history)}\n\nUSER:\n${question}`;
  const q=norm(question);
  const likelyWriting=/اكتب|اكتبلي|صيغ|صياغ|ترجم|لخص|لخّص|rewrite|write|translate|summari[sz]e/.test(q);
  const likelyStudy=/اشرح|فهمني|حل لي|حللي|كود|برمج|sql|ram|ssd|رياضيات|فيزياء|كيمياء|explain|solve|code/.test(q);
  const g=await generateWithGemini(system,prompt,.35,1500,!likelyWriting&&!likelyStudy);
  if(!g)return null;
  return {answer:g.answer,links:g.links||[],actions:[],grounded:Boolean(g.used_search),confidence:g.used_search?.9:.72,sources_count:(g.links||[]).length,used_model:true,ai_provider:'google_gemini',ai_model:g.model,ai_model_version:g.modelVersion,web_search_queries:g.search_queries||[]};
}

async function groundedUniversityAnswer(question:string,rows:any[],language:string){
  if(!rows.length)return null;
  const context=rows.slice(0,6).map((r:any,i:number)=>`[${i+1}] ${clean(r.title,220)}\n${clean(r.description,1200)}\nOfficial: ${r.official?'yes':'no'}\nURL: ${clean(r.url,900)}`).join('\n\n');
  const system=language==='en'
    ? 'Answer the University of Nizwa question using ONLY the verified context provided. If the exact requested fact is not present, say you could not verify the exact answer instead of guessing. Be concise and useful.'
    : 'جاوب سؤال الطالب عن جامعة نزوى اعتمادًا فقط على السياق الموثوق المرفق. لا تخمن ولا تكمل معلومة ناقصة من عندك. إذا المطلوب الدقيق غير موجود في السياق، قل بشكل واضح وبلهجة عمانية طبيعية إنك ما قدرت تتأكد من المعلومة الدقيقة، ووجّه للمصدر المتاح. لا تطبع الروابط داخل نص الإجابة لأن الروابط تُعرض للمستخدم بشكل منفصل. لا تسرد نتائج البحث كقائمة إلا إذا السؤال يطلب قائمة.';
  const g=await generateWithGemini(system,`VERIFIED CONTEXT:\n${context}\n\nQUESTION:\n${question}`,.12,900);
  return g?{answer:g.answer,model:g.model,modelVersion:g.modelVersion}:null;
}

function formatResult(result:any,question:string,language:string){
  const en=language==='en';
  const rows=result.rows||[];
  let answer='',links:any[]=[],actions:any[]=[];
  if(result.kind==='staff'){
    if(!rows.length) answer=en?'I could not find a verified match in the current staff directory. Try the full name or department.':'ما حصلت تطابقًا مؤكدًا في دليل الموظفين الحالي. جرّب الاسم الكامل أو اسم القسم.';
    else if(rows.length>1 && rows[0]._score===rows[1]._score) answer=(en?'I found these possible matches:\n':'حصلت أكثر من تطابق محتمل:\n')+rows.slice(0,5).map((r:any,i:number)=>`${i+1}. ${r.full_name}${r.department?' — '+r.department:''}`).join('\n');
    else{
      const r=rows[0],parts=[r.full_name,r.job_title,r.department,r.college,r.email?((en?'Email: ':'البريد: ')+r.email):'',r.phone?((en?'Phone: ':'الهاتف: ')+r.phone):'',r.extension?((en?'Ext: ':'التحويلة: ')+r.extension):'',r.office_location?((en?'Office: ':'المكتب: ')+r.office_location):''].filter(Boolean);
      answer=parts.join('\n'); links=uniqueLinks([link(r.full_name,r.source_url,true,'staff')]);
    }
  }else if(result.kind==='course'){
    if(!rows.length) answer=en?'I could not find a verified approved course match.':'ما حصلت مادة معتمدة مطابقة بشكل مؤكد.';
    else{
      const r=rows[0]; answer=[`${r.code} — ${en?(r.name_en||r.name_ar):(r.name_ar||r.name_en)}`,r.credit_hours?((en?'Credit hours: ':'الساعات المعتمدة: ')+r.credit_hours):'',r.requirement_type?((en?'Requirement: ':'نوع المتطلب: ')+r.requirement_type):'',(en?(r.department_en||r.department_ar):(r.department_ar||r.department_en))||'',clean(r.description,500)].filter(Boolean).join('\n');
      links=uniqueLinks([link(r.code,r.source_url,true,'course')]);
    }
  }else if(result.kind==='calendar'){
    if(!rows.length) answer=en?'No matching active calendar event was found.':'ما حصلت حدثًا مطابقًا في التقويم الأكاديمي النشط.';
    else answer=rows.map((r:any,i:number)=>`${i+1}. ${r.title} — ${r.start_date}${r.end_date&&r.end_date!==r.start_date?' إلى '+r.end_date:''}${r.description?'\n   '+clean(r.description,260):''}`).join('\n');
  }else if(result.kind==='support'){
    if(!rows.length)answer=en?'No active support center matched.':'ما حصلت مركز دعم نشط مطابق.';
    else{
      const r=rows[0]; answer=`${r.name}\n${clean(r.description,650)}`;
      links=uniqueLinks([link(en?'Booking':'الحجز',r.booking_url,false,'booking'),link(en?'Location':'الموقع',r.location_url,false,'location')]);
      if(r.booking_url)actions.push({type:'open_url',label:en?'Book an appointment':'احجز موعد',url:r.booking_url,requires_confirmation:false});
    }
  }else if(result.kind==='campus'){
    if(rows.length){answer=rows.map((r:any,i:number)=>`${i+1}. ${r.name_ar||r.name_en}${r.building_code?' — '+r.building_code:''}`).join('\n');links=uniqueLinks(rows.map((r:any)=>link(r.name_ar||r.name_en,r.source_url,true,'campus')));}
    else if(result.context?.length){answer=result.context.slice(0,4).map((r:any,i:number)=>`${i+1}. ${r.title}\n${clean(r.description,360)}`).join('\n');links=uniqueLinks(result.context.map((r:any)=>link(r.title,r.url,Boolean(r.official),'source')));}
    else answer=en?'I could not verify that location from the current campus data.':'ما قدرت أتحقق من الموقع من بيانات الحرم الحالية.';
  }else if(result.kind==='schedule'){
    if(result.reason==='missing_session'||result.reason==='not_saved'){answer=en?'I do not have a saved schedule for this browser yet. Open the schedule tool and save your schedule first.':'ما عندي جدول محفوظ لهذا المتصفح إلى الآن. افتح أداة الجدول واحفظ جدولك أول.';actions.push({type:'navigate',label:en?'Open schedule':'افتح الجدول',url:'/schedule.html',requires_confirmation:false});}
    else if(!rows.length)answer=en?'You have no classes today in the saved schedule.':'حسب الجدول المحفوظ، ما عندك محاضرات اليوم 🎉';
    else answer=(en?'Today:\n':'محاضراتك اليوم:\n')+rows.map((r:any,i:number)=>`${i+1}. ${r.course_code}${r.course_name?' — '+r.course_name:''} | ${r.start}${r.end?'–'+r.end:''}${r.room?' | '+r.room:''}`).join('\n');
  }else{
    if(rows.length){answer=rows.slice(0,5).map((r:any,i:number)=>`${i+1}. ${r.title}\n${clean(r.description,420)}`).join('\n');links=uniqueLinks(rows.map((r:any)=>link(r.title,r.url,Boolean(r.official),'source')));}
  }
  return {answer,links,actions};
}
async function fallback(req:Request,body:any){
  const started=Date.now();
  const r=await fetch(BASE_AI,{method:'POST',headers:{'content-type':'application/json',Origin:requestOrigin(req)||'https://uonhub.space',Authorization:`Bearer ${SERVICE_ROLE_KEY}`,apikey:SERVICE_ROLE_KEY},body:JSON.stringify({...body,channel:['web','instagram','whatsapp','telegram'].includes(body?.channel)?body.channel:'web'}),signal:AbortSignal.timeout(18000)});
  const data=await r.json().catch(()=>({}));
  return {data,trace:tool('uon_ai_fallback',started,data?.answer?1:0,r.ok?'ok':'error'),ok:r.ok};
}

Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  const origin=requestOrigin(req); if(origin===null)return reply(req,{error:'origin_not_allowed'},403);
  if(req.method!=='POST')return reply(req,{error:'method_not_allowed'},405);
  try{
    const body=await req.json().catch(()=>({}));
    const question=clean(body?.question,800);
    if(!question)return reply(req,{error:'question_required'},400);
    const rate=await enforceRate(req,body); if(!rate.allowed)return reply(req,{error:'rate_limited',retry_after:rate.retry_after},429);
    const language=body?.language==='en'?'en':'ar';
    const casual=casualReply(question,language);
    if(casual){
      const request_id=await persistDirect(body,question,casual).catch(()=>null);
      return reply(req,{answer:casual,links:[],actions:[],request_id:request_id||undefined,agent:true,agent_version:'1.5.0',intent:'chat',tool_trace:[],grounded:false,confidence:0.99});
    }
    const effectiveQuestion=contextualQuestion(body,question);
    const selected=route(effectiveQuestion);
    console.log('uon-agent-route',JSON.stringify({question,effectiveQuestion,normalized:norm(effectiveQuestion),selected}));

    if(selected==='chat'){
      const g=await generalChat(body,question,language);
      if(g?.answer){
        const request_id=await persistDirect(body,question,g.answer).catch(()=>null);
        return reply(req,{...g,request_id:request_id||undefined,agent:true,agent_version:'1.5.0',intent:'chat',tool_trace:[{name:'general_chat',status:'ok',count:1,ms:0}]});
      }
      const fb=await fallback(req,{...body,question});
      if(fb.ok&&fb.data?.answer)return reply(req,{...fb.data,agent:true,agent_version:'1.5.0',intent:'chat',tool_trace:[fb.trace],fallback:true});
      return reply(req,{answer:language==='en'?'I could not reply just now. Try again in a moment.':'ما قدرت أرد عليك الحين، جرّب مرة ثانية بعد شوي 🙏',links:[],actions:[],agent:true,agent_version:'1.5.0',intent:'chat',tool_trace:[fb.trace],grounded:false,confidence:0.3});
    }

    let result:any;
    if(selected==='staff')result=await staffTool(effectiveQuestion);
    else if(selected==='course')result=await courseTool(effectiveQuestion);
    else if(selected==='calendar')result=await calendarTool(effectiveQuestion);
    else if(selected==='support')result=await supportTool(effectiveQuestion);
    else if(selected==='campus')result=await campusTool(effectiveQuestion);
    else if(selected==='schedule')result=await scheduleTool(body);
    else result=await searchTool(effectiveQuestion);

    const hasRows=Array.isArray(result?.rows)&&result.rows.length>0;
    const hasContext=Array.isArray(result?.context)&&result.context.length>0;
    if(!hasRows&&!hasContext&&['staff','course','calendar','campus','search'].includes(selected)){
      const web=await liveWebAnswer(effectiveQuestion,language,[],universitySignal(effectiveQuestion)?'university':'general');
      if(web?.answer){
        const request_id=await persistDirect(body,question,web.answer).catch(()=>null);
        return reply(req,{answer:web.answer,links:web.links||[],actions:[],request_id:request_id||undefined,agent:true,agent_version:'1.5.0',intent:selected,resolved_question:effectiveQuestion!==question?effectiveQuestion:undefined,tool_trace:[result.trace,{name:'google_search',status:web.used_search?'ok':'no_results',count:(web.links||[]).length,ms:web.ms||0}],grounded:Boolean(web.used_search),confidence:web.used_search?.93:.68,sources_count:(web.links||[]).length,used_model:true,ai_provider:'google_gemini',ai_model:web.model,ai_model_version:web.modelVersion,web_search_queries:web.search_queries||[]});
      }
      const fb=await fallback(req,{...body,question:effectiveQuestion});
      if(fb.ok&&fb.data?.answer)return reply(req,{...fb.data,agent:true,agent_version:'1.5.0',intent:selected,resolved_question:effectiveQuestion!==question?effectiveQuestion:undefined,tool_trace:[result.trace,fb.trace],fallback:true});
    }

    if(selected==='search'&&hasRows){
      const web=await liveWebAnswer(effectiveQuestion,language,result.rows,'university');
      if(web?.answer){
        const internalLinks=result.rows.map((r:any)=>link(r.title,r.url,Boolean(r.official),r.type||'UON Hub'));
        const links=uniqueLinks([...(web.links||[]),...internalLinks]).sort((a:any,b:any)=>Number(Boolean(b.official))-Number(Boolean(a.official))).slice(0,5);
        const request_id=await persistDirect(body,question,web.answer).catch(()=>null);
        return reply(req,{answer:web.answer,links,actions:[],request_id:request_id||undefined,agent:true,agent_version:'1.5.0',intent:'search',tool_trace:[result.trace,{name:'google_search',status:web.used_search?'ok':'no_results',count:(web.links||[]).length,ms:web.ms||0}],grounded:Boolean(web.used_search||result.rows.length),confidence:web.used_search?.96:.88,sources_count:links.length,used_model:true,ai_provider:'google_gemini',ai_model:web.model,ai_model_version:web.modelVersion,web_search_queries:web.search_queries||[]});
      }
      const synthesis=await groundedUniversityAnswer(question,result.rows,language);
      if(synthesis?.answer){
        const links=uniqueLinks(result.rows.map((r:any)=>link(r.title,r.url,Boolean(r.official),r.type||'source')));
        const request_id=await persistDirect(body,question,synthesis.answer).catch(()=>null);
        return reply(req,{answer:synthesis.answer,links,actions:[],request_id:request_id||undefined,agent:true,agent_version:'1.5.0',intent:'search',tool_trace:[result.trace,{name:'grounded_synthesis',status:'ok',count:result.rows.length,ms:0}],grounded:true,confidence:.9,sources_count:result.rows.length,used_model:true,ai_provider:'google_gemini',ai_model:synthesis.model,ai_model_version:synthesis.modelVersion});
      }
    }

    const formatted=formatResult(result,question,language);
    if(formatted.answer){
      const request_id=await persistDirect(body,question,formatted.answer).catch(()=>null);
      return reply(req,{...formatted,request_id:request_id||undefined,agent:true,agent_version:'1.5.0',intent:selected,resolved_question:effectiveQuestion!==question?effectiveQuestion:undefined,tool_trace:[result.trace],grounded:true,confidence:result.rows?.length?0.94:0.72});
    }
    const fb=await fallback(req,body);
    if(fb.ok&&fb.data?.answer)return reply(req,{...fb.data,agent:true,agent_version:'1.5.0',intent:selected,tool_trace:[result.trace,fb.trace],fallback:true});
    return reply(req,{answer:language==='en'?'I could not verify an answer right now. Try a more specific question.':'ما قدرت أتحقق من إجابة دقيقة حاليًا. جرّب سؤال أكثر تحديدًا.',links:[],actions:[],agent:true,agent_version:'1.5.0',intent:selected,tool_trace:[result.trace,fb.trace],grounded:false,confidence:0.35});
  }catch(e){
    console.error('uon-agent-v1',e);
    return reply(req,{error:'agent_unavailable'},500);
  }
});
