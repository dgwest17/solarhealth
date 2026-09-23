/**
 * FILE: api/settings.js
 *
 * GET  /api/settings — org-wide editable defaults. Any authenticated user.
 * PUT  /api/settings — replace them. ADMIN ONLY.
 *
 * One row, one org. The table is a singleton keyed on a fixed id:
 *
 *   create table app_settings (
 *     id          text primary key default 'default',
 *     settings    jsonb not null default '{}'::jsonb,
 *     updated_at  timestamptz default now(),
 *     updated_by  text
 *   );
 *   insert into app_settings (id) values ('default') on conflict do nothing;
 *
 * Uses the SERVICE ROLE key so RLS stays locked; the admin check happens here,
 * on the server, against the role resolved from a verified Supabase token. The
 * browser cannot promote itself.
 *
 * MISSING TABLE IS NOT AN ERROR on read. Until the SQL above is run, GET
 * returns an empty patch and the app runs on its shipped defaults. Only a
 * write surfaces the problem, because only a write is actually blocked by it.
 */
import { requireUser, sendError } from '../_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ROW_ID = 'default';

/** Largest payload we will store. A settings blob has no business being big. */
const MAX_BYTES = 256 * 1024;

async function sbFetch(path, options = {}) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`Supabase ${resp.status}: ${text.slice(0, 300)}`);
    err.status = resp.status;
    err.supabase = true;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/** 404/42P01 from PostgREST means the table has not been created yet. */
const isMissingTable = (e) =>
  !!e && e.supabase && (e.status === 404 || /42P01|does not exist|Could not find the table/i.test(e.message));

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      // Same reasoning as a missing table: reads degrade, writes fail loudly.
      if (req.method === 'GET') return res.status(200).json({ ok: true, settings: {}, configured: false });
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured — see SUPABASE-SETUP.md' });
    }

    const user = await requireUser(req);

    // ---------------------------------------------------------------- READ
    if (req.method === 'GET') {
      try {
        const rows = await sbFetch(
          `/app_settings?id=eq.${ROW_ID}&select=settings,updated_at,updated_by`
        );
        const row = rows && rows[0];
        return res.status(200).json({
          ok: true,
          configured: true,
          settings: (row && row.settings) || {},
          updatedAt: row ? row.updated_at : null,
          updatedBy: row ? row.updated_by : null,
          canEdit: user.role === 'admin'
        });
      } catch (e) {
        if (isMissingTable(e)) {
          return res.status(200).json({
            ok: true, configured: false, settings: {}, canEdit: user.role === 'admin',
            note: 'app_settings table not created yet — running on shipped defaults.'
          });
        }
        throw e;
      }
    }

    // --------------------------------------------------------------- WRITE
    if (req.method === 'PUT' || req.method === 'POST') {
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Changing platform defaults requires an admin login.' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const settings = body.settings;
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return res.status(400).json({ error: 'settings must be an object' });
      }
      const serialized = JSON.stringify(settings);
      if (serialized.length > MAX_BYTES) {
        return res.status(413).json({ error: 'Settings payload too large' });
      }

      try {
        await sbFetch('/app_settings', {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify([{
            id: ROW_ID,
            settings,
            updated_at: new Date().toISOString(),
            updated_by: user.email || null
          }])
        });
      } catch (e) {
        if (isMissingTable(e)) {
          return res.status(503).json({
            error: 'The app_settings table has not been created yet. Run the SQL in api/settings.js (or SUPABASE-SETUP.md) in the Supabase SQL editor, then save again.'
          });
        }
        throw e;
      }

      return res.status(200).json({
        ok: true, settings, updatedBy: user.email || null, updatedAt: new Date().toISOString()
      });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return sendError(res, e);
  }
}
