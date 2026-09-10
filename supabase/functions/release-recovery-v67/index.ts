import postgres from 'npm:postgres@3.4.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';
const GH_MIGRATIONS = 'https://api.github.com/repos/wshukaili25-a11y/UON-COFFEE/contents/supabase/migrations?ref=main';
const GH_RAW_MIGRATIONS = 'https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/main/supabase/migrations';
const APPLY_CONFIRM = 'APPLY_V67_RELEASE_PREREQS';

const RELEASE_MIGRATIONS = [
  {
    version: '20260908203500',
    file: '20260908203500_public_visible_contact_numbers_rpc.sql',
    name: 'public_visible_contact_numbers_rpc',
    regprocedure: 'public.uon_public_contact_numbers()'
  },
  {
    version: '20260908224500',
    file: '20260908224500_secure_exam_question_submission_v2.sql',
    name: 'secure_exam_question_submission_v2',
    regprocedure: 'public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)'
  }
] as const;

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

type SqlClient = ReturnType<typeof postgres>;

function normalizeName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\.sql$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

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
  const remoteOnly = remote.filter(x => !localSet.has(x.version));
  const localOnly = local.filter(x => !remoteSet.has(x.version));

  const localByName = new Map<string, LocalMigration[]>();
  for (const item of localOnly) {
    const key = normalizeName(item.name);
    if (!key) continue;
    if (!localByName.has(key)) localByName.set(key, []);
    localByName.get(key)!.push(item);
  }

  const exactNameMatches: Array<{
    remote_version: string;
    remote_name: string;
    local_version: string;
    local_file: string;
  }> = [];
  const ambiguousNameMatches: Array<{
    remote_version: string;
    remote_name: string;
    local_files: string[];
  }> = [];
  const matchedRemote = new Set<string>();
  const matchedLocalFiles = new Set<string>();

  for (const item of remoteOnly) {
    const candidates = localByName.get(normalizeName(item.name)) || [];
    if (candidates.length === 1) {
      const localItem = candidates[0];
      exactNameMatches.push({
        remote_version: item.version,
        remote_name: item.name,
        local_version: localItem.version,
        local_file: localItem.file
      });
      matchedRemote.add(item.version);
      matchedLocalFiles.add(localItem.file);
    } else if (candidates.length > 1) {
      ambiguousNameMatches.push({
        remote_version: item.version,
        remote_name: item.name,
        local_files: candidates.map(x => x.file)
      });
    }
  }

  return {
    remote_only: remoteOnly,
    local_only: localOnly,
    exact_name_matches: exactNameMatches,
    ambiguous_name_matches: ambiguousNameMatches,
    unresolved_remote_only: remoteOnly.filter(x => !matchedRemote.has(x.version)),
    unresolved_local_only: localOnly.filter(x => !matchedLocalFiles.has(x.file)),
    local_noncanonical: local.filter(x => !x.canonical),
    remote_noncanonical: remote.filter(x => !/^\d{14}$/.test(x.version)),
    duplicate_local_versions: duplicateLocalVersions(local),
    local_prefix_collisions: prefixCollisions(local.map(x => x.version)),
    remote_prefix_collisions: prefixCollisions(remote.map(x => x.version))
  };
}

async function releaseStatus(sql: SqlClient) {
  const rows = await sql<{
    contact_reg: string | null;
    question_reg: string | null;
    contact_anon: boolean;
    contact_auth: boolean;
    question_anon: boolean;
    question_auth: boolean;
  }[]>`
    select
      to_regprocedure('public.uon_public_contact_numbers()')::text as contact_reg,
      to_regprocedure('public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)')::text as question_reg,
      case when to_regprocedure('public.uon_public_contact_numbers()') is null then false
           else has_function_privilege('anon','public.uon_public_contact_numbers()','EXECUTE') end as contact_anon,
      case when to_regprocedure('public.uon_public_contact_numbers()') is null then false
           else has_function_privilege('authenticated','public.uon_public_contact_numbers()','EXECUTE') end as contact_auth,
      case when to_regprocedure('public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)') is null then false
           else has_function_privilege('anon','public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)','EXECUTE') end as question_anon,
      case when to_regprocedure('public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)') is null then false
           else has_function_privilege('authenticated','public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)','EXECUTE') end as question_auth
  `;

  const history = await sql<{ version: string; name: string }[]>`
    select version::text, coalesce(name,'')::text as name
    from supabase_migrations.schema_migrations
    where version in ('20260908203500','20260908224500')
    order by version
  `;

  const row = rows[0] || {
    contact_reg: null,
    question_reg: null,
    contact_anon: false,
    contact_auth: false,
    question_anon: false,
    question_auth: false
  };

  return {
    contact_rpc: Boolean(row.contact_reg),
    contact_anon_execute: Boolean(row.contact_anon),
    contact_authenticated_execute: Boolean(row.contact_auth),
    question_rpc: Boolean(row.question_reg),
    question_anon_execute: Boolean(row.question_anon),
    question_authenticated_execute: Boolean(row.question_auth),
    history_versions: history,
    ready: Boolean(
      row.contact_reg && row.question_reg &&
      row.contact_anon && row.contact_auth &&
      row.question_anon && row.question_auth &&
      history.length === RELEASE_MIGRATIONS.length
    )
  };
}

async function fetchMigrationSql(file: string) {
  const r = await fetch(`${GH_RAW_MIGRATIONS}/${encodeURIComponent(file)}`, {
    headers: { 'user-agent': 'uon-hub-release-recovery-v67' },
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`migration_fetch_${file}_${r.status}`);
  const text = await r.text();
  if (text.trim().length < 20) throw new Error(`migration_empty_${file}`);
  return text;
}

async function applyReleasePrereqs(sql: SqlClient) {
  const applied: Array<{ version: string; file: string; sql_executed: boolean; history_recorded: boolean }> = [];

  for (const item of RELEASE_MIGRATIONS) {
    const exists = await sql<{ present: boolean }[]>`
      select to_regprocedure(${item.regprocedure}) is not null as present
    `;
    let sqlExecuted = false;

    if (!exists[0]?.present) {
      const migrationSql = await fetchMigrationSql(item.file);
      await sql.unsafe(migrationSql);
      sqlExecuted = true;
    }

    await sql`
      insert into supabase_migrations.schema_migrations(version,name)
      values (${item.version},${item.name})
      on conflict (version) do update set name=excluded.name
    `;

    applied.push({
      version: item.version,
      file: item.file,
      sql_executed: sqlExecuted,
      history_recorded: true
    });
  }

  return applied;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);

  const password = req.headers.get('x-admin-password') || '';
  if (!(await adminAuthorized(password))) return json(req, { ok: false, error: 'unauthorized' }, 401);
  if (!DB_URL) return json(req, { ok: false, error: 'db_url_unavailable' }, 503);

  let payload: any = {};
  try { payload = await req.json(); } catch {}
  const action = String(payload?.action || 'inspect');

  let sql: SqlClient | null = null;
  try {
    sql = postgres(DB_URL, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 8 });

    if (action === 'apply_release_prereqs') {
      if (String(payload?.confirm || '') !== APPLY_CONFIRM) {
        return json(req, { ok: false, error: 'confirmation_required' }, 400);
      }
      const before = await releaseStatus(sql);
      const applied = await applyReleasePrereqs(sql);
      const after = await releaseStatus(sql);
      return json(req, {
        ok: after.ready,
        mode: 'apply_release_prereqs',
        before,
        applied,
        after,
        generated_at: new Date().toISOString()
      }, after.ready ? 200 : 500);
    }

    if (action !== 'inspect') return json(req, { ok: false, error: 'unknown_action' }, 400);

    const local = await loadLocalMigrations();
    const remote = await sql<RemoteMigration[]>`
      select version::text, coalesce(name,'')::text as name
      from supabase_migrations.schema_migrations
      order by version
    `;
    const comparison = compareHistory(remote, local);
    const release = await releaseStatus(sql);

    return json(req, {
      ok: true,
      mode: 'inspect_compare',
      counts: {
        remote: remote.length,
        local_files: local.length,
        local_versions: new Set(local.map(x => x.version)).size,
        remote_only: comparison.remote_only.length,
        local_only: comparison.local_only.length,
        exact_name_matches: comparison.exact_name_matches.length,
        unresolved_remote_only: comparison.unresolved_remote_only.length,
        unresolved_local_only: comparison.unresolved_local_only.length
      },
      comparison,
      release_status: release,
      remote_rows: remote,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return json(req, { ok: false, error: action === 'apply_release_prereqs' ? 'apply_failed' : 'inspection_failed', detail: String(error?.message || error).slice(0, 800) }, 500);
  } finally {
    try { await sql?.end({ timeout: 1 }); } catch {}
  }
});
