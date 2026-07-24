UON Hub V18.13.1 — SQL JSON Fix

تم إصلاح خطأ:
invalid input syntax for type json

السبب:
عمود value في جدول site_settings من نوع JSON/JSONB، لذلك يجب تحويل النصوص إلى JSON صالح باستخدام to_jsonb(...::text).

طريقة الاستخدام:
1) افتح Supabase SQL Editor.
2) شغّل الملف UON_HUB_V18_13_PORTAL_CONTROL.sql المعدّل كاملًا.
3) إذا سبق تنفيذ جزء من الملف، يمكن تشغيله مرة أخرى؛ أوامر الإنشاء والإضافة مصممة لتجنب التكرار قدر الإمكان.
