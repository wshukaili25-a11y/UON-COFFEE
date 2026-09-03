-- The current confession page submits pending comments directly to this table.
-- Restore only INSERT, keep the strict pending-only RLS policy, and add client rate limits.
create or replace function public.uon_guard_confession_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.uon_public_rate_allow('confession_comment_total', null, 12, 3600) then
    raise exception 'rate_limited';
  end if;
  if not public.uon_public_rate_allow('confession_comment_target', new.confession_id::text, 4, 600) then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

revoke all on function public.uon_guard_confession_comment_insert() from public, anon, authenticated;
grant execute on function public.uon_guard_confession_comment_insert() to service_role;

drop trigger if exists uon_guard_confession_comment_insert on public.confession_comments;
create trigger uon_guard_confession_comment_insert
before insert on public.confession_comments
for each row execute function public.uon_guard_confession_comment_insert();

grant insert on table public.confession_comments to anon, authenticated;
