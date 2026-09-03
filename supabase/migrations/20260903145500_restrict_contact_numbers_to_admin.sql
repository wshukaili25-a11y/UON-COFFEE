revoke all on table public.contact_numbers from public, anon, authenticated;
grant select, insert, update, delete on table public.contact_numbers to service_role;
