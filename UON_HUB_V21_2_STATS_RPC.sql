-- Accurate public counters for the home page. Runs with owner privileges,
-- so RLS does not hide approved rows from anonymous visitors.
create or replace function public.uon_platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
 select jsonb_build_object(
   'tools_count', (
     select count(*)::int
     from public.tools_items
     where coalesce(status, 'active') = 'active'
   ),
   'summaries_count', (
     select count(*)::int
     from public.summaries
     where approved is true
   ),
   'ratings_count', (
     select count(*)::int
     from public.rating_submissions
     where status = 'approved'
   ),
   'groups_count', (
     select count(*)::int
     from public.whatsapp_groups
     where approved is true
   )
 );
$$;

revoke all on function public.uon_platform_stats() from public;
grant execute on function public.uon_platform_stats() to anon, authenticated;
