UON Hub V9.2

1. Run UON_HUB_V9_2_BOT_ADMIN_FIX.sql.
2. Upload all patch files in exact paths.
3. Redeploy:
   supabase functions deploy telegram-admin --no-verify-jwt
4. Open admin.html. The login screen must always appear.
5. If password is unknown, run:
   select public.uon_reset_admin_password('NEW_STRONG_PASSWORD','Abood');
6. In Telegram, owner menu now includes مشرفون.
7. Callback loading is answered immediately and errors are sent as messages.
