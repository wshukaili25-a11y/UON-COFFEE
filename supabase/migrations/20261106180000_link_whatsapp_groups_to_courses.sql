-- UON Hub 2026-11-06: 937 of 938 approved WhatsApp groups had no course_code
-- (imported with informal names), so course pages showed "no groups".
-- Fill course_code only where the match is unambiguous. Every change is
-- recorded in whatsapp_group_code_backfill so it can be reverted:
--   update whatsapp_groups g set course_code=b.old_code from whatsapp_group_code_backfill b where b.group_id=g.id;

create table if not exists public.whatsapp_group_code_backfill(
  group_id bigint primary key,
  old_code text,
  new_code text not null,
  method text not null,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_group_code_backfill enable row level security;
revoke all on public.whatsapp_group_code_backfill from anon, authenticated;

create or replace function pg_temp.k(v text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(lower(translate(coalesce(v,''),'٠١٢٣٤٥٦٧٨٩أإآىةـ','0123456789اااايه')),'[^[:alnum:]]+',' ','g'),'\s+',' ','g'))
$$;

-- Section/lab suffixes removed before name matching.
create temporary table _g on commit drop as
select g.id, g.subject,
       pg_temp.k(regexp_replace(g.subject,'\s*[(|/–-]?\s*(سكشن|سيكشن|شعبه|شعبة|section|sec|lab|لاب|ثيوري|theory)\y.*$','','i')) stem,
       upper(regexp_replace(substring(g.subject from '([A-Za-z]{2,6}\s*-?\s*\d{3}[A-Za-z]?)'),'[^A-Za-z0-9]','','g')) code_in_subject
from public.whatsapp_groups g
where g.approved is true and nullif(trim(g.course_code),'') is null;

create temporary table _c on commit drop as
select upper(regexp_replace(code,'[^A-Za-z0-9]','','g')) code, pg_temp.k(name_en) en, pg_temp.k(name_ar) ar
from public.courses where active;

create temporary table _match(group_id bigint primary key, code text, method text) on commit drop;

-- 1) explicit code written in the group name and present in the catalogue
insert into _match
select g.id, g.code_in_subject, 'code_in_name' from _g g
where g.code_in_subject in (select code from _c);

-- 2) curated aliases for the most common informal names (unambiguous in the catalogue)
insert into _match
select g.id, a.code, 'alias' from _g g
join (values
  ('عربي 1','ARAB100'),('arabic 1','ARAB100'),('arabic language 1','ARAB100'),('لغه عربيه 1','ARAB100'),
  ('عربي 2','ARAB101'),('arabic 2','ARAB101'),('arabic language 2','ARAB101'),('arbic language 2','ARAB101'),('لغه عربيه 2','ARAB101'),
  ('حضاره','HIST150'),('حضاره اسلاميه','HIST150'),('الحضاره الاسلاميه','HIST150'),('islamic civilization','HIST150'),
  ('computer skills','COMP101'),('كمبيوتر سكلس','COMP101'),('مهارات الحاسوب','COMP101'),('مهارات حاسوب','COMP101'),
  ('مقدمه في المنطق','LOGI100'),('منطق','LOGI100'),('logical thinking','LOGI100'),
  ('مقدمه في الخوارزميات','COMP151'),('introduction to algorithms','COMP151'),
  ('مقدمه في الاداره','MNGT101'),('introduction to management','MNGT101'),
  ('مقدمه في المحاسبه','ACCT101'),('introduction to accounting','ACCT101'),
  ('بري كالكلس','MATH116'),('pre calculus','MATH116'),('precalculus','MATH116')
) a(alias, code) on g.stem = pg_temp.k(a.alias)
where a.code in (select code from _c)
on conflict (group_id) do nothing;

-- 3) group name contains exactly one catalogue course name (≥8 chars)
insert into _match
select g.id, min(c.code), 'unique_name' from _g g
join _c c on (length(c.en)>=8 and g.stem like '%'||c.en||'%') or (length(c.ar)>=8 and g.stem like '%'||c.ar||'%')
group by g.id having count(distinct c.code)=1
on conflict (group_id) do nothing;

insert into public.whatsapp_group_code_backfill(group_id, old_code, new_code, method)
select m.group_id, g.course_code, m.code, m.method
from _match m join public.whatsapp_groups g on g.id=m.group_id
on conflict (group_id) do nothing;

update public.whatsapp_groups g set course_code=m.code, updated_at=now()
from _match m where g.id=m.group_id and nullif(trim(g.course_code),'') is null;
