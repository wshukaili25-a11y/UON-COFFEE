-- UON Hub V31.1 operations suite: features 4-10
begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_roles (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 label_ar text not null,
 permissions jsonb not null default '{}'::jsonb,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

insert into public.admin_roles(name,label_ar,permissions) values
 ('owner','مالك','{"all":true}'::jsonb),
 ('admin','مشرف عام','{"moderate":true,"catalog":true,"imports":true,"notifications":true,"analytics":true,"backups":true}'::jsonb),
 ('college_admin','مشرف كلية','{"moderate":true,"catalog":true,"college_scope":true,"notifications":true}'::jsonb),
 ('content_admin','مشرف ملفات','{"moderate":true,"imports":true,"catalog":true}'::jsonb),
 ('moderator','مراجع','{"moderate":true}'::jsonb)
on conflict(name) do update set label_ar=excluded.label_ar,permissions=excluded.permissions;

alter table if exists public.telegram_admins add column if not exists role_id uuid references public.admin_roles(id);
alter table if exists public.telegram_admins add column if not exists college_scope text;
alter table if exists public.telegram_admins add column if not exists active boolean not null default true;

create table if not exists public.bulk_upload_batches (
 id uuid primary key default gen_random_uuid(),
 source text not null default 'admin',
 college text,
 course_code text,
 content_type text not null default 'summary',
 status text not null default 'draft' check(status in ('draft','processing','review','completed','failed')),
 total_files integer not null default 0,
 imported_files integer not null default 0,
 failed_files integer not null default 0,
 created_by text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);

create table if not exists public.bulk_upload_items (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.bulk_upload_batches(id) on delete cascade,
 original_name text not null,
 display_name text,
 file_url text,
 storage_path text,
 mime_type text,
 size_bytes bigint,
 checksum text,
 status text not null default 'pending' check(status in ('pending','duplicate','imported','failed','rejected')),
 error_message text,
 summary_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create unique index if not exists bulk_upload_checksum_unique on public.bulk_upload_items(checksum) where checksum is not null and status <> 'rejected';
create index if not exists bulk_upload_items_batch_idx on public.bulk_upload_items(batch_id,status);

create table if not exists public.resource_feedback (
 id uuid primary key default gen_random_uuid(),
 resource_table text not null,
 resource_id text not null,
 session_id uuid not null,
 useful boolean,
 rating smallint check(rating between 1 and 5),
 comment text,
 status text not null default 'approved' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 unique(resource_table,resource_id,session_id)
);
create index if not exists resource_feedback_target_idx on public.resource_feedback(resource_table,resource_id,status);

create table if not exists public.notification_subscriptions (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 channel text not null default 'web' check(channel in ('web','telegram','email')),
 target_type text not null check(target_type in ('course','college','feature','all')),
 target_value text not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(session_id,channel,target_type,target_value)
);

create table if not exists public.notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid,
 subscription_id uuid references public.notification_subscriptions(id) on delete set null,
 channel text not null,
 status text not null default 'queued' check(status in ('queued','sent','failed','read')),
 error_message text,
 delivered_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
 id bigint generated always as identity primary key,
 actor text,
 action text not null,
 entity text,
 entity_id text,
 before_data jsonb,
 after_data jsonb,
 ip_hint text,
 created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_entity_idx on public.admin_audit_log(entity,entity_id);

create table if not exists public.soft_deleted_items (
 id uuid primary key default gen_random_uuid(),
 source_table text not null,
 source_id text not null,
 payload jsonb not null,
 deleted_by text,
 deleted_at timestamptz not null default now(),
 restore_until timestamptz not null default (now()+interval '30 days'),
 restored_at timestamptz
);

create or replace view public.resource_feedback_summary as
select resource_table,resource_id,
 count(*) filter(where status='approved') as votes,
 count(*) filter(where status='approved' and useful=true) as useful_votes,
 round(avg(rating) filter(where status='approved' and rating is not null),2) as average_rating
from public.resource_feedback group by resource_table,resource_id;

create or replace view public.daily_usage_analytics as
select date_trunc('day',created_at)::date as day,event_type,page_path,count(*) as events,
 count(distinct session_id) as sessions
from public.usage_events
group by 1,2,3;

alter table public.bulk_upload_batches enable row level security;
alter table public.bulk_upload_items enable row level security;
alter table public.resource_feedback enable row level security;
alter table public.notification_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.soft_deleted_items enable row level security;

drop policy if exists public_submit_feedback on public.resource_feedback;
create policy public_submit_feedback on public.resource_feedback for insert to anon,authenticated with check(status in ('approved','pending'));
drop policy if exists public_read_feedback_summary on public.resource_feedback;
create policy public_read_feedback_summary on public.resource_feedback for select to anon,authenticated using(status='approved');
drop policy if exists public_manage_subscriptions on public.notification_subscriptions;
create policy public_manage_subscriptions on public.notification_subscriptions for all to anon,authenticated using(true) with check(true);

-- Keep privileged operational tables private; admin-api/service role reads them.
revoke all on public.admin_roles,public.bulk_upload_batches,public.bulk_upload_items,public.notification_deliveries,public.admin_audit_log,public.soft_deleted_items from anon,authenticated;
grant select,insert,update on public.resource_feedback to anon,authenticated;
grant select,insert,update,delete on public.notification_subscriptions to anon,authenticated;
grant select on public.resource_feedback_summary,public.daily_usage_analytics to anon,authenticated;

commit;
