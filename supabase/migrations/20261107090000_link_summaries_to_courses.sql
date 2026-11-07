-- UON Hub 2026-11-07: 212 of 220 approved summaries had no course_code, so they
-- did not count on course pages or in the library's course chips. Fill it only
-- when the title/subject/file name contains exactly one catalogue course code.
create table if not exists public.summary_code_backfill(
  summary_id uuid primary key, old_code text, new_code text not null,
  method text not null, created_at timestamptz not null default now());
alter table public.summary_code_backfill enable row level security;
revoke all on public.summary_code_backfill from anon, authenticated;

create temporary table _m on commit drop as
with s as (
  select id, coalesce(title,'')||' '||coalesce(subject,'')||' '||coalesce(original_filename,'') txt
  from public.summaries where approved is true and nullif(trim(course_code),'') is null),
f as (
  select s.id, array_agg(distinct upper(regexp_replace(m[1],'[^A-Za-z0-9]','','g'))) codes
  from s, regexp_matches(upper(replace(s.txt,'_',' ')),'\m([A-Z]{2,6}[ -]?[0-9]{3}[A-Z]?)\M','g') m group by 1),
v as (
  select f.id, array(select c from unnest(f.codes) c
    where c in (select upper(regexp_replace(code,'[^A-Za-z0-9]','','g')) from public.courses where active)) valid
  from f)
select id summary_id, valid[1] code from v where cardinality(valid)=1;

insert into public.summary_code_backfill(summary_id,old_code,new_code,method)
select m.summary_id, s.course_code, m.code, 'code_in_title'
from _m m join public.summaries s on s.id=m.summary_id on conflict (summary_id) do nothing;
update public.summaries s set course_code=m.code, updated_at=now()
from _m m where s.id=m.summary_id and nullif(trim(s.course_code),'') is null;
