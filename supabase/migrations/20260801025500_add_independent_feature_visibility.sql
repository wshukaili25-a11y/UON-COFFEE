alter table public.platform_features
 add column if not exists is_visible boolean not null default true;

insert into public.platform_features(key,name,status,sort_order,is_visible)
values
 ('calendar','التقويم الأكاديمي','active',14,true),
 ('feedback','اقتراح ميزة','active',15,true)
on conflict (key) do update set
 name=excluded.name,
 sort_order=excluded.sort_order;

update public.platform_features
set is_visible=false,updated_at=now()
where key='courses';

create or replace function public.uon_public_state()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
select jsonb_build_object(
 'maintenance_enabled',coalesce((
   select value='true'::jsonb or lower(trim(both '"' from value::text))='true'
   from public.site_settings where key='maintenance_enabled' limit 1
 ),false),
 'maintenance_message',coalesce((
   select trim(both '"' from value::text)
   from public.site_settings where key='maintenance_message' limit 1
 ),'الموقع تحت الصيانة'),
 'maintenance_until',(
   select case when value is null or value='null'::jsonb then null else trim(both '"' from value::text) end
   from public.site_settings where key='maintenance_until' limit 1
 ),
 'features',coalesce((select jsonb_object_agg(key,status) from public.platform_features),'{}'::jsonb),
 'visibility',coalesce((select jsonb_object_agg(key,is_visible) from public.platform_features),'{}'::jsonb),
 'updated_at',greatest(
   coalesce((select max(updated_at) from public.platform_features),'epoch'::timestamptz),
   coalesce((select max(updated_at) from public.site_settings),'epoch'::timestamptz)
 )
);
$function$;

create or replace function public.uon_set_feature_visibility(p_key text,p_visible boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
 update public.platform_features
 set is_visible=p_visible,updated_at=now()
 where key=p_key;
 if not found then raise exception 'Feature not found: %',p_key; end if;
 return public.uon_public_state();
end
$function$;

revoke all on function public.uon_set_feature_visibility(text,boolean) from public,anon,authenticated;
grant execute on function public.uon_set_feature_visibility(text,boolean) to service_role;
