ارفع الملفات الأربعة واستبدل النسخ الحالية:

js/core.js
js/home.js
js/maintenance.js
js/admin.js

ثم انتظر نشر Vercel وافتح:
https://uon-coffee.vercel.app/?v=9.5

التعديل:
- حذف نظام الصيانة القديم بالكامل.
- إزالة startMaintenanceWatcher من الصفحة الرئيسية.
- منع الفحص الدوري والـ reload الوهمي.
- استخدام RPC uon_public_state فقط.
- منع تكرار التحويل بين index.html وmaintenance.html.
- تحسين ظهور تسجيل دخول لوحة الإدارة.
