# Summary email delivery activation

The course hub is usable independently. Email buttons remain hidden until the server reports `available: true`. No message has been sent during development.

Configure these secrets in the existing Supabase project, never in browser code or Git:

- `RESEND_API_KEY`: sending key for the verified sender domain.
- `UON_EMAIL_FROM`: verified UON Hub sender, e.g. `UON Hub <study@uonhub.space>` after domain verification.
- `UON_EMAIL_OTP_SECRET`: independent random secret of at least 32 characters.
- `UON_EMAIL_ENABLED`: set `true` only after the above are ready.

Deploy `summary-email` with its `email.mjs` dependency. It validates the public API key and allowed origins; privileged database access stays server-side. Use the private service-role-only RPCs for OTP creation/claiming.

Flow: approved hosted PDF → name/email → six-digit OTP (10 minutes, 5 attempts) → atomic one-time claim → PDF attachment. Per-address cooldown 60 seconds, 3 requests/hour, global cap 100/hour. Resend idempotency keys prevent duplicate submissions. Only hosted summary PDFs <=12 MiB qualify. Drive folders and external URLs cannot become arbitrary server downloads. Two branded RTL templates include UON Hub signature and independent-project attribution.

Retention: hourly cron removes requests older than 24 hours (maximum 25 hours). End-to-end delivery remains unverified until a sender is configured and an explicitly authorized test mailbox completes the OTP flow. Provider acceptance is not a delivery receipt; no inbox-delivery guarantee is displayed.
