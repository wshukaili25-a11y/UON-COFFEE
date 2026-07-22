UON Hub V10 Stable

الموجود:
- لوحة إدارة محسّنة مع حالة النظام.
- إعلانات مجدولة بوقت بداية ونهاية.
- بحث شامل سريع مع فهرس بحث.
- PWA وأيقونات صحيحة.
- صلاحيات أدوار محفوظة في قاعدة البيانات.
- نشر Edge Functions من GitHub Actions.
- الحفاظ على إصلاحات الصيانة والبوت والـReload من النسخة المستقرة.

التركيب:
1. شغّل UON_HUB_V10_MIGRATION.sql.
2. ارفع جميع ملفات النسخة إلى GitHub.
3. انشر الوظائف:
   supabase functions deploy telegram-admin --no-verify-jwt
   supabase functions deploy admin-api --no-verify-jwt
   supabase functions deploy search-reindex --no-verify-jwt
   supabase functions deploy google-drive-import --no-verify-jwt
   supabase functions deploy database-backup --no-verify-jwt
4. شغّل search-reindex مرة واحدة من Supabase أو عبر الوظيفة.
5. افتح الموقع:
   https://uon-coffee.vercel.app/?v=10

ملاحظة:
- WhatsApp غير مضاف بناءً على طلبك.
- النسخ الاحتياطي الحالي تصدير JSON للتطبيق، وليس نسخة PostgreSQL كاملة.
