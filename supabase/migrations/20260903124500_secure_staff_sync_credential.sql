-- Store the staff-directory sync credential in Supabase Vault instead of SQL/function source.
-- Existing environments keep their current credential; fresh environments create one.

do $$
begin
  if not exists (select 1 from vault.secrets where name='uon_staff_sync_v1') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'uon_staff_sync_v1',
      'UON Hub staff directory sync credential'
    );
  end if;
end $$;

create or replace function public.uon_staff_sync_token_valid(p_token text)
returns boolean
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select coalesce(exists(
    select 1
    from vault.decrypted_secrets
    where name='uon_staff_sync_v1'
      and decrypted_secret=p_token
  ),false);
$$;

revoke all on function public.uon_staff_sync_token_valid(text) from public, anon, authenticated;
grant execute on function public.uon_staff_sync_token_valid(text) to service_role;

create or replace function public.uon_internal_sync_staff_page(p_page integer)
returns bigint
language sql
security definer
set search_path = public, net, vault, pg_temp
as $$
  select net.http_post(
    url := 'https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/sync-uon-staff',
    headers := jsonb_build_object(
      'x-sync-token',(select decrypted_secret from vault.decrypted_secrets where name='uon_staff_sync_v1' limit 1),
      'Content-Type','application/json'
    ),
    body := jsonb_build_object(
      'start_page',greatest(1,least(p_page,58)),
      'end_page',greatest(1,least(p_page,58))
    )
  );
$$;

revoke all on function public.uon_internal_sync_staff_page(integer) from public, anon, authenticated;
grant execute on function public.uon_internal_sync_staff_page(integer) to service_role;
