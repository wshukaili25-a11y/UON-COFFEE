UON Hub V8 Pro — Setup

1) Run UON_HUB_V8_MIGRATION.sql.
2) Upload all files.
3) Deploy functions:
   supabase functions deploy telegram-admin --no-verify-jwt
   supabase functions deploy google-drive-import --no-verify-jwt
   supabase functions deploy whatsapp-notify --no-verify-jwt
   supabase functions deploy database-backup --no-verify-jwt

Required secrets:
Telegram:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- DATABASE_WEBHOOK_SECRET
- SITE_URL

Google Drive:
- GOOGLE_SERVICE_ACCOUNT_JSON
Share each Drive folder with service_account.client_email as Viewer.

WhatsApp Cloud API:
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ADMIN_PHONE
- WHATSAPP_TEMPLATE_NAME
- WHATSAPP_TEMPLATE_LANGUAGE

GitHub Actions optional:
Repository Settings → Secrets and variables → Actions:
- SUPABASE_ACCESS_TOKEN
- SUPABASE_PROJECT_REF = irkhvydgxpseflggbeqq

PWA:
The site exposes manifest.webmanifest and service worker. The Install button appears when supported.

Backup:
Creates JSON files in private bucket uon-backups. It is an application-level data export, not a physical PostgreSQL dump.
