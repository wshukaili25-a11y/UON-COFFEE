import { createClient } from 'npm:@supabase/supabase-js@2';
import * as cheerio from 'npm:cheerio@1.0.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ORIGIN = 'https://www.unizwa.edu.om';
const TOTAL_PAGES = 58;

function norm(v: string | null | undefined) {
  return String(v || '').replace(/\u00a0/g, ' ').replace(/�/g, "'").replace(/\s+/g, ' ').trim();
}
function cleanLine(v: string) { return norm(v).replace(/^[-•*]+\s*/, ''); }
function linesFromHtml(html: string) {
  const broken = html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|h1|h2|h3|h4|h5|h6|tr|td)>/gi, '\n');
  const $ = cheerio.load(`<body>${broken}</body>`);
  return $('body').text().split(/\n+/).map(cleanLine).filter(Boolean);
}
function labelCount(s: string) { return (s.match(/Telephone:|Extension:|eMail:|Email:|Office Location:|Fax:/gi) || []).length; }
function valueFor(lines: string[], label: RegExp) {
  for (const line of lines) { const m = line.match(label); if (m) return norm(m[1]); }
  return '';
}
function parseCard($: cheerio.CheerioAPI, el: any, page: number) {
  const lines = linesFromHtml($.html(el));
  const firstLabel = lines.findIndex(l => /^(Telephone|Extension|eMail|Email|Office Location|Fax):/i.test(l));
  if (firstLabel < 0) return null;
  let head = lines.slice(0, firstLabel).map(l => l.replace(/^Image:\s*/i, '').trim()).filter(l => l && !/^Image$/i.test(l) && !/^Staff$/i.test(l));
  const noise = /^(About UoN|Academic Affairs|Research|Resources and Services|Campus Map|Contact us|Moodle|Staff Directory)$/i;
  head = head.filter(l => !noise.test(l));
  if (!head.length) return null;
  const alt = norm($(el).find('img[alt]').map((_, img) => $(img).attr('alt')).get().find(a => a && !/^image$/i.test(a)) || '');
  let full_name = norm((alt || head[0]).replace(/^image:\s*/i, ''));
  if (!full_name || full_name.length < 3 || full_name.length > 140) return null;
  head = head.filter(h => norm(h).toLowerCase() !== full_name.toLowerCase());
  const email = valueFor(lines, /^(?:eMail|Email):\s*(.+)$/i).toLowerCase();
  const phone = valueFor(lines, /^Telephone:\s*(.+)$/i);
  const extension = valueFor(lines, /^Extension:\s*(.+)$/i);
  const office_location = valueFor(lines, /^Office Location:\s*(.+)$/i);
  const meta = head.map(norm).filter(Boolean).slice(0, 5);
  if (!email && !phone && !extension) return null;
  const job_title = meta[0] || '';
  const department = meta[1] || '';
  const college = meta[2] || '';
  const keyBase = [full_name.toLowerCase(), email, extension, department.toLowerCase()].join('|');
  const source_key = new TextEncoder().encode(keyBase).reduce((h, b) => ((h * 31 + b) >>> 0), 2166136261).toString(16);
  const now = new Date().toISOString();
  return { source_key, full_name, job_title: job_title || null, department: department || null, college: college || null, phone: phone || null, extension: extension || null, email: email || null, office_location: office_location || null, source_url: `${ORIGIN}/profile_details.php?comingfrom=&department=&eppage=${page}&lang=en`, source_page: page, official: true, active: true, last_verified_at: now, synced_at: now, updated_at: now };
}
function extractPage(html: string, page: number) {
  const $ = cheerio.load(html);
  const candidates: any[] = [];
  $('body *').each((_, el) => {
    const text = norm($(el).text());
    const lc = labelCount(text);
    if (lc < 2 || text.length < 40 || text.length > 1400) return;
    let childHas = false;
    $(el).children().each((_, child) => { const ct = norm($(child).text()); if (labelCount(ct) >= 2 && ct.length >= 40 && ct.length < text.length * 0.92) childHas = true; });
    if (!childHas) candidates.push(el);
  });
  const rows = candidates.map(el => parseCard($, el, page)).filter(Boolean) as any[];
  const byKey = new Map<string, any>();
  for (const r of rows) byKey.set(r.source_key, r);
  return [...byKey.values()];
}
async function fetchPage(page: number) {
  const url = `${ORIGIN}/profile_details.php?comingfrom=&department=&eppage=${page}&lang=en`;
  const res = await fetch(url, { headers: { 'user-agent': 'UON-Hub-Staff-Sync/1.2 (+https://uonhub.space)', 'accept-language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  return await res.text();
}
async function authorized(req: Request) {
  const token = req.headers.get('x-sync-token') || '';
  if (!token) return false;
  const { data, error } = await sb.rpc('uon_staff_sync_token_valid', { p_token: token });
  return !error && data === true;
}

Deno.serve(async (req: Request) => {
  if (!(await authorized(req))) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'probe' ? 'probe' : 'sync';
    const start = Math.max(1, Math.min(Number(body?.start_page || 1), TOTAL_PAGES));
    const end = Math.max(start, Math.min(Number(body?.end_page || (mode === 'probe' ? start : TOTAL_PAGES)), TOTAL_PAGES));
    if (mode === 'probe') {
      const html = await fetchPage(start); const rows = extractPage(html, start);
      return Response.json({ ok: true, page: start, count: rows.length, sample: rows.slice(0, 5) });
    }
    const batch = `uon-staff-${new Date().toISOString()}`;
    let total = 0; const pageCounts: Record<string, number> = {}; const errors: string[] = [];
    for (let page = start; page <= end; page++) {
      try {
        const html = await fetchPage(page); const rows = extractPage(html, page).map(r => ({ ...r, sync_batch: batch }));
        pageCounts[String(page)] = rows.length;
        if (!rows.length) { errors.push(`page ${page}: no rows parsed`); continue; }
        const { error } = await sb.from('uon_staff_directory').upsert(rows, { onConflict: 'source_key' });
        if (error) throw error; total += rows.length;
      } catch (e) { errors.push(String((e as Error)?.message || e)); }
    }
    const { count } = await sb.from('uon_staff_directory').select('*', { count: 'exact', head: true }).eq('active', true);
    return Response.json({ ok: errors.length === 0, start_page: start, end_page: end, parsed: total, active_staff: count || 0, page_counts: pageCounts, errors: errors.slice(0, 20) });
  } catch (e) { return Response.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); }
});
