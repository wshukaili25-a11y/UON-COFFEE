alter table public.uon_ai_conversations
  drop constraint if exists uon_ai_conversations_channel_check;

alter table public.uon_ai_conversations
  add constraint uon_ai_conversations_channel_check
  check (channel = any (array['web'::text,'instagram'::text,'whatsapp'::text,'telegram'::text]));

create table if not exists public.uon_ai_social_events (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('instagram','whatsapp')),
  event_id text not null,
  sender_hash text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (channel,event_id)
);

create index if not exists uon_ai_social_events_received_idx
  on public.uon_ai_social_events (received_at desc);

alter table public.uon_ai_social_events enable row level security;

revoke all on table public.uon_ai_social_events from anon, authenticated;
