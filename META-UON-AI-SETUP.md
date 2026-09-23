# UON AI — Instagram + WhatsApp

This is the production social messaging bridge for UON AI.

## Architecture

Instagram DM / WhatsApp Cloud API
→ Meta Webhook
→ Supabase Edge Function `uon-ai-social-webhook`
→ `uon-ai-chat-v64`
→ UON Hub database / verified sources
→ reply through the same Meta channel

The same UON AI conversation system is used for web, Instagram, WhatsApp, and Telegram.

## Production callback URL

`https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-social-webhook`

Use the same callback URL for both Instagram and WhatsApp webhook subscriptions.

## Required Supabase Edge Function secrets

Never commit these values to GitHub.

Common:
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`

Instagram:
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID` (fallback only; normal incoming events contain the recipient account ID)

WhatsApp:
- `WHATSAPP_ACCESS_TOKEN`

Optional:
- `META_GRAPH_VERSION=v26.0`
- `INSTAGRAM_GRAPH_BASE=https://graph.instagram.com`
- `META_ACCESS_TOKEN` can be used as a shared fallback, but separate Instagram/WhatsApp tokens are preferred.

The existing `UON_AI_HANDOFF_SECRET` is reused for supervisor handoff and must remain secret.

## Instagram configuration

1. Use the Meta app connected to the @uonhub professional Instagram account.
2. Enable Instagram messaging / Instagram Login as required by the app configuration.
3. Grant the app the Instagram messaging permission required to manage DMs.
4. Configure the callback URL above.
5. Set the webhook verify token to exactly the same value stored in `META_WEBHOOK_VERIFY_TOKEN`.
6. Subscribe the Instagram account/app to message events.
7. Generate/store a production Instagram access token in `INSTAGRAM_ACCESS_TOKEN`.

## WhatsApp configuration

1. Add WhatsApp Cloud API to the Meta app/business portfolio.
2. Connect the production WhatsApp Business phone number.
3. Create an access token with the WhatsApp messaging/management permissions required by Meta.
4. Store it in `WHATSAPP_ACCESS_TOKEN`.
5. Configure the callback URL above and the same verify token.
6. Subscribe the WhatsApp Business Account to `messages` webhook events.

The webhook reads `phone_number_id` from incoming WhatsApp events, so no phone number ID secret is required for normal inbound replies.

## Implemented behavior

- Verifies Meta webhook challenges.
- Verifies POST requests with `X-Hub-Signature-256` using the Meta App Secret.
- Prevents duplicate processing when Meta retries an event.
- Ignores Instagram echo messages.
- Supports Arabic and English automatically.
- Uses stable, separate conversation IDs per channel/user.
- Keeps up to 12 recent messages as conversation context.
- Uses the same UON AI and database as the website.
- Returns up to two verified source links when relevant.
- Splits long replies before sending.
- Supports Instagram text DMs.
- Supports WhatsApp text, button/list replies, and image captions.
- Gives a text fallback for unsupported attachment-only messages.
- Human handoff: phrases such as asking for a supervisor switch the conversation to `human`, notify the existing UON AI handoff workflow, and pause AI replies.
- Sending `رجع UON AI` returns the conversation to AI mode.

## Database changes

`uon_ai_conversations.channel` now supports:
- `web`
- `instagram`
- `whatsapp`
- `telegram`

`uon_ai_social_events` stores webhook deduplication metadata. Raw Instagram IDs and WhatsApp phone numbers are not stored there; only a SHA-256 sender hash is stored. Client access to this table is revoked and RLS is enabled.

## Production test checklist

### Instagram
1. Send `هلا` to @uonhub from a non-owner/test account.
2. Confirm UON AI replies.
3. Ask a university-specific question and confirm the same answer/source quality as the website.
4. Send `أبي أكلم مشرف` and confirm AI pauses and the admin handoff is generated.
5. Send `رجع UON AI` and confirm AI resumes.

### WhatsApp
1. Send `هلا` to the connected WhatsApp Business number.
2. Confirm UON AI replies.
3. Ask a university-specific question.
4. Test a button/list reply if enabled.
5. Test supervisor handoff and AI resume.

## Security notes

- Never place Meta tokens or App Secret in frontend JavaScript, GitHub, or public site settings.
- Keep Meta webhook signature verification enabled.
- Rotate a token immediately if it is ever exposed.
- Do not accept unsigned POST webhook payloads.
