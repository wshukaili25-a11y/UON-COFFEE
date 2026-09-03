-- Keep inactive/draft public content out of anonymous REST reads.
-- Admin/service-role access is unaffected by these RLS predicates.

alter policy public_read_academic_calendar_events
on public.academic_calendar_events
using (active is true);

alter policy public_read_footer_social_links
on public.footer_social_links
using (active is true);

alter policy public_read_home_slides
on public.home_slides
using (active is true);

alter policy public_read_search_index
on public.search_index
using (active is true);

alter policy public_read_site_updates
on public.site_updates
using (active is true);

alter policy public_read_university_colleges
on public.university_colleges
using (active is true);

alter policy public_read_university_programs
on public.university_programs
using (active is true);

alter policy public_read_useful_sites
on public.useful_sites
using (active is true);
