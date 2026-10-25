# UON Agent V1

Experimental branch-only agent for UON Hub.

## Endpoint
- `uon-agent-v1`
- Read-only tool layer in V1.
- Current `uon-ai-chat-v64` remains unchanged and is used only as fallback.

## Tools
1. `search_staff` — verified active staff directory.
2. `search_courses` — approved active courses.
3. `academic_calendar` — active academic calendar events.
4. `support_centers` — active support centers and booking links.
5. `campus_search` — official buildings plus UON knowledge search.
6. `my_schedule` — private saved schedule scoped to the existing browser session and client-token hash.
7. `uon_knowledge_search` — current fast UON knowledge RPC.

## Safety
- No write tool exists in V1.
- No booking, cancellation, or student-data mutation can happen silently.
- The public endpoint is origin-restricted and rate-limited.
- Schedule lookup requires both the browser session ID and hashed client token.
- Existing production UON AI behavior is not replaced by this branch.
