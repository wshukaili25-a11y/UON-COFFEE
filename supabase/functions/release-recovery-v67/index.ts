import postgres from 'npm:postgres@3.4.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';
const GH_MIGRATIONS = 'https://api.github.com/repos/wshukaili25-a11y/UON-COFFEE/contents/supabase/migrations?ref=main';

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

type RemoteMigration = { version: string; name: string };
type LocalMigration = { version: string; file: string; name: string; canonical: boolean };

function duplicateLocalVersions(local: LocalMigration[]) {
  const grouped = new Map<string, LocalMigration[]>();
  for (const item of local) {
    if (!grouped.has(item.version)) grouped.set(item.version, []);
    grouped.get(item.version)!.push(item);
  }
  return [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([version, items]) => ({ version, files: items.map(x => x.file) }));
}

function prefixCollisions(versions: string[]) {
  const unique = [...new Set(versions)].sort();
  const found: Array<{ short: string; long: string }> = [];
  for (const short of unique) {
    for (const long of unique) {
      if (short !== long && short.length < long.length && long.startsWith(short)) {
        found.push({ short, long });
      }
    }
  }
  return found;
}

async function loadLocalMigrations(): Promise<LocalMigration[]> {
  const r = await fetch(GH_MIGRATIONS, {
    headers: {
      'accept': 'application/vnd.github+json',
      'user-agent': 'uon-hub-release-recovery-v67'
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`github_migrations_${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error('github_migrations_invalid');

  return data
    .map((item: any) => String(item?.name || ''))
    .filter((file: string) => file.endsWith('.sql'))
    .map((file: string) => {
      const stem = file.slice(0, -4);
      const underscore = stem.indexOf('_');
      const version = underscore === -1 ? stem : stem.slice(0, underscore);
      const name = underscore === -1 ? '' : stem.slice(underscore + 1);
      return { version, file, name, canonical: /^\d{14}$/.test(version) };
    })
    .filter((x: LocalMigration) => /^\d+$/.test(x.version));
}

function compareHistory(remote: RemoteMigration[], local: LocalMigration[]) {
  const remoteSet = new Set(remote.map(x => x.version));
  const localSet = new Set(local.map(x => x.version));

  return {
    remote_only: remote.filter(x => !localSet.has(x.version)),
    local_only: local.filter(x => !remoteSet.has(x.version)),
    local_noncanonical: local.filter(x => !x.canonical),
    remote_noncanonical: remote.filter(x => !/^\d{14}$/.test(x.version)),
    duplicate_local_versions: duplicateLocalVersions(local),
    local_prefix_collisions: prefixCollisions(local.map(x => x.version)),
    remote_prefix_collisions: prefixCollisions(remote.map(x => x.version))
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
    const local = await loadLocalMigrations();
    sql = postgres(DB_URL, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 8 });
    const remote = await sql<RemoteMigration[]>`
      select version::text, coalesce(name,'')::text as name
      from supabase_migrations.schema_migrations
      order by version
    `;
    const comparison = compareHistory(remote, local);

    return json(req, {
      ok: true,
      mode: 'inspect_compare',
      counts: { remote: remote.length, local_files: local.length, local_versions: new Set(local.map(x => x.version)).size },
      comparison,
      remote_rows: remote,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return json(req, { ok: false, error: 'inspection_failed', detail: String(error?.message || error).slice(0, 500) }, 500);
  } finally {
    try { await sql?.end({ timeout: 1 }); } catch {}
  }
});
