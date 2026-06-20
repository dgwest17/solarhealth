/**
 * GET /api/health  (admin only)
 * Safe diagnostics: tells you which env vars are CONFIGURED (present/absent)
 * and whether a Zoho token refresh + a 1-row Contacts read succeed.
 *
 * NEVER returns secret values — only booleans and error messages. This is the
 * fast way to find a 500 cause (missing var, wrong data center, bad token).
 */
import { getZohoAccessToken, zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

export default async function handler(req, res) {
  try {
    // Must be logged in; only admin can run diagnostics
    const user = await requireUser(req);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const env = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      ADMIN_EMAILS: !!process.env.ADMIN_EMAILS,
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_ACCOUNTS_DOMAIN: process.env.ZOHO_ACCOUNTS_DOMAIN || '(default .com)',
      ZOHO_API_DOMAIN: process.env.ZOHO_API_DOMAIN || '(default .com)'
    };

    const checks = {};

    // Test 1: can we get a Zoho access token?
    try {
      const token = await getZohoAccessToken();
      checks.zohoTokenRefresh = token ? 'ok' : 'failed (no token returned)';
    } catch (e) {
      checks.zohoTokenRefresh = `failed: ${e.message}`;
    }

    // Test 2: can we read 1 contact via COQL?
    if (checks.zohoTokenRefresh === 'ok') {
      try {
        const r = await zohoFetch('/crm/v2/coql', {
          method: 'POST',
          body: JSON.stringify({ select_query: 'select id, Last_Name from Contacts where Email is not null limit 1' })
        });
        checks.zohoContactsRead = (r.data && r.data.length >= 0) ? `ok (${r.data.length} row sample)` : 'ok (empty)';
      } catch (e) {
        checks.zohoContactsRead = `failed: ${e.message}`;
      }
    } else {
      checks.zohoContactsRead = 'skipped (token failed)';
    }

    res.status(200).json({ role: user.role, env, checks });
  } catch (e) {
    sendError(res, e);
  }
}
