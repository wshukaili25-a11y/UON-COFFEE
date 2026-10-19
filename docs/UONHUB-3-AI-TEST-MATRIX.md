# UON AI 3.0 — Regression & Isolation Test Matrix
Date: 2026-10-20
Scope: planning for staging; no production traffic generated.

## Existing tests found
- `tests/assistant-conversation.test.mjs` uses Node's built-in test runner.
- Covers Arabic/English staff matching, diacritics, ambiguous names, conversational follow-ups, ordinal selection and forged staff IDs.
- Current assistant frontend includes local Omani-style casual replies.
- Existing SSE parser lives in `js/assistant-stream.js`.

## Must-pass staging scenarios
1. Greeting: `هلا` returns quickly, no remote call needed.
2. Faculty lookup: exact staff identity from seeded records, no invented email.
3. Ambiguity: two matching faculty prompt for selection; ordinal follow-up resolves selected record.
4. Unknown faculty: acknowledge missing record, never fabricate office/contact.
5. Academic date: include source and freshness; refuse to guess unknown deadline.
6. Multi-turn context: pronouns resolve correctly; never inject system role from user history.
7. Security: cross-user schedule/profile access denied by RLS; admin-only data not exposed.
8. Privacy: no raw personal messages in error logs; no sensitive data in public preview.
9. Abuse: oversized inputs, rapid requests and malformed SSE handled safely.
10. Performance: capture p50/p95 first-token and total latency under repeatable staging load.
11. Failover: upstream timeout returns actionable fallback, not endless spinner.
12. DeepSeek evaluation: compare accuracy, citations, latency and cost against current baseline on identical synthetic questions.

## Exit criteria
- All security/authorization tests pass.
- No preview request reaches production Supabase.
- No ungrounded staff identities or academic dates in the golden set.
- Mobile Arabic RTL and accessibility smoke checks pass.
- Owner reviews results before any production rollout.

## Known blockers
A dedicated staging Supabase project, staging credentials and synthetic seed dataset have not been provisioned. Avoid running these tests against production.
