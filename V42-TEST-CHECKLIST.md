# V42 Manual Acceptance Checklist

## Website
- [ ] Home page loads without recovery loops.
- [ ] Arabic and English switch the full interface.
- [ ] Search returns grouped results in both languages.
- [ ] Course pages load summaries, groups, ratings, and counts.
- [ ] UON AI answers a course code and links to the course page.
- [ ] Content report form submits and shows success.

## Upload
- [ ] Multiple PDF files can be selected.
- [ ] Files larger than 20MB are rejected.
- [ ] Non-PDF files are rejected.
- [ ] Uploaded resources remain pending.
- [ ] Moderator can approve the resource.

## Owner Dashboard
- [ ] Correct password opens the dashboard.
- [ ] Wrong password is rejected.
- [ ] Period selector refreshes analytics.
- [ ] Pending and report counts are correct.
- [ ] Telegram V42 status can be checked.
- [ ] Legacy bot rollback remains available.

## PWA
- [ ] Install prompt or Add to Home Screen works.
- [ ] App opens directly at `index.html`.
- [ ] Offline page appears when a non-cached route is opened offline.
- [ ] Cached core pages open offline.
- [ ] A new version shows an update banner without forced reload.

## Telegram
- [ ] Current bot remains active before manual activation.
- [ ] V42 menu opens after activation.
- [ ] Dashboard, pending requests, services, courses, reports, and uploads open.
- [ ] Legacy actions still pass through to the old bot.
- [ ] Rollback restores the previous webhook.
