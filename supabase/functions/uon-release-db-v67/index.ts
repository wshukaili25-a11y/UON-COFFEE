import postgres from 'npm:postgres@3.4.7';

const DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';
const RELEASE_ID = 'uon-v67-required-rpcs-20260910';
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const CONTACT_SQL = `
create or replace function public.uon_public_contact_numbers()
returns table (
  label text,
  phone text,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.label,
    c.phone,
    c.sort_order
  from public.contact_numbers c
  where c.is_visible = true
    and nullif(trim(c.label), '') is not null
    and nullif(trim(c.phone), '') is not null
  order by c.sort_order asc, c.created_at asc;
$$;

revoke all on function public.uon_public_contact_numbers() from public;
grant execute on function public.uon_public_contact_numbers() to anon, authenticated;

comment on function public.uon_public_contact_numbers() is
  'Safe public projection of visible UON Hub contact numbers. Exposes label, phone and sort order only.';
`;

const QUESTION_SQL = `
create table if not exists public.uon_question_submission_guard (
  session_id uuid primary key,
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 0,
  last_submitted_at timestamptz not null default now()
);

alter table public.uon_question_submission_guard enable row level security;
revoke all on table public.uon_question_submission_guard from public, anon, authenticated;

create or replace function public.uon_submit_exam_question_v2(
  p_college text,
  p_subject text,
  p_text text,
  p_session_id uuid,
  p_answer text default null,
  p_type text default 'mcq',
  p_year text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_count integer;
  v_college text := btrim(coalesce(p_college,''));
  v_subject text := upper(regexp_replace(btrim(coalesce(p_subject,'')), '\\s+', '', 'g'));
  v_text text := btrim(coalesce(p_text,''));
  v_answer text := nullif(btrim(coalesce(p_answer,'')), '');
  v_year text := nullif(btrim(coalesce(p_year,'')), '');
  v_type text := lower(btrim(coalesce(p_type,'mcq')));
begin
  if p_session_id is null then
    raise exception 'invalid_session' using errcode = 'P0001';
  end if;
  if char_length(v_college) < 2 or char_length(v_college) > 100 then
    raise exception 'invalid_college' using errcode = 'P0001';
  end if;
  if char_length(v_subject) < 2 or char_length(v_subject) > 100 then
    raise exception 'invalid_subject' using errcode = 'P0001';
  end if;
  if char_length(v_text) < 5 or char_length(v_text) > 1200 then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  if v_answer is not null and char_length(v_answer) > 1200 then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;
  if v_year is not null and char_length(v_year) > 40 then
    raise exception 'invalid_year' using errcode = 'P0001';
  end if;
  if v_type not in ('mcq','essay','tf','calc') then
    raise exception 'invalid_question_type' using errcode = 'P0001';
  end if;

  insert into public.uon_question_submission_guard(session_id,window_started_at,submission_count,last_submitted_at)
  values (p_session_id,now(),1,now())
  on conflict (session_id) do update
  set submission_count = case
        when public.uon_question_submission_guard.window_started_at < now() - interval '1 hour' then 1
        else public.uon_question_submission_guard.submission_count + 1
      end,
      window_started_at = case
        when public.uon_question_submission_guard.window_started_at < now() - interval '1 hour' then now()
        else public.uon_question_submission_guard.window_started_at
      end,
      last_submitted_at = now()
  returning submission_count into v_count;

  if v_count > 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if not public.uon_public_rate_allow('exam_question_submit_total',null,30,3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.exam_questions(college,subject,text,answer,type,year,votes,approved)
  values (v_college,v_subject,v_text,v_answer,v_type,v_year,0,false)
  returning id::text into v_id;

  return v_id;
end;
$$;

revoke all on function public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text) from public;
grant execute on function public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text) to anon, authenticated;

comment on function public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text) is
  'Validated, rate-limited public submission path for pending exam questions.';
`;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: HEADERS });
  }
  if (!DB_URL) {
    return new Response(JSON.stringify({ ok: false, error: 'db_url_unavailable' }), { status: 503, headers: HEADERS });
  }

  const sql = postgres(DB_URL, { prepare: false, max: 1 });
  try {
    let state = 'applied';
    await sql.begin(async (tx) => {
      await tx.unsafe(`select pg_advisory_xact_lock(hashtext('uon-release-db-v67'))`);
      await tx.unsafe(`
        create table if not exists public.uon_release_once_guard (
          release_id text primary key,
          applied_at timestamptz not null default now()
        );
        alter table public.uon_release_once_guard enable row level security;
        revoke all on table public.uon_release_once_guard from public, anon, authenticated;
      `);

      const existing = await tx`
        select release_id from public.uon_release_once_guard where release_id = ${RELEASE_ID} limit 1
      `;
      if (existing.length) {
        state = 'already_applied';
        return;
      }

      await tx.unsafe(CONTACT_SQL);
      await tx.unsafe(QUESTION_SQL);
      await tx`
        insert into public.uon_release_once_guard(release_id) values (${RELEASE_ID})
        on conflict (release_id) do nothing
      `;
    });

    const checks = await sql`
      select
        to_regprocedure('public.uon_public_contact_numbers()') is not null as contact_rpc,
        to_regprocedure('public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text)') is not null as question_rpc,
        to_regclass('public.uon_question_submission_guard') is not null as question_guard
    `;
    const result = checks[0] || {};
    const ok = Boolean(result.contact_rpc && result.question_rpc && result.question_guard);
    return new Response(JSON.stringify({ ok, state, ...result }), { status: ok ? 200 : 500, headers: HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String((error as Error)?.message || error).slice(0, 700) }), { status: 500, headers: HEADERS });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
});
