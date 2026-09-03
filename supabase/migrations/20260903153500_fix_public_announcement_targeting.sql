create or replace function public.uon_public_announcements_core_v1(
  p_college text default null,
  p_feature text default null
)
returns setof public.site_announcements
language sql
stable
security definer
set search_path = ''
as $$
  select a.*
  from public.site_announcements a
  where a.active is true
    and (a.starts_at is null or a.starts_at <= now())
    and (coalesce(a.ends_at,a.expires_at) is null or coalesce(a.ends_at,a.expires_at) > now())
    and (a.feature_key is null or (p_feature is not null and a.feature_key = p_feature))
    and (
      coalesce(cardinality(a.college_scope),0)=0
      or (p_college is not null and p_college = any(a.college_scope))
    )
  order by a.priority desc,a.created_at desc;
$$;

revoke all on function public.uon_public_announcements_core_v1(text,text) from public,anon,authenticated;
grant execute on function public.uon_public_announcements_core_v1(text,text) to service_role;
