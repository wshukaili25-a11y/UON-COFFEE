import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const allowedOrigins = new Set(['https://uonhub.space','https://www.uonhub.space']);
const headers = (origin='https://uonhub.space') => ({
  'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://uonhub.space',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
});
const json = (req: Request, body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: headers(req.headers.get('origin')||'') });
const clean = (v: unknown, max=1200) => String(v??'').replace(/\s+/g,' ').trim().slice(0,max);

function fallback(text: string) {
  const normalized = text.toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
  const categories: string[] = [];
  if (/(اقتل|بقتلك|بذبح|تهديد|انتحر|ينتحر|اقتلك|اذبحك)/.test(normalized)) categories.push('threat');
  if (/(حقير|كلب|حمار|غبي|وسخ|قذر|لعنه|تفو|سب|شتم)/.test(normalized)) categories.push('abuse');
  if (/(رقمها|رقمه|هاتفه|هاتفها|سنابه|انستاها|انستاه|اسمها الكامل|اسمه الكامل)/.test(normalized)) categories.push('personal_data');
  return { abusive: categories.length>0, severity: categories.includes('threat') ? 'high' : categories.length ? 'medium' : 'low', categories, confidence: categories.length ? 0.74 : 0.45, reason: categories.length ? 'fallback_rules' : 'no_signal' };
}

async function classify(text: string) {
  if (!GEMINI_API_KEY) return fallback(text);
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
      method:'POST',
      headers:{'x-goog-api-key':GEMINI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        system_instruction:{parts:[{text:'Classify an Arabic student confession for safety moderation. Return JSON only with abusive boolean, severity low|medium|high, categories array chosen from abuse, bullying, threat, harassment, hate, sexual, personal_data, self_harm, spam, and a brief Arabic reason. Do not block ordinary criticism, jokes, sadness, or romantic content unless targeted abuse or danger is present.'}]},
        contents:[{role:'user',parts:[{text:text.slice(0,1000)}]}],
        generationConfig:{temperature:0,maxOutputTokens:220,responseMimeType:'application/json'}
      })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(raw);
    const data = JSON.parse(raw);
    const output = data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('') || '{}';
    const parsed = JSON.parse(output);
    return {
      abusive:Boolean(parsed.abusive),
      severity:['low','medium','high'].includes(parsed.severity)?parsed.severity:'low',
      categories:Array.isArray(parsed.categories)?parsed.categories.map((x:any)=>clean(x,40)).slice(0,6):[],
      confidence:0.92,
      reason:clean(parsed.reason,300)
    };
  } catch (error) {
    console.warn('AI moderation fallback', String((error as Error)?.message||error));
    return fallback(text);
  }
}

async function sendTelegram(message: string) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  const { data: owners } = await db.from('telegram_admins').select('chat_id').eq('active',true).eq('role','owner');
  let messageId: string | null = null;
  for (const owner of owners || []) {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:owner.chat_id,text:message,disable_web_page_preview:true})
    });
    const payload = await response.json().catch(()=>({}));
    if (payload?.result?.message_id) messageId = String(payload.result.message_id);
  }
  return messageId;
}

Deno.serve(async (req: Request) => {
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:headers(req.headers.get('origin')||'')});
  if (req.method!=='POST') return json(req,{error:'method_not_allowed'},405);
  try {
    const body = await req.json().catch(()=>({}));
    const id = clean(body.confession_id,80);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(req,{error:'invalid_id'},400);
    const { data: confession, error } = await db.from('confessions').select('id,text,content,college,program,created_at').eq('id',id).maybeSingle();
    if (error) throw error;
    if (!confession) return json(req,{error:'not_found'},404);

    const { data: existing } = await db.from('ai_supervisor_reviews').select('id,alert_sent_at').eq('source_table','confessions').eq('source_id',id).maybeSingle();
    if (existing?.alert_sent_at) return json(req,{ok:true,already_alerted:true});

    const text = clean(confession.text || confession.content,1000);
    const result = await classify(text);
    const review = {
      source_table:'confessions', source_id:id, content_excerpt:text.slice(0,500),
      score:result.abusive ? (result.severity==='high'?95:75) : 15,
      recommendation:result.abusive?'alert':'allow', reasons:[result.reason],
      flags:{categories:result.categories,severity:result.severity}, status:'resolved',
      model_name:GEMINI_API_KEY?'gemini-3.1-flash-lite':'fallback-rules', confidence:result.confidence,
      reviewed_by:'ai_moderator', reviewed_by_ai_at:new Date().toISOString(), resolved_at:new Date().toISOString(), created_at:new Date().toISOString(),
      alert_category:result.categories.join(',') || null
    };
    const { data: saved, error: saveError } = await db.from('ai_supervisor_reviews').upsert(review,{onConflict:'source_table,source_id'}).select('id').single();
    if (saveError) throw saveError;

    if (!result.abusive) return json(req,{ok:true,alerted:false});
    const preview = text.length>360 ? `${text.slice(0,360)}…` : text;
    const message = `🚨 تنبيه AI Moderator\n\nتم اكتشاف اعتراف قد يحتوي محتوى مسيئًا.\n\nالخطورة: ${result.severity}\nالتصنيف: ${result.categories.join('، ')||'غير محدد'}\nالسبب: ${result.reason}\n\nالاعتراف:\n${preview}\n\nالمعرف: ${id}\nالرابط: https://uonhub.space/confessions.html`;
    const telegramMessageId = await sendTelegram(message);
    await db.from('ai_supervisor_reviews').update({alert_sent_at:new Date().toISOString(),alert_message_id:telegramMessageId}).eq('id',saved.id);
    return json(req,{ok:true,alerted:true});
  } catch (error) {
    console.error('confession-ai-alert',error);
    return json(req,{error:'moderation_failed'},500);
  }
});