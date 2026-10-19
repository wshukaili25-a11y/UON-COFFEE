# UON AI — Verified Active Backend (read-only audit)
Date: 2026-10-20

## Grounded routing
- Frontend `js/assistant.js` calls production Supabase function `uon-ai-chat-v64`.
- Supabase confirms `uon-ai-chat-v64` ACTIVE, version 33, JWT verification disabled at gateway (`verify_jwt=false`). This does not prove absence of application-level authorization.
- Retrieved deployed function source. Gemini references are present; DeepSeek is not identified by this simple string scan. This is not a complete provider/runtime audit.
- Source includes rate-limit, retrieval, embedding, and authorization references; their effectiveness remains unverified.
- Legacy Vercel endpoints `/api/ai-chat` and `/api/uon-ai` return HTTP 410.

## Engineering implications
1. Do not route preview chat traffic to production function or infer it is safe from function metadata.
2. Audit the actual authorization checks, token validation, quotas, logging, provider fallback and retrieval quality.
3. Develop a staging-only adapter and synthetic regression tests before implementing DeepSeek replacement.
4. Preserve the existing production AI until staging passes quality and security tests.

No deployed Edge Functions or production data were changed.
