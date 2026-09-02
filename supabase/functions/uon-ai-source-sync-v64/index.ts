import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('UON_AI_SYNC_SECRET') || '';
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const OFFICIAL_HOSTS = new Set(['unizwa.edu.om', 'www.unizwa.edu.om']);
const GOOGLE_DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const CALENDAR_HOSTS = new Set(['calendar.google.com']);
const MAX_TEXT = 18000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function clean(v: unknown, max = MAX_TEXT) { return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalize(v: unknown) { return clean(v).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }
function categoryFromSource(source: any) { return clean(source?.settings?.category || source?.source_type || 'general', 80) || 'general'; }
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function authorized(req: Request) {
  const secret = req.headers.get('x-sync-secret') || '';
  if (SYNC_SECRET && secret && secret === SYNC_SECRET) return true;
  const password = req.headers.get('x-admin-password') || '';
  if (!password) return false;
  const { data, error } = await db.rpc('uon_admin_authorized', { p_password: password });
  return !error && data === true;
}
function htmlToText(html: string) {
  return clean(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"), MAX_TEXT);
}
function sourceAllowed(source: any) {
  try {
    const url = new URL(source.source_url || '');
    if (source.provider === 'university_page') return OFFICIAL_HOSTS.has(url.hostname.toLowerCase());
    if (source.provider === 'google_calendar_public') return CALENDAR_HOSTS.has(url.hostname.toLowerCase());
    if (source.provider === 'google_drive') return true;
  } catch { return source.provider === 'google_drive'; }
  return false;
}
async function startRun(source: any) {
  const { data, error } = await db.from('uon_ai_source_sync_runs').insert({ source_id: source.id, provider: source.provider }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
async function finishRun(runId: string, source: any, result: any, errorText = '') {
  const success = !errorText;
  await db.from('uon_ai_source_sync_runs').update({
    status: success ? (result?.partial ? 'partial' : 'success') : 'failed',
    fetched_count: result?.fetched || 0,
    inserted_count: result?.inserted || 0,
    updated_count: result?.updated || 0,
    skipped_count: result?.skipped || 0,
    error: errorText || null,
    metadata: result?.metadata || {},
    completed_at: new Date().toISOString(),
  }).eq('id', runId);
  const next = new Date(Date.now() + Math.max(15, Number(source.refresh_minutes) || 1440) * 60000).toISOString();
  await db.from('import_sources').update({
    last_sync_at: new Date().toISOString(), next_sync_at: next,
    last_status: success ? 'success' : 'failed', last_error: errorText || null, updated_at: new Date().toISOString(),
  }).eq('id', source.id);
}
async function upsertKnowledge(source: any, externalId: string, title: string, content: string, sourceUrl: string, metadata: any = {}, sourceUpdatedAt?: string | null) {
  const safeTitle = clean(title, 300), safeContent = clean(content, MAX_TEXT);
  if (!safeTitle || safeContent.length < 20) return { skipped: true };
  const hash = await sha256(`${safeTitle}\n${safeContent}`);
  const provider = clean(source.provider, 80), ext = clean(`${source.id}:${externalId}`, 500);
  const { data: existing } = await db.from('uon_ai_knowledge').select('id,content_hash').eq('source_provider', provider).eq('source_external_id', ext).maybeSingle();
  if (existing?.content_hash === hash) return { skipped: true };
  const official = Boolean(source?.settings?.official) || source.provider === 'university_page';
  const trust = Math.max(0, Math.min(100, Number(source.trust_level) || 70));
  const approved = Boolean(source.allow_auto_publish) && trust >= 90;
  const payload = {
    title: safeTitle, content: safeContent, category: categoryFromSource(source), source_url: clean(sourceUrl, 1000) || null,
    source_title: clean(source.source_name || safeTitle, 300), official,
    active: approved, tags: [provider, clean(source.source_type, 80), categoryFromSource(source)].filter(Boolean),
    source_provider: provider, source_external_id: ext, source_type: clean(source.source_type, 80),
    fetched_at: new Date().toISOString(), source_updated_at: sourceUpdatedAt || null, content_hash: hash,
    confidence: Math.min(0.99, Math.max(0.40, trust / 100)), verification_status: approved ? 'approved' : 'pending',
    last_verified_at: approved ? new Date().toISOString() : null,
    metadata: { ...metadata, source_registry_id: source.id }, updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    const { error } = await db.from('uon_ai_knowledge').update(payload).eq('id', existing.id); if (error) throw error;
    return { updated: true };
  }
  const { error } = await db.from('uon_ai_knowledge').insert(payload); if (error) throw error;
  return { inserted: true };
}
async function syncUniversityPage(source: any) {
  if (!sourceAllowed(source)) throw new Error('SOURCE_HOST_NOT_ALLOWED');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(source.source_url, { headers: { 'user-agent': 'UON-Hub-KnowledgeSync/64.0' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const html = await res.text(), text = htmlToText(html);
    const result = await upsertKnowledge(source, source.source_id, source.source_name || source.source_id, text, source.source_url, { host: new URL(source.source_url).hostname, http_status: res.status });
    return { fetched: 1, inserted: result.inserted ? 1 : 0, updated: result.updated ? 1 : 0, skipped: result.skipped ? 1 : 0 };
  } finally { clearTimeout(timer); }
}
function b64url(v: unknown) { return btoa(JSON.stringify(v)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
async function driveToken() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_MISSING');
  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON); if (!sa.client_email || !sa.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_INVALID');
  const now = Math.floor(Date.now() / 1000), h = b64url({ alg: 'RS256', typ: 'JWT' }), c = b64url({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), x => x.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${c}`));
  const s = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${s}` }) });
  const p = await r.json(); if (!r.ok || !p.access_token) throw new Error('GOOGLE_DRIVE_AUTH_FAILED'); return p.access_token as string;
}
async function driveExport(file: any, token: string) {
  const mime = file.mimeType || '';
  let exportMime = '';
  if (mime === 'application/vnd.google-apps.document') exportMime = 'text/plain';
  else if (mime === 'application/vnd.google-apps.spreadsheet') exportMime = 'text/csv';
  else if (mime === 'text/plain' || mime === 'text/csv') {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? clean(await r.text(), MAX_TEXT) : '';
  } else return '';
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok ? clean(await r.text(), MAX_TEXT) : '';
}
async function syncGoogleDrive(source: any) {
  const token = await driveToken(), folderId = clean(source.source_id, 220);
  if (!/^[A-Za-z0-9_-]{10,220}$/.test(folderId)) throw new Error('GOOGLE_DRIVE_SOURCE_ID_INVALID');
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`), fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)');
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=100&fields=${fields}`, { headers: { Authorization: `Bearer ${token}` } });
  const p = await r.json(); if (!r.ok) throw new Error(`GOOGLE_DRIVE_HTTP_${r.status}`);
  let inserted = 0, updated = 0, skipped = 0, fetched = 0;
  for (const file of (p.files || []).slice(0, 100)) {
    fetched++; const text = await driveExport(file, token);
    if (!text) { skipped++; continue; }
    const result = await upsertKnowledge(source, file.id, file.name, text, file.webViewLink || '', { mime_type: file.mimeType }, file.modifiedTime || null);
    inserted += result.inserted ? 1 : 0; updated += result.updated ? 1 : 0; skipped += result.skipped ? 1 : 0;
  }
  return { fetched, inserted, updated, skipped, partial: Boolean(p.nextPageToken), metadata: { next_page: Boolean(p.nextPageToken) } };
}
function unfoldIcs(text: string) { return text.replace(/\r?\n[ \t]/g, ''); }
function parseIcsDate(v: string) {
  const x = clean(v, 40); const m = x.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?/); if (!m) return x;
  return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5] || '00'}` : ''}`;
}
async function syncGoogleCalendar(source: any) {
  if (!sourceAllowed(source)) throw new Error('CALENDAR_HOST_NOT_ALLOWED');
  const r = await fetch(source.source_url, { headers: { 'user-agent': 'UON-Hub-KnowledgeSync/64.0' } }); if (!r.ok) throw new Error(`CALENDAR_HTTP_${r.status}`);
  const text = unfoldIcs(await r.text()), blocks = text.split('BEGIN:VEVENT').slice(1).map(x => x.split('END:VEVENT')[0]);
  let inserted = 0, updated = 0, skipped = 0;
  for (const block of blocks.slice(0, 300)) {
    const get = (key: string) => clean(block.match(new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:(.*)`, 'i'))?.[1] || '', 1000);
    const uid = get('UID') || await sha256(block), title = get('SUMMARY') || 'Calendar event', start = parseIcsDate(get('DTSTART')), end = parseIcsDate(get('DTEND')), description = get('DESCRIPTION'), location = get('LOCATION');
    const content = [title, start && `Start: ${start}`, end && `End: ${end}`, location && `Location: ${location}`, description].filter(Boolean).join(' • ');
    const result = await upsertKnowledge(source, uid, title, content, source.source_url, { calendar_uid: uid, start, end, location });
    inserted += result.inserted ? 1 : 0; updated += result.updated ? 1 : 0; skipped += result.skipped ? 1 : 0;
  }
  return { fetched: blocks.length, inserted, updated, skipped, partial: blocks.length > 300 };
}
async function syncOne(source: any) {
  if (!sourceAllowed(source)) throw new Error('SOURCE_NOT_ALLOWED');
  if (source.provider === 'university_page') return await syncUniversityPage(source);
  if (source.provider === 'google_drive') return await syncGoogleDrive(source);
  if (source.provider === 'google_calendar_public') return await syncGoogleCalendar(source);
  throw new Error('PROVIDER_NOT_SUPPORTED');
}
async function dueSources(limit: number) {
  const now = new Date().toISOString();
  const { data, error } = await db.from('import_sources').select('*').eq('active', true).in('provider', ['university_page', 'google_drive', 'google_calendar_public']).or(`next_sync_at.is.null,next_sync_at.lte.${now}`).order('next_sync_at', { ascending: true, nullsFirst: true }).limit(Math.max(1, Math.min(limit, 8)));
  if (error) throw error; return data || [];
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(req))) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    let sources: any[] = [];
    if (body.action === 'sync-source') {
      const { data, error } = await db.from('import_sources').select('*').eq('id', clean(body.source_id, 100)).eq('active', true).maybeSingle(); if (error) throw error; if (!data) return json({ error: 'source_not_found' }, 404); sources = [data];
    } else sources = await dueSources(Number(body.limit) || 4);
    const results: any[] = [];
    for (const source of sources) {
      const runId = await startRun(source);
      try { const result = await syncOne(source); await finishRun(runId, source, result); results.push({ source_id: source.id, provider: source.provider, ok: true, ...result }); }
      catch (e) { const message = clean((e as Error)?.message || e, 900); await finishRun(runId, source, {}, message); results.push({ source_id: source.id, provider: source.provider, ok: false, error: message }); }
    }
    return json({ ok: true, synced: results.length, results });
  } catch (e) { return json({ ok: false, error: clean((e as Error)?.message || e, 900) }, 400); }
});
