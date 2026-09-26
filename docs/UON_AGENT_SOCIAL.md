# UON Agent — Instagram + WhatsApp

UON Agent is now the assistant engine behind the existing social webhook adapter.

## Webhook callback
Use this same callback for both Meta products:

`https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-social-webhook`

The callback URL stays stable even though the internal engine is now `uon-agent-v1`.

## Required Supabase Edge Function secrets

Configure these in Supabase Dashboard → Edge Functions → Secrets. Never put them in frontend JavaScript or commit them to GitHub.

### Shared Meta
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_GRAPH_VERSION` (optional; current default is `v26.0`)

### Instagram
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID`
- `INSTAGRAM_GRAPH_BASE` (optional; defaults to `https://graph.instagram.com`)

The Meta app / Instagram professional account must have messaging access, including `instagram_business_manage_messages`. The recipient must initiate the Instagram conversation.

### WhatsApp Cloud API
- `WHATSAPP_ACCESS_TOKEN`

The inbound webhook supplies `phone_number_id`, so a separate phone-number secret is not required by the current adapter. The Meta app must be subscribed to the WhatsApp Business Account messages webhook and the token must have the permissions needed for WhatsApp business messaging/management.

### Human handoff
- `UON_AI_HANDOFF_SECRET`

This keeps the existing supervisor handoff flow working.

## Implemented behavior
- Instagram DMs → UON Agent.
- WhatsApp messages → UON Agent.
- Same UON Hub database and verified tools as the web Agent.
- Stable conversation identity per channel/user.
- Conversation history persisted in `uon_ai_conversations` + `uon_ai_messages`.
- Webhook retry deduplication through `uon_ai_social_events`.
- Meta `X-Hub-Signature-256` verification.
- Existing human handoff remains available.
- `رجع UON Agent` and the old `رجع UON AI` phrasing both resume automation.
- Verified links and Agent actions are appended to social replies when safe.
- UON AI remains the fallback if the Agent cannot produce an answer.

## Health check
GET:

`https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-social-webhook?health=1`

Expected after Meta setup:
- `assistant_engine = uon-agent-v1`
- `meta_app_secret_configured = true`
- `verify_token_configured = true`
- `instagram_token_configured = true`
- `whatsapp_token_configured = true`

## Test checklist

### Instagram
1. Send `هلا` to @uonhub from another Instagram account.
2. Ask `عطني معلومات عن ACCT101`.
3. Ask a follow-up such as `وين مكتبه؟` after asking about a staff member.
4. Send `أبي أكلم مشرف` and confirm the AI pauses.
5. Send `رجع UON Agent` and confirm the Agent resumes.

### WhatsApp
1. Send `هلا` to the connected WhatsApp Business number.
2. Ask a university-specific question.
3. Test a button/list reply.
4. Test human handoff and resume.
5. Confirm repeated webhook delivery does not duplicate the answer.

## Privacy note
Raw Instagram IDs and WhatsApp phone numbers are not written to `uon_ai_social_events`; that table stores a SHA-256 sender hash for webhook deduplication. Conversation session IDs and client tokens are deterministic channel-scoped UUIDs generated from the provider sender ID.
