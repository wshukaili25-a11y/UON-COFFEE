-- UON Hub 2026-11-07: 29 active programs had no courses. Courses were extracted
-- from the official plan files on unizwa.edu.om (program_files/000NN-*.pdf|doc,
-- content_files/a*761.htm for correct Arabic names) into public.plan_import_final
-- (21 programs, 964 links, 484 new course codes) and reviewed by the owner.
-- Rollback:
--   delete from public.course_programs cp using public.plan_import_final f
--     where cp.program_id=f.program_id and upper(cp.course_code)=f.code and cp.source_url=f.source_url;
--   delete from public.courses c using public.plan_import_final f
--     where f.is_new and upper(c.code)=f.code and c.source_url like 'https://www.unizwa.edu.om/%' and c.created_at::date='2026-11-07';

insert into public.courses(code,name_ar,name_en,college,department,college_ar,college_en,department_ar,department_en,
                           credit_hours,level,requirement_type,source_url,active,status)
select distinct on (f.code) f.code, f.name_ar, f.name_en, f.college_ar, f.department_ar, f.college_ar, f.college_en,
       f.department_ar, f.department_en, f.credits, f.level, f.requirement_type, f.source_url, true, 'approved'
from public.plan_import_final f
where f.is_new and not exists (select 1 from public.courses c where upper(regexp_replace(c.code,'[\s-]','','g'))=f.code)
order by f.code, f.program_id;

insert into public.course_programs(course_code,program_id,requirement_type,source_url)
select f.code, f.program_id, f.requirement_type, f.source_url
from public.plan_import_final f
where not exists (select 1 from public.course_programs cp where cp.program_id=f.program_id and upper(cp.course_code)=f.code);

-- Re-link still-unlinked groups and summaries now that the catalogue covers these programs.
-- Same safety rules as 20261106180000/20261107090000, plus: names shorter than 12 chars
-- must match the whole group name; "طرق ..." (teaching-methods) names only match exactly;
-- lab groups go to the course's L variant when it exists. Reverts via the *_backfill tables.
create or replace function pg_temp.k(v text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(lower(translate(coalesce(v,''),'٠١٢٣٤٥٦٧٨٩أإآىةـ','0123456789ااايه')),'[^[:alnum:]]+',' ','g'),'([^0-9])\1+','\1','g'),'\s+',' ','g'))
$$;
create or replace function pg_temp.stem(v text) returns text language sql immutable as $$
  select pg_temp.k(regexp_replace(regexp_replace(v,'جميع\s+السكاشن|كل\s+السكاشن','','g'),'\s*[(|/–-]?\s*(سكشن|سيكشن|سڪشن|شعبه|شعبة|section|sec|lab|لاب|ثيوري|theory)\y.*$','','i'))
$$;
create temporary table _g on commit drop as
select id, subject, pg_temp.stem(subject) stem, subject ~* '(\ylab\y|\ylap\y|laboratory|لاب|عملي)' is_lab,
       upper(regexp_replace(substring(subject from '([A-Za-z]{2,6}\s*-?\s*\d{3}[A-Za-z]?)'),'[^A-Za-z0-9]','','g')) cis
from public.whatsapp_groups where approved is true and nullif(trim(course_code),'') is null;
create temporary table _c on commit drop as
select upper(regexp_replace(code,'[^A-Za-z0-9]','','g')) code, pg_temp.k(name_en) en, pg_temp.k(name_ar) ar from public.courses where active;
create temporary table _gm(group_id bigint primary key, code text, method text) on commit drop;
insert into _gm select id, cis, 'code_in_name' from _g where cis in (select code from _c);
insert into _gm
select g.id, min(c.code), 'unique_name_v2' from _g g join _c c on
  (length(c.en)>=8 and ((' '||g.stem||' ') like '% '||c.en||' %') and (length(c.en)>=12 or g.stem=c.en))
  or (length(c.ar)>=8 and ((' '||g.stem||' ') like '% '||c.ar||' %') and (length(c.ar)>=12 or g.stem=c.ar))
where (g.stem !~ '^طرق ' or g.stem in (c.en,c.ar))
group by g.id having count(distinct c.code)=1
on conflict (group_id) do nothing;
update _gm m set code=m.code||'L' from _g g where g.id=m.group_id and g.is_lab and m.code !~ 'L$' and (m.code||'L') in (select code from _c);
insert into public.whatsapp_group_code_backfill(group_id,old_code,new_code,method)
select m.group_id, g.course_code, m.code, m.method from _gm m join public.whatsapp_groups g on g.id=m.group_id on conflict (group_id) do nothing;
update public.whatsapp_groups g set course_code=m.code, updated_at=now() from _gm m where g.id=m.group_id and nullif(trim(g.course_code),'') is null;

create temporary table _sm on commit drop as
with s as (select id, coalesce(title,'')||' '||coalesce(subject,'')||' '||coalesce(original_filename,'') txt
           from public.summaries where approved is true and nullif(trim(course_code),'') is null),
f as (select s.id, array_agg(distinct upper(regexp_replace(m[1],'[^A-Za-z0-9]','','g'))) codes
      from s, regexp_matches(upper(replace(s.txt,'_',' ')),'\m([A-Z]{2,6}[ -]?[0-9]{3}[A-Z]?)\M','g') m group by 1),
v as (select f.id, array(select c from unnest(f.codes) c where c in (select code from _c)) valid from f)
select id summary_id, valid[1] code from v where cardinality(valid)=1;
insert into public.summary_code_backfill(summary_id,old_code,new_code,method)
select m.summary_id, s.course_code, m.code, 'code_in_title_v2' from _sm m join public.summaries s on s.id=m.summary_id on conflict (summary_id) do nothing;
update public.summaries s set course_code=m.code, updated_at=now() from _sm m where s.id=m.summary_id and nullif(trim(s.course_code),'') is null;
