import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = new Set([
  'https://uonhub.space',
  'https://www.uonhub.space',
]);

const ADMIN_TABLES = new Set([
  'academic_calendar_events',
  'admin_audit_log',
  'backup_runs',
  'broken_link_reports',
  'confessions',
  'course_requests',
  'courses',
  'drive_import_items',
  'drive_import_runs',
  'dropbox_import_items',
  'dropbox_import_runs',
  'feature_suggestions',
  'platform_features',
  'rating_submissions',
  'restore_runs',
  'search_index',
  'site_announcements',
  'site_notifications',
  'site_settings',
  'student_projects',
  'summaries',
  'system_errors',
  'telegram_admins',
  'tools_items',
  'university_programs',
  'usage_events',
  'whatsapp_groups',
]);

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
const SELECT_EXPRESSION = /^[a-z0-9_*.,:()!]+$/i;

function requestOrigin(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  try {
    const host = new URL(origin).hostname;
    if (
      host.endsWith('.vercel.app') &&
      (host.startsWith('uon-') || host.startsWith('uon-hub-'))
    ) return origin;
  } catch {
    // Requests without a browser Origin header are allowed by authentication.
  }
  return 'https://uonhub.space';
}

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': requestOrigin(req),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-admin-password',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

async function authorized(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (bearer && bearer === SERVICE_ROLE_KEY) return true;

  const password = req.headers.get('x-admin-password') || '';
  if (!password) return false;

  const { data, error } = await db.rpc('uon_admin_authorized', {
    p_password: password,
  });
  return !error && data === true;
}

function scalar(value: string): string | number | boolean | null {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function assertIdentifier(value: string, label = 'identifier') {
  if (!IDENTIFIER.test(value)) throw new Error(`Invalid ${label}`);
}

async function adminRead(body: Record<string, unknown>) {
  const table = String(body.table || '');
  if (!ADMIN_TABLES.has(table)) throw new Error('Table is not available to the admin API');

  const params = new URLSearchParams(String(body.query || '').replace(/^\?/, ''));
  const select = params.get('select') || '*';
  if (!SELECT_EXPRESSION.test(select)) throw new Error('Invalid select expression');

  let query: any = db.from(table).select(select);

  for (const [column, expression] of params.entries()) {
    if (column === 'select' || column === 'order' || column === 'limit') continue;
    assertIdentifier(column, 'filter column');

    const separator = expression.indexOf('.');
    if (separator <= 0) throw new Error(`Invalid filter for ${column}`);
    const operator = expression.slice(0, separator);
    const rawValue = expression.slice(separator + 1);

    if (operator === 'in') {
      if (!rawValue.startsWith('(') || !rawValue.endsWith(')')) {
        throw new Error(`Invalid in filter for ${column}`);
      }
      const values = rawValue
        .slice(1, -1)
        .split(',')
        .filter(Boolean)
        .map(scalar);
      query = query.in(column, values);
      continue;
    }

    if (operator === 'is') {
      if (!['null', 'true', 'false'].includes(rawValue)) {
        throw new Error(`Invalid is filter for ${column}`);
      }
      query = query.is(column, scalar(rawValue));
      continue;
    }

    const allowedOperators = new Set([
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
    ]);
    if (!allowedOperators.has(operator)) throw new Error(`Unsupported filter: ${operator}`);
    query = query.filter(column, operator, scalar(rawValue));
  }

  const order = params.get('order');
  if (order) {
    for (const item of order.split(',')) {
      const [column, direction = 'asc'] = item.split('.');
      assertIdentifier(column, 'order column');
      if (!['asc', 'desc'].includes(direction)) throw new Error('Invalid order direction');
      query = query.order(column, { ascending: direction === 'asc' });
    }
  }

  const requestedLimit = Number(params.get('limit') || 1000);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new Error('Invalid limit');
  }
  query = query.limit(Math.min(requestedLimit, 5000));

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === 'health') {
      const { data: state, error } = await db.rpc('uon_public_state');
      if (error) throw error;
      return reply(req, {
        ok: true,
        checks: {
          database: 'ok',
          maintenance: state?.maintenance_enabled ? 'maintenance' : 'active',
          features: Object.keys(state?.features || {}).length,
        },
      });
    }

    if (!(await authorized(req))) {
      return reply(req, { ok: false, error: 'unauthorized' }, 401);
    }

    if (body.action === 'read') {
      return reply(req, { ok: true, data: await adminRead(body) });
    }

    if (body.action === 'reindex') {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/search-reindex`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
        },
        body: '{}',
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { ...corsHeaders(req), 'content-type': 'application/json' },
      });
    }

    return reply(req, { ok: false, error: 'unknown_action' }, 400);
  } catch (error) {
    const message = String((error as Error)?.message || error);
    const clientError = /Invalid|Unsupported|not available|required/i.test(message);
    return reply(req, { ok: false, error: message }, clientError ? 400 : 500);
  }
});
