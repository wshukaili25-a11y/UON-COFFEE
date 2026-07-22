UON Hub V12.2

1. Run UON_HUB_V12_2_MIGRATION.sql.
2. Upload all files.
3. Deploy:
   supabase functions deploy telegram-admin --no-verify-jwt
   supabase functions deploy daily-report --no-verify-jwt
   supabase functions deploy database-backup --no-verify-jwt
4. نادي المواد uses one canonical RPC and platform_features row.
5. Daily report can be sent manually from Telegram. For automatic daily runs, schedule daily-report in Supabase Dashboard Cron.
6. Restore from Telegram is powerful: test on a backup before production use.
