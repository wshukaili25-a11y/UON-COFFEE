-- Keep public UI settings readable while preventing operational credentials
-- from being exposed through the public site_settings SELECT policy.

drop policy if exists public_read_site_settings on public.site_settings;

create policy public_read_site_settings
on public.site_settings
for select
to anon, authenticated
using (key !~* '(secret|password|private|service[_-]?role|token)');

-- Rotate the operations cron credential because the previous value lived in a
-- row that was historically publicly readable.
update public.site_settings
set value = to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')),
    updated_at = now()
where key = 'ops_cron_secret';
