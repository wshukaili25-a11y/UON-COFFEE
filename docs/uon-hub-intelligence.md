# UON Hub Intelligence — preview integration

## Implemented
- `GET /api/intelligence-summary` returns aggregate read-only data from seven existing tables.
- Requires `Authorization: Bearer <INTELLIGENCE_MONITOR_TOKEN>`.
- No raw student messages, comments, client identifiers, or security event details are returned.
- Limited to 1,000 rows per source. `sampled: true` means figures are samples, **not** complete totals.

## Before enabling
1. Configure Vercel **Preview-only** server environment variables: `INTELLIGENCE_MONITOR_TOKEN` (long random secret), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never place these in client JS, GitHub, or `NEXT_PUBLIC_*`.
2. Restrict Preview deployment access using Vercel protection; do not link this endpoint from public navigation.
3. Test unauthorized requests return 401, authorized requests return only aggregates, and missing config returns 503.
4. Validate database access and compare counts with private SQL queries.
5. Replace simple shared-token auth with existing owner/supervisor authorization before integrating the dashboard. Add audit logging and rate limiting.
6. Confirm `api/` serverless routes are deployed in this static Vercel project.

## Important limitations
- This is **not** an automated scheduler or a live dashboard yet.
- It does not classify security events as attacks or determine incident severity.
- It does not evaluate AI answer correctness; that requires a curated test set and model test runner.
- It does not change production database tables, RLS policies, or content.
