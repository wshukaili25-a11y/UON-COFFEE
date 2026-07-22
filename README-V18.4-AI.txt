UON Hub V18.4 — AI Fix

المشكلة التي تم إصلاحها:
- assistant.html يستخدم chatForm وchat.
- assistant.js كان يبحث عن assistantForm وanswer، لذلك يتوقف.
- المساعد السابق كان بحثًا محليًا فقط وليس AI فعليًا.

الآن:
- محادثة UON AI تعمل.
- تستخدم Gemini عبر Supabase Edge Function.
- المفتاح لا يظهر في المتصفح.
- تضيف نتائج المنصة كسياق للإجابة.
- إذا Gemini أو الوظيفة غير متاحين، تعمل بخطة بديلة محلية.
- زر Enter يرسل، وShift+Enter ينزل سطرًا.
- منع الضغط المتكرر وإظهار مؤشر الكتابة.
- تحديد 12 طلبًا في الدقيقة لكل عنوان IP داخل نسخة Edge Function.

التفعيل:
1. أنشئ Gemini API Key من Google AI Studio.
2. أضف السر في Supabase:
   supabase secrets set GEMINI_API_KEY=ضع_المفتاح_هنا
3. انشر الوظيفة:
   supabase functions deploy uon-ai --no-verify-jwt
4. ارفع ملفات الموقع وافتح:
   https://uon-coffee.vercel.app/assistant.html?v=18.4

ملاحظة:
حتى بدون الخطوتين 1 و2، صفحة المساعد لن تتعطل؛ ستستخدم البحث المحلي داخل المنصة.
