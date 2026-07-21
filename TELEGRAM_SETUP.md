# تنبيه أمني
رمز البوت القديم ظهر في المحادثة. استخدم `/revoke` ثم `/token` في BotFather، ولا تستخدم الرمز القديم.

# إعداد تلجرام — UON Hub V5.2

## الأسرار في Supabase Edge Functions
أضف هذه القيم في:
Project Settings → Edge Functions → Secrets

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `DATABASE_WEBHOOK_SECRET`
- `SITE_URL` مثل `https://uon-coffee.vercel.app`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## نشر الوظيفة
```bash
supabase functions deploy telegram-admin --no-verify-jwt
```

## ربط Telegram Webhook
استبدل القيم:
```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<FUNCTION_URL>&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## إشعارات قاعدة البيانات
من Supabase:
Database → Webhooks → Create webhook

أنشئ Webhook لحدث INSERT لكل جدول:
- summaries
- whatsapp_groups
- student_projects
- rating_submissions
- confessions

URL:
`https://<PROJECT_REF>.supabase.co/functions/v1/telegram-admin`

Header:
`x-database-webhook-secret: <DATABASE_WEBHOOK_SECRET>`

## إضافة المشرفين
من لوحة إدارة الموقع → مشرفو تلجرام.
أضف Chat ID والدور.

الأدوار:
- owner: تحكم كامل.
- admin: تحكم كامل.
- moderator: قبول ورفض فقط افتراضيًا.

## قناة واتساب
إنشاء القناة يتم يدويًا من تطبيق واتساب:
Updates → + → New channel
بعد إنشائها انسخ الرابط وضعه من:
لوحة الإدارة → الموقع والصيانة → قناة واتساب الرسمية.
