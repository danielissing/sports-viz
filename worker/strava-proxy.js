const ALLOWED_ORIGINS = [
  'https://danielissing.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any *.streamlit.app subdomain
  try {
    const url = new URL(origin);
    return url.hostname.endsWith('.streamlit.app');
  } catch {
    return false;
  }
}

function isAllowedRedirect(url) {
  try {
    const parsed = new URL(url);
    if (ALLOWED_ORIGINS.includes(parsed.origin)) return true;
    return parsed.hostname.endsWith('.streamlit.app');
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- Preflight ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // --- GET /callback ---
    if (url.pathname === '/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state') || '';
      if (!isAllowedRedirect(state)) {
        return new Response('Invalid redirect target', { status: 400 });
      }
      const target = new URL(state);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (code) target.searchParams.set('code', code);
      if (error) target.searchParams.set('error', error);
      return Response.redirect(target.toString(), 302);
    }

    // --- POST /exchange ---
    if (url.pathname === '/exchange' && request.method === 'POST') {
      const cors = corsHeaders(request);
      try {
        const body = await request.json();
        const resp = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            code: body.code,
            grant_type: 'authorization_code',
          }),
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
    }

    // --- POST /refresh ---
    if (url.pathname === '/refresh' && request.method === 'POST') {
      const cors = corsHeaders(request);
      try {
        const body = await request.json();
        const resp = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: body.refresh_token,
          }),
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
