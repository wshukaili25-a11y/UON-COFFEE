-- UON Hub 2026-11-07: owner-approved aliases (batch 2). Logged as 'alias_owner_2'.
create or replace function pg_temp.k(v text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(lower(translate(coalesce(v,''),'٠١٢٣٤٥٦٧٨٩أإآىةـ','0123456789ااايه')),'[^[:alnum:]]+',' ','g'),'([^0-9])\1+','\1','g'),'\s+',' ','g'))
$$;
-- Section suffixes removed; "lab/لاب" kept so lab groups match their own alias.
create or replace function pg_temp.stem(v text) returns text language sql immutable as $$
  select pg_temp.k(regexp_replace(regexp_replace(v,'جميع\s+السكاشن|كل\s+السكاشن','','g'),'\s*[(|/–-]?\s*(سكشن|سيكشن|سڪشن|شعبه|شعبة|section|sec|ثيوري|theory)\y.*$','','i'))
$$;
create temporary table _m on commit drop as
select distinct on (g.id) g.id group_id, g.course_code old_code, a.code
from public.whatsapp_groups g
join (values
 ('مقدمة إلى الأعمال','BUSI101'),('مقدمة الى الاعمال','BUSI101'),('introduction to business','BUSI101'),
 ('مبادئ الاقتصاد','ECON101'),
 ('احصاء','STAT101'),('إحصاء','STAT101'),('مبادئ الاحصاء','STAT101'),('مختبر الاحصاء','STAT101'),('جروب مختبر الاحصاء','STAT101'),('لاب مبادئ احصاء','STAT101'),('لاب احصاء','STAT101'),
 ('علم نفس','EDUC101'),('علم النفس','EDUC101'),
 ('ريادة اعمال','MNGT100'),('ريادة الاعمال','MNGT100'),
 ('تقانة الانترنت','INFS103'),('تقنية الانترنت','INFS103'),('internet technology','INFS103'),
 ('مقدمة في التسويق','MRKT101'),('مقدمة في التسويق 1','MRKT101'),('introduction to marketing','MRKT101'),
 ('سلوك تنظيمي','MNGT102'),('organizational behavior','MNGT102'),
 ('فيزياء عامة 1','PHYS101'),('general physics 1','PHYS101'),
 ('نظم ادارة قواعد البيانات','INFS302'),('نظم ادارة القواعد','INFS302'),
 ('علم الاجتماع','SOCI101'),
 ('calculus','MATH211'),('calculu','MATH211'),('calculus 1','MATH211'),
 ('fundamentals of chemistry','CHEM107'),('chemistry','CHEM107'),('كمستري','CHEM107'),('كمستري 1','CHEM107'),('كمستري 1 لاب','CHEM107'),('لاب كمستري','CHEM107'),('كيمياء','CHEM107'),('لاب كيمياء','CHEM107'),('chemistry lab','CHEM107'),
 ('biology','BIOL101'),('بايو','BIOL101'),('بايو لاب','BIOL101'),('لاب بايو','BIOL101'),('biology lab','BIOL101'),
 ('communication skills','ENGL155'),('مهارات اتصال','ENGL155'),('مهارات الاتصال','ENGL155'),('مهارات اتصال communication skills','ENGL155')
) a(alias,code) on pg_temp.stem(g.subject)=pg_temp.k(a.alias)
where g.approved is true and nullif(trim(g.course_code),'') is null
order by g.id;
insert into public.whatsapp_group_code_backfill(group_id,old_code,new_code,method)
select group_id,old_code,code,'alias_owner_2' from _m on conflict (group_id) do nothing;
update public.whatsapp_groups g set course_code=m.code, updated_at=now() from _m m where g.id=m.group_id;
