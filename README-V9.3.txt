1) Run UON_HUB_V9_3_DEFINITIVE_FIX.sql
2) Set admin password:
select public.uon_reset_admin_password('NEW_PASSWORD','Abood');
3) Upload all patch files.
4) Deploy telegram-admin.
5) Send /start. The owner must see مشرفون.
6) Test feature state and maintenance.
The page no longer hides during repeated maintenance polling.
