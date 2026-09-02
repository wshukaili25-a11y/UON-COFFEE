create table if not exists public.uon_ai_model_health (
  model text primary key,
  failure_count integer not null default 0,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  disabled_until timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.uon_ai_model_health enable row level security;
revoke all on table public.uon_ai_model_health from public, anon, authenticated;
create index if not exists uon_ai_model_health_disabled_until_idx
  on public.uon_ai_model_health(disabled_until);
