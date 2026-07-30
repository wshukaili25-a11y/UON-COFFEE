import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Map([
  ['pdf', 'application/pdf'],
  ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['ppt', 'application/vnd.ms-powerpoint'],
  ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['txt', 'text/plain'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
]);
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
    Vary: 'Origin',
  };
}

function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

async function authorized(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (bearer && bearer === SERVICE_ROLE_KEY) return true;
  const password = req.headers.get('x-admin-password') || '';
  if (!password) return false;
  const { data, error } = await db.rpc('uon_admin_authorized', { p_password: password });
  return !error && data === true;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function telegramFile(fileId: string) {
  const metadataResponse = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  const metadata = await metadataResponse.json();
  if (!metadataResponse.ok || !metadata.ok || !metadata.result?.file_path) {
    throw new Error(metadata.description || 'تعذر قراءة ملف Telegram');
  }

  const declaredSize = Number(metadata.result.file_size || 0);
  if (declaredSize > MAX_FILE_BYTES) throw new Error('حجم الملف يتجاوز 20 MB');

  const filePath = String(metadata.result.file_path);
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('نوع الملف غير مسموح');

  const downloadResponse = await fetch(
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!downloadResponse.ok) throw new Error('تعذر تنزيل ملف Telegram');

  const contentLength = Number(downloadResponse.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_BYTES) throw new Error('حجم الملف يتجاوز 20 MB');
  const bytes = new Uint8Array(await downloadResponse.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error('حجم الملف غير صالح');
  }

  const responseType = (downloadResponse.headers.get('content-type') || '').split(';')[0];
  const expectedType = ALLOWED_EXTENSIONS.get(extension)!;
  if (
    responseType &&
    responseType !== 'application/octet-stream' &&
    responseType !== expectedType
  ) throw new Error('نوع محتوى الملف لا يطابق امتداده');
  const mimeType = expectedType;

  return { bytes, extension, mimeType, filePath };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);
  if (!(await authorized(req))) return reply(req, { ok: false, error: 'unauthorized' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const college = String(body.college || '').trim();
    const subject = String(body.subject || 'استيراد Telegram').trim().slice(0, 180);
    const courseCode = String(body.course_code || '').trim().slice(0, 40) || null;
    const requestedBy = String(body.requested_by || 'admin-panel').slice(0, 120);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!COLLEGES.has(college)) return reply(req, { ok: false, error: 'college is invalid' }, 400);
    if (!items.length || items.length > 100) {
      return reply(req, { ok: false, error: 'items must contain 1 to 100 files' }, 400);
    }

    let imported = 0;
    let skipped = 0;
    let totalBytes = 0;
    const results: unknown[] = [];

    for (const [index, item] of items.entries()) {
      let storagePath = '';
      let summaryId = '';
      let trackingId = '';
      try {
        if (item?.url) throw new Error('External URLs are not accepted; provide file_id');
        const fileId = String(item?.file_id || '').trim();
        if (!/^[A-Za-z0-9_-]{10,512}$/.test(fileId)) throw new Error('file_id is invalid');

        const fileIdHash = await sha256(fileId);
        const { data: existing, error: existingError } = await db
          .from('telegram_import_items')
          .select('id,status,summary_id')
          .eq('file_id_hash', fileIdHash)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing && existing.status !== 'failed') {
          skipped++;
          results.push({ ok: true, skipped: true, reason: 'duplicate', summary_id: existing.summary_id });
          continue;
        }

        if (existing) {
          trackingId = existing.id;
          const { error } = await db
            .from('telegram_import_items')
            .update({ status: 'processing', error: null, updated_at: new Date().toISOString() })
            .eq('id', trackingId);
          if (error) throw error;
        } else {
          const { data: tracking, error } = await db
            .from('telegram_import_items')
            .insert({
              file_id_hash: fileIdHash,
              status: 'processing',
              requested_by: requestedBy,
            })
            .select('id')
            .single();
          if (error) {
            if (error.code === '23505') {
              skipped++;
              results.push({ ok: true, skipped: true, reason: 'duplicate' });
              continue;
            }
            throw error;
          }
          trackingId = tracking.id;
        }

        const file = await telegramFile(fileId);
        totalBytes += file.bytes.byteLength;
        if (totalBytes > MAX_REQUEST_BYTES) throw new Error('إجمالي حجم الطلب يتجاوز 100 MB');

        const date = new Date();
        storagePath = [
          'telegram',
          String(date.getUTCFullYear()),
          String(date.getUTCMonth() + 1).padStart(2, '0'),
          `${crypto.randomUUID()}.${file.extension}`,
        ].join('/');

        const { error: uploadError } = await db.storage
          .from('summaries')
          .upload(storagePath, file.bytes, {
            contentType: file.mimeType,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = db.storage.from('summaries').getPublicUrl(storagePath);
        const url = publicUrl.publicUrl;
        if (!url?.startsWith(`${SUPABASE_URL}/storage/v1/object/public/summaries/`)) {
          throw new Error('تعذر إنشاء رابط Storage آمن');
        }

        const fallbackName = file.filePath.split('/').pop() || `Telegram file ${index + 1}`;
        const title = String(item?.title || item?.file_name || fallbackName).trim().slice(0, 180);
        const { data: summary, error: summaryError } = await db
          .from('summaries')
          .insert({
            title: title || fallbackName,
            subject,
            college,
            course_code: String(item?.course_code || courseCode || '').slice(0, 40) || null,
            url,
            link: url,
            pdf_url: file.extension === 'pdf' ? url : null,
            description: String(
              item?.description || 'تم استيراده جماعيًا من Telegram — بانتظار موافقة المشرف',
            ).slice(0, 1000),
            approved: false,
            resource_type: 'file',
            content_type: ['summary', 'exam'].includes(String(item?.content_type))
              ? String(item.content_type)
              : 'summary',
          })
          .select('id')
          .single();
        if (summaryError) throw summaryError;
        summaryId = summary.id;

        const { error: trackingError } = await db
          .from('telegram_import_items')
          .update({
            summary_id: summary.id,
            storage_path: storagePath,
            file_name: title || fallbackName,
            mime_type: file.mimeType,
            size_bytes: file.bytes.byteLength,
            status: 'pending',
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', trackingId);
        if (trackingError) throw trackingError;

        imported++;
        results.push({
          ok: true,
          summary_id: summary.id,
          title: title || fallbackName,
          size_bytes: file.bytes.byteLength,
        });
      } catch (error) {
        if (summaryId) await db.from('summaries').delete().eq('id', summaryId);
        if (storagePath) await db.storage.from('summaries').remove([storagePath]);
        const message = String((error as Error)?.message || error);
        if (trackingId) {
          await db
            .from('telegram_import_items')
            .update({ status: 'failed', error: message.slice(0, 1000), updated_at: new Date().toISOString() })
            .eq('id', trackingId);
        }
        skipped++;
        results.push({ ok: false, title: String(item?.title || item?.file_name || ''), error: message });
      }
    }

    return reply(req, { ok: true, imported, skipped, results });
  } catch (error) {
    return reply(req, { ok: false, error: String((error as Error)?.message || error) }, 500);
  }
});
