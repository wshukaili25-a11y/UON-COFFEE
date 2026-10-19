# UON Hub 3.0 — Preview Isolation Gate

Verified on 2026-10-20; feature branch only.

## Deployment
- Vercel project: uon-hub (prj_KmexbfmMIs7fpLSiqto1OhXoVny4).
- Preview deployment for commit ee92164ef85d59047b980f5d4f94ae70d272beea is READY.
- URL: https://uon-jvpj12w27-wshukaili25-1447s-projects.vercel.app/uonhub-3-preview.html
- Vercel SSO protection enabled for non-custom domains. Public accessibility is not guaranteed.
- This confirms deployment status, **not** end-to-end browser rendering.

## Critical isolation findings
- vercel.json CSP explicitly allows connections to production Supabase project irkhvydgxpseflggbeqq.
- index.html preconnects to production Supabase.
- api/schedule-parser.js uses a fixed production Supabase Edge Function URL and public publishable key. Publishable key is not a service-role secret, but does not isolate requests.
- api/uon-ai.js and api/ai-chat.js return HTTP 410; they are retired legacy endpoints. Do not assume these are active AI handlers.
- No staging database verified. Do not enable API calls, test uploads, or mutations against preview until isolation is complete.

## Gate before interactive implementation
1. Create separate Supabase staging project, if approved (may incur billing).
2. Configure preview-specific environment variables and endpoint selection.
3. Eliminate hardcoded production endpoint from preview code paths.
4. Use synthetic test data only; no copied student records.
5. Test request destinations and role/RLS policies before any preview writes.
6. Keep current static concept preview free of API requests.

No production code, environment variables, or database were modified during this audit.
