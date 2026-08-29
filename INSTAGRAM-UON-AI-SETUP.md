# UON AI for Instagram

This branch adds an official Instagram Messaging webhook that forwards text DMs to UON AI and sends the answer back to the student.

## Webhook endpoint

`/api/instagram-webhook`

Use the deployed HTTPS URL as the Meta webhook callback URL.

## Required Vercel environment variables

- `INSTAGRAM_VERIFY_TOKEN` — random private string used only for Meta webhook verification.
- `INSTAGRAM_ACCESS_TOKEN` — Instagram access token with messaging permissions.
- `INSTAGRAM_APP_SECRET` — Meta app secret; enables `X-Hub-Signature-256` verification.
- Configure the Send API using either `INSTAGRAM_SEND_URL`, or both `INSTAGRAM_API_VERSION` and `INSTAGRAM_IG_USER_ID`.

## Optional environment variables

- `INSTAGRAM_SEND_URL` — full Send API messages endpoint. Use this when you want the Meta-configured endpoint to be explicit.
- `INSTAGRAM_API_VERSION` — Graph API version. Required when `INSTAGRAM_SEND_URL` is not set.
- `INSTAGRAM_IG_USER_ID` — Instagram professional account ID. Required when `INSTAGRAM_SEND_URL` is not set.
- `INSTAGRAM_GRAPH_BASE_URL` — defaults to `https://graph.instagram.com`.
- `UON_AI_ENDPOINT` — recommended: the deployed Supabase `uon-ai-v2` function URL so replies are grounded in UON Hub search/course data.
- `UON_AI_API_KEY` — optional API key when the configured UON AI endpoint requires one.

If `UON_AI_ENDPOINT` is not set, the webhook falls back to the same deployment's `/api/uon-ai` endpoint.

## Meta configuration

1. Use an Instagram Professional account for `@uonhub`.
2. Create/configure the Meta app and enable Instagram messaging for the account.
3. Set the callback URL to `https://<deployment-domain>/api/instagram-webhook`.
4. Set Meta's Verify Token to exactly the same value as `INSTAGRAM_VERIFY_TOKEN` in Vercel.
5. Subscribe to the Instagram messaging webhook events required for DMs.
6. Add the access token, App Secret, and the Send API configuration to Vercel environment variables.
7. Redeploy after environment variables are added.

## Current behavior

- Replies to incoming text DMs using UON AI.
- Arabic questions default to Arabic replies; English questions default to English.
- Ignores `is_echo` events to prevent response loops.
- Accepts attachment-only messages but asks the student to send text.
- Splits long AI replies into Instagram-friendly chunks.
- Verifies webhook signatures when `INSTAGRAM_APP_SECRET` is configured.
- Does not claim official University of Nizwa affiliation; that remains enforced by the existing UON AI system prompt.

## Next stage

After Meta credentials are configured, add persistent conversation history and a human-handoff flag in Supabase so a supervisor can take over a DM without the AI continuing to reply.
