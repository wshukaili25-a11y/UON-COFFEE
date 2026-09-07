const UON = { lat: 22.9108, lon: 57.6722 };

function clean(value, max = 240) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function categoryFor(question) {
  const q = clean(question).toLowerCase();
  if (/(مطعم|اكل|أكل|طعام|restaurant|food)/i.test(q)) return 'food';
  if (/(مقهى|كافيه|قهوه|قهوة|cafe|coffee)/i.test(q)) return 'cafe';
  if (/(صيدل|pharmacy)/i.test(q)) return 'pharmacy';
  if (/(بنك|صراف|atm|bank)/i.test(q)) return 'bank';
  if (/(سوبرماركت|بقاله|بقالة|supermarket|grocery)/i.test(q)) return 'supermarket';
  if (/(مستشفى|عياد|hospital|clinic)/i.test(q)) return 'health';
  if (/(مسجد|mosque)/i.test(q)) return 'mosque';
  return 'general';
}

function filtersFor(category) {
  switch (category) {
    case 'food': return ['["amenity"~"restaurant|fast_food|food_court"]'];
    case 'cafe': return ['["amenity"="cafe"]'];
    case 'pharmacy': return ['["amenity"="pharmacy"]'];
    case 'bank': return ['["amenity"~"bank|atm"]'];
    case 'supermarket': return ['["shop"~"supermarket|convenience"]'];
    case 'health': return ['["amenity"~"hospital|clinic|doctors"]'];
    case 'mosque': return ['["amenity"="place_of_worship"]["religion"="muslim"]'];
    default: return [
      '["amenity"~"restaurant|fast_food|cafe|pharmacy|bank|atm|hospital|clinic"]',
      '["shop"~"supermarket|convenience"]'
    ];
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = d => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapUrl(lat, lon, name) {
  const query = name ? `${name} ${lat},${lon}` : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildOverpass(category, radius = 7000) {
  const filters = filtersFor(category);
  const clauses = [];
  for (const filter of filters) {
    clauses.push(`nwr(around:${radius},${UON.lat},${UON.lon})${filter};`);
  }
  return `[out:json][timeout:12];(${clauses.join('')});out center tags;`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const question = clean(req.query?.q || req.query?.query || '');
  const category = categoryFor(question);
  const query = buildOverpass(category);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9500);
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'UONHub/1.0 (+https://uonhub.space)'
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`overpass_${response.status}`);
    const data = await response.json();
    const seen = new Set();
    const places = [];

    for (const item of Array.isArray(data?.elements) ? data.elements : []) {
      const tags = item.tags || {};
      const lat = Number(item.lat ?? item.center?.lat);
      const lon = Number(item.lon ?? item.center?.lon);
      const name = clean(tags['name:ar'] || tags.name || tags['name:en'] || '', 180);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const distance = Math.round(haversine(UON.lat, UON.lon, lat, lon));
      const addressParts = [tags['addr:street'], tags['addr:place'], tags['addr:city']].map(x => clean(x, 120)).filter(Boolean);
      places.push({
        place_id: `osm:${item.type}:${item.id}`,
        name,
        address: addressParts.join('، '),
        lat,
        lng: lon,
        distance_m: distance,
        maps_url: mapUrl(lat, lon, name),
        directions_url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('University of Nizwa, Oman')}&destination=${encodeURIComponent(`${lat},${lon}`)}`,
        open_now: null,
        source_provider: 'openstreetmap'
      });
    }

    places.sort((a, b) => a.distance_m - b.distance_m);
    return res.status(200).json({
      ok: true,
      available: places.length > 0,
      provider: 'openstreetmap',
      attribution: '© OpenStreetMap contributors',
      category,
      places: places.slice(0, 5)
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      available: false,
      provider: 'openstreetmap',
      reason: clean(error?.message || error, 160),
      places: []
    });
  }
}
