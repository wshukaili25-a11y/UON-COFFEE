# UON Hub 3.0 — Technical Audit (initial)

Date: 2026-10-19
Scope: read-only production inspection; branch feature/uonhub-3-university-platform.

## Confirmed
- Git repository contains 465 tree entries, static HTML pages, css/, js/, api/ serverless handlers, and .github/workflows/verify.yml.
- package.json uses Node 24.x; vercel-build runs four verification scripts.
- Dependency `ai` is specified as `latest`, which is not reproducible; pin a tested version with lockfile before release.
- Vercel project `uon-hub` exists. Preview deployment status and environment isolation still require validation.
- Supabase `uoncoffee` contains existing course, staff, campus, AI, support and monitoring tables; avoid duplicate schema.
- Public tables returned RLS enabled, but policies and privileged functions have not been audited.
- GitHub main branch protection reports disabled: enable protection/required reviews before merging.

## Risks / gaps
1. Preview may share production Supabase credentials: do not test mutations before separate staging credentials.
2. No confirmed isolated staging database or working preview URL.
3. Need inspect all API endpoints for authorization, rate limits and secrets handling.
4. Need evaluate existing design layers before replacing them.
5. Need assess dependency pinning, CI coverage, performance and accessibility.

## Next engineering steps
- Read vercel.json, workflow, main HTML, AI handlers, and security policies.
- Provision isolated staging environment and synthetic seed data.
- Create role-based design shell with Arabic RTL and reduced-motion support.
- Build service catalog pilot and analytics with strict access boundaries.
- Verify staging smoke tests, RLS, accessibility and mobile UX before PR.
