begin;

insert into public.tool_backups(snapshot,requested_by,reason)
select jsonb_build_object(
  'tool_registry',coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order,t.key) from public.tool_registry t),'[]'::jsonb),
  'useful_sites',coalesce((select jsonb_agg(to_jsonb(u) order by u.sort_order,u.title_ar) from public.useful_sites u),'[]'::jsonb)
),'chatgpt','student_tools_reorganization_v46';

update public.tool_registry
set placement='home_secondary',
    sort_order=case key
      when 'summaries' then 110
      when 'groups' then 120
      when 'university-guide' then 130
      when 'ratings' then 140
      when 'assistant' then 150
      when 'calendar' then 160
      else sort_order
    end,
    updated_at=now()
where key in ('summaries','groups','university-guide','ratings','assistant','calendar');

update public.tool_registry
set placement='home_primary',
    is_visible=true,
    is_platform=true,
    category_id='platform',
    sort_order=case key
      when 'schedule' then 10
      when 'courses' then 20
      when 'gpa' then 30
      when 'projects' then 40
      when 'confessions' then 50
      when 'useful-sites' then 60
      else sort_order
    end,
    name_ar=case key
      when 'courses' then 'مركز المقررات'
      when 'useful-sites' then 'مواقع وأدوات مفيدة للطلاب'
      else name_ar
    end,
    name_en=case key
      when 'courses' then 'Course Center'
      when 'useful-sites' then 'Useful Websites & Student Tools'
      else name_en
    end,
    description_ar=case key
      when 'schedule' then 'رتّب موادك ومحاضراتك في جدول دراسي واضح.'
      when 'courses' then 'ابحث عن المقرر وشاهد الملخصات والاختبارات والمجموعات والتقييمات.'
      when 'gpa' then 'احسب المعدل الفصلي والتراكمي مع المواد المعادة.'
      when 'projects' then 'استعرض مشاريع الطلبة وشارك مشروعك.'
      when 'confessions' then 'شارك الاعترافات والرسائل الطلابية بصورة مجهولة.'
      when 'useful-sites' then 'روابط الجامعة وأدوات الدراسة والملفات والذكاء الاصطناعي في مكان واحد.'
      else description_ar
    end,
    description_en=case key
      when 'schedule' then 'Organize courses and lectures in a clear study schedule.'
      when 'courses' then 'Find a course and open summaries, exams, groups, and ratings.'
      when 'gpa' then 'Calculate semester and cumulative GPA, including repeated courses.'
      when 'projects' then 'Explore student projects and share your own.'
      when 'confessions' then 'Share anonymous student confessions and messages.'
      when 'useful-sites' then 'University links and useful study, file, and AI tools in one place.'
      else description_en
    end,
    updated_at=now()
where key in ('schedule','courses','gpa','projects','confessions','useful-sites');

update public.tool_registry
set placement='tools_only',sort_order=170,updated_at=now()
where key='feedback';

update public.tool_registry
set placement='hidden',updated_at=now()
where key='tools';

with external_tools as (
  select distinct on (
    regexp_replace(regexp_replace(lower(trim(url)),'^https?://(www\.)?','','i'),'/+$','')
  )
    name_ar,
    coalesce(name_en,name_ar) as name_en,
    description_ar,
    coalesce(description_en,description_ar) as description_en,
    case category_id
      when 'pdf' then 'files'
      when 'utilities' then 'utilities'
      when 'integrity' then 'academic'
      when 'ebooks' then 'books'
      when 'cat-academic' then 'academic'
      else coalesce(category_id,'general')
    end as category,
    url,
    coalesce(icon,'🔗') as icon,
    regexp_replace(regexp_replace(lower(trim(url)),'^https?://(www\.)?','','i'),'/+$','') as normalized_url
  from public.tool_registry
  where is_platform=false
    and url ~* '^https?://'
  order by regexp_replace(regexp_replace(lower(trim(url)),'^https?://(www\.)?','','i'),'/+$',''),sort_order,key
), numbered as (
  select *,row_number() over(order by category,name_ar) as rn
  from external_tools
)
insert into public.useful_sites(
  title_ar,title_en,description_ar,description_en,category,url,icon,sort_order,active,updated_at
)
select
  n.name_ar,
  n.name_en,
  coalesce(nullif(n.description_ar,''),'أداة مفيدة للطلاب.'),
  coalesce(nullif(n.description_en,''),nullif(n.description_ar,''),'Useful tool for students.'),
  n.category,
  n.url,
  n.icon,
  600+n.rn,
  true,
  now()
from numbered n
where not exists (
  select 1
  from public.useful_sites u
  where regexp_replace(regexp_replace(lower(trim(u.url)),'^https?://(www\.)?','','i'),'/+$','')=n.normalized_url
);

update public.tool_registry
set placement='hidden',updated_at=now()
where is_platform=false and url ~* '^https?://';

commit;
