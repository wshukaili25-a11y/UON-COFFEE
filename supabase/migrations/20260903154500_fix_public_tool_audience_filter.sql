create or replace function public.uon_public_tool_catalog_core_v1(p_college text default null)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
select jsonb_build_object(
 'version',public.uon_catalog_version(),
 'updated_at',greatest(coalesce((select max(updated_at) from public.tool_registry),'epoch'::timestamptz),coalesce((select max(updated_at) from public.site_settings where key='tool_catalog_version'),'epoch'::timestamptz)),
 'items',coalesce((
  select jsonb_agg(jsonb_build_object(
   'key',r.key,'category_id',r.category_id,'name_ar',r.name_ar,'name_en',r.name_en,
   'description_ar',r.description_ar,'description_en',r.description_en,'url',r.url,'icon',r.icon,'color',r.color,
   'status',r.status,'is_visible',r.is_visible,'is_platform',r.is_platform,'placement',r.placement,'sort_order',r.sort_order,
   'maintenance_message',r.maintenance_message,'starts_at',r.starts_at,'ends_at',r.ends_at,'short_slug',r.short_slug,
   'health_status',r.health_status,'health_checked_at',r.health_checked_at,'version_no',r.version_no
  ) order by r.sort_order,r.name_ar)
  from public.tool_registry r
  where r.publish_status='published' and r.is_visible=true and r.placement<>'hidden'
    and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now())
    and (
      coalesce(r.audience->>'type','all')='all'
      or (p_college is not null and coalesce(r.audience->'colleges','[]'::jsonb) ? p_college)
    )
 ),'[]'::jsonb)
);
$$;

revoke all on function public.uon_public_tool_catalog_core_v1(text) from public,anon,authenticated;
grant execute on function public.uon_public_tool_catalog_core_v1(text) to service_role;
