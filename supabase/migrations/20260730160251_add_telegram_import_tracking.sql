create table if not exists public.telegram_import_items (
  id uuid primary key default gen_random_uuid(),
  file_id_hash text not null unique,
  summary_id uuid references public.summaries(id) on delete set null,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  status text not null default 'processing',
  requested_by text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(file_id_hash) = 64),
  check (size_bytes is null or size_bytes between 0 and 20971520)
);

alter table public.telegram_import_items enable row level security;
revoke all on table public.telegram_import_items from anon, authenticated;

create index if not exists telegram_import_items_created_at_idx
on public.telegram_import_items (created_at desc);
