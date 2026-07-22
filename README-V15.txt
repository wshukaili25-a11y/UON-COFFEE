UON Hub V15 — Bot Control

مبني فوق V14.2 Simple Student، لذلك تصميم الموقع ودليل البرامج لم يتغيرا.

المضاف في البوت:
- لوحة إحصائيات مباشرة.
- التحكم الكامل بحالات الخدمات والصيانة.
- قبول ورفض وحذف الطلبات المعلقة.
- إشعارات فورية للمشرفين عند إرسال طلب من الموقع.
- إدارة مركز المقررات: إضافة، تعديل، تفعيل، إيقاف، حذف، وقبول الطلبات.
- نشر وإدارة الإعلانات وإشعارات الموقع.
- تعديل روابط واتساب وإنستغرام ومراكز أنجز ومسالك التعلم.
- إدارة المشرفين والصلاحيات.
- إنشاء نسخة احتياطية واستعادتها من البوت.
- تقرير يومي يدوي أو عبر جدولة Supabase.
- سجل كامل لعمليات البوت والأخطاء.

التركيب:
1. شغّل UON_HUB_V15_MIGRATION.sql في Supabase SQL Editor.
2. ارفع كل الملفات إلى GitHub.
3. انشر الوظائف:
   supabase functions deploy telegram-admin --no-verify-jwt
   supabase functions deploy database-backup --no-verify-jwt
   supabase functions deploy database-restore --no-verify-jwt
   supabase functions deploy daily-report --no-verify-jwt
4. أعد ضبط Webhook للبوت إذا لزم.
5. أرسل /start.

مهم:
- الاستعادة متاحة للمالك فقط وتحتاج تأكيد.
- اختبر الاستعادة على بيانات تجريبية أولًا.
- التقرير اليومي التلقائي يحتاج Cron يستدعي daily-report مرة كل يوم.
