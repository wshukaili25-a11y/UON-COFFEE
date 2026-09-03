drop policy if exists public_read_academic_calendar_events on public.academic_calendar_events;
create policy public_read_academic_calendar_events on public.academic_calendar_events for select to anon, authenticated using (active is true);

drop policy if exists public_read_footer_social_links on public.footer_social_links;
create policy public_read_footer_social_links on public.footer_social_links for select to anon, authenticated using (active is true);

drop policy if exists public_read_home_slides on public.home_slides;
create policy public_read_home_slides on public.home_slides for select to anon, authenticated using (active is true);

drop policy if exists public_read_platform_features on public.platform_features;
create policy public_read_platform_features on public.platform_features for select to anon, authenticated using (is_visible is true);

drop policy if exists public_read_search_index on public.search_index;
create policy public_read_search_index on public.search_index for select to anon, authenticated using (active is true);

drop policy if exists public_read_site_updates on public.site_updates;
create policy public_read_site_updates on public.site_updates for select to anon, authenticated using (active is true);

drop policy if exists public_read_university_colleges on public.university_colleges;
create policy public_read_university_colleges on public.university_colleges for select to anon, authenticated using (active is true);

drop policy if exists public_read_university_programs on public.university_programs;
create policy public_read_university_programs on public.university_programs for select to anon, authenticated using (active is true);

drop policy if exists public_read_useful_sites on public.useful_sites;
create policy public_read_useful_sites on public.useful_sites for select to anon, authenticated using (active is true);
