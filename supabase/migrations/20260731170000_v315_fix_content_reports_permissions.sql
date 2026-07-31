alter table public.content_reports enable row level security;

grant insert on table public.content_reports to anon, authenticated;
grant select, insert, update, delete on table public.content_reports to service_role;

drop policy if exists "public can submit content reports" on public.content_reports;
create policy "public can submit content reports"
on public.content_reports for insert to anon, authenticated
with check (status = 'pending');

drop policy if exists "public cannot read content reports" on public.content_reports;
create policy "public cannot read content reports"
on public.content_reports for select to anon, authenticated
using (false);
