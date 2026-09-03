-- Current deferred UX module sends platform feedback directly to this table.
-- Restore only a tightly constrained, rate-limited pending INSERT path.
drop policy if exists public_insert_pending_platform_feedback on public.platform_feedback;
create policy public_insert_pending_platform_feedback
on public.platform_feedback
for insert
to anon, authenticated
with check (
  status='pending'
  and rating between 1 and 5
  and char_length(coalesce(comment,'')) <= 1200
  and char_length(coalesce(page_path,'')) <= 300
  and (page_path is null or page_path like '/%')
);

create or replace function public.uon_guard_platform_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.uon_public_rate_allow('platform_feedback_total', null, 6, 3600) then
    raise exception 'rate_limited';
  end if;
  if not public.uon_public_rate_allow('platform_feedback_page', left(coalesce(new.page_path,''),200), 2, 3600) then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

revoke all on function public.uon_guard_platform_feedback_insert() from public, anon, authenticated;
grant execute on function public.uon_guard_platform_feedback_insert() to service_role;

drop trigger if exists uon_guard_platform_feedback_insert on public.platform_feedback;
create trigger uon_guard_platform_feedback_insert
before insert on public.platform_feedback
for each row execute function public.uon_guard_platform_feedback_insert();

grant insert on table public.platform_feedback to anon, authenticated;
