import postgres from 'npm:postgres@3.4.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';

function secretKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function allowedOrigin(origin: string) {
  if (!origin) return '';
  if (origin === 'https://uonhub.space' || origin === 'https://www.uonhub.space') return origin;
  try {
    const h = new URL(origin).hostname.toLowerCase();
    if (h.endsWith('.vercel.app') && (h.startsWith('uon-') || h.includes('uon-hub'))) return origin;
  } catch {}
  return '';
}

function headers(req: Request) {
  const origin = allowedOrigin(req.headers.get('origin') || '');
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': origin || 'https://uonhub.space',
    'access-control-allow-headers': 'content-type,x-admin-password',
    'access-control-allow-methods': 'POST,OPTIONS',
    'vary': 'Origin'
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

async function adminAuthorized(password: string) {
  const key = secretKey();
  if (!SUPABASE_URL || !key || !password) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_admin_authorized`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ p_password: password }),
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

function migrationHealth(rows: Array<{version:string;name:string}>) {
  const versions = rows.map(x => String(x.version || ''));
  const nonCanonical = rows.filter(x => !/^\d{14}$/.test(String(x.version || '')));
  const prefixCollisions: Array<{short:string;long:string}> = [];
  for (const short of versions) {
    for (const long of versions) {
      if (short !== long && short.length < long.length && long.startsWith(short)) {
        prefixCollisions.push({ short, long });
      }
    }
  }
  return {
    total: rows.length,
    non_canonical: nonCanonical,
    prefix_collisions: prefixCollisions
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);

  const password = req.headers.get('x-admin-password') || '';
  if (!(await adminAuthorized(password))) return json(req, { ok: false, error: 'unauthorized' }, 401);
  if (!DB_URL) return json(req, { ok: false, error: 'db_url_unavailable' }, 503);

  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(DB_URL, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 8 });
    const rows = await sql<{version:string;name:string}[]>`
      select version::text, coalesce(name,'')::text as name
      from supabase_migrations.schema_migrations
      order by version
    `;

    return json(req, {
      ok: true,
      mode: 'inspect',
      rows,
      health: migrationHealth(rows),
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return json(req, { ok: false, error: 'inspection_failed', detail: String(error?.message || error).slice(0, 500) }, 500);
  } finally {
    try { await sql?.end({ timeout: 1 }); } catch {}
  }
});
