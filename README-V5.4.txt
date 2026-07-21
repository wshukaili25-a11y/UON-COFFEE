UON Hub V5.4 — Telegram Control Center

1. شغّل V5_4_TELEGRAM_CONTROL_CENTER.sql في Supabase.
2. ارفع ملفات الموقع كالمعتاد.
3. أعد نشر Edge Function:
   supabase functions deploy telegram-admin --no-verify-jwt

4. افتح البوت واكتب:
/start

الميزات:
- قائمة رئيسية بالأزرار.
- الإحصائيات.
- الطلبات المعلقة مع قبول ورفض.
- تشغيل وإيقاف الصيانة.
- التحكم بحالات الأدوات.
- إنشاء إعلان خطوة بخطوة.
- عرض وتشغيل وإيقاف وحذف الإعلانات.
- صلاحيات owner/admin/moderator/staff.
- إشعارات حسب صلاحية كل مشرف.

الأدوار:
- owner: كل شيء.
- admin: إدارة كاملة تقريبًا.
- moderator: مراجعة الطلبات فقط.
- staff: المشاريع والإحصائيات فقط.
