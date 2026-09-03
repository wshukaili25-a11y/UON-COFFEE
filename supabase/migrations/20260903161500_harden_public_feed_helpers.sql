create or replace function public.uon_home_popular(p_days integer default 7, p_limit integer default 6)
returns table(label text, uses bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  with raw as (
    select
      upper(nullif(trim(coalesce(metadata->>'code',metadata->>'course_code','')),'')) as course_code,
      lower(coalesce(nullif(trim(metadata->>'page'),''),event_type,'')) as source_label
    from public.usage_events
    where created_at >= now() - make_interval(days => greatest(1,least(coalesce(p_days,7),30)))
  ), normalized as (
    select case
      when r.course_code is not null and exists(
        select 1 from public.courses c where c.code=r.course_code and c.active is true and c.status='approved'
      ) then r.course_code
      when r.source_label ~ 'summar' then 'SUMMARIES'
      when r.source_label ~ 'group|whatsapp' then 'GROUPS'
      when r.source_label ~ 'calendar' then 'CALENDAR'
      when r.source_label ~ 'assistant|uon[-_ ]?ai' then 'UON AI'
      when r.source_label ~ 'rating' then 'RATINGS'
      when r.source_label ~ 'global[_ -]?search|search' then 'SEARCH'
      when r.source_label ~ 'useful[_ -]?site' then 'USEFUL SITES'
      when r.source_label ~ 'schedule' then 'SCHEDULE'
      when r.source_label ~ '(^|[/_-])gpa([._/-]|$)' then 'GPA'
      when r.source_label ~ 'project' then 'PROJECTS'
      when r.source_label ~ 'confession' then 'CONFESSIONS'
      when r.source_label ~ 'university[_ -]?guide|guide' then 'UNIVERSITY GUIDE'
      when r.source_label ~ 'tool|feature_open' then 'TOOLS'
      else null end as safe_label
    from raw r
  )
  select n.safe_label,count(*)::bigint
  from normalized n
  where n.safe_label is not null
  group by n.safe_label
  order by count(*) desc,n.safe_label
  limit greatest(1,least(coalesce(p_limit,6),20));
$$;

create or replace function public.get_anonymous_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_handle text:=lower(trim(coalesce(p_handle,'')));
  v_profile public.anonymous_profiles%rowtype;
begin
  if octet_length(coalesce(p_handle,''))>80 or v_handle !~ '^[a-z0-9_]{3,24}$' then return null; end if;
  if not public.uon_public_rate_allow('anonymous_profile_read',null,500,3600) then
    return jsonb_build_object('ok',false,'error','محاولات كثيرة، حاول بعد قليل','rate_limited',true);
  end if;
  if not public.uon_public_rate_allow('anonymous_profile_target',v_handle,120,3600) then
    return jsonb_build_object('ok',false,'error','محاولات كثيرة، حاول بعد قليل','rate_limited',true);
  end if;
  select * into v_profile from public.anonymous_profiles where handle=v_handle and is_active=true;
  if v_profile.id is null then return null; end if;
  return jsonb_build_object(
    'handle',v_profile.handle,'display_name',v_profile.display_name,'bio',v_profile.bio,'inbox_open',v_profile.inbox_open,
    'messages',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'body',m.body,'reply',m.reply,'created_at',m.created_at,'published_at',m.published_at
      ) order by m.published_at desc)
      from (
        select id,body,reply,created_at,published_at
        from public.anonymous_messages
        where recipient_id=v_profile.id and status='published'
        order by published_at desc
        limit 100
      ) m
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.uon_summary_rating_stats(p_ids text[])
returns table(resource_id text,average numeric,total bigint,recommended_percent numeric,stars jsonb,comments jsonb)
language sql
stable
security definer
set search_path to ''
as $$
 select * from public.uon_summary_rating_stats_core_v1(
   array(
     select left(x,100)
     from unnest(coalesce(p_ids,array[]::text[])) x
     where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and exists(select 1 from public.summaries s where s.id=x::uuid and s.approved is true)
     limit 100
   )
 );
$$;
