UON HUB V7 CLEAN

تركيب النسخة:
1) شغّل UON_HUB_V7_MIGRATION.sql في Supabase SQL Editor.
2) أنشئ كلمة مرور المالك بالأمر الموجود أسفل ملف SQL بعد تغيير CHANGE_ME.
3) ارفع كل الملفات والمجلدات إلى GitHub.
4) انشر Edge Function:
   supabase functions deploy telegram-admin --no-verify-jwt
5) تأكد أن Secrets القديمة ما زالت موجودة.
6) افتح الموقع في نافذة خاصة واختبر الصيانة والخدمات.
7) افتح البوت وأرسل /start و /health.

مهم:
- لم يتم حذف أي جدول أو بيانات قديمة.
- خدمات الموقع في platform_features فقط.
- الأدوات الخارجية في tools_items فقط.
- كل HTML يحمل ملف JavaScript واحدًا فقط، وهذا الملف يستورد core.js.
- قناة واتساب الرسمية محفوظة وقابلة للتعديل من لوحة المالك.
