import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

declare const Deno: any;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
const CONNECTOR_SECRET = Deno.env.get('UON_AI_CONNECTOR_SECRET') || '';
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const UON_CENTER = { latitude: 22.9108, longitude: 57.6722 };
function clean(v: unknown, n = 500) { return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n); }
function out(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function authorized(req: Request) { return Boolean(CONNECTOR_SECRET) && req.headers.get('x-connector-secret') === CONNECTOR_SECRET; }
function mapsSearchUrl(query: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`; }
async function rememberPlaceId(placeId: string, query: string, relevance = 0.7) {
  if (!placeId) return;
  const tag = clean(query, 120).toLowerCase();
  const { data } = await db.from('uon_ai_google_place_refs').select('query_tags').eq('place_id', placeId).maybeSingle();
  const tags = [...new Set([...(data?.query_tags || []), tag].filter(Boolean))].slice(-20);
  await db.from('uon_ai_google_place_refs').upsert({ place_id: placeId, last_seen_at: new Date().toISOString(), query_tags: tags, campus_relevance: relevance, metadata: { source: 'google_places_live' } }, { onConflict: 'place_id' });
}
async function textSearch(query: string, maxResults = 5) {
  if (!GOOGLE_MAPS_API_KEY) return { available: false, reason: 'GOOGLE_MAPS_API_KEY_MISSING', places: [] };
  const q = clean(query, 240); if (q.length < 2) return { available: true, places: [] };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryType,places.currentOpeningHours.openNow',
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: 'ar',
      regionCode: 'OM',
      maxResultCount: Math.max(1, Math.min(Number(maxResults) || 5, 8)),
      locationBias: { circle: { center: UON_CENTER, radius: 25000 } },
    }),
    signal: AbortSignal.timeout(7000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { available: false, reason: `GOOGLE_PLACES_HTTP_${res.status}`, places: [] };
  const places = (data.places || []).slice(0, 8).map((p: any) => ({
    place_id: clean(p.id, 220),
    name: clean(p.displayName?.text, 220),
    address: clean(p.formattedAddress, 360),
    lat: Number(p.location?.latitude) || null,
    lng: Number(p.location?.longitude) || null,
    maps_url: clean(p.googleMapsUri, 900) || mapsSearchUrl(`${clean(p.displayName?.text, 180)} ${clean(p.formattedAddress, 220)}`),
    primary_type: clean(p.primaryType, 100),
    open_now: typeof p.currentOpeningHours?.openNow === 'boolean' ? p.currentOpeningHours.openNow : null,
  })).filter((p: any) => p.place_id && p.name);
  await Promise.allSettled(places.map((p: any, index: number) => rememberPlaceId(p.place_id, q, Math.max(0.4, 0.95 - index * 0.08))));
  return { available: true, places };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return out({ error: 'method_not_allowed' }, 405);
  if (!authorized(req)) return out({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const query = clean(body.query || body.question, 240);
  try {
    const result = await textSearch(query, Number(body.limit) || 5);
    return out({ ok: true, provider: 'google_maps', attribution: 'Google Maps', storage_policy: 'place_id_only', ...result });
  } catch (e) {
    return out({ ok: false, provider: 'google_maps', available: false, reason: clean((e as Error)?.message || e, 300), places: [] }, 200);
  }
});
