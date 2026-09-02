import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const allowed = new Set(['https://uonhub.space', 'https://www.uonhub.space']);
const CALENDAR_SCOPES = new Set([
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
]);
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
function clean(v: unknown, max = 800) { return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }
function origin(req: Request) { const value=req.headers.get('origin')||''; try{const host=new URL(value).hostname;if(allowed.has(value)||(host.endsWith('.vercel.app')&&(host.startsWith('uon-')||host.startsWith('uon-hub-'))))return value}catch{} return 'https://uonhub.space'; }
function headers(req: Request) { return {'Access-Control-Allow-Origin':origin(req),'Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin'}; }
function out(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(req) }); }
async function authUser(req: Request) {
  const raw = req.headers.get('authorization') || '';
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error('invalid_session');
  return data.user;
}
async function tokenInfo(accessToken: string) {
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { signal: AbortSignal.timeout(7000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.scope) throw new Error('invalid_google_token');
  return {
    subject: clean(data.sub || data.user_id, 200),
    email: clean(data.email, 320),
    scopes: String(data.scope || '').split(/\s+/).filter(Boolean).slice(0, 30),
    expiresIn: Math.max(60, Math.min(7200, Number(data.expires_in) || 3600)),
  };
}
async function connection(userId: string) {
  const { data, error } = await db.from('uon_google_connections')
    .select('user_id,google_email,status,granted_scopes,calendar_read_enabled,drive_file_enabled,token_expires_at,connected_at,last_used_at,revoked_at,last_error,updated_at')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
async function rawTokens(userId: string) {
  const { data, error } = await db.rpc('uon_google_get_tokens', { p_user_id: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.access_token) throw new Error('google_not_connected');
  return row;
}
async function refreshAccess(userId: string, row: any) {
  if (!row?.refresh_token) throw new Error('google_reconnect_required');
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) throw new Error('google_oauth_refresh_not_configured');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.access_token) throw new Error('google_reconnect_required');
  const expiresAt = new Date(Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000).toISOString();
  const { error } = await db.rpc('uon_google_update_access_token', { p_user_id: userId, p_access_token: data.access_token, p_expires_at: expiresAt });
  if (error) throw error;
  return { ...row, access_token: data.access_token, expires_at: expiresAt };
}
async function usableTokens(userId: string) {
  let row = await rawTokens(userId);
  const expires = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expires || expires < Date.now() + 90_000) row = await refreshAccess(userId, row);
  return row;
}
function hasCalendar(scopes: string[]) { return scopes.some(s => CALENDAR_SCOPES.has(s)); }
function hasDrive(scopes: string[]) { return scopes.includes(DRIVE_SCOPE); }
async function upcomingCalendar(userId: string) {
  const row = await usableTokens(userId), scopes = Array.isArray(row.scopes) ? row.scopes : [];
  if (!hasCalendar(scopes)) throw new Error('calendar_scope_missing');
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: '12',
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: 'Asia/Muscat',
    fields: 'items(id,summary,start,end,location,htmlLink,status),timeZone',
  });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${row.access_token}` }, signal: AbortSignal.timeout(8000) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('google_reconnect_required');
  if (!r.ok) throw new Error(`calendar_http_${r.status}`);
  await db.rpc('uon_google_mark_used', { p_user_id: userId });
  return (data.items || []).slice(0, 12).map((e: any) => ({
    id: clean(e.id, 260), summary: clean(e.summary || 'موعد', 300),
    start: clean(e.start?.dateTime || e.start?.date, 80), end: clean(e.end?.dateTime || e.end?.date, 80),
    location: clean(e.location, 400), url: clean(e.htmlLink, 900), status: clean(e.status, 40),
  }));
}
async function driveFiles(userId: string) {
  const row = await usableTokens(userId), scopes = Array.isArray(row.scopes) ? row.scopes : [];
  if (!hasDrive(scopes)) throw new Error('drive_scope_missing');
  const params = new URLSearchParams({
    q: 'trashed=false', spaces: 'drive', pageSize: '30', orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
  });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${row.access_token}` }, signal: AbortSignal.timeout(8000) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('google_reconnect_required');
  if (!r.ok) throw new Error(`drive_http_${r.status}`);
  await db.rpc('uon_google_mark_used', { p_user_id: userId });
  return (data.files || []).slice(0, 30).map((f: any) => ({
    id: clean(f.id, 260), name: clean(f.name, 300), mime_type: clean(f.mimeType, 160),
    modified_at: clean(f.modifiedTime, 80), url: clean(f.webViewLink, 900), size: Number(f.size) || null,
  }));
}
async function revokeAndDisconnect(userId: string) {
  let row: any = null; try { row = await rawTokens(userId); } catch {}
  const revokeToken = row?.refresh_token || row?.access_token || '';
  if (revokeToken) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(revokeToken)}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(7000) }); } catch {}
  }
  const { error } = await db.rpc('uon_google_disconnect', { p_user_id: userId });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'POST') return out(req, { error: 'method_not_allowed' }, 405);
  try {
    const user = await authUser(req);
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 60) || 'status';
    if (action === 'status') return out(req, { ok: true, connection: await connection(user.id) });
    if (action === 'connect') {
      const access = clean(body.provider_token, 4096), refresh = clean(body.provider_refresh_token, 4096);
      if (access.length < 10) return out(req, { error: 'provider_token_required' }, 400);
      const info = await tokenInfo(access);
      if (!hasCalendar(info.scopes) && !hasDrive(info.scopes)) return out(req, { error: 'required_google_scopes_missing' }, 400);
      const expiresAt = new Date(Date.now() + info.expiresIn * 1000).toISOString();
      const { error } = await db.rpc('uon_google_store_connection', {
        p_user_id: user.id, p_access_token: access, p_refresh_token: refresh,
        p_google_subject: info.subject, p_google_email: info.email,
        p_scopes: info.scopes, p_expires_at: expiresAt,
      });
      if (error) throw error;
      return out(req, { ok: true, connection: await connection(user.id) });
    }
    if (action === 'calendar-upcoming') return out(req, { ok: true, events: await upcomingCalendar(user.id) });
    if (action === 'drive-files') return out(req, { ok: true, files: await driveFiles(user.id), scope_note: 'drive.file only returns files the user has authorized for this app.' });
    if (action === 'disconnect') { await revokeAndDisconnect(user.id); return out(req, { ok: true, disconnected: true }); }
    return out(req, { error: 'unknown_action' }, 400);
  } catch (e) {
    const message = clean((e as Error)?.message || e, 300);
    const status = ['auth_required','invalid_session'].includes(message) ? 401 : 400;
    console.error('uon-google-account-v64', message);
    return out(req, { error: message }, status);
  }
});
