/**
 * Zoho OAuth helper (server-side only).
 *
 * Exchanges a long-lived refresh token for a short-lived access token.
 * ALL of these live in Vercel env vars and never reach the browser:
 *   ZOHO_CLIENT_ID
 *   ZOHO_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN
 *   ZOHO_ACCOUNTS_DOMAIN   (optional, default https://accounts.zoho.com)
 *   ZOHO_API_DOMAIN        (optional, default https://www.zohoapis.com)
 *
 * Access tokens last ~1 hour; we cache in module memory so we don't
 * refresh on every call within a warm serverless instance.
 */

let _cachedToken = null;
let _cachedExpiry = 0;

export async function getZohoAccessToken() {
  const now = Date.now();
  // Reuse cached token if it has >2 min of life left
  if (_cachedToken && now < _cachedExpiry - 120000) {
    return _cachedToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com';

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho credentials are not configured in environment variables.');
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });

  const resp = await fetch(`${accountsDomain}/oauth/v2/token?${params.toString()}`, {
    method: 'POST'
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`Zoho token refresh failed: ${data.error || resp.status}`);
  }

  _cachedToken = data.access_token;
  // expires_in is seconds; default to 3600 if absent
  _cachedExpiry = now + (data.expires_in ? data.expires_in * 1000 : 3600000);
  return _cachedToken;
}

export function zohoApiDomain() {
  return process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';
}

/**
 * Thin wrapper for authenticated Zoho REST calls.
 * path example: '/crm/v2/Contacts?fields=Email,Full_Name&per_page=200'
 */
export async function zohoFetch(path, options = {}) {
  const token = await getZohoAccessToken();
  const resp = await fetch(`${zohoApiDomain()}${path}`, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  // 204 = no content (e.g. empty result set)
  if (resp.status === 204) return { data: [] };

  const text = await resp.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Zoho returned non-JSON (status ${resp.status})`);
  }
  if (!resp.ok) {
    throw new Error(`Zoho API error ${resp.status}: ${json.message || text}`);
  }
  return json;
}
