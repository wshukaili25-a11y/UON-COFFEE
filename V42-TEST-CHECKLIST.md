# V42 Manual Acceptance Checklist

## Website
- [ ] Home page loads without recovery loops.
- [ ] Arabic and English switch the full interface.
- [x] Search returns grouped results in both languages.
- [x] Course pages load course data and counts through the unified RPC.
- [x] UON AI answers a course code and links to the course page.
- [x] Content report service passes the submission dry run.

## Upload
- [x] A real PDF upload succeeds through `multipart/form-data`.
- [x] Upload API enforces a 20MB maximum.
- [x] Upload API accepts PDF only.
- [x] Uploaded resources remain pending.
- [x] Temporary uploaded row and Storage object were removed after testing.
- [ ] Multiple PDF files can be selected in a real browser session.
- [ ] Moderator can approve the resource from the admin interface.

## Owner Dashboard
- [ ] Correct password opens the dashboard in a browser.
- [x] Unauthorized access is rejected.
- [x] Dashboard RPC returns period analytics, totals, pages, events, and reports.
- [ ] Period selector refreshes analytics in a browser.
- [ ] Pending and report counts are visually correct.
- [ ] Telegram V42 status can be checked from the dashboard.
- [ ] Legacy bot rollback remains available in a browser session.

## PWA
- [ ] Install prompt or Add to Home Screen works.
- [x] Manifest starts directly at `index.html`.
- [x] Service Worker contains no forced reload or recovery redirect loop.
- [ ] Offline page appears when a non-cached route is opened offline.
- [ ] Cached core pages open offline.
- [ ] A new version shows an update banner without forced reload.

## Telegram
- [x] Current bot remains active before manual activation.
- [x] V42 control endpoint rejects unauthenticated requests.
- [ ] V42 menu opens after activation.
- [ ] Dashboard, pending requests, services, courses, reports, and uploads open.
- [ ] Legacy actions still pass through to the old bot.
- [ ] Rollback restores the previous webhook.

## Logs and cleanup
- [x] Vercel Preview deployment is READY.
- [x] No recent Vercel Preview warnings or errors were found.
- [x] New Supabase Edge Functions returned expected status codes.
- [x] No test report, summary row, or Storage object remains.
- [x] Temporary upload integration endpoint was disabled after testing.
