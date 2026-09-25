/**
 * FILE: api/save-proposal.js
 *
 * POST /api/save-proposal — store what the rep priced, and move the deal.
 * GET  /api/save-proposal?contactId=… — read the saved proposal back.
 *
 * Two writes, deliberately in this order:
 *
 *   1. SUPABASE gets the full proposal object. This is the write that must
 *      not fail, because it is the only complete record of what the customer
 *      was shown.
 *   2. ZOHO gets the summary and the stage move.
 *
 * If Zoho fails the Supabase write still stands and the response says so.
 * The reverse order would risk a deal sitting at "Met" in the CRM with no
 * proposal behind it — a stage that lies is worse than a stage that lags.
 *
 * MISSING FIELDS ARE EXPECTED. The summary includes fields Dave may not have
 * created yet (Sales_Stage, Net_Investment, the three step statuses). Zoho
 * rejects an unknown field for the whole record, so this retries without the
 * offending fields and reports exactly which ones are missing, rather than
 * failing the save and leaving the rep with nothing.
 *
 * Writes are rep/admin only, through the shared assertCanWriteContact guard —
 * the same one every other write endpoint uses, so permissions cannot drift.
 */
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError, assertCanWriteContact } from '../_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/** Fields that may not exist in Zoho yet. Retried away one by one on failure. */
const OPTIONAL_ZOHO_FIELDS = [
  'Sales_Stage', 'Proposal_Date', 'Net_Investment', 'Storage_Rebate',
  'Est_Monthly_Savings', 'Rep_Commission',
  'Lender_Qualification', 'Documents_Step', 'Intake_Step',
  // Add-on tracking and the setter lookup. Listed so a save still lands with a
  // clear "these fields do not exist yet" report on an org where they have not
  // been created, instead of failing outright the first time one is written.
  'Proposal_Scope', 'Added_Solar_kW', 'Added_Annual_Production_kWh', 'Set_By',
  'Install_Company'
];

/**
 * Fields where an explicit null means "clear it", not "not applicable".
 *
 * Everything else is stripped when null, because a null in this payload usually
 * just means the deal has no such figure and writing it would blank a column
 * somebody filled in by hand. Set_By is the exception: a deal attributed to the
 * wrong rep has to be clearable, and for a Zoho lookup that takes a real null.
 */
const CLEARABLE_ZOHO_FIELDS = new Set(['Set_By']);

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
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Write the summary to Solar_Projects, dropping fields Zoho does not know
 * about and reporting them back.
 */
/**
 * Why Zoho refused a field, in words a rep can act on.
 *
 * Every refusal used to be reported as "this field doesn't exist yet", which
 * sent Dave hunting for a field that was sitting right there in the CRM: the
 * real cause was a decimal sent to an integer field. Zoho says which it is —
 * `expected_data_type` on a type mismatch — so that is passed through, and
 * "not found" is only claimed when Zoho's own message says so.
 */
function reasonFor(e, field) {
  const row = e.zohoRow || null;
  const details = (row && row.details) || null;
  let expected = details && details.expected_data_type;
  const text = String((row && row.message) || e.message || '');
  if (!expected) {
    const m = /"api_name"\s*:\s*"([^"]+)"[^}]*"expected_data_type"\s*:\s*"([^"]+)"/.exec(text)
      || /"expected_data_type"\s*:\s*"([^"]+)"[^}]*"api_name"\s*:\s*"([^"]+)"/.exec(text);
    if (m) expected = m[1] === field ? m[2] : m[1];
  }
  if (expected) return `wrong type — Zoho expects ${expected}`;
  if (/not\s*found|invalid\s*field|no\s*such/i.test(text)) return 'not found on Solar_Projects';
  return (row && row.code) || text.slice(0, 120) || 'rejected';
}

async function writeZohoSummary(projectId, summary) {
  const missing = [];
  const problems = [];
  let payload = { ...summary };

  // Nulls are meaningful to Zoho (they clear a field) but here a null just
  // means "not applicable to this deal", so they are stripped.
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) { delete payload[k]; continue; }
    if (CLEARABLE_ZOHO_FIELDS.has(k)) continue;
    if (payload[k] === null || payload[k] === '') delete payload[k];
  }

  for (let attempt = 0; attempt < OPTIONAL_ZOHO_FIELDS.length + 1; attempt++) {
    try {
      const r = await zohoFetch(`/crm/v2/Solar_Projects/${encodeURIComponent(projectId)}`, {
        method: 'PUT',
        body: JSON.stringify({ data: [payload] })
      });
      const row = r && r.data && r.data[0];
      if (row && row.code && row.code !== 'SUCCESS') {
        throw Object.assign(new Error(row.message || row.code), { zohoRow: row });
      }
      return { ok: true, missing, problems, written: Object.keys(payload) };
    } catch (e) {
      // Zoho names the offending field in `details.api_name` on an
      // INVALID_DATA / mandatory-field style rejection.
      const name =
        (e.zohoRow && e.zohoRow.details && e.zohoRow.details.api_name) ||
        OPTIONAL_ZOHO_FIELDS.find((f) => new RegExp(f, 'i').test(e.message || ''));

      if (name && payload[name] !== undefined) {
        missing.push(name);
        problems.push({ field: name, value: payload[name], reason: reasonFor(e, name) });
        delete payload[name];
        continue;
      }
      // Not a missing-field problem, or nothing left to drop.
      return { ok: false, missing, problems, error: e.message };
    }
  }
  return { ok: false, missing, problems, error: 'Could not write any proposal fields to Zoho.' };
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);

    // ----------------------------------------------------------------- READ
    if (req.method === 'GET') {
      const contactId = req.query.contactId;
      if (!contactId) return res.status(400).json({ error: 'contactId required' });
      // Reading a proposal is allowed for anyone who can see the client —
      // including the client themselves, who is entitled to their own quote.
      if (!SUPABASE_URL || !SERVICE_KEY) return res.status(200).json({ ok: true, proposal: null });

      const rows = await sbFetch(
        `/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=proposal,updated_at`
      );
      const row = rows && rows[0];
      return res.status(200).json({
        ok: true,
        proposal: (row && row.proposal) || null,
        updatedAt: row ? row.updated_at : null
      });
    }

    // ---------------------------------------------------------------- WRITE
    if (req.method !== 'POST' && req.method !== 'PUT') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contactId, projectId, proposal, zohoSummary } = body;

    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    if (!proposal || typeof proposal !== 'object') {
      return res.status(400).json({ error: 'proposal object required' });
    }

    await assertCanWriteContact(user, contactId, zohoFetch);

    // --- 1. Supabase: the complete record. This one matters most. ---
    let supabaseOk = false;
    let supabaseError = null;
    if (SUPABASE_URL && SERVICE_KEY) {
      try {
        await sbFetch('/client_data', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify([{
            contact_id: contactId,
            proposal: { ...proposal, savedBy: user.email, savedAt: new Date().toISOString() },
            updated_at: new Date().toISOString()
          }])
        });
        supabaseOk = true;
      } catch (e) {
        supabaseError = /column .*proposal.* does not exist/i.test(e.message)
          ? 'The client_data table has no `proposal` column yet. Run: alter table client_data add column proposal jsonb;'
          : e.message;
      }
    } else {
      supabaseError = 'SUPABASE_SERVICE_KEY not configured.';
    }

    // --- 2. Zoho: the reportable summary and the stage move. ---
    let zoho = { ok: false, missing: [], error: 'No projectId — nothing written to the CRM.' };
    if (projectId && zohoSummary) {
      zoho = await writeZohoSummary(projectId, zohoSummary);
    }

    // A save is a success if the full record landed. Zoho trouble is reported
    // but does not cost the rep their work.
    const ok = supabaseOk || zoho.ok;
    return res.status(ok ? 200 : 500).json({
      ok,
      savedFull: supabaseOk,
      supabaseError,
      zoho,
      stage: proposal.stage,
      // Surfaced so the UI can tell the rep precisely what to create in Zoho
      // rather than showing a generic failure.
      missingZohoFields: zoho.missing,
      // Each refused field with Zoho's reason, so the message can say "wrong
      // type" when it is wrong type instead of claiming the field is missing.
      zohoProblems: zoho.problems || []
    });
  } catch (e) {
    return sendError(res, e);
  }
}
