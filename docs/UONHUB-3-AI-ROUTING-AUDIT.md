# UON Hub 3.0 — AI Routing Findings

2026-10-20. Read-only code inspection, no production changes.

## Verified current routes
- `js/assistant.js` calls Supabase Edge Function `uon-ai-chat-v64` directly at the production project URL.
- `api/uon-ai.js` and `api/ai-chat.js` are retired legacy endpoints returning HTTP 410, not the active chat path.
- `js/core.js` hardcodes the production Supabase project URL and publishable key; several administrative and notification functions are referenced there.
- `api/schedule-parser.js` proxies to production Edge Function `uon-schedule-image-parser`.
- `js/assistant-stream.js` implements SSE stream parsing.

## Implications
The active AI is not isolated simply by changing a Vercel preview environment variable. Frontend JavaScript itself references production Supabase. A safe preview must not load those live modules or perform write requests until endpoints and keys are separated.

## Next actions
1. Inspect the deployed `uon-ai-chat-v64` Edge Function and its upstream model provider, retrieval, auth, rate limiting, and source citations.
2. Map every direct frontend Supabase call and hardcoded URL.
3. Create a preview-only configuration boundary and staging deployment with synthetic data, subject to staging project approval.
4. Add route and security regression tests before replacing existing assistant.
5. Keep UON Hub 3.0 concept page static until gate is met.
