/**
 * FILE: api/beach.js
 *
 * GET /api/beach[?rep=email] — a rep's book, bucketed into the three tides.
 *
 * Scoping is the whole security story here. A rep sees only contacts where
 * Created_By_Rep matches their login; an admin sees everyone, or one rep when
 * `rep` is passed. A client has no business on this endpoint at all.
 *
 * WHERE A DEAL'S TIDE COMES FROM, in priority order:
 *
 *   1. Sales_Stage on the project, if Dave has created that field.
 *   2. Project_Status — "Battery Installed" and "PTO-Approved" are installed
 *      whatever the sales stage says, because the install side is the truth
 *      once hardware is on a wall.
 *   3. The saved proposal's own stage, from Supabase.
 *
 * Falling through rather than depending on one field means The Beach works
 * today, before Sales_Stage exists, and keeps working after.
 *
 * Commission comes from the saved proposal, never re-derived. See
 * src/beach/Treasure.jsx for why.
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** Install-side statuses that mean the hardware is up, whatever sales says. */
const INSTALLED_STATUSES = new Set(['Battery Installed', 'HVAC Installed', 'PTO-Approved']);

const tideFor = (project, proposal) => {
  const status = project && project.Project_Status;
  if (status && INSTALLED_STATUSES.has(status)) return 'installed';

  const stage = (project && project.Sales_Stage) || (proposal && proposal.stage) || null;
  if (stage === 'Installed') return 'installed';
  if (stage === 'Converted to Project') return 'project';
  if (stage === 'Met') return 'met';

  // A saved proposal with no stage anywhere still means somebody was priced.
  return proposal ? 'met' : null;
};

/** "Loan · 20 yr · $24,500 · $118/mo" without importing the client bundle. */
const summarise = (proposal, project) => {
  const f = (proposal && proposal.financing) || {};
  const p = (proposal && proposal.pricing) || {};
  const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
  const parts = [];
  const type = f.purchaseType || (project && project.Purchase_Type) || null;
  if (type) parts.push(type.charAt(0).toUpperCase() + type.slice(1));
  const term = f.termYears || (project && project.Term);
  if (term) parts.push(`${term} yr`);
  const cv = p.contractWithAdders ?? (project && project.Contract_Value);
  if (cv) parts.push(money(cv));
  const pay = f.monthlyPayment ?? (project && project.Monthly_Payment);
  if (pay) parts.push(`${money(pay)}/mo`);
  return parts.join(' · ');
};

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (user.role === 'client') {
      return res.status(403).json({ error: 'The Beach is for reps and admins.' });
    }

    const me = (user.email || '').toLowerCase();
    const requested = (req.query.rep || '').toLowerCase();
    // A rep asking for someone else's book gets their own, silently — the
    // request is almost certainly a stale URL, not an attack, and an error
    // page helps nobody.
    const scopeTo = user.role === 'admin' ? requested : me;

    // --- contacts in scope ---
    let contactQuery = 'select id, Full_Name, Email, Created_By_Rep from Contacts where Last_Name is not null';
    if (scopeTo) {
      const safe = scopeTo.replace(/'/g, '');
      contactQuery = `select id, Full_Name, Email, Created_By_Rep from Contacts where Created_By_Rep = '${safe}'`;
    }
    contactQuery += ' limit 200';

    let contacts = [];
    try {
      const r = await zohoFetch('/crm/v2/coql', {
        method: 'POST',
        body: JSON.stringify({ select_query: contactQuery })
      });
      contacts = (r && r.data) || [];
    } catch (e) {
      // An empty book is a legitimate state — a new rep has no contacts, and
      // COQL returns an error rather than an empty set for that.
      contacts = [];
    }

    const byId = Object.fromEntries(contacts.map((c) => [c.id, c]));
    const ids = contacts.map((c) => c.id);

    // --- their projects ---
    let projects = [];
    if (ids.length) {
      const inList = ids.map((i) => `'${i}'`).join(',');
      const fields = [
        'id', 'Contact', 'Project_Status', 'Purchase_Type', 'Contract_Value',
        'Term', 'Monthly_Payment', 'Finance_Provider'
      ];
      // Sales_Stage may not exist yet. Ask for it, and drop it if Zoho
      // refuses rather than losing the whole query.
      for (const withStage of [true, false]) {
        const sel = withStage ? [...fields, 'Sales_Stage'] : fields;
        try {
          const r = await zohoFetch('/crm/v2/coql', {
            method: 'POST',
            body: JSON.stringify({
              select_query: `select ${sel.join(', ')} from Solar_Projects where Contact in (${inList}) limit 200`
            })
          });
          projects = (r && r.data) || [];
          break;
        } catch (e) {
          if (withStage) continue;
          projects = [];
        }
      }
    }

    // --- saved proposals ---
    let proposals = {};
    if (SUPABASE_URL && SERVICE_KEY && ids.length) {
      try {
        const inList = ids.map(encodeURIComponent).join(',');
        const rows = await sbFetch(`/client_data?contact_id=in.(${inList})&select=contact_id,proposal`);
        for (const row of rows || []) {
          if (row.proposal) proposals[row.contact_id] = row.proposal;
        }
      } catch { /* proposals are an enrichment, not a requirement */ }
    }

    // --- assemble ---
    const deals = [];
    const seen = new Set();

    for (const project of projects) {
      const contactId = project.Contact && (project.Contact.id || project.Contact);
      const contact = byId[contactId];
      const proposal = proposals[contactId] || null;
      const tide = tideFor(project, proposal);
      if (!tide) continue;
      seen.add(contactId);
      deals.push({
        id: project.id,
        contactId,
        name: (contact && contact.Full_Name) || null,
        tide,
        summary: summarise(proposal, project),
        contractValue: (proposal && proposal.pricing && proposal.pricing.contractWithAdders)
          ?? project.Contract_Value ?? 0,
        commission: (proposal && proposal.internal && proposal.internal.commission) || 0,
        proposalDate: (proposal && proposal.createdAt) || null,
        projectStatus: project.Project_Status || null,
        rep: (contact && contact.Created_By_Rep) || null
      });
    }

    // A proposal saved against a contact with no project row still counts.
    for (const [contactId, proposal] of Object.entries(proposals)) {
      if (seen.has(contactId) || !byId[contactId]) continue;
      deals.push({
        id: `prop_${contactId}`,
        contactId,
        name: byId[contactId].Full_Name || null,
        tide: tideFor(null, proposal) || 'met',
        summary: summarise(proposal, null),
        contractValue: (proposal.pricing && proposal.pricing.contractWithAdders) || 0,
        commission: (proposal.internal && proposal.internal.commission) || 0,
        proposalDate: proposal.createdAt || null,
        projectStatus: null,
        rep: byId[contactId].Created_By_Rep || null
      });
    }

    deals.sort((a, b) => (b.proposalDate || '').localeCompare(a.proposalDate || ''));

    // Admins get the rep list for the filter.
    const reps = user.role === 'admin'
      ? [...new Set(contacts.map((c) => c.Created_By_Rep).filter(Boolean))].sort()
      : [];

    return res.status(200).json({ ok: true, deals, reps, scope: scopeTo || 'all', role: user.role });
  } catch (e) {
    return sendError(res, e);
  }
}
