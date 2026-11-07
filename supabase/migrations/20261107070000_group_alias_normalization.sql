-- UON Hub 2026-11-07: re-run the already-approved group aliases with fixed text
-- normalisation. The earlier key mapped ى→ا and ة→ي by mistake, and stylised
-- spellings (حضههاره، انجلش ون، عربي تو، "جميع السكاشن") were missed.
-- Only aliases already approved (2026-11-06 list + owner's English 1/2) are used.
create or replace function pg_temp.k(v text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(
    lower(translate(coalesce(v,''),'٠١٢٣٤٥٦٧٨٩أإآىةـ','0123456789ااايه')),
    '[^[:alnum:]]+',' ','g'),'([^0-9])\1+','\1','g'),'\s+',' ','g'))
$$;
create or replace function pg_temp.stem(v text) returns text language sql immutable as $$
  select pg_temp.k(regexp_replace(regexp_replace(v,'جميع\s+السكاشن|كل\s+السكاشن','','g'),
    '\s*[(|/–-]?\s*(سكشن|سيكشن|سڪشن|شعبه|شعبة|section|sec|lab|لاب|ثيوري|theory)\y.*$','','i'))
$$;
create temporary table _m on commit drop as
select g.id group_id, g.course_code old_code, a.code
from public.whatsapp_groups g
join (values
  ('عربي 1','ARAB100'),('عربي ون','ARAB100'),('arabic 1','ARAB100'),('arabic language 1','ARAB100'),('لغة عربية 1','ARAB100'),('اللغة العربية 1','ARAB100'),
  ('عربي 2','ARAB101'),('عربي تو','ARAB101'),('arabic 2','ARAB101'),('arabic language 2','ARAB101'),('arbic language 2','ARAB101'),('لغة عربية 2','ARAB101'),('اللغة العربية 2','ARAB101'),
  ('حضارة','HIST150'),('حضارة إسلامية','HIST150'),('الحضارة الإسلامية','HIST150'),('islamic civilization','HIST150'),
  ('computer skills','COMP101'),('كمبيوتر سكلس','COMP101'),('مهارات الحاسوب','COMP101'),('مهارات حاسوب','COMP101'),
  ('مقدمة في المنطق','LOGI100'),('منطق','LOGI100'),('logical thinking','LOGI100'),
  ('مقدمة في الخوارزميات','COMP151'),('introduction to algorithms','COMP151'),
  ('مقدمة في الإدارة','MNGT101'),('introduction to management','MNGT101'),
  ('مقدمة في المحاسبة','ACCT101'),('introduction to accounting','ACCT101'),
  ('بري كالكلس','MATH116'),('بري كالكولس','MATH116'),('pre calculus','MATH116'),('precalculus','MATH116'),
  ('english 1','ENGL150'),('انجلش 1','ENGL150'),('انجلش ون','ENGL150'),('انجليزي 1','ENGL150'),('english language 1','ENGL150'),('english i','ENGL150'),
  ('english 2','ENGL151'),('انجلش 2','ENGL151'),('انجلش تو','ENGL151'),('انجليزي 2','ENGL151'),('english language 2','ENGL151'),('english ii','ENGL151')
) a(alias,code) on pg_temp.stem(g.subject)=pg_temp.k(a.alias)
where g.approved is true and nullif(trim(g.course_code),'') is null;
insert into public.whatsapp_group_code_backfill(group_id,old_code,new_code,method)
select group_id,old_code,code,'alias_normalized' from _m on conflict (group_id) do nothing;
update public.whatsapp_groups g set course_code=m.code, updated_at=now() from _m m where g.id=m.group_id;
