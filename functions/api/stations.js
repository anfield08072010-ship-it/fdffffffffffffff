const SOURCE_URL = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=74';
const CACHE_KEY = new Request('https://samut-sakhon-water-cache.invalid/stations');
const CACHE_TTL = 120;

export async function onRequestGet({ waitUntil }) {
  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached;

  let upstream;
  try {
    upstream = await fetch(SOURCE_URL, {
      headers: { Accept: 'application/json' }
    });
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  if (!upstream.ok) {
    return Response.json({ error: upstream.status === 429 ? 'upstream_rate_limited' : 'upstream_error' }, {
      status: upstream.status === 429 ? 429 : 502,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return Response.json({ error: 'invalid_upstream_payload' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const rows = payload?.waterlevel_data?.data;
  if (payload?.waterlevel_data?.result !== 'OK' || !Array.isArray(rows)) {
    return Response.json({ error: 'invalid_upstream_payload' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const stations = rows
    .filter(row => String(row.geocode?.province_code) === '74' && row.station_type === 'tele_waterlevel')
    .map(row => ({
      waterlevel_datetime: row.waterlevel_datetime,
      waterlevel_msl: row.waterlevel_msl,
      waterlevel_msl_previous: row.waterlevel_msl_previous,
      diff_wl_bank: row.diff_wl_bank,
      storage_percent: row.storage_percent,
      station_type: row.station_type,
      station: {
        id: row.station?.id,
        tele_station_oldcode: row.station?.tele_station_oldcode,
        tele_station_name: row.station?.tele_station_name,
        tele_station_lat: row.station?.tele_station_lat,
        tele_station_long: row.station?.tele_station_long
      },
      geocode: {
        province_code: row.geocode?.province_code,
        amphoe_name: row.geocode?.amphoe_name
      },
      agency: { agency_shortname: row.agency?.agency_shortname },
      basin: { basin_name: row.basin?.basin_name }
    }));

  const response = Response.json({ waterlevel_data: { result: 'OK', data: stations } }, {
    headers: { 'Cache-Control': `public, max-age=${CACHE_TTL}` }
  });
  waitUntil(cache.put(CACHE_KEY, response.clone()));
  return response;
}
