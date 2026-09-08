create or replace function public.uon_public_contact_numbers()
returns table (
  label text,
  phone text,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.label,
    c.phone,
    c.sort_order
  from public.contact_numbers c
  where c.is_visible = true
    and nullif(trim(c.label), '') is not null
    and nullif(trim(c.phone), '') is not null
  order by c.sort_order asc, c.created_at asc;
$$;

revoke all on function public.uon_public_contact_numbers() from public;
grant execute on function public.uon_public_contact_numbers() to anon, authenticated;

comment on function public.uon_public_contact_numbers() is
  'Safe public projection of visible UON Hub contact numbers. Exposes label, phone and sort order only.';
