-- Confirmed EduWave section observations. Images are never persisted.
create table if not exists public.uon_student_section_observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  client_token_hash text not null,
  term text,
  course_code text not null check (char_length(course_code) between 2 and 40),
  course_name text,
  section_no text not null,
  instructor text,
  capacity integer check (capacity is null or capacity between 0 and 999),
  enrolled integer check (enrolled is null or enrolled between 0 and 999),
  meetings jsonb not null check (jsonb_typeof(meetings)='array' and jsonb_array_length(meetings) between 1 and 8),
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,course_code,section_no)
);
alter table public.uon_student_section_observations enable row level security;
revoke all on table public.uon_student_section_observations from public, anon, authenticated;
create index if not exists uon_section_observations_course_updated_idx on public.uon_student_section_observations(course_code,updated_at desc);
create index if not exists uon_section_observations_session_idx on public.uon_student_section_observations(session_id);

create or replace function public.uon_confirm_schedule_sections(p_session_id uuid,p_client_token text,p_sections jsonb,p_term text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_hash text;
  v_existing_hash text;
  v_item jsonb;
  v_count integer:=0;
begin
  if p_session_id is null or octet_length(coalesce(p_client_token,'')) not between 16 and 200 then raise exception 'invalid_session'; end if;
  if jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections) not between 1 and 20 or octet_length(p_sections::text)>100000 then raise exception 'invalid_sections'; end if;
  v_hash:=encode(extensions.digest(convert_to(trim(p_client_token),'UTF8'),'sha256'),'hex');
  select client_token_hash into v_existing_hash from public.uon_ai_schedule_snapshots where session_id=p_session_id;
  if nullif(v_existing_hash,'') is not null and v_existing_hash<>v_hash then raise exception 'session_not_allowed'; end if;
  if not public.uon_public_rate_allow('confirm_schedule_sections',p_session_id::text,20,3600) then raise exception 'rate_limited'; end if;
  for v_item in select value from jsonb_array_elements(p_sections)
  loop
    if char_length(coalesce(v_item->>'course_code','')) not between 2 and 40
      or char_length(coalesce(v_item->>'section_no','')) not between 1 and 20
      or jsonb_typeof(v_item->'meetings')<>'array'
      or jsonb_array_length(v_item->'meetings') not between 1 and 8 then
      raise exception 'invalid_section_row';
    end if;
    insert into public.uon_student_section_observations(session_id,client_token_hash,term,course_code,course_name,section_no,instructor,capacity,enrolled,meetings,confirmed_at,updated_at)
    values(p_session_id,v_hash,nullif(left(trim(coalesce(p_term,'')),40),''),upper(left(trim(v_item->>'course_code'),40)),nullif(left(trim(coalesce(v_item->>'course_name','')),120),''),left(trim(v_item->>'section_no'),20),nullif(left(trim(coalesce(v_item->>'instructor','')),100),''),greatest(0,least(999,nullif(v_item->>'capacity','')::integer)),greatest(0,least(999,nullif(v_item->>'enrolled','')::integer)),v_item->'meetings',now(),now())
    on conflict(session_id,course_code,section_no) do update set term=excluded.term,course_name=excluded.course_name,instructor=excluded.instructor,capacity=excluded.capacity,enrolled=excluded.enrolled,meetings=excluded.meetings,confirmed_at=now(),updated_at=now()
    where public.uon_student_section_observations.client_token_hash=v_hash;
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'confirmed_sections',v_count);
end;
$$;
revoke all on function public.uon_confirm_schedule_sections(uuid,text,jsonb,text) from public;
grant execute on function public.uon_confirm_schedule_sections(uuid,text,jsonb,text) to anon, authenticated;

create or replace view public.uon_ai_confirmed_sections
with (security_invoker=true)
as
select course_code,course_name,section_no,instructor,capacity,enrolled,meetings,
       count(*) as confirmations,max(confirmed_at) as last_confirmed_at
from public.uon_student_section_observations
where confirmed_at>now()-interval '120 days'
group by course_code,course_name,section_no,instructor,capacity,enrolled,meetings;
revoke all on public.uon_ai_confirmed_sections from public, anon, authenticated;
grant select on public.uon_ai_confirmed_sections to service_role;
