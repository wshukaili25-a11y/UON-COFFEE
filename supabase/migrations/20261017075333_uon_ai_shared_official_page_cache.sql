create table public.uon_ai_official_page_cache (
  url text primary key check (length(url) <= 1200 and url ~ '^https://www[.]unizwa[.]edu[.]om/(index|program_details|profile_details|search)[.]php[?]'),
  html text not null check (octet_length(html) <= 2400000),
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > fetched_at and expires_at <= fetched_at + interval '5 minutes')
);
create index uon_ai_official_page_cache_expiry on public.uon_ai_official_page_cache (expires_at);
alter table public.uon_ai_official_page_cache enable row level security;
revoke all on public.uon_ai_official_page_cache from public, anon, authenticated;
grant select, insert, update, delete on public.uon_ai_official_page_cache to service_role;
comment on table public.uon_ai_official_page_cache is 'Server-only short-lived official university HTML cache; not conversation or model answer storage.';
