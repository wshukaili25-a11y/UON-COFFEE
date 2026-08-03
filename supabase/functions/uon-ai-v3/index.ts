import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = new Set([
  'https://uonhub.space',
  'https://www.uonhub.space',
]);

function resolveOrigin(req: Request) {
  const value = req.headers.get('origin') || '';
  try {
    const host = new URL(value).hostname;
    if (
      allowedOrigins.has(value) ||
      (host.endsWith('.vercel.app') &&
        (host.startsWith('uon-') || host.startsWith('uon-hub-')))
    ) return value;
  } catch {}
  return 'https://uonhub.space';
}

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(req),
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...extra },
  });
}

const clean = (value: unknown, max = 1200) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const normalize = (value: unknown) =>
  clean(value, 1200)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function clientKey(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  return `${ip}|${(req.headers.get('user-agent') || '').slice(0, 120)}`;
}

async function rateLimit(req: Request) {
  const start = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const { data, error } = await db.rpc('uon_ai_rate_limit', {
    p_client_key: clientKey(req),
    p_window_start: start,
    p_limit: 20,
  });
  if (error) return { allowed: true, retry: 0 };
  return {
    allowed: Boolean(data?.allowed),
    retry: Number(data?.retry_after || 60),
  };
}

function safeUrl(value: unknown) {
  const raw = clean(value, 700);
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://www.uonhub.space/');
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (url.origin === 'https://www.uonhub.space') return `${url.pathname}${url.search}${url.hash}`;
    return url.toString();
  } catch {
    return '';
  }
}

function courseCode(value: string) {
  return value.toUpperCase().match(/\b[A-Z]{2,10}\s*\d{2,4}[A-Z]?\b/)?.[0]?.replace(/\s+/g, '') || '';
}

function detectIntent(question: string) {
  const q = normalize(question);
  if (courseCode(question)) return 'course';
  if (/معدل|gpa|تراكمي|فصلي/.test(q)) return 'gpa';
  if (/تقويم|موعد|تاريخ|تسجيل|حذف|اضافه|انسحاب/.test(q)) return 'calendar';
  if (/قروب|جروب|واتساب|مجموعه/.test(q)) return 'groups';
  if (/ملخص|اختبار|فاينل|ميد|ملف/.test(q)) return 'summaries';
  if (/تخصص|كليه|برنامج|بكالوريوس|دبلوم|ماجستير/.test(q)) return 'programs';
  if (/رابط|بوابه|بوابة|موقع|ادخل|دخول|مودل|eduwave|اديويف/.test(q)) return 'links';
  return 'general';
}

function sanitizeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-10)
    .map((item: any) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: clean(item?.content, 700),
    }))
    .filter((item) => item.content);
}

async function collectContext(question: string) {
  const started = Date.now();
  const { data, error } = await db.rpc('uon_ai_search_fast', {
    p_question: question,
    p_limit: 16,
  });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : [])
    .map((item: any) => ({
      type: clean(item.type, 80),
      title: clean(item.title, 220),
      description: clean(item.description, 1100),
      url: safeUrl(item.url),
      official: Boolean(item.official),
      score: Number(item.score || 0),
    }))
    .filter((item: any) => item.title);

  if (!rows.length) return { rows: [], ms: Date.now() - started };
  const best = rows[0].score || 1;
  return {
    rows: rows.filter((item: any) => item.score >= best * 0.5).slice(0, 10),
    ms: Date.now() - started,
  };
}

async function getCourse(code: string, language: string) {
  if (!code) return null;
  const { data, error } = await db.rpc('uon_course_hub_v42', {
    p_code: code,
    p_language: language,
  });
  if (error || !data?.course) return null;
  return data;
}

function courseAnswer(hub: any, language: string) {
  const course = hub.course || {};
  const summaries = Array.isArray(hub.summaries) ? hub.summaries : [];
  const groups = Array.isArray(hub.groups) ? hub.groups : [];
  const ratings = Array.isArray(hub.ratings) ? hub.ratings : [];
  const exams = summaries.filter((item: any) =>
    /exam|test|mid|final|اختبار|فاينل|ميد/i.test(
      `${item.resource_type || ''} ${item.content_type || ''} ${item.title || ''}`,
    )
  ).length;
  const notes = Math.max(0, summaries.length - exams);
  const average = Number(hub.stats?.rating_average || 0);
  const name = language === 'en'
    ? (course.name_en || course.name_ar || course.code)
    : (course.name_ar || course.name_en || course.code);

  if (language === 'en') {
    return `## ${course.code} — ${name}\n\n- Credit hours: **${course.credit_hours ?? 'Not available'}**\n- Summaries: **${notes}**\n- Previous exams: **${exams}**\n- WhatsApp groups: **${groups.length}**\n- Student ratings: **${ratings.length}**${average ? `\n- Average rating: **${average}/5**` : ''}\n\nOpen the course page below to see all available content.`;
  }

  return `## ${course.code} — ${name}\n\n- الساعات المعتمدة: **${course.credit_hours ?? 'غير متوفرة'}**\n- الملخصات: **${notes}**\n- الاختبارات السابقة: **${exams}**\n- مجموعات الواتساب: **${groups.length}**\n- تقييمات الطلبة: **${ratings.length}**${average ? `\n- متوسط التقييم: **${average}/5**` : ''}\n\nافتح صفحة المقرر من الرابط تحت عشان تشوف كل المحتوى المتوفر.`;
}

function fallbackAnswer(question: string, context: any[], language: string, intent: string) {
  if (!context.length) {
    return language === 'en'
      ? 'I could not find a reliable answer in UON Hub data. Try a course code, a service name, or a more specific question.'
      : 'ما حصلت جواب موثوق في بيانات UON Hub حاليًا. جرّب تكتب رمز المادة، اسم الخدمة، أو سؤال أدق.';
  }
  const first = context[0];
  if (language === 'en') {
    if (intent === 'links') return `The closest verified result is **${first.title}**. Open the source below.`;
    return `I found information related to your question. The closest result is **${first.title}**. Review the sources below for the details.`;
  }
  if (intent === 'links') return `أقرب نتيجة موثوقة لسؤالك هي **${first.title}**. افتح المصدر الموجود تحت.`;
  return `حصلت معلومات مرتبطة بسؤالك، وأقرب نتيجة هي **${first.title}**. راجع المصادر الموجودة تحت للتفاصيل.`;
}

async function generateAnswer(question: string, history: any[], context: any[], language: string) {
  if (!GEMINI_API_KEY || !context.length) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  const contextText = context.map((item, index) =>
    `[${index + 1}] ${item.type}\nTitle: ${item.title}\nDetails: ${item.description}\nURL: ${item.url || 'Not available'}\nOfficial: ${item.official ? 'Yes' : 'No'}`
  ).join('\n\n');
  const historyText = history.map((item) =>
    `${item.role === 'assistant' ? 'Assistant' : 'Student'}: ${item.content}`
  ).join('\n');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Muscat', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const system = language === 'en'
    ? `You are UON AI, a focused assistant for University of Nizwa students and the UON Hub platform. Use only the supplied context. Never invent rules, dates, fees, links, people, or academic decisions. Clearly distinguish official University of Nizwa sources from student-contributed UON Hub content. For academic, financial, registration, or policy decisions, tell the student to verify the official source. Today in Oman is ${today}. Answer in clear concise Markdown. Use short paragraphs and bullets when useful.`
    : `أنت UON AI، مساعد متخصص لطلاب جامعة نزوى ومنصة UON Hub. استخدم فقط السياق المرفق، ولا تخترع لوائح أو تواريخ أو رسوم أو روابط أو أسماء أو قرارات أكاديمية. وضّح الفرق بين المصدر الرسمي لجامعة نزوى والمحتوى الطلابي في UON Hub. في القرارات الأكاديمية والمالية والتسجيل واللوائح اطلب من الطالب التأكد من المصدر الرسمي. تاريخ اليوم في عُمان هو ${today}. جاوب بالعربية الواضحة والقريبة من الطالب، وبصيغة Markdown مختصرة، واستخدم نقاط عند الحاجة.`;

  const prompt = `${historyText ? `Conversation:\n${historyText}\n\n` : ''}Context:\n${contextText}\n\nStudent question:\n${question}`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.12,
            maxOutputTokens: 700,
          },
        }),
        signal: controller.signal,
      },
    );
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) throw new Error(data?.error?.message || `AI HTTP ${response.status}`);
    return clean(
      data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join(''),
      5000,
    );
  } catch (error) {
    console.warn('UON AI v3 grounded fallback', String((error as Error)?.message || error));
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function suggestions(intent: string, code: string, language: string) {
  const ar: Record<string, string[]> = {
    course: code ? [`وين ملخصات ${code}؟`, `هل فيه مجموعة واتساب لـ ${code}؟`, `كيف تقييم مادة ${code}؟`] : ['ابحث عن مادة', 'وين الملخصات؟', 'كيف أشوف التقييمات؟'],
    gpa: ['افتح حاسبة المعدل', 'كيف أحسب المعدل الفصلي؟', 'كيف أحسب المعدل التراكمي؟'],
    calendar: ['ما أقرب موعد مهم؟', 'افتح التقويم الأكاديمي', 'وين رابط التسجيل الرسمي؟'],
    groups: ['كيف أبحث برمز المادة؟', 'افتح مجموعات الواتساب', 'بلغ عن رابط منتهي'],
    summaries: ['ابحث برمز المادة', 'أين الاختبارات السابقة؟', 'كيف أطلب ملف ناقص؟'],
    programs: ['ما كليات الجامعة؟', 'افتح دليل الجامعة', 'كيف أعرف خطة التخصص؟'],
    links: ['رابط EduWave الرسمي', 'رابط Moodle الرسمي', 'كل روابط الجامعة'],
    general: ['ما الخدمات الموجودة؟', 'ابحث عن مادة', 'ما أهم روابط الجامعة؟'],
  };
  const en: Record<string, string[]> = {
    course: code ? [`Show ${code} summaries`, `Is there a WhatsApp group for ${code}?`, `How is ${code} rated?`] : ['Search for a course', 'Where are summaries?', 'How do ratings work?'],
    gpa: ['Open GPA calculator', 'How do I calculate semester GPA?', 'How do I calculate cumulative GPA?'],
    calendar: ['What is the next important date?', 'Open academic calendar', 'Official registration link'],
    groups: ['How do I search by course code?', 'Open WhatsApp groups', 'Report an expired link'],
    summaries: ['Search by course code', 'Where are previous exams?', 'Request a missing file'],
    programs: ['What colleges are available?', 'Open university guide', 'How do I find a study plan?'],
    links: ['Official EduWave link', 'Official Moodle link', 'All university links'],
    general: ['What services are available?', 'Search for a course', 'Important university links'],
  };
  return (language === 'en' ? en : ar)[intent] || (language === 'en' ? en.general : ar.general);
}

function actionLinks(intent: string, code: string, language: string) {
  const t = (ar: string, en: string) => language === 'en' ? en : ar;
  const actions: any[] = [];
  if (code) {
    actions.push({ label: t('صفحة المقرر', 'Course page'), url: `/course.html?code=${encodeURIComponent(code)}`, icon: '📘' });
    actions.push({ label: t('البحث عن كل المحتوى', 'Search all content'), url: `/search.html?q=${encodeURIComponent(code)}`, icon: '🔎' });
  }
  const map: Record<string, any> = {
    gpa: { label: t('حاسبة المعدل', 'GPA calculator'), url: '/gpa.html', icon: '🧮' },
    calendar: { label: t('التقويم الأكاديمي', 'Academic calendar'), url: '/calendar.html', icon: '📅' },
    groups: { label: t('مجموعات الواتساب', 'WhatsApp groups'), url: '/groups.html', icon: '💬' },
    summaries: { label: t('الملخصات والاختبارات', 'Summaries and exams'), url: '/summaries.html', icon: '📚' },
    programs: { label: t('دليل الجامعة', 'University guide'), url: '/university-guide.html', icon: '🎓' },
    links: { label: t('روابط الجامعة', 'University links'), url: '/useful-sites.html', icon: '🔗' },
  };
  if (map[intent] && !actions.some((item) => item.url === map[intent].url)) actions.push(map[intent]);
  return actions.slice(0, 3);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const started = Date.now();
  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === 'feedback') {
      const requestId = clean(body.request_id, 60);
      const rating = Number(body.rating) === -1 ? -1 : 1;
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json(req, { error: 'invalid_request_id' }, 400);
      const { error } = await db.from('uon_ai_feedback').insert({
        request_id: requestId,
        rating,
        question: clean(body.question, 800),
        answer_preview: clean(body.answer, 900),
        note: clean(body.note, 500),
      });
      if (error) throw error;
      return json(req, { ok: true });
    }

    const rate = await rateLimit(req);
    if (!rate.allowed) {
      return json(
        req,
        { error: 'rate_limited', message: 'تم تجاوز الحد المؤقت. جرّب بعد دقيقة.' },
        429,
        { 'Retry-After': String(rate.retry) },
      );
    }

    const question = clean(body.question, 800);
    const language = body.language === 'en' ? 'en' : 'ar';
    const history = sanitizeHistory(body.history);
    if (question.length < 2) {
      return json(req, { error: 'question_too_short' }, 400);
    }

    const intent = detectIntent(question);
    const code = courseCode(question);
    const requestId = crypto.randomUUID();
    const [{ rows: context, ms: searchMs }, course] = await Promise.all([
      collectContext(question),
      getCourse(code, language),
    ]);

    let answer = course ? courseAnswer(course, language) : '';
    let usedModel = false;
    if (!answer) {
      const generated = await generateAnswer(question, history, context, language);
      if (generated) {
        answer = generated;
        usedModel = true;
      } else {
        answer = fallbackAnswer(question, context, language, intent);
      }
    }

    const links: any[] = [];
    const seen = new Set<string>();
    if (code) {
      const url = `/course.html?code=${encodeURIComponent(code)}`;
      links.push({ type: language === 'en' ? 'Course' : 'مقرر', title: language === 'en' ? `Open ${code}` : `فتح ${code}`, url, official: false });
      seen.add(url);
    }
    for (const item of context) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      links.push({
        type: item.official ? (language === 'en' ? 'Official source' : 'مصدر رسمي') : item.type,
        title: item.title,
        url: item.url,
        official: item.official,
      });
    }

    const sourceCount = context.length + (course ? 1 : 0);
    const confidence = sourceCount >= 5 ? 0.94 : sourceCount >= 3 ? 0.86 : sourceCount >= 1 ? 0.72 : 0.3;
    const totalMs = Date.now() - started;

    db.from('uon_ai_questions').insert({
      question,
      normalized_question: normalize(question),
      answer_preview: answer.slice(0, 500),
      sources_count: sourceCount,
      confidence,
      success: true,
    }).then(() => {});

    return json(req, {
      request_id: requestId,
      answer,
      links: links.slice(0, 8),
      actions: actionLinks(intent, code, language),
      suggestions: suggestions(intent, code, language),
      grounded: sourceCount > 0,
      confidence,
      sources_count: sourceCount,
      mode: intent,
      used_model: usedModel,
      timing: { search_ms: searchMs, total_ms: totalMs },
    });
  } catch (error) {
    console.error('uon-ai-v3', error);
    return json(req, { error: 'assistant_unavailable' }, 500);
  }
});
