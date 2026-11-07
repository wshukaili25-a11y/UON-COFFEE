-- UON Hub 2026-11-07: owner confirmed English 1 = ENGL150, English 2 = ENGL151.
-- Logged in whatsapp_group_code_backfill (method 'alias_owner') for rollback.
create or replace function pg_temp.k(v text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(lower(translate(coalesce(v,''),'٠١٢٣٤٥٦٧٨٩أإآىةـ','0123456789اااايه')),'[^[:alnum:]]+',' ','g'),'\s+',' ','g'))
$$;
create temporary table _m on commit drop as
select g.id group_id, g.course_code old_code, a.code
from public.whatsapp_groups g
join (values ('english 1','ENGL150'),('انجلش 1','ENGL150'),('انجليزي 1','ENGL150'),('english language 1','ENGL150'),('english i','ENGL150'),
 ('english 2','ENGL151'),('انجلش 2','ENGL151'),('انجليزي 2','ENGL151'),('english language 2','ENGL151'),('english ii','ENGL151')) a(alias,code)
  on pg_temp.k(regexp_replace(g.subject,'\s*[(|/–-]?\s*(سكشن|سيكشن|شعبه|شعبة|section|sec|lab|لاب|ثيوري|theory)\y.*$','','i'))=pg_temp.k(a.alias)
where g.approved is true and nullif(trim(g.course_code),'') is null;
insert into public.whatsapp_group_code_backfill(group_id,old_code,new_code,method)
select group_id,old_code,code,'alias_owner' from _m on conflict (group_id) do nothing;
update public.whatsapp_groups g set course_code=m.code, updated_at=now() from _m m where g.id=m.group_id;
