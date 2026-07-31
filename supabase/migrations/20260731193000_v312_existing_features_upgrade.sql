-- V31.2 upgrades existing assistant, ratings, calendar and moderation features.
create table if not exists public.content_reports (
 id uuid primary key default gen_random_uuid(),
 reason text not null check (reason in ('incorrect','broken_link','duplicate','inappropriate','privacy','other')),
 content_title text,
 details text not null,
 page_url text not null,
 page_title text,
 status text not null default 'pending' check (status in ('pending','reviewing','resolved','rejected')),
 reviewer_note text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists content_reports_status_created_idx on public.content_reports(status,created_at desc);
alter table public.content_reports enable row level security;
drop policy if exists "public can submit content reports" on public.content_reports;
create policy "public can submit content reports" on public.content_reports for insert to anon,authenticated with check (status='pending');
drop policy if exists "public cannot read content reports" on public.content_reports;
create policy "public cannot read content reports" on public.content_reports for select to anon using (false);

-- Helpful indexes for the existing features.
create index if not exists rating_submissions_status_target_idx on public.rating_submissions(status,target_type,target_name);
create index if not exists academic_calendar_events_active_start_idx on public.academic_calendar_events(active,start_date);
