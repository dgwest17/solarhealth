/**
 * FILE: api/project-steps.js
 *
 * POST /api/project-steps — record a completed step, and move the stage when
 * the last one lands.
 *
 * The stage move is computed HERE, on the server, from the saved proposal —
 * never taken from the request body. A customer ticking boxes on their own
 * phone is the normal path for this endpoint, and a client who can set their
 * own deal to "Converted to Project" by editing a payload is a CRM full of
 * fiction.
 *
 * Access is deliberately wider than the other write endpoints: the whole point
 * is that a homeowner completes these steps unattended. So a client may update
 * steps on their OWN contact, alongside the usual rep and admin access. What a
 * client cannot do is anything else — no pricing, no proposal content, no
 * stage value of their choosing.
 *
 * Supabase is the source of truth for step state; Zoho gets the three summary
 * fields and the stage, and a Zoho failure never costs the customer their
 * progress.
 */
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const STEP_STATUS = { NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
const VALID_STATUS = new Set(Object.values(STEP_STATUS));

/** Mirrors proposalModel — actionable steps by purchase type. */
const ACTIONABLE = {
  loan:  ['qualification', 'paperwork', 'site_inspection'],
  lease: ['qualification', 'paperwork', 'site_inspection'],
  cash:  ['paperwork', 'site_inspection']
};

const ZOHO_STEP_FIELD = {
  qualification:   'Bank_Qualification',
  paperwork:       'Documents_Step',
  site_inspection: 'Intake_Step'
};

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
  if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${text.slice(0, 250)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * May this user touch this contact's steps?
 * Rep/admin through the usual ownership rules; a client only their own record.
 */
async function assertStepAccess(user, contactId) {
  if (user.role === 'admin') return;
  const r = await zohoFetch(
    `/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Email,Created_By_Rep`
  );
  const c = (r.data && r.data[0]) || null;
  if (!c) throw Object.assign(new Error('Client not found'), { status: 404 });

  const me = (user.email || '').toLowerCase();
  const email = (c.Email || '').toLowerCase();
  const createdBy = (c.Created_By_Rep || '').toLowerCase();

  if (user.role === 'client' && !!me && email === me) return;
  if (user.role === 'rep' && !!me && createdBy === me) return;
  throw Object.assign(new Error('Not authorized for this client.'), { status: 403 });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'PUT') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const user = await requireUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contactId, projectId, stepId, status } = body;

    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    if (!stepId) return res.status(400).json({ error: 'stepId required' });
    if (!VALID_STATUS.has(status)) return res.status(400).json({ error: 'Unrecognised status' });

    await assertStepAccess(user, contactId);

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Storage is not configured; progress was not saved.' });
    }

    // --- read the proposal so the stage is computed from stored truth ---
    const rows = await sbFetch(
      `/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=proposal`
    );
    const proposal = rows && rows[0] && rows[0].proposal;
    if (!proposal) return res.status(404).json({ error: 'No saved proposal for this client.' });

    const mode = (proposal.financing && proposal.financing.purchaseType) || 'loan';
    const required = ACTIONABLE[mode] || ACTIONABLE.loan;

    // Only steps that exist for this deal, and only from the stored set —
    // the request supplies one step, never the whole map.
    const steps = { ...(proposal.steps || {}) };
    if (!required.includes(stepId) && !(stepId in steps)) {
      return res.status(400).json({ error: 'That step does not apply to this deal.' });
    }
    steps[stepId] = status;

    const complete = required.every((id) => steps[id] === STEP_STATUS.COMPLETED);
    const stage = complete ? 'Converted to Project' : 'Met';

    const updated = {
      ...proposal,
      steps,
      stage,
      stepsUpdatedAt: new Date().toISOString(),
      stepsUpdatedBy: user.email || null
    };

    await sbFetch('/client_data', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{
        contact_id: contactId, proposal: updated, updated_at: new Date().toISOString()
      }])
    });

    // --- Zoho, best effort ---
    let zoho = { ok: false, missing: [] };
    if (projectId) {
      const payload = { Sales_Stage: stage };
      for (const [id, field] of Object.entries(ZOHO_STEP_FIELD)) {
        if (steps[id]) payload[field] = steps[id];
      }
      // Same drop-and-retry as save-proposal: a field Dave hasn't created
      // must not cost the customer their progress.
      const optional = Object.keys(payload);
      let attempt = { ...payload };
      for (let i = 0; i <= optional.length; i++) {
        try {
          await zohoFetch(`/crm/v2/Solar_Projects/${encodeURIComponent(projectId)}`, {
            method: 'PUT',
            body: JSON.stringify({ data: [attempt] })
          });
          zoho = { ok: true, missing: zoho.missing };
          break;
        } catch (e) {
          const name = optional.find((f) => new RegExp(f, 'i').test(e.message || '') && attempt[f] !== undefined);
          if (name) { zoho.missing.push(name); delete attempt[name]; continue; }
          zoho = { ok: false, missing: zoho.missing, error: e.message };
          break;
        }
      }
    }

    return res.status(200).json({ ok: true, steps, stage, complete, zoho });
  } catch (e) {
    return sendError(res, e);
  }
}
