alter table public.backup_runs
add column if not exists size_bytes bigint;

alter table public.backup_runs
drop constraint if exists backup_runs_size_bytes_nonnegative;

alter table public.backup_runs
add constraint backup_runs_size_bytes_nonnegative
check (size_bytes is null or size_bytes >= 0);

alter table public.drive_import_items
add column if not exists summary_id uuid references public.summaries(id) on delete set null;

create unique index if not exists drive_import_items_drive_file_id_key
on public.drive_import_items (drive_file_id);

create table if not exists public.dropbox_import_runs (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  college text,
  status text not null default 'running',
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.dropbox_import_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.dropbox_import_runs(id) on delete cascade,
  dropbox_path text not null,
  file_name text not null,
  shared_url text,
  summary_id uuid references public.summaries(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists dropbox_import_items_path_key
on public.dropbox_import_items (dropbox_path);

alter table public.dropbox_import_runs enable row level security;
alter table public.dropbox_import_items enable row level security;
revoke all on table public.dropbox_import_runs from anon, authenticated;
revoke all on table public.dropbox_import_items from anon, authenticated;
