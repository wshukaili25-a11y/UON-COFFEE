import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COLLEGES = new Set([
  'كلية العلوم والآداب',
  'كلية الاقتصاد والإدارة ونظم المعلومات',
  'كلية الهندسة والعمارة',
  'كلية العلوم الصحية',
]);

function allowedOrigin(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (origin === 'https://uonhub.space' || origin === 'https://www.uonhub.space') return origin;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith('.vercel.app') && (host.startsWith('uon-') || host.startsWith('uon-hub-'))) {
      return origin;
    }
  } catch {
    // Non-browser clients are authenticated separately.
  }
  return 'https://uonhub.space';
}

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(req),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-admin-password',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    Vary: 'Origin',
  };
}

function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

async function requireAdmin(req: Request) {
  const password = req.headers.get('x-admin-password') || '';
  if (!password) throw new Error('ADMIN_AUTH_REQUIRED');
  const { data, error } = await db.rpc('uon_admin_authorized', { p_password: password });
  if (error || data !== true) throw new Error('ADMIN_AUTH_FAILED');
}

function base64Url(value: unknown) {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function accessToken() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing');
  const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Google service account configuration is incomplete');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: 'RS256', typ: 'JWT' });
  const claim = base64Url({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const pem = serviceAccount.private_key.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g,
    '',
  );
  const bytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${encodedSignature}`,
    }),
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error('GOOGLE_AUTH_FAILED');
  }
  return tokenPayload.access_token as string;
}

function serviceAccountEmail() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing');
  const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount.client_email) {
    throw new Error('Google service account configuration is incomplete');
  }
  return String(serviceAccount.client_email);
}

function parseDriveSource(value: unknown) {
  const source = String(value || '').trim();
  if (!source) throw new Error('drive source is required');

  if (/^[A-Za-z0-9_-]{10,200}$/.test(source)) {
    return { id: source, kind: 'folder' as const, resourceKey: '' };
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error('Google Drive link is invalid');
  }
  if (!['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('Google Drive link is invalid');
  }

  const folderMatch = url.pathname.match(/\/folders\/([A-Za-z0-9_-]{10,200})/);
  const resourceKey = String(url.searchParams.get('resourcekey') || '').slice(0, 500);
  if (folderMatch) return { id: folderMatch[1], kind: 'folder' as const, resourceKey };

  const fileMatch = url.pathname.match(/\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d)\/([A-Za-z0-9_-]{10,200})/);
  const queryId = url.searchParams.get('id');
  const id = fileMatch?.[1] || queryId || '';
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error('Google Drive link is invalid');
  return { id, kind: 'file' as const, resourceKey };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return response(req, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let runId = '';
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === 'connection-info') {
      return response(req, { ok: true, service_account_email: serviceAccountEmail() });
    }

    const source = parseDriveSource(body.source || body.drive_url || body.folder_id);
    const college = String(body.college || '').trim();
    if (!COLLEGES.has(college)) throw new Error('college is invalid');

    const { data: run, error: runError } = await db
      .from('drive_import_runs')
      .insert({ folder_id: source.id, college, status: 'running' })
      .select()
      .single();
    if (runError) throw runError;
    runId = run.id;

    const token = await accessToken();
    let pageToken = '';
    let imported = 0;
    let skipped = 0;
    let examined = 0;

    async function importFile(file: any) {
        examined++;
        if (examined > 10_000) throw new Error('Drive import safety limit exceeded');
        if (file.mimeType === 'application/vnd.google-apps.folder' || !file.webViewLink) {
          skipped++;
          return;
        }

        const { data: existing } = await db
          .from('drive_import_items')
          .select('id')
          .eq('drive_file_id', file.id)
          .maybeSingle();
        if (existing) {
          skipped++;
          return;
        }

        const { data: item, error: itemError } = await db
          .from('drive_import_items')
          .insert({
            run_id: run.id,
            drive_file_id: file.id,
            file_name: file.name,
            web_view_link: file.webViewLink,
            mime_type: file.mimeType,
            status: 'pending',
          })
          .select()
          .single();
        if (itemError) {
          skipped++;
          return;
        }

        const { data: summary, error: summaryError } = await db
          .from('summaries')
          .insert({
            title: file.name,
            subject: 'استيراد Google Drive',
            college,
            url: file.webViewLink,
            link: file.webViewLink,
            description: 'تم استيراده من Google Drive — بانتظار موافقة المشرف',
            approved: false,
          })
          .select('id')
          .single();
        if (summaryError) {
          skipped++;
          await db.from('drive_import_items').delete().eq('id', item.id);
          return;
        }

        await db.from('drive_import_items').update({ summary_id: summary.id }).eq('id', item.id);
        imported++;
    }

    if (source.kind === 'file') {
      const fields = encodeURIComponent('id,name,mimeType,webViewLink,trashed');
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (source.resourceKey) {
        headers['X-Goog-Drive-Resource-Keys'] = `${source.id}/${source.resourceKey}`;
      }
      const driveResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(source.id)}?fields=${fields}&supportsAllDrives=true`,
        { headers },
      );
      const file = await driveResponse.json();
      if (driveResponse.status === 403 || driveResponse.status === 404) {
        throw new Error('DRIVE_ACCESS_DENIED');
      }
      if (!driveResponse.ok) throw new Error('GOOGLE_DRIVE_REQUEST_FAILED');
      if (file.trashed) throw new Error('Google Drive file is in trash');
      await importFile(file);
    } else {
      do {
        const query = new URLSearchParams({
          q: `'${source.id}' in parents and trashed=false`,
          fields: 'nextPageToken,files(id,name,mimeType,webViewLink)',
          pageSize: '1000',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });
        if (pageToken) query.set('pageToken', pageToken);

        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (source.resourceKey) {
          headers['X-Goog-Drive-Resource-Keys'] = `${source.id}/${source.resourceKey}`;
        }
        const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
          headers,
        });
        const drivePayload = await driveResponse.json();
        if (driveResponse.status === 403 || driveResponse.status === 404) {
          throw new Error('DRIVE_ACCESS_DENIED');
        }
        if (!driveResponse.ok) throw new Error('GOOGLE_DRIVE_REQUEST_FAILED');

        pageToken = drivePayload.nextPageToken || '';
        for (const file of drivePayload.files || []) await importFile(file);
      } while (pageToken);
    }

    await db
      .from('drive_import_runs')
      .update({
        status: 'completed',
        imported_count: imported,
        skipped_count: skipped,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return response(req, {
      ok: true,
      run_id: run.id,
      source_type: source.kind,
      imported,
      skipped,
    });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    if (runId) {
      await db
        .from('drive_import_runs')
        .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
        .eq('id', runId);
    }
    const status = message.startsWith('ADMIN_AUTH_')
      ? 401
      : message === 'DRIVE_ACCESS_DENIED'
      ? 403
      : /invalid|required/i.test(message)
      ? 400
      : 500;
    return response(req, { ok: false, error: message }, status);
  }
});
