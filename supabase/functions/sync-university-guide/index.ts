import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OFFICIAL_PROGRAMS_URL = 'https://www.unizwa.edu.om/program_details.php?comingfrom=1378';
const OFFICIAL_CONTACT_URL = 'https://www.unizwa.edu.om/contactus.php';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

const COLLEGE_ALIASES: Record<string, string> = {
  'كلية العلوم والآداب': 'كلية العلوم والآداب',
  'كلية الاقتصاد والادارة ونظم المعلومات': 'كلية الاقتصاد والإدارة ونظم المعلومات',
  'كلية الاقتصاد والإدارة ونظم المعلومات': 'كلية الاقتصاد والإدارة ونظم المعلومات',
  'كلية الهندسة والعمارة': 'كلية الهندسة والعمارة',
  'كلية العلوم الصحية': 'كلية العلوم الصحية',
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function htmlToLines(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function detectDegree(title: string) {
  const t = title.trim();
  if (/دكتوراه|Ph\.?D/i.test(t)) return 'دكتوراه';
  if (/ماجستير|M\.?Sc|M\.?A\.?|Master/i.test(t)) return 'ماجستير';
  if (/دبلوم الدراسات العليا|الدبلوم العالي|Postgraduate Diploma|PgD/i.test(t)) return 'دبلوم دراسات عليا';
  if (/بكالوريوس|Bachelor|B\.?Sc|B\.?A/i.test(t)) return 'بكالوريوس';
  if (/دبلوم|Diploma/i.test(t)) return 'دبلوم';
  return 'برنامج';
}

function cleanProgramName(title: string) {
  return title
    .replace(/^\s*(برنامج\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrograms(html: string) {
  const lines = htmlToLines(html);
  const programs: Array<Record<string, unknown>> = [];
  const ignored = new Set([
    'الكلية/البرنامج', 'الدرجة', 'البرامج', 'مرفقات', 'معلومات إضافية:',
    'قيمة الساعة المعتمدة إجمالي الساعات المعتمدة تكلفة الفصل الدراسي الواحد إجمالي التكلفة مدة الدراسة المتوقعة بالسنوات',
  ]);

  for (let i = 1; i < lines.length; i++) {
    const normalizedCollege = COLLEGE_ALIASES[lines[i]];
    if (!normalizedCollege) continue;

    let title = '';
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const candidate = lines[j].trim();
      if (!candidate || ignored.has(candidate) || candidate.startsWith('Image')) continue;
      if (/^(قيمة الساعة|إجمالي عدد ساعات|الحد الأدنى|معلومات إضافية|نبذة|الوظائف|مرفقات)/.test(candidate)) continue;
      title = candidate;
      break;
    }

    if (!title || title.length < 4 || title.length > 220) continue;
    const degree = detectDegree(title);
    const name = cleanProgramName(title);
    const slug = `${normalizedCollege}|${degree}|${name}`.toLowerCase();

    programs.push({
      source_key: slug,
      college: normalizedCollege,
      degree,
      name_ar: name,
      name_en: null,
      official_url: OFFICIAL_PROGRAMS_URL,
      source_updated_at: new Date().toISOString(),
      active: true,
    });
  }

  const unique = new Map<string, Record<string, unknown>>();
  for (const item of programs) unique.set(String(item.source_key), item);
  return [...unique.values()];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const expectedSecret = Deno.env.get('UNIVERSITY_GUIDE_SYNC_SECRET');
    const providedSecret = req.headers.get('x-sync-secret');
    if (expectedSecret && providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const response = await fetch(OFFICIAL_PROGRAMS_URL, {
      headers: { 'User-Agent': 'UON-Hub-University-Guide/1.0' },
    });
    if (!response.ok) throw new Error(`Official page returned ${response.status}`);

    const html = await response.text();
    const programs = parsePrograms(html);
    if (programs.length < 50) throw new Error(`Parser returned only ${programs.length} programs`);

    const { error: upsertError } = await supabase
      .from('university_programs')
      .upsert(programs, { onConflict: 'source_key' });
    if (upsertError) throw upsertError;

    const { error: metaError } = await supabase.from('university_guide_syncs').insert({
      source_url: OFFICIAL_PROGRAMS_URL,
      programs_count: programs.length,
      status: 'success',
      details: { contact_source: OFFICIAL_CONTACT_URL },
    });
    if (metaError) console.warn(metaError.message);

    return new Response(JSON.stringify({
      ok: true,
      programs_count: programs.length,
      colleges: [...new Set(programs.map((p) => p.college))],
      source: OFFICIAL_PROGRAMS_URL,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
