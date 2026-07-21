UON Hub V6.1 Fix

1) Run V6_1_TELEGRAM_NOTIFICATIONS_TOOL_STATUS_FIX.sql in Supabase.
2) Upload:
   - index.html
   - js/home.js
   - css/home.css
   - vercel.json
3) Replace:
   supabase/functions/telegram-admin/index.ts
4) Redeploy:
   supabase functions deploy telegram-admin --no-verify-jwt
5) Open Telegram and send /start.
6) Submit a new test request.

Fixes:
- Telegram Markdown parse error.
- Browser-to-Edge-Function CORS.
- Notification log created only after successful Telegram delivery.
- Stale notification log cleared.
- Homepage quick cards obey tool status from Telegram/admin.
