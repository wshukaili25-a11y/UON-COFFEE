import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = new Set([
  'https://uonhub.space',
  'https://www.uonhub.space',
]);
const PENDING_SUMMARY_BUCKET = 'summary-submissions';
const PUBLIC_SUMMARY_BUCKET = 'summaries';

const ADMIN_TABLES = new Set([
  'academic_calendar_events',
  'admin_audit_log',
  'admin_roles',
  'backup_runs',
  'broken_link_reports',
  'bulk_upload_batches',
  'confessions',
  'content_reports',
  'course_requests',
  'courses',
  'daily_usage_analytics',
  'drive_import_items',
  'drive_import_runs',
  'dropbox_import_items',
  'dropbox_import_runs',
  'feature_suggestions',
  'notification_subscriptions',
  'platform_features',
  'rating_submissions',
  'resource_feedback',
  'restore_runs',
  'search_index',
  'site_announcements',
  'site_notifications',
  'site_settings',
  'student_projects',
  'summaries',
  'system_errors',
  'telegram_admins',
  'tools_items',
  'university_programs',
  'usage_events',
  'whatsapp_groups',
]);

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
const SELECT_EXPRESSION = /^[a-z0-9_*.,:()!]+$/i;

function requestOrigin(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  try {
    const host = new URL(origin).hostname;
    if (
      host.endsWith('.vercel.app') &&
      (host.startsWith('uon-') || host.startsWith('uon-hub-'))
    ) return origin;
  } catch {
    // Requests without a browser Origin header are allowed by authentication.
  }
  return 'https://uonhub.space';
}

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': requestOrigin(req),
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
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

async function authorized(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (bearer && bearer === SERVICE_ROLE_KEY) return true;

  const password = req.headers.get('x-admin-password') || '';
  if (!password) return false;

  const { data, error } = await db.rpc('uon_admin_authorized', {
    p_password: password,
  });
  return !error && data === true;
}

function scalar(value: string): string | number | boolean | null {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function assertIdentifier(value: string, label = 'identifier') {
  if (!IDENTIFIER.test(value)) throw new Error(`Invalid ${label}`);
}

function safeStorageName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 90);
}

async function adminRead(body: Record<string, unknown>) {
  const table = String(body.table || '');
  if (!ADMIN_TABLES.has(table)) throw new Error('Table is not available to the admin API');

  const params = new URLSearchParams(String(body.query || '').replace(/^\?/, ''));
  const select = params.get('select') || '*';
  if (!SELECT_EXPRESSION.test(select)) throw new Error('Invalid select expression');

  let query: any = db.from(table).select(select);

  for (const [column, expression] of params.entries()) {
    if (column === 'select' || column === 'order' || column === 'limit') continue;
    assertIdentifier(column, 'filter column');

    const separator = expression.indexOf('.');
    if (separator <= 0) throw new Error(`Invalid filter for ${column}`);
    const operator = expression.slice(0, separator);
    const rawValue = expression.slice(separator + 1);

    if (operator === 'in') {
      if (!rawValue.startsWith('(') || !rawValue.endsWith(')')) {
        throw new Error(`Invalid in filter for ${column}`);
      }
      const values = rawValue
        .slice(1, -1)
        .split(',')
        .filter(Boolean)
        .map(scalar);
      query = query.in(column, values);
      continue;
    }

    if (operator === 'is') {
      if (!['null', 'true', 'false'].includes(rawValue)) {
        throw new Error(`Invalid is filter for ${column}`);
      }
      query = query.is(column, scalar(rawValue));
      continue;
    }

    const allowedOperators = new Set([
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
    ]);
    if (!allowedOperators.has(operator)) throw new Error(`Unsupported filter: ${operator}`);
    query = query.filter(column, operator, scalar(rawValue));
  }

  const order = params.get('order');
  if (order) {
    for (const item of order.split(',')) {
      const [column, direction = 'asc'] = item.split('.');
      assertIdentifier(column, 'order column');
      if (!['asc', 'desc'].includes(direction)) throw new Error('Invalid order direction');
      query = query.order(column, { ascending: direction === 'asc' });
    }
  }

  const requestedLimit = Number(params.get('limit') || 1000);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new Error('Invalid limit');
  }
  query = query.limit(Math.min(requestedLimit, 5000));

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function moderateSummary(body: Record<string, unknown>) {
  const id = String(body.id || '').trim();
  const action = String(body.moderation_action || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid summary id');
  if (!['approve', 'reject', 'delete'].includes(action)) throw new Error('Invalid summary moderation action');

  const { data: row, error: readError } = await db
    .from('summaries')
    .select('id,title,course_code,original_filename,pending_storage_path,approved,url,pdf_url')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) throw new Error('Summary not found');

  const pendingPath = String(row.pending_storage_path || '').trim();
  if (pendingPath && (!pendingPath.startsWith('pending/') || pendingPath.includes('..'))) {
    throw new Error('Invalid pending storage path');
  }

  if (action !== 'approve') {
    if (pendingPath) {
      const { error: removeError } = await db.storage.from(PENDING_SUMMARY_BUCKET).remove([pendingPath]);
      if (removeError) throw removeError;
    }
    const { error: deleteError } = await db.from('summaries').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await db.from('admin_audit_log').insert({
      admin_name: 'web-admin', action: 'summary_reject', entity: 'summaries', entity_id: id,
      details: { had_private_upload: Boolean(pendingPath) },
    });
    return { id, action, removed_private_upload: Boolean(pendingPath) };
  }

  if (!pendingPath) {
    const { data, error } = await db
      .from('summaries')
      .update({ approved: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
    if (error) throw error;
    await db.from('admin_audit_log').insert({
      admin_name: 'web-admin', action: 'summary_approve_link', entity: 'summaries', entity_id: id,
      details: { source: 'external-link' },
    });
    return { id: data.id, action, promoted: false };
  }

  const { data: blob, error: downloadError } = await db.storage.from(PENDING_SUMMARY_BUCKET).download(pendingPath);
  if (downloadError || !blob) throw downloadError || new Error('Pending PDF not found');

  const filename = safeStorageName(String(row.original_filename || '')) || `${String(row.course_code || 'resource').toLowerCase()}.pdf`;
  const month = new Date().toISOString().slice(0, 7);
  const publicPath = `approved/${month}/${crypto.randomUUID()}-${filename.endsWith('.pdf') ? filename : `${filename}.pdf`}`;
  let publicUploaded = false;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Pending file is not a valid PDF');

    const { error: uploadError } = await db.storage.from(PUBLIC_SUMMARY_BUCKET).upload(publicPath, bytes, {
      contentType: 'application/pdf', upsert: false, cacheControl: '3600',
    });
    if (uploadError) throw uploadError;
    publicUploaded = true;

    const { data: publicData } = db.storage.from(PUBLIC_SUMMARY_BUCKET).getPublicUrl(publicPath);
    const publicUrl = publicData.publicUrl;
    const { error: updateError } = await db.from('summaries').update({
      approved: true,
      url: publicUrl,
      pdf_url: publicUrl,
      link: publicUrl,
      pending_storage_path: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (updateError) throw updateError;

    const { error: removeError } = await db.storage.from(PENDING_SUMMARY_BUCKET).remove([pendingPath]);
    if (removeError) console.warn('Approved summary left an orphan private object', removeError.message);

    await db.from('admin_audit_log').insert({
      admin_name: 'web-admin', action: 'summary_approve_upload', entity: 'summaries', entity_id: id,
      details: { public_path: publicPath },
    });
    return { id, action, promoted: true, public_url: publicUrl };
  } catch (error) {
    if (publicUploaded) await db.storage.from(PUBLIC_SUMMARY_BUCKET).remove([publicPath]).catch(() => {});
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === 'health') {
      const { data: state, error } = await db.rpc('uon_public_state');
      if (error) throw error;
      return reply(req, {
        ok: true,
        checks: {
          database: 'ok',
          maintenance: state?.maintenance_enabled ? 'maintenance' : 'active',
          features: Object.keys(state?.features || {}).length,
        },
      });
    }

    if (!(await authorized(req))) {
      return reply(req, { ok: false, error: 'unauthorized' }, 401);
    }

    if (body.action === 'read') {
      return reply(req, { ok: true, data: await adminRead(body) });
    }

    if (body.action === 'summary_moderate') {
      return reply(req, { ok: true, data: await moderateSummary(body) });
    }

    if (body.action === 'course_upsert') {
      const course = body.course || {};
      const code = String(course.code || '').trim().toUpperCase().replace(/\s+/g, '');
      const nameAr = String(course.name_ar || '').trim();
      if (!/^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$/.test(code)) throw new Error('Invalid course code');
      if (nameAr.length < 2) throw new Error('Course Arabic name is required');
      const payload = {
        code,
        name_ar: nameAr,
        name_en: String(course.name_en || '').trim() || null,
        college: String(course.college || '').trim() || null,
        department: String(course.department || '').trim() || null,
        credit_hours: course.credit_hours === '' || course.credit_hours == null ? null : Number(course.credit_hours),
        level: course.level === '' || course.level == null ? null : Number(course.level),
        description: String(course.description || '').trim() || null,
        learning_outcomes: String(course.learning_outcomes || '').trim() || null,
        active: course.active !== false,
        status: 'approved',
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db.from('courses').upsert(payload, { onConflict: 'code' }).select('*').single();
      if (error) throw error;
      await db.from('admin_audit_log').insert({ admin_name: 'web-admin', action: 'course_upsert', entity: 'courses', entity_id: data.id, details: payload });
      return reply(req, { ok: true, data });
    }

    if (body.action === 'course_toggle') {
      const id = String(body.id || '');
      if (!id) throw new Error('Course id is required');
      const { data, error } = await db.from('courses').update({ active: Boolean(body.active), updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      return reply(req, { ok: true, data });
    }

    if (body.action === 'course_delete') {
      const id = String(body.id || '');
      if (!id) throw new Error('Course id is required');
      const { error } = await db.from('courses').delete().eq('id', id);
      if (error) throw error;
      return reply(req, { ok: true });
    }

    if (body.action === 'course_bulk_upsert') {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
      if (!rows.length) throw new Error('No course rows supplied');
      const normalized = rows.map((course: any) => ({
        code: String(course.code || '').trim().toUpperCase().replace(/\s+/g, ''),
        name_ar: String(course.name_ar || course.name || '').trim(),
        name_en: String(course.name_en || '').trim() || null,
        college: String(course.college || '').trim() || null,
        department: String(course.department || '').trim() || null,
        credit_hours: course.credit_hours === '' || course.credit_hours == null ? null : Number(course.credit_hours),
        level: course.level === '' || course.level == null ? null : Number(course.level),
        description: String(course.description || '').trim() || null,
        active: String(course.active ?? 'true').toLowerCase() !== 'false',
        status: 'approved',
        updated_at: new Date().toISOString(),
      })).filter((x: any) => /^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$/.test(x.code) && x.name_ar.length >= 2);
      if (!normalized.length) throw new Error('No valid course rows');
      const { data, error } = await db.from('courses').upsert(normalized, { onConflict: 'code' }).select('id,code');
      if (error) throw error;
      return reply(req, { ok: true, data, imported: data?.length || 0, skipped: rows.length - normalized.length });
    }

    if (body.action === 'reindex') {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/search-reindex`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
        },
        body: '{}',
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { ...corsHeaders(req), 'content-type': 'application/json' },
      });
    }

    return reply(req, { ok: false, error: 'unknown_action' }, 400);
  } catch (error) {
    const message = String((error as Error)?.message || error);
    const clientError = /Invalid|Unsupported|not available|required|not found/i.test(message);
    return reply(req, { ok: false, error: message }, clientError ? 400 : 500);
  }
});