import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PRODUCTION_RESTORE_ENABLED =
  Deno.env.get('ALLOW_PRODUCTION_RESTORE') === 'true';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = new Set([
  'https://uonhub.space',
  'https://www.uonhub.space',
]);

const restoreOrder = [
  'site_settings',
  'platform_features',
  'tools_items',
  'courses',
  'university_programs',
  'academic_calendar_events',
  'site_announcements',
  'site_notifications',
  'import_sources',
  'summaries',
  'whatsapp_groups',
  'student_projects',
  'rating_submissions',
  'confessions',
  'course_resources',
  'course_requests',
  'feature_suggestions',
  'broken_link_reports',
  'telegram_admins',
  'admin_roles',
] as const;

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
    // Non-browser calls are authenticated separately.
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

function validatePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Backup payload must be a JSON object');
  }
  const value = payload as Record<string, unknown>;
  const tables = value.tables;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    throw new Error('Backup payload has no valid tables object');
  }

  const counts: Record<string, number> = {};
  const unknownTables: string[] = [];
  let totalRows = 0;
  for (const [table, rows] of Object.entries(tables)) {
    if (!restoreOrder.includes(table as typeof restoreOrder[number])) {
      unknownTables.push(table);
      continue;
    }
    if (!Array.isArray(rows)) throw new Error(`Backup table ${table} is not an array`);
    counts[table] = rows.length;
    totalRows += rows.length;
  }
  if (!Object.keys(counts).length) throw new Error('Backup contains no restorable tables');
  if (totalRows > 250_000) throw new Error('Backup row count exceeds the safety limit');

  return {
    value,
    tables: tables as Record<string, unknown[]>,
    counts,
    totalRows,
    unknownTables,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);
  if (!(await authorized(req))) return reply(req, { ok: false, error: 'unauthorized' }, 401);

  let runId = '';
  try {
    const body = await req.json().catch(() => ({}));
    const backupId = String(body.backup_run_id || body.backup_id || '');
    const dryRun = body.dry_run === true || body.validate_only === true;
    if (!backupId) return reply(req, { ok: false, error: 'backup_run_id is required' }, 400);

    const { data: backup, error: backupError } = await db
      .from('backup_runs')
      .select('*')
      .eq('id', backupId)
      .eq('status', 'completed')
      .single();
    if (backupError) throw backupError;

    const backupPath = backup.file_path || backup.backup_path;
    if (!backupPath) throw new Error('Backup file path is missing');

    const { data: file, error: downloadError } = await db.storage
      .from('uon-backups')
      .download(backupPath);
    if (downloadError) throw downloadError;

    const text = await file.text();
    const parsed = validatePayload(JSON.parse(text));
    const summary = {
      backup_id: backup.id,
      backup_path: backupPath,
      backup_created_at: backup.created_at,
      backup_version: parsed.value.version || null,
      size_bytes: new TextEncoder().encode(text).byteLength,
      table_counts: parsed.counts,
      total_rows: parsed.totalRows,
      ignored_unknown_tables: parsed.unknownTables,
    };

    if (dryRun) {
      return reply(req, {
        ok: true,
        dry_run: true,
        writes_performed: false,
        validation: summary,
      });
    }

    if (!PRODUCTION_RESTORE_ENABLED) {
      return reply(req, {
        ok: false,
        error: 'production_restore_disabled',
        message:
          'Production restore is disabled. Use dry_run=true to validate the backup safely.',
        writes_performed: false,
      }, 409);
    }

    const { data: run, error: runError } = await db
      .from('restore_runs')
      .insert({
        backup_path: backupPath,
        status: 'running',
        requested_by: String(body.requested_by || 'admin'),
      })
      .select()
      .single();
    if (runError) throw runError;
    runId = run.id;

    const results: Record<string, unknown> = {};
    for (const table of restoreOrder) {
      const rows = parsed.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      let restored = 0;
      for (let index = 0; index < rows.length; index += 250) {
        const chunk = rows.slice(index, index + 250);
        const { error } = await db.from(table).upsert(chunk);
        if (error) {
          results[table] = { ok: false, error: error.message, restored };
          break;
        }
        restored += chunk.length;
      }
      if (!results[table]) results[table] = { ok: true, rows: restored };
    }

    const failed = Object.values(results).some((result: any) => result.ok === false);
    await db
      .from('restore_runs')
      .update({
        status: failed ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        error: failed ? JSON.stringify(results) : null,
      })
      .eq('id', runId);

    return reply(req, { ok: !failed, run_id: runId, summary, results }, failed ? 207 : 200);
  } catch (error) {
    const message = String((error as Error)?.message || error);
    if (runId) {
      await db
        .from('restore_runs')
        .update({
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }
    return reply(req, { ok: false, error: message }, 500);
  }
});
