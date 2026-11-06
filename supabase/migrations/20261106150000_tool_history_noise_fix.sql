-- UON Hub 2026-11-06: stop hourly health checks from flooding tool_versions,
-- remove the existing noise rows, and keep tool_health_checks bounded.
-- Real edit history (any change beyond health/updated_at fields) is preserved.

create or replace function public.uon_tool_history_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor text := coalesce(current_setting('app.actor', true), 'system');
  v_noise constant text[] := array['health_status','health_checked_at','last_error','updated_at'];
begin
  if tg_op = 'INSERT' then
    insert into public.tool_versions(tool_key,action,new_snapshot,actor,source)
    values (new.key,'insert',to_jsonb(new),v_actor,'trigger');
    return new;
  elsif tg_op = 'UPDATE' then
    -- Ignore updates that only touch health-monitoring / timestamp fields.
    if (to_jsonb(old) - v_noise) is distinct from (to_jsonb(new) - v_noise) then
      insert into public.tool_versions(tool_key,action,old_snapshot,new_snapshot,actor,source)
      values (new.key,'update',to_jsonb(old),to_jsonb(new),v_actor,'trigger');
    end if;
    return new;
  else
    insert into public.tool_versions(tool_key,action,old_snapshot,actor,source)
    values (old.key,'delete',to_jsonb(old),v_actor,'trigger');
    return old;
  end if;
end;
$function$;

-- Remove historical noise: update rows whose only differences are health/timestamp fields.
delete from public.tool_versions v
where v.action = 'update'
  and v.undone_at is null
  and (v.old_snapshot - array['health_status','health_checked_at','last_error','updated_at'])
      is not distinct from
      (v.new_snapshot - array['health_status','health_checked_at','last_error','updated_at']);

-- Keep 30 days of raw health-check samples.
delete from public.tool_health_checks where checked_at < now() - interval '30 days';

-- Daily retention job (idempotent).
select cron.unschedule(jobid) from cron.job where jobname = 'uon_tool_health_retention';
select cron.schedule(
  'uon_tool_health_retention',
  '50 0 * * *',
  $$delete from public.tool_health_checks where checked_at < now() - interval '30 days'$$
);
