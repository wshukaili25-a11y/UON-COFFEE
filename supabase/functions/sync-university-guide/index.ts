import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OFFICIAL_PROGRAMS_URL = 'https://www.unizwa.edu.om/program_details.php?comingfrom=1378';
const OFFICIAL_CONTACT_URL = 'https://www.unizwa.edu.om/contactus.php';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

function normalizeArabic(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

const COLLEGE_ALIASES: Array<[RegExp, string]> = [
  [/كليه\s+العلوم\s+والاداب/i, 'كلية العلوم والآداب'],
  [/كليه\s+الاقتصاد\s+والاداره\s+ونظم\s+المعلومات/i, 'كلية الاقتصاد والإدارة ونظم المعلومات'],
  [/كليه\s+الهندسه\s+والعماره/i, 'كلية الهندسة والعمارة'],
  [/كليه\s+العلوم\s+الصحيه/i, 'كلية العلوم الصحية'],
];

function canonicalCollege(value: string) {
  const normalized = normalizeArabic(value);
  for (const [pattern, canonical] of COLLEGE_ALIASES) {
    if (pattern.test(normalized)) return canonical;
  }
  return null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function htmlToLines(html: string) {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(?:p|div|li|tr|td|th|h[1-6]|section|article|option|a)\b[^>]*>/gi, '\n')
      // Split every HTML text node onto its own line. The official page uses many inline tags.
      .replace(/<[^>]+>/g, '\n'),
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function scoreArabic(text: string) {
  return (text.match(/[\u0600-\u06FF]/g) || []).length;
}

function decodeOfficialHtml(bytes: Uint8Array, contentType: string | null) {
  const declared = contentType?.match(/charset\s*=\s*([^;\s]+)/i)?.[1]?.replace(/["']/g, '');
  const candidates = [declared, 'utf-8', 'windows-1256', 'iso-8859-6']
    .filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);

  let best = '';
  let bestScore = -1;
  for (const encoding of candidates) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes);
      const score = scoreArabic(decoded) + (decoded.includes('كلية') ? 500 : 0) + (decoded.includes('بكالوريوس') ? 500 : 0);
      if (score > bestScore) {
        best = decoded;
        bestScore = score;
      }
    } catch {
      // Unsupported decoder label; try the next candidate.
    }
  }
  return best || new TextDecoder().decode(bytes);
}

function detectDegree(title: string) {
  const t = normalizeArabic(title);
  if (/دكتوراه|ph\.?d/i.test(t)) return 'دكتوراه';
  if (/ماجستير|m\.?sc|m\.?a\.?|master/i.test(t)) return 'ماجستير';
  if (/دبلوم\s+(?:الدراسات\s+العليا|التاهيل\s+التربوي|عالي)|postgraduate diploma|pgd/i.test(t)) return 'دبلوم دراسات عليا';
  if (/بكالوريوس|bachelor|b\.?sc|b\.?a/i.test(t)) return 'بكالوريوس';
  if (/دبلوم|diploma/i.test(t)) return 'دبلوم';
  return 'برنامج';
}

function looksLikeProgramTitle(value: string) {
  const t = normalizeArabic(value);
  // Do not use \b here: JavaScript word boundaries are ASCII-oriented and fail with Arabic text.
  return /^(?:برنامج\s+)?(?:دبلوم|بكالوريوس|ماجستير|دكتوراه)(?:\s|$)/.test(t)
    || /^(?:program\s+)?(?:diploma|bachelor|master|ph\.?d)(?:\s|$)/i.test(value);
}

function cleanProgramName(title: string) {
  return title.replace(/^\s*برنامج\s+/i, '').replace(/\s+/g, ' ').trim();
}

function parsePrograms(html: string) {
  const lines = htmlToLines(html);
  const programs: Array<Record<string, unknown>> = [];

  // The official page consistently places the program title immediately before its college.
  for (let i = 0; i < lines.length; i++) {
    const college = canonicalCollege(lines[i]);
    if (!college) continue;

    let title = '';
    for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
      const candidate = lines[j];
      if (looksLikeProgramTitle(candidate)) {
        title = candidate;
        break;
      }
    }

    if (!title || title.length < 4 || title.length > 240) continue;
    const degree = detectDegree(title);
    const name = cleanProgramName(title);
    const sourceKey = `${college}|${degree}|${normalizeArabic(name)}`;

    programs.push({
      source_key: sourceKey,
      college,
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
  return { programs: [...unique.values()], lines };
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UON-Hub-University-Guide/2.0)',
        'Accept-Language': 'ar,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`Official page returned ${response.status}`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    const html = decodeOfficialHtml(bytes, response.headers.get('content-type'));
    const { programs, lines } = parsePrograms(html);

    console.log(JSON.stringify({
      event: 'university_guide_parse',
      http_status: response.status,
      content_type: response.headers.get('content-type'),
      bytes: bytes.length,
      lines: lines.length,
      arabic_chars: scoreArabic(html),
      programs: programs.length,
      sample: lines.filter(looksLikeProgramTitle).slice(0, 10),
      college_sample: lines.filter((line) => canonicalCollege(line)).slice(0, 10),
    }));

    if (programs.length < 50) {
      throw new Error(`Parser returned only ${programs.length} programs (lines=${lines.length}, arabic=${scoreArabic(html)}). Check function logs for title and college samples`);
    }

    const { error: upsertError } = await supabase
      .from('university_programs')
      .upsert(programs, { onConflict: 'source_key' });
    if (upsertError) throw upsertError;

    const activeKeys = programs.map((item) => String(item.source_key));
    const { error: deactivateError } = await supabase
      .from('university_programs')
      .update({ active: false })
      .eq('official_url', OFFICIAL_PROGRAMS_URL)
      .not('source_key', 'in', `(${activeKeys.map((key) => `"${key.replace(/"/g, '\\"')}"`).join(',')})`);
    if (deactivateError) console.warn(`Could not deactivate removed programs: ${deactivateError.message}`);

    const { error: metaError } = await supabase.from('university_guide_syncs').insert({
      source_url: OFFICIAL_PROGRAMS_URL,
      programs_count: programs.length,
      status: 'success',
      details: {
        contact_source: OFFICIAL_CONTACT_URL,
        content_type: response.headers.get('content-type'),
        page_bytes: bytes.length,
      },
    });
    if (metaError) console.warn(metaError.message);

    return new Response(JSON.stringify({
      ok: true,
      programs_count: programs.length,
      colleges: [...new Set(programs.map((p) => p.college))],
      degrees: [...new Set(programs.map((p) => p.degree))],
      source: OFFICIAL_PROGRAMS_URL,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
