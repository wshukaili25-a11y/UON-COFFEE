import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'https://uonhub.space';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const REASONS = new Set(['incorrect','broken_link','duplicate','inappropriate','privacy','other']);
const REASON_LABELS: Record<string,string> = {
  incorrect: 'معلومة خاطئة', broken_link: 'رابط لا يعمل', duplicate: 'محتوى مكرر',
  inappropriate: 'محتوى غير مناسب', privacy: 'بيانات شخصية', other: 'أخرى',
};
const ALLOWED_ORIGINS = new Set(['https://uonhub.space','https://www.uonhub.space','https://uon-hub.vercel.app']);

function originAllowed(origin: string) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host.endsWith('.vercel.app') && (host.startsWith('uon-') || host.includes('uon-hub'));
  } catch { return false; }
}
function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': originAllowed(origin) ? origin : 'https://uonhub.space',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8' } });
}
function clean(value: unknown, max: number) { return String(value ?? '').trim().slice(0, max); }
function safePageUrl(value: unknown, origin: string) {
  const raw = clean(value, 1500);
  const u = new URL(raw);
  if (!['http:','https:'].includes(u.protocol)) throw new Error('invalid_page_url');
  if (originAllowed(origin) && u.origin !== origin) throw new Error('page_origin_mismatch');
  return u.toString();
}
async function sendTelegram(chatId: string, text: string, pageUrl: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text,
      reply_markup: { inline_keyboard: [
        [{ text: '🔗 فتح الصفحة', url: pageUrl }],
        [{ text: '🛡 فتح لوحة البلاغات', url: `${SITE_URL}/admin.html#content-reports` }],
      ] },
    }),
    signal: AbortSignal.timeout(6000),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);
  const origin = req.headers.get('origin') || '';
  if (!originAllowed(origin)) return reply(req, { ok: false, error: 'origin_not_allowed' }, 403);
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.dry_run === true) return reply(req, { ok: true, dry_run: true });
    const reason = clean(body.reason, 40);
    const details = clean(body.details, 1200);
    const contentTitle = clean(body.content_title, 180) || null;
    const pageTitle = clean(body.page_title, 220) || null;
    if (!REASONS.has(reason)) throw new Error('invalid_reason');
    if (details.length < 5) throw new Error('details_too_short');
    const pageUrl = safePageUrl(body.page_url, origin);

    const { data: row, error } = await db.from('content_reports').insert({
      reason, content_title: contentTitle, details, page_url: pageUrl,
      page_title: pageTitle, status: 'pending',
    }).select('id,created_at').single();
    if (error) throw error;

    const { data: admins } = await db.from('telegram_admins')
      .select('chat_id').eq('active', true).eq('notifications_enabled', true);
    const message = `🚨 بلاغ محتوى جديد\n\nالسبب: ${REASON_LABELS[reason]}\nالعنوان: ${contentTitle || pageTitle || 'بدون عنوان'}\nالتفاصيل: ${details}\nالصفحة: ${pageUrl}`;
    let sent = 0;
    for (const admin of admins || []) {
      if (await sendTelegram(String(admin.chat_id), message, pageUrl).catch(() => false)) sent++;
    }
    return reply(req, { ok: true, id: row.id, sent });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    const status = /invalid|too_short|mismatch/i.test(message) ? 400 : 500;
    return reply(req, { ok: false, error: message }, status);
  }
});
