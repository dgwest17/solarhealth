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
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';
import { SALES_STAGE } from '../../src/proposal/proposalModel.js';

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

  // Compared against the model's constants, not retyped strings: the Zoho
  // picklist is editable, and a stale literal here would silently park a deal
  // in the wrong tide rather than fail.
  const stage = (project && project.Sales_Stage) || (proposal && proposal.stage) || null;
  if (stage === SALES_STAGE.INSTALLED) return 'installed';
  if (stage === SALES_STAGE.CONVERTED) return 'project';
  if (stage === SALES_STAGE.MET) return 'met';
  // A lost deal is not in the water and never reached the sand.
  if (stage === SALES_STAGE.LOST) return null;

  // A saved proposal with no stage anywhere still means somebody was priced.
  return proposal ? 'met' : null;
};

/**
 * WHAT THIS VIEWER EARNED ON THIS DEAL — not what the deal paid out.
 *
 * The saved proposal carries the whole pool and a snapshot of the split. A rep
 * looking at Treasure needs their own share; a manager needs every share. So
 * this returns both, and Treasure decides which to show.
 *
 * MATCHING IS BY SEAT, FROM THE SNAPSHOT. The percentages are read off the
 * stored proposal rather than the current rate card, because a comp change
 * would otherwise retroactively rewrite what past deals paid — a rep's banked
 * total moving overnight is the fastest way to lose their trust in the number.
 *
 * A proposal saved before the split model has no rows. Its total is attributed
 * to the rep who saved it, which is what the old single-figure field meant.
 */
const commissionFor = (proposal, viewerEmail, isManager) => {
  const int = (proposal && proposal.internal) || null;
  if (!int) return { total: 0, mine: 0, rows: [], legacy: false };

  const total = Number(int.total ?? int.commission) || 0;
  const rows = Array.isArray(int.rows) ? int.rows : [];

  if (!rows.length) {
    // Legacy proposal: one figure, no seats. Treat it as the saver's.
    return { total, mine: total, rows: [], legacy: true, seat: null, selfGen: false };
  }

  const me = (viewerEmail || '').toLowerCase();
  const builderEmail = (int.builderEmail || '').toLowerCase();

  // WHICH SEAT IS THIS VIEWER IN? The builder sees the builder's half; anyone
  // else looking at their own book is the engineer who closed it. Decided by
  // email rather than by who saved the proposal, because the builder did not
  // save it and would otherwise see nothing.
  const seat = (builderEmail && me && builderEmail === me)
    ? 'builder'
    : (int.selfGen ? 'self' : 'engineer');

  const seatRow = rows.find((r) => r.key === seat);
  const mine = seatRow ? Number(seatRow.amount) || 0 : 0;

  return {
    total,
    mine: isManager ? total : mine,
    rows,
    legacy: false,
    seat,
    selfGen: !!int.selfGen,
    builderName: int.builderName || null,
    builderEmail: int.builderEmail || null,
    // Manager buckets: what the override seats earned across the book.
    captain: (rows.find((r) => r.key === 'captain') || {}).amount || 0,
    recruiter: (rows.find((r) => r.key === 'recruiter') || {}).amount || 0
  };
};

/**
 * What battery this deal is, in words.
 *
 * The saved proposal wins: it is what the customer agreed to buy. The Zoho
 * record is the fallback, and is the only source for jobs that predate
 * proposals being saved at all.
 */
const batteryLabel = (proposal, project) => {
  const sys = proposal && proposal.system;
  if (sys && (sys.make || sys.model)) {
    const name = [sys.make, sys.model].filter(Boolean).join(' ');
    const extra = (sys.units || []).reduce((a, u) => a + (Number(u.qty) || 0), 0);
    return extra ? `${name} +${extra}` : name;
  }
  if (project && project.Battery_Manufacturer) return project.Battery_Manufacturer;
  return null;
};

/** "Loan · 20 yr · $24,500 · $118/mo" without importing the client bundle. */
const summarise = (proposal, project) => {
  const f = (proposal && proposal.financing) || {};
  const p = (proposal && proposal.pricing) || {};
  const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
  const parts = [];
  // Fall back to the Proposal_* fields, never to Purchase_Type / Term /
  // Contract_Value / Monthly_Payment. Those six describe the system the
  // customer ALREADY has; reading them here would print their existing loan
  // on a row labelled as this deal, which is the most believable kind of
  // wrong number — nobody checks a figure that looks right.
  const type = f.purchaseType || (project && project.Proposal_Purchase_Type) || null;
  if (type) parts.push(type.charAt(0).toUpperCase() + type.slice(1));
  const term = f.termYears || (project && project.Proposal_Term);
  if (term) parts.push(`${term} yr`);
  const cv = p.contractWithAdders ?? (project && project.Proposal_Contract_Value);
  if (cv) parts.push(money(cv));
  const pay = f.monthlyPayment ?? (project && project.Proposal_Monthly_Payment);
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
    // An admin looking at the whole book is a manager view: they see the pool
    // and the override buckets, not one seat's share.
    const isManager = user.role === 'admin' && !requested;

    // --- contacts in scope ---
    let contactQuery = 'select id, Full_Name, Email, Created_By_Rep, Last_Activity_Time from Contacts where Last_Name is not null';
    if (scopeTo) {
      const safe = scopeTo.replace(/'/g, '');
      contactQuery = `select id, Full_Name, Email, Created_By_Rep, Last_Activity_Time from Contacts where Created_By_Rep = '${safe}'`;
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
      // The Beach shows the DEAL, so it selects the Proposal_* fields. The
      // audit's Purchase_Type / Contract_Value / Term / Monthly_Payment are
      // the customer's existing system and have no business on a pipeline row.
      const fields = ['id', 'Contact', 'Project_Status'];
      // None of the Proposal_* fields exist until they are created in Zoho.
      // Ask for them, and fall back to the bare row if Zoho refuses, rather
      // than losing the whole query and blanking The Beach.
      // Optional because a field may not exist on this org's module yet. The
      // Pipeline needs the dates and the equipment; the tides only need the
      // first few.
      let optional = [
        'Sales_Stage', 'Proposal_Purchase_Type', 'Proposal_Contract_Value',
        'Proposal_Term', 'Proposal_Monthly_Payment', 'Proposal_Lender',
        'Proposal_Date', 'Install_Date', 'PTO_Date', 'Battery_Install_Date',
        'System_Size_kW', 'Battery_Capacity_kWh', 'Battery_Manufacturer',
        'Number_of_Modules', 'Panel_Model', 'Utility_Provider', 'NEM_Version'
      ];

      /**
       * Drop failing fields ONE AT A TIME rather than abandoning the whole
       * optional set.
       *
       * The previous version retried once without any optional field, so a
       * single missing column cost every other one — the Pipeline would lose
       * install dates and equipment because, say, Panel_Model happened not to
       * exist. COQL names the offending field in its error, so the name is
       * matched out and only that one is given up.
       */
      for (let attempt = 0; attempt <= optional.length; attempt++) {
        const sel = [...fields, ...optional];
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
          const msg = e.message || '';
          const bad = optional.find((f) => msg.includes(f));
          if (bad) { optional = optional.filter((f) => f !== bad); continue; }
          // Not a field problem — stop rather than looping on a real failure.
          projects = [];
          break;
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

    /**
     * DEALS THIS REP SET BUT DOES NOT OWN.
     *
     * A builder does not own the contact — the engineer who closed it does, and
     * Created_By_Rep points at them. Scoping on ownership alone therefore hides
     * a builder's own deals from their own Beach, which is precisely the money
     * they most want to see.
     *
     * So a second pass: proposals whose stored split names this viewer as the
     * builder. Filtered inside the jsonb, so it stays one query rather than a
     * scan. An admin looking at the whole book already has everything and skips
     * it; a rep looking at somebody else's book is not entitled to this.
     */
    if (SUPABASE_URL && SERVICE_KEY && me && !isManager && (!requested || requested === me)) {
      try {
        const asBuilder = await sbFetch(
          `/client_data?proposal->internal->>builderEmail=eq.${encodeURIComponent(me)}` +
          `&select=contact_id,proposal`
        );
        const extraIds = [];
        for (const row of asBuilder || []) {
          if (!row.proposal || proposals[row.contact_id]) continue;
          proposals[row.contact_id] = row.proposal;
          extraIds.push(row.contact_id);
        }
        // Their names come from Zoho; without this the rows render as "Unnamed".
        if (extraIds.length) {
          const inList = extraIds.map((i) => `'${String(i).replace(/'/g, '')}'`).join(',');
          try {
            const r = await zohoFetch('/crm/v2/coql', {
              method: 'POST',
              body: JSON.stringify({
                select_query: `select id, Full_Name, Email, Created_By_Rep, Last_Activity_Time ` +
                  `from Contacts where id in (${inList}) limit 200`
              })
            });
            for (const c of (r && r.data) || []) {
              if (!byId[c.id]) { byId[c.id] = c; contacts.push(c); }
            }
          } catch { /* a missing name is survivable; a missing deal is not */ }
        }
      } catch { /* older proposals have no builder field — nothing to add */ }
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
      const comm = commissionFor(proposal, me, isManager);
      deals.push({
        id: project.id,
        contactId,
        name: (contact && contact.Full_Name) || null,
        tide,
        summary: summarise(proposal, project),
        // Proposal_Contract_Value, not Contract_Value. The latter is what the
        // customer's EXISTING system cost, and Treasure sums this field into
        // a rep's pipeline revenue — so the audit figure would show up as
        // money they are about to earn on a deal that does not exist.
        contractValue: (proposal && proposal.pricing && proposal.pricing.contractWithAdders)
          ?? project.Proposal_Contract_Value ?? 0,
        // `commission` is the viewer's own share; `commissionTotal` is the
        // pool. Treasure sums the first, a manager's view sums the second.
        commission: comm.mine,
        commissionTotal: comm.total,
        commissionRows: comm.rows,
        commissionSeat: comm.seat,
        selfGen: comm.selfGen,
        proposalDate: (proposal && proposal.createdAt) || project.Proposal_Date || null,
        projectStatus: project.Project_Status || null,
        rep: (contact && contact.Created_By_Rep) || null,

        // ---- Pipeline columns ----
        // Sold is when a deal reached a signed stage, which the proposal knows
        // and the project does not; the CRM's Proposal_Date is the fallback.
        soldDate: (proposal && proposal.stepsUpdatedAt && proposal.stage === 'Project')
          ? proposal.stepsUpdatedAt
          : (project.Proposal_Date || null),
        installDate: project.Battery_Install_Date || project.Install_Date || null,
        ptoDate: project.PTO_Date || null,
        lastContact: (contact && contact.Last_Activity_Time) || null,
        // Equipment: the saved proposal is what was SOLD, the project is what
        // is on the roof. For a pipeline row the sold system is the answer,
        // with the installed record as fallback for older jobs.
        battery: batteryLabel(proposal, project),
        batteryKwh: (proposal && proposal.system && proposal.system.usableKwh)
          || project.Battery_Capacity_kWh || 0,
        solarKw: project.System_Size_kW || 0,
        panels: project.Number_of_Modules || 0,
        panelModel: project.Panel_Model || null,
        utility: project.Utility_Provider || null,
        nemVersion: project.NEM_Version || null
      });
    }

    // A proposal saved against a contact with no project row still counts.
    for (const [contactId, proposal] of Object.entries(proposals)) {
      if (seen.has(contactId) || !byId[contactId]) continue;
      const comm = commissionFor(proposal, me, isManager);
      deals.push({
        id: `prop_${contactId}`,
        contactId,
        name: byId[contactId].Full_Name || null,
        tide: tideFor(null, proposal) || 'met',
        summary: summarise(proposal, null),
        contractValue: (proposal.pricing && proposal.pricing.contractWithAdders) || 0,
        commission: comm.mine,
        commissionTotal: comm.total,
        commissionRows: comm.rows,
        commissionSeat: comm.seat,
        selfGen: comm.selfGen,
        proposalDate: proposal.createdAt || null,
        projectStatus: null,
        rep: byId[contactId].Created_By_Rep || null,
        soldDate: null,
        installDate: null,
        ptoDate: null,
        lastContact: byId[contactId].Last_Activity_Time || null,
        battery: batteryLabel(proposal, null),
        batteryKwh: (proposal.system && proposal.system.usableKwh) || 0,
        solarKw: 0,
        panels: (proposal.solar && proposal.solar.panels) || 0,
        panelModel: (proposal.solar && proposal.solar.panelModel) || null,
        utility: null,
        nemVersion: null
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
