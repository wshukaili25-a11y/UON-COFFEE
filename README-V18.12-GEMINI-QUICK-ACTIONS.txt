UON Hub V18.12 — Gemini + Quick Actions

التغييرات:
- الإبقاء على الأزرار الجاهزة في صفحة المساعد.
- إعادة ربط المساعد بخدمة Gemini بدل OpenAI.
- الإبقاء على بحث بيانات UON Hub وروابط جامعة نزوى الرسمية الموجودة في قاعدة البيانات.
- لا يحتاج مفتاح OpenAI أو رصيد OpenAI API.

المتطلبات:
1) تأكد أن Secret باسم GEMINI_API_KEY موجود في Supabase.
2) انشر Function:
   supabase functions deploy uon-ai --project-ref irkhvydgxpseflggbeqq --no-verify-jwt
3) ارفع ملفات الموقع إلى GitHub/Vercel.

لإضافة المفتاح عند الحاجة:
supabase secrets set GEMINI_API_KEY=YOUR_KEY --project-ref irkhvydgxpseflggbeqq

ملاحظة:
إجابات Gemini تعتمد على سياق المنصة المرسل من الموقع. الروابط الرسمية تأتي من بيانات الجامعة المخزنة في جداول UON Hub، ولا يتم استخدام OpenAI.
