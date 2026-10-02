const sourceUrl = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=74';

module.exports = async function stations(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  response.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');

  try {
    const upstream = await fetch(sourceUrl, {
      headers: { Accept: 'application/json' }
    });

    if (!upstream.ok) {
      response.setHeader('Cache-Control', 'no-store');
      if (upstream.status === 429) {
        const retryAfter = upstream.headers.get('retry-after');
        if (retryAfter) response.setHeader('Retry-After', retryAfter);
        return response.status(429).json({ error: 'upstream_rate_limited' });
      }
      return response.status(502).json({ error: 'upstream_error' });
    }

    const payload = await upstream.json();
    if (payload?.waterlevel_data?.result !== 'OK' || !Array.isArray(payload.waterlevel_data.data)) {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(502).json({ error: 'invalid_upstream_payload' });
    }

    return response.status(200).json(payload);
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(502).json({ error: 'upstream_unavailable' });
  }
};
