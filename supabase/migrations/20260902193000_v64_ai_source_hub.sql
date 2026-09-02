-- UON Hub V64 — source-aware AI knowledge ingestion

alter table public.uon_ai_knowledge
  add column if not exists source_provider text,
  add column if not exists source_external_id text,
  add column if not exists source_type text,
  add column if not exists fetched_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists confidence numeric(4,3) not null default 0.750,
  add column if not exists verification_status text not null default 'approved',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists last_verified_at timestamptz;

alter table public.uon_ai_knowledge
  drop constraint if exists uon_ai_knowledge_confidence_check;
alter table public.uon_ai_knowledge
  add constraint uon_ai_knowledge_confidence_check check (confidence >= 0 and confidence <= 1);

alter table public.uon_ai_knowledge
  drop constraint if exists uon_ai_knowledge_verification_status_check;
alter table public.uon_ai_knowledge
  add constraint uon_ai_knowledge_verification_status_check
  check (verification_status in ('pending','approved','rejected','stale'));

create unique index if not exists uon_ai_knowledge_source_external_uidx
  on public.uon_ai_knowledge(source_provider, source_external_id)
  where source_provider is not null and source_external_id is not null;
create index if not exists uon_ai_knowledge_content_hash_idx
  on public.uon_ai_knowledge(content_hash)
  where content_hash is not null;
create index if not exists uon_ai_knowledge_source_status_idx
  on public.uon_ai_knowledge(source_provider, verification_status, active);

alter table public.import_sources
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_type text not null default 'external',
  add column if not exists trust_level smallint not null default 70,
  add column if not exists refresh_minutes integer not null default 1440,
  add column if not exists next_sync_at timestamptz,
  add column if not exists last_status text,
  add column if not exists last_error text,
  add column if not exists allow_auto_publish boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.import_sources
  drop constraint if exists import_sources_trust_level_check;
alter table public.import_sources
  add constraint import_sources_trust_level_check check (trust_level between 0 and 100);
alter table public.import_sources
  drop constraint if exists import_sources_refresh_minutes_check;
alter table public.import_sources
  add constraint import_sources_refresh_minutes_check check (refresh_minutes between 15 and 43200);

create table if not exists public.uon_ai_source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.import_sources(id) on delete set null,
  provider text not null,
  status text not null default 'running' check (status in ('running','success','partial','failed','skipped')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.uon_ai_source_sync_runs enable row level security;
create index if not exists uon_ai_source_sync_runs_source_idx
  on public.uon_ai_source_sync_runs(source_id, started_at desc);

-- Google Maps Platform content must not be persisted beyond allowed policy exceptions.
-- This table stores only durable Place IDs plus UON Hub's own annotations/tags.
create table if not exists public.uon_ai_google_place_refs (
  place_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  query_tags text[] not null default '{}',
  campus_relevance numeric(4,3) not null default 0.500 check (campus_relevance >= 0 and campus_relevance <= 1),
  own_notes text,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.uon_ai_google_place_refs enable row level security;
create index if not exists uon_ai_google_place_refs_last_seen_idx
  on public.uon_ai_google_place_refs(last_seen_at desc);

-- Seed official University of Nizwa sources. Existing rows are updated safely by provider/source_id.
insert into public.import_sources(provider,source_id,source_name,source_url,source_type,active,trust_level,refresh_minutes,allow_auto_publish,settings,next_sync_at)
values
 ('university_page','uon-home','University of Nizwa — Home','https://www.unizwa.edu.om/','official_web',true,100,360,true,'{"official":true,"language":"auto"}'::jsonb,now()),
 ('university_page','uon-calendar','University of Nizwa — Academic Calendar','https://www.unizwa.edu.om/index.php?contentid=1071&lang=en','official_web',true,100,180,true,'{"official":true,"category":"calendar"}'::jsonb,now()),
 ('university_page','uon-programs','University of Nizwa — Academic Programs','https://www.unizwa.edu.om/index.php?contentid=623&lang=en','official_web',true,100,720,true,'{"official":true,"category":"programs"}'::jsonb,now()),
 ('university_page','uon-rules','University of Nizwa — Rules','https://www.unizwa.edu.om/index.php?contentid=1068&lang=en','official_web',true,100,720,true,'{"official":true,"category":"policy"}'::jsonb,now()),
 ('university_page','uon-contact','University of Nizwa — Contact','https://www.unizwa.edu.om/index.php?contentid=201&lang=en','official_web',true,100,720,true,'{"official":true,"category":"contact"}'::jsonb,now()),
 ('university_page','uon-map','University of Nizwa — Campus Map','https://www.unizwa.edu.om/index.php?contentid=626&lang=en','official_web',true,100,1440,true,'{"official":true,"category":"map"}'::jsonb,now())
on conflict (provider,source_id) do update set
  source_name=excluded.source_name,
  source_url=excluded.source_url,
  source_type=excluded.source_type,
  trust_level=excluded.trust_level,
  refresh_minutes=excluded.refresh_minutes,
  allow_auto_publish=excluded.allow_auto_publish,
  settings=coalesce(public.import_sources.settings,'{}'::jsonb) || excluded.settings,
  updated_at=now();
