/**
 * FILE: api/_routes/update-deal.js
 *
 * POST /api/update-deal — change a deal from the Pipeline, without opening it.
 *
 * A rep working a list needs to move a stage, set an install date or correct a
 * commission without loading the whole audit for each one. That is the entire
 * purpose; anything that needs the pricing screen belongs on the pricing
 * screen.
 *
 * ---------------------------------------------------------------------------
 * WHAT CAN BE CHANGED, AND WHY THE LIST IS SHORT
 *
 *   stage          Sales_Stage. The thing that moves most often.
 *   installDate    the date everyone else asks about.
 *   commission     the total pool, for a deal priced outside the tool or
 *                  corrected after the fact. ADMIN ONLY.
 *   setByRep       who set it, and their email — the field that routes a
 *                  builder's half into their Beach, and the one most likely to
 *                  have been left blank in the room.
 *   note           free text onto the project.
 *
 * Nothing that would change the customer's PRICE is editable here. Changing a
 * contract value without re-deriving the payment, the rebate and the federal
 * deduction produces a record that contradicts the proposal the customer is
 * holding — and the Pipeline has none of that machinery. Re-price on the
 * pricing screen and save a new version, which leaves the trail `supersedes`
 * exists for.
 *
 * ---------------------------------------------------------------------------
 * PERMISSIONS
 *
 * A rep may edit a deal they own or one they set. That second case is the whole
 * reason builders can see these rows at all, and a builder who cannot fix the
 * install date on their own deal would have to ask the closer to do it.
 *
 * COMMISSION IS ADMIN-ONLY, and the check is here rather than in the UI. A rep
 * editing their own commission is the one write on this endpoint with a direct
 * financial motive, so the server refuses it regardless of what the browser
 * sends. The UI hiding the field is a convenience, not the control.
 *
 * Stage is validated against the model's own list rather than passed through:
 * an arbitrary string would be dropped silently by Zoho and look like the
 * update having no effect.
 */
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';
import { SALES_STAGE } from '../../src/proposal/proposalModel.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const VALID_STAGES = new Set(Object.values(SALES_STAGE));

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
 * May this user change this deal?
 *
 * Ownership is resolved from Zoho, never from the request. The builder case is
 * resolved from the stored proposal, which is the only place that fact lives.
 */
async function assertCanEdit(user, contactId) {
  if (user.role === 'admin') return { isAdmin: true };
  if (user.role !== 'rep') {
    throw Object.assign(new Error('Editing a deal requires a rep or admin login.'), { status: 403 });
  }

  const me = (user.email || '').toLowerCase();
  const r = await zohoFetch(
    `/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Created_By_Rep`
  );
  const c = (r.data && r.data[0]) || null;
  if (c && (c.Created_By_Rep || '').toLowerCase() === me) return { isAdmin: false };

  // Not the owner. They may still be the builder who set it.
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const rows = await sbFetch(
        `/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=proposal`
      );
      const int = rows && rows[0] && rows[0].proposal && rows[0].proposal.internal;
      if (int && (int.builderEmail || '').toLowerCase() === me) return { isAdmin: false };
    } catch { /* fall through to the refusal */ }
  }

  throw Object.assign(new Error('That is not your deal.'), { status: 403 });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'PUT') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const user = await requireUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contactId, projectId, stage, installDate, commission, setByRep, setByRepEmail, note } = body;

    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    const { isAdmin } = await assertCanEdit(user, contactId);

    if (commission != null && !isAdmin) {
      return res.status(403).json({ error: 'Only an admin can change a commission.' });
    }
    if (stage != null && !VALID_STAGES.has(stage)) {
      return res.status(400).json({
        error: `Unrecognised stage. Expected one of: ${[...VALID_STAGES].join(', ')}`
      });
    }
    if (installDate != null && installDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(installDate)) {
      return res.status(400).json({ error: 'installDate must be YYYY-MM-DD.' });
    }

    /* ---------------- Zoho: the reportable fields ---------------- */
    const payload = {};
    if (stage != null) payload.Sales_Stage = stage;
    if (installDate != null) payload.Install_Date = installDate || null;
    if (commission != null) payload.Rep_Commission = Math.max(0, Number(commission) || 0);
    if (setByRep != null) payload.Set_By_Rep = setByRep || null;
    if (setByRepEmail != null) payload.Set_By_Rep_Email = (setByRepEmail || '').trim().toLowerCase() || null;
    if (note) payload.Description = note;

    let zoho = { ok: false, missing: [] };
    if (projectId && Object.keys(payload).length) {
      // Drop a field Zoho does not have rather than losing the whole update —
      // the same retry the other write paths use, for the same reason: a field
      // that has not been created yet must not cost the edit that was made.
      const optional = Object.keys(payload);
      const attempt = { ...payload };
      for (let i = 0; i <= optional.length; i++) {
        try {
          await zohoFetch(`/crm/v2/Solar_Projects/${encodeURIComponent(projectId)}`, {
            method: 'PUT',
            body: JSON.stringify({ data: [attempt] })
          });
          zoho = { ok: true, missing: zoho.missing };
          break;
        } catch (e) {
          const bad = optional.find((f) => new RegExp(f, 'i').test(e.message || '') && attempt[f] !== undefined);
          if (bad) { zoho.missing.push(bad); delete attempt[bad]; continue; }
          zoho = { ok: false, missing: zoho.missing, error: e.message };
          break;
        }
      }
    }

    /* ------------- Supabase: keep the proposal in step -------------
       The stored proposal is what Treasure and the Pipeline read, so an edit
       that only reached Zoho would show the old figures everywhere in the app.
       The split is RE-DERIVED from the stored percentages when a commission
       changes — not from today's rate card, which would retroactively rewrite
       the deal's own history. */
    let proposalUpdated = false;
    if (SUPABASE_URL && SERVICE_KEY) {
      try {
        const rows = await sbFetch(
          `/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=proposal`
        );
        const existing = rows && rows[0] && rows[0].proposal;
        if (existing) {
          const next = { ...existing };
          if (stage != null) next.stage = stage;

          const int = { ...(existing.internal || {}) };
          if (commission != null) {
            const total = Math.max(0, Number(commission) || 0);
            int.total = total;
            int.commission = total;
            // Re-apply each seat's OWN stored percentage.
            int.rows = (int.rows || []).map((r) => ({ ...r, amount: total * (Number(r.pct) || 0) / 100 }));
            int.editedAt = new Date().toISOString();
            int.editedBy = user.email || null;
          }
          if (setByRep != null) int.builderName = setByRep || null;
          if (setByRepEmail != null) {
            int.builderEmail = (setByRepEmail || '').trim().toLowerCase() || null;
            // Naming a builder ends self-gen; clearing one restores it. The two
            // cannot be set independently, or a deal ends up self-gen with a
            // builder on it and nobody can say who should have been paid.
            int.selfGen = !int.builderEmail && !int.builderName;
          }
          next.internal = int;

          await sbFetch('/client_data', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([{
              contact_id: contactId, proposal: next, updated_at: new Date().toISOString()
            }])
          });
          proposalUpdated = true;
        }
      } catch (e) {
        // Zoho may already have taken the edit. Say so rather than implying
        // nothing happened.
        return res.status(200).json({
          ok: zoho.ok, zoho, proposalUpdated: false,
          warning: `Saved to the CRM but not to the stored proposal: ${e.message}`
        });
      }
    }

    return res.status(200).json({ ok: true, zoho, proposalUpdated });
  } catch (e) {
    return sendError(res, e);
  }
}
