UON Hub V6.2 Core Fix

1. Run V6_2_CORE_FIX.sql.
2. Upload all patch files to GitHub in the same paths.
3. Redeploy Telegram:
   supabase functions deploy telegram-admin --no-verify-jwt
4. Test bot:
   /notify_test
   /health
5. Test maintenance in a private/incognito browser.
