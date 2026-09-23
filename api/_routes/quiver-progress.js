/**
 * FILE: api/quiver-progress.js
 *
 * GET  /api/quiver-progress?rep=email — which trainings this rep has ticked.
 * POST /api/quiver-progress            — save their progress.
 *
 * Progress is per rep and keyed on their email in the same client_data table
 * everything else uses, with `rep:` prefixing the key so a rep row can never
 * collide with a Zoho contact id.
 *
 * A rep can only read and write their OWN progress. An admin can read anyone's
 * — seeing who has done the training is the point of having it — but cannot
 * write on their behalf, because ticking someone else's box is a lie about
 * what they know.
 */
import { requireUser, sendError } from '../_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const keyFor = (email) => `rep:${String(email || '').toLowerCase()}`;

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

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (user.role === 'client') {
      return res.status(403).json({ error: 'Not available.' });
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(200).json({ ok: true, progress: {}, configured: false });
    }

    const me = (user.email || '').toLowerCase();

    if (req.method === 'GET') {
      const asked = (req.query.rep || me).toLowerCase();
      if (asked !== me && user.role !== 'admin') {
        return res.status(403).json({ error: 'You can only see your own progress.' });
      }
      try {
        const rows = await sbFetch(
          `/client_data?contact_id=eq.${encodeURIComponent(keyFor(asked))}&select=settings`
        );
        const row = rows && rows[0];
        return res.status(200).json({
          ok: true,
          progress: (row && row.settings && row.settings.quiverProgress) || {}
        });
      } catch {
        return res.status(200).json({ ok: true, progress: {} });
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const target = (body.rep || me).toLowerCase();
      // Deliberately stricter than the read: nobody ticks anyone else's boxes.
      if (target !== me) {
        return res.status(403).json({ error: 'You can only save your own progress.' });
      }
      const progress = body.progress && typeof body.progress === 'object' ? body.progress : {};

      await sbFetch('/client_data', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([{
          contact_id: keyFor(me),
          settings: { quiverProgress: progress },
          updated_at: new Date().toISOString()
        }])
      });
      return res.status(200).json({ ok: true, progress });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return sendError(res, e);
  }
}
