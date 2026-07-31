# UON Hub V31.0.0

## Course Center
- Rebuilt `courses.html` with fast search, college and department filters, sorting, grid/list modes, loading states, error recovery, and responsive cards.
- Rebuilt `course.html` as a unified course workspace with deep-linkable tabs, content counts, prerequisite links, sharing, copy-link support, approved resources, reports, exams, summaries, groups, and ratings.
- Added `css/course-center-v31.css` as an isolated responsive design layer.
- Added safe optional queries so missing secondary tables do not break the whole course page.

## Database
- Added `course_prerequisites` and `course_resources` schema.
- Added course metadata fields and course-code indexes to existing content tables.
- Added public read RLS policies for prerequisite and active-resource data.

## PWA and performance
- Upgraded cache namespace to V31.
- Cached the Course Center shell and assets.
- Changed installation caching to tolerate a single unavailable optional asset.
- Added a Course Center shortcut to the web app manifest.

## Deployment order
1. Apply `supabase/migrations/20260731154500_v31_course_center.sql`.
2. Deploy the project to Vercel.
3. Hard refresh once or reopen the installed PWA to activate the new service worker.
