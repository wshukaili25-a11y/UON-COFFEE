create table if not exists public.ai_supervisor_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default true,
  auto_approve_enabled boolean not null default false,
  auto_approve_threshold integer not null default 97 check (auto_approve_threshold between 85 and 100),
  duplicate_detection_enabled boolean not null default true,
  personal_data_detection_enabled boolean not null default true,
  spam_detection_enabled boolean not null default true,
  sensitive_content_detection_enabled boolean not null default true,
  daily_report_enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.ai_supervisor_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.ai_supervisor_reviews (
  id bigint generated always as identity primary key,
  source_table text not null,
  source_id text not null,
  score integer not null check (score between 0 and 100),
  recommendation text not null check (recommendation in ('approve','review','reject')),
  reasons jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  duplicate_of text,
  reviewed_by_ai_at timestamptz not null default now(),
  unique(source_table, source_id)
);

create table if not exists public.moderation_assignments (
  id bigint generated always as identity primary key,
  source_table text not null,
  source_id text not null,
  assigned_to_chat_id text not null,
  assigned_by_chat_id text not null,
  status text not null default 'assigned' check (status in ('assigned','reviewing','done','cancelled')),
  note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists moderation_assignments_open_unique
  on public.moderation_assignments(source_table, source_id, assigned_to_chat_id)
  where status in ('assigned','reviewing');

create table if not exists public.moderation_decisions (
  id bigint generated always as identity primary key,
  source_table text not null,
  source_id text not null,
  action text not null,
  old_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  admin_chat_id text not null,
  admin_name text,
  note text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by_chat_id text
);

create index if not exists ai_supervisor_reviews_source_idx on public.ai_supervisor_reviews(source_table,source_id);
create index if not exists ai_supervisor_reviews_queue_idx on public.ai_supervisor_reviews(recommendation,score,reviewed_by_ai_at desc);
create index if not exists moderation_assignments_assignee_idx on public.moderation_assignments(assigned_to_chat_id,status,created_at desc);
create index if not exists moderation_decisions_source_idx on public.moderation_decisions(source_table,source_id,created_at desc);

alter table public.ai_supervisor_settings enable row level security;
alter table public.ai_supervisor_reviews enable row level security;
alter table public.moderation_assignments enable row level security;
alter table public.moderation_decisions enable row level security;
