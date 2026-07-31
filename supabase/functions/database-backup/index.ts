import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  'site_settings',
  'platform_features',
  'courses',
  'course_resources',
  'course_requests',
  'summaries',
  'whatsapp_groups',
  'student_projects',
  'rating_submissions',
  'confessions',
  'site_announcements',
  'site_notifications',
  'university_programs',
  'tools_items',
  'academic_calendar_events',
  'feature_suggestions',
  'broken_link_reports',
  'telegram_admins',
  'admin_roles',
  'import_sources',
] as const;

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);
  if (!(await authorized(req))) return reply(req, { ok: false, error: 'unauthorized' }, 401);

  const input = await req.json().catch(() => ({}));
  const { data: run, error: runError } = await db
    .from('backup_runs')
    .insert({
      status: 'running',
      requested_by: String(input.requested_by || 'admin').slice(0, 120),
    })
    .select()
    .single();
  if (runError) return reply(req, { ok: false, error: runError.message }, 500);

  let path = '';
  try {
    const payload: Record<string, unknown> = {
      version: '30.0',
      created_at: new Date().toISOString(),
      tables: {},
    };
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const { data, error } = await db.from(table).select('*');
      if (error) {
        if (error.code === '42P01') continue;
        throw error;
      }
      (payload.tables as Record<string, unknown[]>)[table] = data || [];
      counts[table] = (data || []).length;
    }
    payload.row_counts = counts;

    const json = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(json).byteLength;
    path = `backups/v30-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    const { error: uploadError } = await db.storage
      .from('uon-backups')
      .upload(path, new Blob([json], { type: 'application/json' }), {
        contentType: 'application/json',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: verificationFile, error: verificationError } = await db.storage
      .from('uon-backups')
      .download(path);
    if (verificationError || !verificationFile) {
      throw verificationError || new Error('Storage verification failed');
    }
    const verifiedSize = verificationFile.size;
    if (verifiedSize !== sizeBytes) {
      throw new Error(`Storage size mismatch: expected ${sizeBytes}, received ${verifiedSize}`);
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await db
      .from('backup_runs')
      .update({
        status: 'completed',
        file_path: path,
        row_counts: counts,
        size_bytes: sizeBytes,
        completed_at: completedAt,
      })
      .eq('id', run.id);
    if (updateError) throw updateError;

    return reply(req, {
      ok: true,
      run_id: run.id,
      path,
      size_bytes: sizeBytes,
      counts,
      completed_at: completedAt,
      storage_verified: true,
    });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    await db
      .from('backup_runs')
      .update({
        status: 'failed',
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    return reply(req, { ok: false, error: message, path: path || null }, 500);
  }
});
