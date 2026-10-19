# UON Hub 3.0 — Implementation Roadmap

Status: planning / isolated development branch. Production remains unchanged.

## Verified inventory (2026-10-19)
- Repository: wshukaili25-a11y/UON-COFFEE, base main at c52f3ce79cb60902663600562f7e72633f1be6d0.
- Supabase project: uoncoffee (production; read-only inspection only).
- Existing tables include courses, academic_programs, uon_staff_directory, uon_campus_buildings, uon_ai_knowledge, uon_ai_messages, uon_ai_schedule_snapshots, support_centers, security_events, system_errors.
- Public tables inspected have RLS enabled; policy quality not yet audited.
- No staging database or preview deployment has been created yet.

## Rules
1. No changes to main, production Supabase, production domains, or secrets.
2. Create an isolated staging Supabase project with synthetic data before implementing writes.
3. Keep student/staff personal data out of preview and analytics.
4. Integrate official university systems only with documented permission.
5. Add automated tests, accessibility, responsive checks, performance budgets and security review before merging.

## Delivery phases
### P0 — Audit and baseline
Inventory frontend pages, API handlers, edge functions, dependencies, env variables (names only), DB schema, RLS policies, deployment wiring and current errors. Capture baseline latency and failure rates.

### P1 — Design system and navigation
Build responsive Arabic-first RTL design tokens, shared navigation, per-role entry points, reduced-motion support and clear return-home navigation.

### P2 — Student experience
Unify existing course catalog, schedule planning, university guide, campus directory, support centers and sourced AI answers. Reuse existing tables where suitable.

### P3 — Service center pilot
Introduce service catalog, appointment requests, statuses, audit trail and staff dashboards in staging only. Pilot with an approved center.

### P4 — Institutional dashboard
Aggregate anonymous demand, usage and service performance. Enforce role-scoped access and minimum group sizes.

### P5 — AI and Raqeeb
Evaluate independent DeepSeek deployment, retrieval citations, quality tests, fallback, official source monitoring and observability.

### P6 — Release readiness
Security/RLS penetration checks, load tests, restore drills, QA acceptance and staged rollout only after explicit approval.

## Acceptance gates
- Preview build isolated from production database.
- Zero production writes during development.
- All routes tested on phone and desktop, RTL/LTR.
- Role access verified, RLS tests pass, no exposed secrets.
- UON AI quality evaluated against curated university questions.
- Rollback documented and tested.

## Next tasks
- Review source structure and existing features in detail.
- Provision staging Supabase and deployment once authorized/configured.
- Implement first isolated dashboard and navigation on this branch.
