-- UON Hub: AI moderation + analytics foundation

alter table public.ai_supervisor_reviews
  add column if not exists status text not null default 'pending',
  add column if not exists content_excerpt text,
  add column if not exists model_name text,
  add column if not exists confidence numeric(5,4),
  add column if not exists reviewed_by text,
  add column if not exists resolved_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists ai_supervisor_reviews_source_unique
  on public.ai_supervisor_reviews(source_table, source_id);

create index if not exists ai_supervisor_reviews_status_created_idx
  on public.ai_supervisor_reviews(status, created_at desc);

insert into public.ai_supervisor_settings (
  id, enabled, auto_approve_enabled, auto_approve_threshold,
  duplicate_detection_enabled, personal_data_detection_enabled,
  spam_detection_enabled, sensitive_content_detection_enabled,
  daily_report_enabled, updated_by, updated_at
)
values (true, true, false, 90, true, true, true, true, true, 'system', now())
on conflict (id) do nothing;

create or replace function public.uon_queue_moderation_review(
  p_source_table text,
  p_source_id text,
  p_excerpt text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_source_table not in ('confessions','summaries') then
    raise exception 'unsupported source table';
  end if;

  insert into public.ai_supervisor_reviews(
    source_table, source_id, content_excerpt, score,
    recommendation, reasons, flags, status, created_at
  ) values (
    p_source_table,
    left(p_source_id, 120),
    left(coalesce(p_excerpt,''), 500),
    0,
    'manual_review',
    '[]'::jsonb,
    '{}'::jsonb,
    'pending',
    now()
  )
  on conflict (source_table, source_id)
  do update set
    content_excerpt = excluded.content_excerpt,
    status = case when ai_supervisor_reviews.status='resolved' then 'pending' else ai_supervisor_reviews.status end,
    created_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.uon_queue_moderation_review(text,text,text) from public;
grant execute on function public.uon_queue_moderation_review(text,text,text) to service_role;

create or replace function public.uon_analytics_dashboard(p_days integer default 7)
returns jsonb
language sql
security definer
set search_path = public
as $$
with bounds as (
  select now() - make_interval(days => greatest(1, least(coalesce(p_days,7), 90))) as since
),
base as (
  select u.* from public.usage_events u, bounds b where u.created_at >= b.since
),
summary as (
  select
    count(*)::bigint as events,
    count(distinct session_id)::bigint as sessions,
    count(*) filter (where event_type='page_view')::bigint as page_views,
    count(*) filter (where event_type ilike '%download%')::bigint as downloads,
    count(*) filter (where event_type ilike '%search%')::bigint as searches
  from base
),
top_pages as (
  select coalesce(page_path,'/') page_path, count(*) total
  from base
  where event_type='page_view'
  group by 1 order by total desc limit 10
),
top_events as (
  select event_type, count(*) total
  from base
  group by 1 order by total desc limit 10
),
hourly as (
  select extract(hour from created_at at time zone 'Asia/Muscat')::int as peak_hour, count(*) total
  from base
  group by 1 order by total desc limit 6
),
moderation as (
  select
    count(*) filter (where status='pending')::bigint pending,
    count(*) filter (where recommendation='reject')::bigint rejected,
    count(*) filter (where recommendation='approve')::bigint approved,
    count(*)::bigint total
  from public.ai_supervisor_reviews r, bounds b
  where r.created_at >= b.since
)
select jsonb_build_object(
  'generated_at', now(),
  'days', greatest(1, least(coalesce(p_days,7), 90)),
  'summary', (select to_jsonb(summary) from summary),
  'top_pages', coalesce((select jsonb_agg(to_jsonb(top_pages)) from top_pages), '[]'::jsonb),
  'top_events', coalesce((select jsonb_agg(to_jsonb(top_events)) from top_events), '[]'::jsonb),
  'peak_hours', coalesce((select jsonb_agg(to_jsonb(hourly)) from hourly), '[]'::jsonb),
  'moderation', (select to_jsonb(moderation) from moderation)
);
$$;

revoke all on function public.uon_analytics_dashboard(integer) from public;
grant execute on function public.uon_analytics_dashboard(integer) to service_role;
