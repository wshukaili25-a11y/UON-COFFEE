const ALLOWED_ORIGINS = new Set([
  'https://uonhub.space',
  'https://www.uonhub.space'
]);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://uonhub.space';
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'content-type,x-admin-password',
    'access-control-allow-methods': 'POST,OPTIONS',
    'vary': 'Origin'
  };
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  return new Response(JSON.stringify({
    ok: false,
    error: 'release_recovery_retired',
    message: 'UON Hub V67 release recovery has been completed and this endpoint is permanently disabled.'
  }), {
    status: 410,
    headers: cors(req)
  });
});
