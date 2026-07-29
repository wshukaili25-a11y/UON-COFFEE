# UON Hub V24 AI Supervisor

## الملفات المعدلة
- `supabase/functions/telegram-admin/index.ts`
- `supabase/migrations/20260729_ai_supervisor_v24.sql`

## التشغيل
1. نفّذ ملف SQL في Supabase SQL Editor، أو شغّل `supabase db push`.
2. انشر الدالة:
   `supabase functions deploy telegram-admin --no-verify-jwt`
3. افتح البوت وأرسل `/start`.

## المميزات
- مركز AI داخل القائمة الحالية.
- تحليل الطلبات وتقييم من 100.
- كشف مبدئي للسبام والبيانات الشخصية والمحتوى الحساس.
- يحتاج تعديل.
- إسناد الطلب للمشرف الحالي.
- قائمة الطلبات المسندة.
- تقرير تحليلات.
- إعدادات تشغيل وحد الثقة.
