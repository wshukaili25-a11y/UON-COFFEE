create table if not exists public.contact_numbers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_numbers enable row level security;

drop policy if exists "Public can view visible contact numbers" on public.contact_numbers;
create policy "Public can view visible contact numbers"
on public.contact_numbers for select
to anon, authenticated
using (is_visible = true);

create index if not exists contact_numbers_sort_idx
on public.contact_numbers (sort_order, created_at);

insert into public.contact_numbers (label, phone, sort_order)
select v.label, v.phone, v.sort_order
from (values
  ('الرقم العام', '+968 2544 0000', 10),
  ('القبول والتسجيل', '+968 2544 0000', 20),
  ('المالية', '+968 2544 0000', 30),
  ('الرعاية الاجتماعية', '+968 2544 0000', 40)
) as v(label, phone, sort_order)
where not exists (select 1 from public.contact_numbers);
