revoke insert on table public.confessions from anon, authenticated;
drop policy if exists public_insert_approved_confessions on public.confessions;

revoke insert, update on table public.resource_feedback from anon, authenticated;
drop policy if exists public_submit_feedback on public.resource_feedback;
