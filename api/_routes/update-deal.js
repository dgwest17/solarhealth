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
 *   builder        who set it: { id, name, email } or null for self-gen. The
 *                  field that routes a builder's half into their Beach, and the
 *                  one most likely to have been left blank in the room. Omit it
 *                  entirely to leave the stored builder untouched.
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
import { SALES_STAGE, builderOf } from '../../src/proposal/proposalModel.js';

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
      const b = builderOf(int);
      if (b && b.email && b.email === me) return { isAdmin: false };
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
    const { contactId, projectId, stage, installDate, commission, builder, note } = body;

    /**
     * WHO SET IT — one value, validated here.
     *
     * `builder` is { id, name, email } or null; absent means "do not touch it".
     * The three-way distinction matters: null clears the builder (self-gen),
     * absent leaves whatever is stored alone, and an object replaces it. Sending
     * a name and an email as two separate parameters, as this used to, made
     * "clear it" and "leave it" indistinguishable.
     *
     * Normalised into ONE shape before anything downstream reads it, so neither
     * the CRM write nor the stored proposal has to think about it again.
     */
    const touchesBuilder = Object.prototype.hasOwnProperty.call(body, 'builder');
    let nextBuilder = null;
    if (touchesBuilder && builder) {
      if (typeof builder !== 'object') {
        return res.status(400).json({ error: 'builder must be an object or null.' });
      }
      const email = String(builder.email || '').trim().toLowerCase();
      // A lookup id from Zoho is a long digit string. Rejecting anything else
      // keeps a junk value out of the CRM write, where it would fail the whole
      // update rather than just this field.
      const id = builder.id != null && /^\d{1,25}$/.test(String(builder.id))
        ? String(builder.id) : null;
      const name = String(builder.name || '').trim();
      if (!id && !email && !name) {
        return res.status(400).json({ error: 'A builder needs an id, an email or a name.' });
      }
      nextBuilder = { id, name, email };
    }

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
    /**
     * ONE lookup field at the Recruit record, replacing the old name+email pair.
     *
     * Written as null when the builder is cleared — an explicit null is how a
     * Zoho lookup is emptied, and a deal pointing at a rep who did not earn it
     * has to be clearable. A builder with no recruit id (typed in while the
     * roster was down) cannot be pointed at, so the CRM link is left absent
     * while the email in the stored proposal still routes the money.
     */
    if (touchesBuilder) {
      if (!nextBuilder) payload.Set_By = null;
      else if (nextBuilder.id) payload.Set_By = { id: nextBuilder.id };
    }
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
          /**
           * The stored snapshot, set as one unit.
           *
           * All four properties move together or not at all. They used to be
           * settable independently, which allowed a deal to end up marked
           * self-gen with a builder's name still on it — and then nobody could
           * say who should have been paid. selfGen is derived here, never sent.
           */
          if (touchesBuilder) {
            int.builderRecruitId = nextBuilder ? nextBuilder.id : null;
            int.builderName = nextBuilder ? (nextBuilder.name || null) : null;
            int.builderEmail = nextBuilder ? (nextBuilder.email || null) : null;
            int.selfGen = !nextBuilder;
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
