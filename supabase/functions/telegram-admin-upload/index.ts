import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES + 512 * 1024;
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;
const recentUploads: number[] = [];
const COLLEGES = new Set([
  'كلية العلوم والآداب',
  'كلية الاقتصاد والإدارة ونظم المعلومات',
  'كلية الهندسة والعمارة',
  'كلية العلوم الصحية',
]);

function allowedOrigin(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (origin === 'https://uonhub.space' || origin === 'https://www.uonhub.space') return origin;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith('.vercel.app') && (host.startsWith('uon-') || host.startsWith('uon-hub-'))) {
      return origin;
    }
  } catch {
    // Non-browser clients are authenticated separately.
  }
  return 'https://uonhub.space';
}

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(req),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-admin-password',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function authorized(req: Request) {
  const password = req.headers.get('x-admin-password') || '';
  if (!password) return false;
  const { data, error } = await db.rpc('uon_admin_authorized', { p_password: password });
  return !error && data === true;
}

function assertRateLimit() {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  while (recentUploads.length && recentUploads[0] < cutoff) recentUploads.shift();
  if (recentUploads.length >= RATE_LIMIT) throw new Error('RATE_LIMITED');
  recentUploads.push(Date.now());
}

async function sendPdfToTelegram(chatId: string, file: File) {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('disable_notification', 'true');
  form.set('caption', 'UON Hub V30 — ملف اختبار استيراد إداري');
  form.set('document', file, file.name);

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
    {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    },
  );
  const telegramPayload = await telegramResponse.json().catch(() => ({}));
  if (!telegramResponse.ok || !telegramPayload?.ok || !telegramPayload?.result?.document?.file_id) {
    throw new Error('TELEGRAM_UPLOAD_FAILED');
  }
  return {
    fileId: String(telegramPayload.result.document.file_id),
    messageId: Number(telegramPayload.result.message_id || 0),
  };
}

async function deleteTelegramMessage(chatId: string, messageId: number) {
  if (!messageId) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!(await authorized(req))) return reply(req, { ok: false, error: 'UNAUTHORIZED' }, 401);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return reply(req, { ok: false, error: 'FILE_TOO_LARGE' }, 413);
  }

  let chatId = '';
  let messageId = 0;
  try {
    assertRateLimit();
    const form = await req.formData();
    const file = form.get('file');
    const college = String(form.get('college') || '').trim();
    const subject = String(form.get('subject') || 'ملف اختبار Telegram V30').trim().slice(0, 180);
    const title = String(form.get('title') || '').trim().slice(0, 180);

    if (!(file instanceof File) || file.size < 1) throw new Error('PDF_FILE_REQUIRED');
    if (file.size > MAX_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
    if (!COLLEGES.has(college)) throw new Error('INVALID_COLLEGE');
    if (!/\.pdf$/i.test(file.name) || file.type !== 'application/pdf') {
      throw new Error('INVALID_PDF_TYPE');
    }
    const magic = new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer()));
    if (magic !== '%PDF-') throw new Error('INVALID_PDF_CONTENT');

    const { data: admins, error: adminsError } = await db
      .from('telegram_admins')
      .select('chat_id,role')
      .eq('active', true)
      .limit(25);
    if (adminsError) throw new Error('TELEGRAM_ADMIN_LOOKUP_FAILED');
    const admin = admins?.find((item) => item.role === 'owner') || admins?.[0];
    chatId = String(admin?.chat_id || '');
    if (!chatId) throw new Error('NO_ACTIVE_TELEGRAM_ADMIN');

    const telegramUpload = await sendPdfToTelegram(chatId, file);
    messageId = telegramUpload.messageId;

    const bulkResponse = await fetch(`${SUPABASE_URL}/functions/v1/telegram-bulk-import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        college,
        subject,
        requested_by: 'admin-panel-v30-upload',
        content_type: 'summary',
        items: [{
          file_id: telegramUpload.fileId,
          file_name: file.name,
          title: title || file.name,
          description: 'ملف PDF حقيقي مستورد عبر Telegram Admin — بانتظار موافقة المشرف',
        }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const bulkPayload = await bulkResponse.json().catch(() => ({}));
    const importedItem = bulkPayload?.results?.find((item: any) => item?.ok && !item?.skipped);
    if (!bulkResponse.ok || !bulkPayload?.ok || Number(bulkPayload?.imported || 0) !== 1 || !importedItem) {
      throw new Error('TELEGRAM_IMPORT_FAILED');
    }

    await deleteTelegramMessage(chatId, messageId);
    return reply(req, {
      ok: true,
      imported: 1,
      summary_id: importedItem.summary_id,
      status: 'pending',
      title: importedItem.title,
      size_bytes: importedItem.size_bytes,
    });
  } catch (error) {
    await deleteTelegramMessage(chatId, messageId);
    const message = String((error as Error)?.message || error);
    const status = message === 'UNAUTHORIZED'
      ? 401
      : message === 'FILE_TOO_LARGE'
      ? 413
      : /PDF_|INVALID_PDF/.test(message)
      ? 415
      : message === 'RATE_LIMITED'
      ? 429
      : /INVALID_COLLEGE/.test(message)
      ? 400
      : 502;
    return reply(req, { ok: false, error: message }, status);
  }
});
