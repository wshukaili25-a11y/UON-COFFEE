create or replace function public.claim_telegram_web_notification(
  p_source_table text,
  p_source_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_rows integer;
begin
  if p_source_table not in (
    'summaries',
    'whatsapp_groups',
    'rating_submissions',
    'confessions',
    'student_projects',
    'course_requests',
    'feature_suggestions',
    'broken_link_reports'
  ) or length(p_source_id) not between 1 and 100 then
    raise exception 'invalid_notification_claim';
  end if;

  -- Serialize the count and insert so parallel requests cannot race past the
  -- global per-minute notification limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('uon_telegram_web_notification_rate', 0)
  );

  if exists (
    select 1
    from public.telegram_web_notifications
    where source_table = p_source_table
      and source_id = p_source_id
  ) then
    return 'duplicate';
  end if;

  if (
    select count(*)
    from public.telegram_web_notifications
    where created_at >= pg_catalog.clock_timestamp() - interval '1 minute'
  ) >= 10 then
    return 'rate_limited';
  end if;

  insert into public.telegram_web_notifications (source_table, source_id)
  values (p_source_table, p_source_id)
  on conflict do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return 'duplicate'; end if;
  return 'claimed';
end;
$$;

revoke all on function public.claim_telegram_web_notification(text, text)
from public, anon, authenticated;

grant execute on function public.claim_telegram_web_notification(text, text)
to service_role;
