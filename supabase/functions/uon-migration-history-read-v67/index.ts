import postgres from 'npm:postgres@3.4.7';

const DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers });
  }
  if (!DB_URL) {
    return new Response(JSON.stringify({ ok: false, error: 'db_url_unavailable' }), { status: 503, headers });
  }

  const sql = postgres(DB_URL, { prepare: false, max: 1 });
  try {
    const rows = await sql`
      select version::text as version, coalesce(name, '')::text as name
      from supabase_migrations.schema_migrations
      order by version
    `;
    return new Response(JSON.stringify({ ok: true, count: rows.length, migrations: rows }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String((error as Error)?.message || error).slice(0, 500) }), { status: 500, headers });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
});
