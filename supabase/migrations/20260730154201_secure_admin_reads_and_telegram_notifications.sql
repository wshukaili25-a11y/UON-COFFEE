-- Keep moderation queues and operational telemetry private. Admin reads are
-- served by the password-protected admin-api Edge Function using service role.

drop policy if exists public_read_summaries on public.summaries;
create policy public_read_approved_summaries
on public.summaries
for select
to anon, authenticated
using (approved is true);

drop policy if exists public_insert_summaries on public.summaries;
create policy public_insert_pending_summaries
on public.summaries
for insert
to anon, authenticated
with check (coalesce(approved, false) is false);

drop policy if exists public_read_whatsapp_groups on public.whatsapp_groups;
create policy public_read_approved_whatsapp_groups
on public.whatsapp_groups
for select
to anon, authenticated
using (approved is true);

drop policy if exists public_insert_whatsapp_groups on public.whatsapp_groups;
create policy public_insert_pending_whatsapp_groups
on public.whatsapp_groups
for insert
to anon, authenticated
with check (coalesce(approved, false) is false);

drop policy if exists public_read_student_projects on public.student_projects;
create policy public_read_approved_student_projects
on public.student_projects
for select
to anon, authenticated
using (status = 'approved');

drop policy if exists public_read_marketplace on public.marketplace;
create policy public_read_approved_marketplace
on public.marketplace
for select
to anon, authenticated
using (approved is true);

drop policy if exists public_read_student_market on public.student_market;
create policy public_read_approved_student_market
on public.student_market
for select
to anon, authenticated
using (status = 'approved');

drop policy if exists public_read_course_resources on public.course_resources;
create policy public_read_active_course_resources
on public.course_resources
for select
to anon, authenticated
using (active is true);

drop policy if exists public_read_site_notifications on public.site_notifications;
create policy public_read_active_site_notifications
on public.site_notifications
for select
to anon, authenticated
using (active is true);

drop policy if exists public_read_site_announcements on public.site_announcements;
create policy public_read_current_site_announcements
on public.site_announcements
for select
to anon, authenticated
using (
  active is true
  and (starts_at is null or starts_at <= now())
  and (coalesce(ends_at, expires_at) is null or coalesce(ends_at, expires_at) > now())
);

drop policy if exists public_read_usage_events on public.usage_events;

drop policy if exists public_insert_confessions on public.confessions;
create policy public_insert_pending_confessions
on public.confessions
for insert
to anon, authenticated
with check (coalesce(status, 'pending') = 'pending');

drop policy if exists public_insert_rating_submissions on public.rating_submissions;
create policy public_insert_pending_ratings
on public.rating_submissions
for insert
to anon, authenticated
with check (coalesce(status, 'pending') = 'pending');

drop policy if exists public_insert_course_requests on public.course_requests;
create policy public_insert_pending_course_requests
on public.course_requests
for insert
to anon, authenticated
with check (coalesce(status, 'pending') = 'pending');

drop policy if exists public_insert_feature_suggestions on public.feature_suggestions;
create policy public_insert_pending_feature_suggestions
on public.feature_suggestions
for insert
to anon, authenticated
with check (coalesce(status, 'pending') = 'pending');

drop policy if exists public_insert_broken_link_reports on public.broken_link_reports;
create policy public_insert_pending_broken_link_reports
on public.broken_link_reports
for insert
to anon, authenticated
with check (coalesce(status, 'pending') = 'pending');
