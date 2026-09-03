create or replace function public.uon_global_search_v42_core_v1(p_query text, p_limit integer default 30, p_language text default 'ar')
returns table(result_type text,result_id text,title text,subtitle text,url text,score numeric,meta jsonb)
language sql
stable
security definer
set search_path to 'public','extensions'
as $$
with q as (select trim(coalesce(p_query,'')) s, greatest(1,least(coalesce(p_limit,30),80)) lim), items(result_type,result_id,title,subtitle,url,score,meta) as (
 select 'course'::text,c.id::text,case when p_language='en' then coalesce(nullif(c.name_en,''),c.name_ar,c.code) else coalesce(nullif(c.name_ar,''),c.name_en,c.code) end,
 concat_ws(' • ',c.code,case when p_language='en' then coalesce(c.college_en,c.college) else coalesce(c.college_ar,c.college) end),'/course.html?code='||c.code,
 greatest(similarity(lower(c.code),lower(q.s))*2,similarity(lower(coalesce(c.name_ar,'')),lower(q.s)),similarity(lower(coalesce(c.name_en,'')),lower(q.s)))::numeric,
 jsonb_build_object('code',c.code,'hours',c.credit_hours,'level',c.level)
 from public.courses c,q where c.active is true and c.status='approved' and q.s<>'' and (c.code ilike '%'||q.s||'%' or c.name_ar ilike '%'||q.s||'%' or c.name_en ilike '%'||q.s||'%' or coalesce(c.college_ar,c.college,'') ilike '%'||q.s||'%')
 union all
 select 'summary',s.id::text,coalesce(s.title,s.subject,'ملخص'),concat_ws(' • ',s.course_code,s.college),coalesce(s.url,s.pdf_url,s.link,'/summaries.html'),
 greatest(similarity(lower(coalesce(s.course_code,'')),lower(q.s))*2,similarity(lower(coalesce(s.title,'')),lower(q.s)),similarity(lower(coalesce(s.subject,'')),lower(q.s)))::numeric,
 jsonb_build_object('course_code',s.course_code,'downloads',s.downloads,'rating',s.rating,'content_type',coalesce(s.content_type,s.resource_type))
 from public.summaries s,q where s.approved is true and q.s<>'' and (s.course_code ilike '%'||q.s||'%' or s.title ilike '%'||q.s||'%' or s.subject ilike '%'||q.s||'%' or coalesce(s.description,'') ilike '%'||q.s||'%')
 union all
 select 'group',g.id::text,coalesce(g.subject,g.course_code,'مجموعة'),concat_ws(' • ',g.course_code,g.college),coalesce(g.link,'/groups.html'),
 greatest(similarity(lower(coalesce(g.course_code,'')),lower(q.s))*2,similarity(lower(coalesce(g.subject,'')),lower(q.s)))::numeric,
 jsonb_build_object('course_code',g.course_code,'members_count',g.members_count)
 from public.whatsapp_groups g,q where g.approved is true and q.s<>'' and (g.course_code ilike '%'||q.s||'%' or g.subject ilike '%'||q.s||'%' or g.college ilike '%'||q.s||'%' or coalesce(g.description,'') ilike '%'||q.s||'%')
 union all
 select 'project',p.id::text,p.title,coalesce(p.major,''),coalesce(p.demo_url,p.github_url,p.url,'/projects.html'),
 greatest(similarity(lower(coalesce(p.title,'')),lower(q.s)),similarity(lower(coalesce(p.major,'')),lower(q.s)),similarity(lower(coalesce(p.description,'')),lower(q.s)))::numeric,
 jsonb_build_object('major',p.major,'views',p.views,'likes',p.likes)
 from public.student_projects p,q where p.status='approved' and q.s<>'' and (p.title ilike '%'||q.s||'%' or p.major ilike '%'||q.s||'%' or p.description ilike '%'||q.s||'%')
 union all
 select 'site',u.id::text,case when p_language='en' then coalesce(u.title_en,u.title_ar) else coalesce(u.title_ar,u.title_en) end,
 case when p_language='en' then coalesce(u.description_en,u.category,'') else coalesce(u.description_ar,u.category,'') end,u.url,
 greatest(similarity(lower(coalesce(u.title_ar,'')),lower(q.s)),similarity(lower(coalesce(u.title_en,'')),lower(q.s)))::numeric,
 jsonb_build_object('category',u.category,'icon',u.icon)
 from public.useful_sites u,q where u.active is true and q.s<>'' and (u.title_ar ilike '%'||q.s||'%' or u.title_en ilike '%'||q.s||'%' or u.description_ar ilike '%'||q.s||'%' or u.description_en ilike '%'||q.s||'%')
 union all
 select 'program',p.id::text,case when p_language='en' then coalesce(p.name_en,p.name_ar) else coalesce(p.name_ar,p.name_en) end,concat_ws(' • ',p.college,p.degree),coalesce(p.official_url,'/university-guide.html'),
 greatest(similarity(lower(coalesce(p.name_ar,'')),lower(q.s)),similarity(lower(coalesce(p.name_en,'')),lower(q.s)))::numeric,
 jsonb_build_object('college',p.college,'degree',p.degree,'credit_hours',p.credit_hours)
 from public.university_programs p,q where p.active is true and q.s<>'' and (p.name_ar ilike '%'||q.s||'%' or p.name_en ilike '%'||q.s||'%' or p.college ilike '%'||q.s||'%')
)
select * from items order by 6 desc,3 limit (select lim from q);
$$;

create or replace function public.uon_global_search_v44_core_v1(p_query text,p_limit integer default 40,p_language text default 'ar')
returns table(result_type text,result_id text,title text,subtitle text,url text,score numeric,meta jsonb)
language sql
stable
security definer
set search_path to 'public','extensions'
as $$
with base as (select * from public.uon_global_search_v42(p_query,p_limit,p_language)), q as (select trim(coalesce(p_query,'')) s), tool_items as (
 select 'tool'::text,r.key,case when p_language='en' then coalesce(nullif(r.name_en,''),r.name_ar) else r.name_ar end,
 case when p_language='en' then coalesce(nullif(r.description_en,''),r.description_ar,'') else coalesce(r.description_ar,'') end,
 r.url,greatest(similarity(lower(r.name_ar),lower(q.s)),similarity(lower(coalesce(r.name_en,'')),lower(q.s)),similarity(lower(coalesce(r.description_ar,'')),lower(q.s)))::numeric,
 jsonb_build_object('icon',r.icon,'status',r.status,'placement',r.placement,'short_slug',r.short_slug)
 from public.tool_registry r,q where q.s<>'' and r.publish_status='published' and r.is_visible and r.placement<>'hidden' and r.status='active'
  and coalesce(r.audience->>'type','all')='all'
  and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now())
  and (r.name_ar ilike '%'||q.s||'%' or r.name_en ilike '%'||q.s||'%' or r.description_ar ilike '%'||q.s||'%' or r.description_en ilike '%'||q.s||'%')
), all_items as (select * from base union all select * from tool_items)
select * from all_items order by score desc,title limit greatest(1,least(coalesce(p_limit,40),100));
$$;

revoke all on function public.uon_global_search_v42_core_v1(text,integer,text) from public,anon,authenticated;
revoke all on function public.uon_global_search_v44_core_v1(text,integer,text) from public,anon,authenticated;
grant execute on function public.uon_global_search_v42_core_v1(text,integer,text) to service_role;
grant execute on function public.uon_global_search_v44_core_v1(text,integer,text) to service_role;
