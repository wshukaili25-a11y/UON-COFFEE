# UON Hub V42 Platform Upgrade

## Scope
- Course Hub V2 through a unified database RPC.
- Database-powered global search in Arabic and English.
- UON AI V2 with grounded course and search context.
- Protected owner analytics dashboard.
- Professional multi-PDF upload workflow with moderation.
- Advanced content reports with priority, source context, and deduplication.
- Stable PWA update flow without forced reload loops.
- Telegram Admin V42 with safe fallback to the existing bot.

## Safety
- Production is not modified by this branch.
- Telegram V42 is deployed but its webhook is not active by default.
- Owner dashboard can activate V42 or restore the legacy webhook.
- Uploaded files remain pending until moderator approval.
- Edge functions validate origins, file type, size, and admin access where required.

## Verified
- Vercel preview deployments: READY.
- UON AI V2 course query: HTTP 200.
- Content report dry run: HTTP 200.
- Resource upload API health check: HTTP 200.
- Unauthorized bot control request: HTTP 401.
- Global search verified in Arabic and English.
- No temporary test reports or summaries were retained.
- Supabase and Vercel logs show no new runtime errors.

## Rollout
1. Review the Preview deployment on mobile and desktop.
2. Test Arabic/English switching on search, course, and assistant pages.
3. Upload one real PDF and approve it from moderation.
4. Merge the PR to `main` only after the checks pass.
5. Activate Telegram V42 from the owner dashboard after website verification.
