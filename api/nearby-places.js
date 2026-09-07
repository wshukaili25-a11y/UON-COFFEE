const UON = { lat: 22.9108, lon: 57.6722 };

function clean(value, max = 240) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value, 240)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryFor(question) {
  const q = normalize(question);
  if (/(مطعم|اكل|طعام|restaurant|food)/i.test(q)) return 'food';
  if (/(مقهى|كافيه|قهوه|cafe|coffee)/i.test(q)) return 'cafe';
  if (/(صيدل|pharmacy)/i.test(q)) return 'pharmacy';
  if (/(بنك|صراف|atm|bank)/i.test(q)) return 'bank';
  if (/(سوبرماركت|بقاله|supermarket|grocery)/i.test(q)) return 'supermarket';
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

function mapUrl(lat, lon) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}

function buildOverpass(category, radius = 12000) {
  const clauses = [];
  for (const filter of filtersFor(category)) {
    clauses.push(`nwr(around:${radius},${UON.lat},${UON.lon})${filter};`);
  }
  return `[out:json][timeout:12];(${clauses.join('')});out center tags;`;
}

const CAMPUS_GENERIC = /(male|female|staff|stuff|student|students|boys|girls|faculty|campus|university|uon|college|hostel|dorm|cafeteria|canteen|restaurant\s*\d*|مطعم\s*(الطلاب|الطالبات|الموظفين|الموظفات|الجامعه|الجامعة)?$|كافتيريا|كافتريا|مقصف|سكن|طلاب|طالبات|موظفين|موظفات)/i;
const FOOD_BAD = /(medical|clinic|hospital|health|center|centre|school|office|mosque|مسجد|مركز صحي|عياد|مستشفى|مكتب)/i;
const CAFE_BAD = /(medical|clinic|hospital|health|school|office|mosque|مسجد|مركز صحي|عياد|مستشفى|مكتب)/i;

function isGenericName(name, category) {
  const n = normalize(name);
  if (!n || n.length < 3) return true;
  if (/^(restaurant|مطعم|cafe|coffee|مقهى|كافيه|pharmacy|صيدليه|bank|بنك|atm|supermarket|سوبرماركت)$/i.test(n)) return true;
  if ((category === 'food' || category === 'cafe') && CAMPUS_GENERIC.test(n)) return true;
  if (category === 'food' && FOOD_BAD.test(n)) return true;
  if (category === 'cafe' && CAFE_BAD.test(n)) return true;
  return false;
}

function categoryMatches(tags, category) {
  const amenity = normalize(tags.amenity || '');
  const shop = normalize(tags.shop || '');
  switch (category) {
    case 'food': return ['restaurant', 'fast food', 'food court'].includes(amenity);
    case 'cafe': return amenity === 'cafe';
    case 'pharmacy': return amenity === 'pharmacy';
    case 'bank': return amenity === 'bank' || amenity === 'atm';
    case 'supermarket': return shop === 'supermarket' || shop === 'convenience';
    case 'health': return ['hospital', 'clinic', 'doctors'].includes(amenity);
    case 'mosque': return amenity === 'place of worship' && normalize(tags.religion || '') === 'muslim';
    default: return true;
  }
}

function commercialSignals(tags) {
  let score = 0;
  if (clean(tags.brand)) score += 22;
  if (clean(tags.website || tags['contact:website'])) score += 16;
  if (clean(tags.phone || tags['contact:phone'])) score += 12;
  if (clean(tags.opening_hours)) score += 8;
  if (clean(tags.cuisine)) score += 8;
  if (clean(tags['addr:street'] || tags['addr:place'] || tags['addr:city'])) score += 7;
  if (clean(tags.takeaway || tags.delivery)) score += 4;
  return score;
}

function qualityScore({ name, tags, distance, category }) {
  let score = 100;
  const n = normalize(name);
  if (categoryMatches(tags, category)) score += 35;
  score += commercialSignals(tags);

  // Prefer a specific business-like name over a generic facility label.
  if (n.split(' ').length >= 2) score += 8;
  if (/مطعم|restaurant|cafe|coffee|كافيه|مقهى|burger|pizza|grill|kitchen|مطابخ|مشاوي|برجر|بيتزا/i.test(n)) score += 5;

  // Close is useful, but it should never beat quality by itself.
  score += Math.max(0, 30 - distance / 220);

  // The University centroid sits inside the campus. Food POIs extremely close to
  // it are usually internal cafeterias, not businesses a student means by "nearby restaurants".
  if ((category === 'food' || category === 'cafe') && distance < 350) score -= 90;
  if ((category === 'food' || category === 'cafe') && distance >= 350 && distance < 1500) score += 12;
  if (distance > 9000) score -= 18;

  return score;
}

function acceptable({ name, tags, distance, category }) {
  if (isGenericName(name, category)) return false;
  if (!categoryMatches(tags, category) && category !== 'general') return false;

  // Hard reject campus-style food labels near the campus centroid.
  if ((category === 'food' || category === 'cafe') && distance < 300) return false;

  // A named commercial place a little farther away is better than an unnamed/internal POI.
  if ((category === 'food' || category === 'cafe') && distance < 650 && commercialSignals(tags) === 0) return false;
  return true;
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
        'User-Agent': 'UONHub/1.1 (+https://uonhub.space)'
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`overpass_${response.status}`);
    const data = await response.json();
    const candidates = [];

    for (const item of Array.isArray(data?.elements) ? data.elements : []) {
      const tags = item.tags || {};
      const lat = Number(item.lat ?? item.center?.lat);
      const lon = Number(item.lon ?? item.center?.lon);
      const name = clean(tags['name:ar'] || tags.name || tags['name:en'] || tags.brand || '', 180);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const distance = Math.round(haversine(UON.lat, UON.lon, lat, lon));
      const candidate = { name, tags, distance, category };
      if (!acceptable(candidate)) continue;

      const addressParts = [tags['addr:street'], tags['addr:place'], tags['addr:city']]
        .map(x => clean(x, 120)).filter(Boolean);

      candidates.push({
        place_id: `osm:${item.type}:${item.id}`,
        name,
        normalized_name: normalize(name),
        address: addressParts.join('، '),
        lat,
        lng: lon,
        distance_m: distance,
        maps_url: mapUrl(lat, lon),
        directions_url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${UON.lat},${UON.lon}`)}&destination=${encodeURIComponent(`${lat},${lon}`)}`,
        open_now: null,
        source_provider: 'openstreetmap',
        primary_type: clean(tags.amenity || tags.shop || '', 80),
        cuisine: clean(tags.cuisine || '', 100),
        _score: qualityScore(candidate)
      });
    }

    // Deduplicate nearby records with the same/near-identical business name.
    candidates.sort((a, b) => b._score - a._score || a.distance_m - b.distance_m);
    const places = [];
    for (const place of candidates) {
      const duplicate = places.some(existing => {
        if (existing.normalized_name !== place.normalized_name) return false;
        return haversine(existing.lat, existing.lng, place.lat, place.lng) < 250;
      });
      if (duplicate) continue;
      const { normalized_name, _score, ...publicPlace } = place;
      places.push(publicPlace);
      if (places.length >= 5) break;
    }

    return res.status(200).json({
      ok: true,
      available: places.length > 0,
      provider: 'openstreetmap',
      attribution: '© OpenStreetMap contributors',
      category,
      smart_filter: true,
      places
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
