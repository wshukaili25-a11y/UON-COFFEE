begin;

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
set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_count integer;
  v_college text := btrim(coalesce(p_college,''));
  v_subject text := upper(regexp_replace(btrim(coalesce(p_subject,'')), '\s+', '', 'g'));
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

  insert into public.exam_questions(college,subject,text,answer,type,year,votes,approved)
  values (v_college,v_subject,v_text,v_answer,v_type,v_year,0,false)
  returning id::text into v_id;

  return v_id;
end;
$$;

revoke all on function public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text) from public;
grant execute on function public.uon_submit_exam_question_v2(text,text,text,uuid,text,text,text) to anon, authenticated;

commit;
