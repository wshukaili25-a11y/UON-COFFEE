import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DROPBOX_ACCESS_TOKEN = Deno.env.get('DROPBOX_ACCESS_TOKEN');
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

async function requireAdmin(req: Request) {
  const password = req.headers.get('x-admin-password') || '';
  if (!password) throw new Error('ADMIN_AUTH_REQUIRED');
  const { data, error } = await db.rpc('uon_admin_authorized', { p_password: password });
  if (error || data !== true) throw new Error('ADMIN_AUTH_FAILED');
}

async function dropbox(endpoint: string, body: unknown) {
  const result = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await result.json().catch(() => ({}));
  return { result, payload };
}

async function sharedLink(path: string) {
  const created = await dropbox('sharing/create_shared_link_with_settings', { path });
  if (created.result.ok && created.payload.url) return String(created.payload.url);

  const existing = await dropbox('sharing/list_shared_links', {
    path,
    direct_only: true,
  });
  const url = existing.payload.links?.[0]?.url;
  return typeof url === 'string' ? url : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return response(req, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let runId = '';
  try {
    await requireAdmin(req);
    if (!DROPBOX_ACCESS_TOKEN) throw new Error('DROPBOX_ACCESS_TOKEN is missing');

    const body = await req.json().catch(() => ({}));
    const path = String(body.path || '').trim();
    const college = String(body.college || '').trim();
    if (!path.startsWith('/') || path === '/' || path.length > 500 || /[\u0000-\u001f]/.test(path)) {
      throw new Error('Dropbox path is invalid');
    }
    if (!COLLEGES.has(college)) throw new Error('college is invalid');

    const { data: run, error: runError } = await db
      .from('dropbox_import_runs')
      .insert({ path, college, status: 'running' })
      .select()
      .single();
    if (runError) throw runError;
    runId = run.id;

    let cursor = '';
    let imported = 0;
    let skipped = 0;
    let examined = 0;

    do {
      const listing = cursor
        ? await dropbox('files/list_folder/continue', { cursor })
        : await dropbox('files/list_folder', {
          path,
          recursive: true,
          include_deleted: false,
          limit: 1000,
        });
      if (!listing.result.ok) throw new Error(JSON.stringify(listing.payload));

      for (const file of listing.payload.entries || []) {
        if (file['.tag'] !== 'file') continue;
        examined++;
        if (examined > 10_000) throw new Error('Dropbox import safety limit exceeded');

        const dropboxPath = String(file.path_lower || '');
        const { data: existing } = await db
          .from('dropbox_import_items')
          .select('id')
          .eq('dropbox_path', dropboxPath)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const url = await sharedLink(dropboxPath);
        if (!url || !url.startsWith('https://')) {
          skipped++;
          continue;
        }

        const { data: item, error: itemError } = await db
          .from('dropbox_import_items')
          .insert({
            run_id: run.id,
            dropbox_path: dropboxPath,
            file_name: String(file.name || 'Dropbox file'),
            shared_url: url,
            status: 'pending',
          })
          .select()
          .single();
        if (itemError) {
          skipped++;
          continue;
        }

        const { data: summary, error: summaryError } = await db
          .from('summaries')
          .insert({
            title: String(file.name || 'Dropbox file'),
            subject: 'استيراد Dropbox',
            college,
            url,
            link: url,
            description: 'تم استيراده من Dropbox — بانتظار موافقة المشرف',
            approved: false,
          })
          .select('id')
          .single();
        if (summaryError) {
          skipped++;
          await db.from('dropbox_import_items').delete().eq('id', item.id);
          continue;
        }

        await db.from('dropbox_import_items').update({ summary_id: summary.id }).eq('id', item.id);
        imported++;
      }

      cursor = listing.payload.has_more ? String(listing.payload.cursor || '') : '';
    } while (cursor);

    await db
      .from('dropbox_import_runs')
      .update({
        status: 'completed',
        imported_count: imported,
        skipped_count: skipped,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return response(req, { ok: true, run_id: run.id, imported, skipped });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    if (runId) {
      await db
        .from('dropbox_import_runs')
        .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
        .eq('id', runId);
    }
    const status = message.startsWith('ADMIN_AUTH_') ? 401 : /invalid|required/i.test(message) ? 400 : 500;
    return response(req, { ok: false, error: message }, status);
  }
});
