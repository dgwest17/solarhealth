/**
 * GET/POST /api/gb-profile — persistence for Green Button profiles and
 * client settings (e.g. EV-TOU rate plan) in Supabase.
 *
 * Table (create once in Supabase SQL editor — see SUPABASE-SETUP.md):
 *   client_data(contact_id text primary key, gb_profile jsonb,
 *               settings jsonb, updated_at timestamptz default now())
 *
 * Uses the SERVICE ROLE key (server-only env var SUPABASE_SERVICE_KEY) so
 * RLS can stay locked; per-role access is enforced HERE:
 *   - admin: any contact
 *   - client: only the contact whose Zoho Email matches their login email
 *   - rep: their test client, or contacts they created (Created_By_Rep)
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
  if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function assertAccess(user, contactId) {
  if (user.role === 'admin') return;
  const r = await zohoFetch(`/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Email,Created_By_Rep`);
  const c = r.data && r.data[0];
  if (!c) throw Object.assign(new Error('Contact not found'), { status: 404 });
  const email = (c.Email || '').toLowerCase();
  const me = (user.email || '').toLowerCase();
  if (user.role === 'client' && email === me) return;
  if (user.role === 'rep') {
    const testEmail = (process.env.REP_TEST_CLIENT_EMAIL || '').toLowerCase();
    const createdBy = (c.Created_By_Rep || '').toLowerCase();
    if (email === testEmail || createdBy === me) return;
  }
  throw Object.assign(new Error('Not authorized for this contact'), { status: 403 });
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured — see SUPABASE-SETUP.md' });
    }
    const user = await requireUser(req);

    if (req.method === 'GET') {
      const contactId = req.query.contactId;
      if (!contactId) return res.status(400).json({ error: 'contactId required' });
      await assertAccess(user, contactId);
      const rows = await sbFetch(`/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=gb_profile,settings,updated_at`);
      const row = rows && rows[0];
      return res.status(200).json({
        ok: true,
        gbProfile: row ? row.gb_profile : null,
        settings: row ? row.settings : null,
        updatedAt: row ? row.updated_at : null
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { contactId, gbProfile, settings } = body;
      if (!contactId) return res.status(400).json({ error: 'contactId required' });
      if (gbProfile === undefined && settings === undefined) {
        return res.status(400).json({ error: 'Provide gbProfile and/or settings' });
      }
      await assertAccess(user, contactId);

      // Merge with any existing row so partial updates don't clobber.
      const rows = await sbFetch(`/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=gb_profile,settings`);
      const existing = (rows && rows[0]) || {};
      const record = {
        contact_id: String(contactId),
        gb_profile: gbProfile !== undefined ? gbProfile : existing.gb_profile ?? null,
        settings: settings !== undefined ? { ...(existing.settings || {}), ...settings } : existing.settings ?? null,
        updated_at: new Date().toISOString()
      };
      await sbFetch('/client_data', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([record])
      });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { sendError(res, e); }
}
