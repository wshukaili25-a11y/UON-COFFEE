UON Hub V9.1 Status/Maintenance Fix

1. Run UON_HUB_V9_1_STATUS_MAINTENANCE_FIX.sql.
2. Upload all patch files in their exact paths.
3. Redeploy telegram-admin:
   supabase functions deploy telegram-admin --no-verify-jwt
4. Test /health.
5. Change a feature. The bot must say it was saved in the database.
6. Open the homepage in a private window; feature states refresh every 3 seconds.
7. Turn maintenance on; all public pages redirect within 5 seconds.
