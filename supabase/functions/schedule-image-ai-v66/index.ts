import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const PRIMARY_MODEL = Deno.env.get('GEMINI_PRIMARY_MODEL') || 'gemini-3.7-flash';
const FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-2.5-flash';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const allowedOrigins = new Set(['https://uonhub.space', 'https://www.uonhub.space']);
const allowedDays = new Set(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
const dayAliases: Record<string, string> = {
  sunday: 'الأحد', sun: 'الأحد', 'الأحد': 'الأحد', 'الاحد': 'الأحد',
  monday: 'الاثنين', mon: 'الاثنين', 'الاثنين': 'الاثنين',
  tuesday: 'الثلاثاء', tue: 'الثلاثاء', 'الثلاثاء': 'الثلاثاء',
  wednesday: 'الأربعاء', wed: 'الأربعاء', 'الأربعاء': 'الأربعاء', 'الاربعاء': 'الأربعاء',
  thursday: 'الخميس', thu: 'الخميس', 'الخميس': 'الخميس'
};

function clean(v: unknown, max = 200) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function requestOrigin(req: Request) {
  return req.headers.get('origin') || '';
}
function isAllowedOrigin(req: Request) {
  const value = requestOrigin(req);
  if (allowedOrigins.has(value)) return true;
  try {
    const host = new URL(value).hostname;
    return host.endsWith('.vercel.app') && (host.startsWith('uon-') || host.startsWith('uon-hub-'));
  } catch { return false; }
}
function corsOrigin(req: Request) {
  return isAllowedOrigin(req) ? requestOrigin(req) : 'https://uonhub.space';
}
function headers(req: Request) {
  return {
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}
function out(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}
function validClientToken(v: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ''));
}
function normalizeDay(v: unknown) {
  const key = clean(v, 30).toLowerCase();
  return dayAliases[key] || '';
}
function normalizeTime(v: unknown) {
  const raw = clean(v, 20).replace(/[.]/g, ':');
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm|ص|م)?$/i);
  if (!m) return '';
  let h = Number(m[1]); const min = Number(m[2]);
  if (min > 59 || h > 23) return '';
  const p = (m[3] || '').toLowerCase();
  if (p === 'pm' || p === 'م') { if (h < 12) h += 12; }
  if (p === 'am' || p === 'ص') { if (h === 12) h = 0; }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
function minutes(v: string) {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}
function overlaps(a: any, b: any) {
  return a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
}
async function digest(v: string) {
  const bytes = new TextEncoder().encode(v);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function clientIp(req: Request) {
  for (const key of ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']) {
    const raw = req.headers.get(key) || '';
    const first = raw.split(',')[0]?.trim();
    if (first && first.length <= 80) return first;
  }
  return '';
}
async function rateHit(key: string, limit: number) {
  const d = new Date(); d.setSeconds(0, 0);
  try {
    const { data, error } = await db.rpc('uon_ai_rate_limit', { p_client_key: key, p_window_start: d.toISOString(), p_limit: limit });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) || {};
    return Boolean(row?.allowed);
  } catch {
    return false;
  }
}
async function allowedByRate(req: Request, clientToken: string) {
  if (!(await rateHit(`schedule-image-client:${clientToken}`, 6))) return false;
  const ip = clientIp(req);
  if (!ip) return false;
  return rateHit(`schedule-image-ip:${await digest(ip)}`, 12);
}

function normalizeCourses(raw: any) {
  const list = Array.isArray(raw?.courses) ? raw.courses : Array.isArray(raw) ? raw : [];
  const courses: any[] = [];
  for (const item of list.slice(0, 30)) {
    const course = clean(item?.course || item?.code || item?.title || item?.name, 40).toUpperCase();
    const title = clean(item?.title || item?.name || item?.course || item?.code, 100);
    if (!course) continue;
    const sections: any[] = [];
    for (const sec of (Array.isArray(item?.sections) ? item.sections : []).slice(0, 30)) {
      const section = clean(sec?.section || sec?.section_no || sec?.id || sec?.number, 40);
      if (!section) continue;
      const meetings: any[] = [];
      for (const mt of (Array.isArray(sec?.meetings) ? sec.meetings : []).slice(0, 12)) {
        const day = normalizeDay(mt?.day);
        const start = normalizeTime(mt?.start);
        const end = normalizeTime(mt?.end);
        if (!allowedDays.has(day) || !start || !end || minutes(end) <= minutes(start)) continue;
        meetings.push({
          day,
          start,
          end,
          room: clean(mt?.room, 50),
          teacher: clean(mt?.teacher || mt?.instructor, 100),
          type: clean(mt?.type || 'lecture', 20) || 'lecture'
        });
      }
      if (meetings.length) sections.push({ section, meetings });
    }
    if (sections.length) courses.push({ course, title: title || course, sections });
  }
  return courses;
}

function selectionScore(rows: any[], preference: string) {
  const days = new Map<string, any[]>();
  for (const r of rows) {
    if (!days.has(r.day)) days.set(r.day, []);
    days.get(r.day)!.push(r);
  }
  let gaps = 0, startSum = 0, count = 0;
  for (const list of days.values()) {
    list.sort((a, b) => minutes(a.start) - minutes(b.start));
    for (let i = 0; i < list.length; i++) {
      startSum += minutes(list[i].start); count++;
      if (i) gaps += Math.max(0, minutes(list[i].start) - minutes(list[i - 1].end));
    }
  }
  let score = days.size * 1000 + gaps * 2;
  const avg = count ? startSum / count : 0;
  if (preference === 'morning') score += avg * 2;
  else if (preference === 'late') score -= avg * 1.5;
  else if (preference === 'fewer_days') score += days.size * 2500;
  else score += avg * 0.15;
  return score;
}

function optimize(courses: any[], preference: string) {
  const ordered = [...courses].sort((a, b) => a.sections.length - b.sections.length);
  let best: any[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let visited = 0;
  const MAX_VISITS = 50000;
  function walk(index: number, chosenRows: any[]) {
    if (++visited > MAX_VISITS) return;
    if (index >= ordered.length) {
      const score = selectionScore(chosenRows, preference);
      if (score < bestScore) { bestScore = score; best = chosenRows.map(x => ({ ...x })); }
      return;
    }
    const course = ordered[index];
    for (const sec of course.sections) {
      const rows = sec.meetings.map((m: any) => ({ ...m, course: course.course, title: course.title, section: sec.section }));
      if (!rows.some((row: any) => chosenRows.some(existing => overlaps(row, existing)))) walk(index + 1, chosenRows.concat(rows));
    }
  }
  walk(0, []);
  return { rows: best || [], complete: Boolean(best), visited };
}

function extractJson(text: string) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
  throw new Error('invalid_model_json');
}

async function callGemini(model: string, images: any[]) {
  const prompt = `You are extracting University of Nizwa EduWave available-section screenshots for a student timetable generator.
Return ONLY JSON. Do not invent any course, section, day, time, room, or instructor.
The student may upload multiple screenshots. Course code/name is visible in the screenshots, so infer it only from visible text.
Merge duplicate screenshots of the same course. Group every meeting belonging to the same section together.
Use this exact schema:
{"courses":[{"course":"visible course code or concise visible course name","title":"visible course title","sections":[{"section":"visible section number/name","meetings":[{"day":"الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس","start":"HH:MM","end":"HH:MM","room":"","teacher":"","type":"lecture"}]}]}],"warnings":[]}
Rules:
- Convert Sunday-Thursday to the Arabic day names shown above.
- Use 24-hour HH:MM times.
- Preserve all available sections, not just one.
- If one section meets on multiple days, include all its meetings in the same section.
- Ignore rows that are clearly not available section schedule data.
- If a value is unreadable, leave room/teacher empty; never guess times or section numbers.
- warnings may briefly mention screenshots that are unreadable or incomplete.`;
  const parts: any[] = [{ text: prompt }];
  for (const img of images) parts.push({ inlineData: { mimeType: img.mime_type, data: img.data } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.05, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(45000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`gemini_${res.status}_${clean(data?.error?.message, 160)}`);
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('\n');
  if (!text) throw new Error('empty_model_response');
  return extractJson(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(req)) return out(req, { error: 'origin_not_allowed' }, 403);
    return new Response('', { status: 204, headers: headers(req) });
  }
  if (req.method !== 'POST') return out(req, { error: 'method_not_allowed' }, 405);
  if (!isAllowedOrigin(req)) return out(req, { error: 'origin_not_allowed' }, 403);
  if (!GEMINI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) return out(req, { error: 'service_not_configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const clientToken = clean(body?.client_token, 80);
  if (!validClientToken(clientToken)) return out(req, { error: 'invalid_client' }, 400);
  if (!(await allowedByRate(req, clientToken))) return out(req, { error: 'rate_limited' }, 429);

  const images = (Array.isArray(body?.images) ? body.images : []).slice(0, 12).map((x: any) => ({
    mime_type: clean(x?.mime_type, 40), data: String(x?.data || '')
  })).filter((x: any) => /^image\/(png|jpeg|jpg|webp)$/i.test(x.mime_type) && /^[A-Za-z0-9+/=]+$/.test(x.data));
  const encodedBytes = images.reduce((sum: number, x: any) => sum + x.data.length, 0);
  if (!images.length) return out(req, { error: 'no_images' }, 400);
  if (encodedBytes > 18_000_000) return out(req, { error: 'images_too_large' }, 413);

  const preference = ['balanced', 'morning', 'late', 'fewer_days'].includes(body?.preference) ? body.preference : 'balanced';
  let extracted: any = null;
  let usedModel = PRIMARY_MODEL;
  try {
    extracted = await callGemini(PRIMARY_MODEL, images);
  } catch (primaryError) {
    if (!FALLBACK_MODEL || FALLBACK_MODEL === PRIMARY_MODEL) return out(req, { error: 'vision_failed', detail: clean((primaryError as Error)?.message, 180) }, 502);
    try {
      usedModel = FALLBACK_MODEL;
      extracted = await callGemini(FALLBACK_MODEL, images);
    } catch (fallbackError) {
      return out(req, { error: 'vision_failed', detail: clean((fallbackError as Error)?.message, 180) }, 502);
    }
  }

  const courses = normalizeCourses(extracted);
  if (!courses.length) return out(req, { error: 'no_sections_found', warnings: Array.isArray(extracted?.warnings) ? extracted.warnings.slice(0, 8) : [] }, 422);

  const optimized = optimize(courses, preference);
  if (!optimized.complete) {
    return out(req, {
      error: 'no_conflict_free_schedule',
      courses_found: courses.length,
      sections_found: courses.reduce((n, c) => n + c.sections.length, 0),
      warnings: ['تمت قراءة الشعب، لكن لا يوجد اختيار كامل بدون تعارض بين المواد.']
    }, 409);
  }

  const schedule = optimized.rows.slice(0, 80).map((r: any) => ({
    course: clean(r.course, 40), title: clean(r.title, 100), section: clean(r.section, 40),
    day: r.day, start: r.start, end: r.end, room: clean(r.room, 50), teacher: clean(r.teacher, 100), type: clean(r.type || 'lecture', 20)
  }));

  return out(req, {
    ok: true,
    model: usedModel,
    privacy: 'images_not_saved_in_uonhub_database',
    courses_found: courses.length,
    sections_found: courses.reduce((n, c) => n + c.sections.length, 0),
    schedule,
    warnings: (Array.isArray(extracted?.warnings) ? extracted.warnings : []).map((x: any) => clean(x, 180)).filter(Boolean).slice(0, 8)
  });
});
