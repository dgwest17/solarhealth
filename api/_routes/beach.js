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
import { SALES_STAGE, builderOf } from '../../src/proposal/proposalModel.js';

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

/**
 * Which tide a deal sits in — or null if it is not a deal at all.
 *
 * ---------------------------------------------------------------------------
 * A PROJECT STATUS IS NOT EVIDENCE OF A SALE
 *
 * This used to return 'installed' for any project whose Project_Status was in
 * INSTALLED_STATUSES, before looking at anything else. Project_Status is an
 * operational field and it arrived on roughly two hundred bulk-imported service
 * clients as "PTO-Approved" — systems somebody else sold years ago, imported so
 * the audit tool could analyse them.
 *
 * Every one of those was therefore an installed DEAL: two hundred rows in the
 * Pipeline, two hundred jobs in Treasure's banked count, all with no contract
 * value and no commission. It went unnoticed only because a separate bug was
 * emptying the whole view before these could be counted, so fixing that one
 * without fixing this one would have replaced an empty Beach with a false one.
 *
 * A deal needs evidence that somebody here sold it: a Sales_Stage set by this
 * app, or a saved proposal. Project_Status then decides WHICH tide, which is
 * the job it can actually do.
 */
const tideFor = (project, proposal) => {
  // Compared against the model's constants, not retyped strings: the Zoho
  // picklist is editable, and a stale literal here would silently park a deal
  // in the wrong tide rather than fail.
  const stage = (project && project.Sales_Stage) || (proposal && proposal.stage) || null;

  // No sales record of any kind — not ours, whatever is on the roof.
  if (!stage && !proposal) return null;

  // A lost deal is not in the water and never reached the sand.
  if (stage === SALES_STAGE.LOST) return null;

  // Hardware beats paperwork: a job the installer has signed off is installed
  // even if nobody moved the sales stage.
  const status = project && project.Project_Status;
  if (status && INSTALLED_STATUSES.has(status)) return 'installed';

  if (stage === SALES_STAGE.INSTALLED) return 'installed';
  if (stage === SALES_STAGE.CONVERTED) return 'project';
  if (stage === SALES_STAGE.MET) return 'met';

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
/**
 * ADMIN-ONLY FIGURES, STRIPPED ON THE SERVER.
 *
 * The Captain and Recruiter rows, and the pool total, are a manager's business.
 * They were correctly hidden in the UI and sent to every browser anyway, which
 * is a rendering decision rather than a control — a rep with the network tab
 * open could read what their captain earns off their production. So the seats a
 * rep is not entitled to never leave this function.
 *
 * A rep keeps the builder and engineer rows: those two ARE the split they are
 * part of, and the Pipeline shows them what a setter is owed.
 */
const REP_VISIBLE_SEATS = new Set(['builder', 'engineer', 'self']);

const commissionFor = (proposal, viewerEmail, { isAdmin = false, isManager = false } = {}) => {
  const int = (proposal && proposal.internal) || null;
  if (!int) return { total: 0, mine: 0, rows: [], legacy: false };

  const total = Number(int.total ?? int.commission) || 0;
  const rows = Array.isArray(int.rows) ? int.rows : [];
  // What leaves the server. `total` is the pool, so a non-admin gets null
  // rather than a figure they should not be reading.
  const outTotal = isAdmin ? total : null;

  if (!rows.length) {
    // Legacy proposal: one figure, no seats. Treat it as the saver's.
    return { total: outTotal, mine: total, rows: [], legacy: true, seat: null, selfGen: false };
  }

  const me = (viewerEmail || '').toLowerCase();
  // ONE reader of the stored shape, shared with the browser. It also understands
  // proposals saved before the recruit id existed, so an older deal still finds
  // its builder.
  const builder = builderOf(int);
  const builderEmail = (builder && builder.email) || '';

  // WHICH SEAT IS THIS VIEWER IN? The builder sees the builder's half; anyone
  // else looking at their own book is the engineer who closed it. Decided by
  // email rather than by who saved the proposal, because the builder did not
  // save it and would otherwise see nothing.
  //
  // Self-gen is the ABSENCE of a builder, derived rather than read from a stored
  // flag — a deal whose flag disagreed with its builder used to be possible, and
  // then nobody could say who should have been paid.
  const seat = (builderEmail && me && builderEmail === me)
    ? 'builder'
    : (builder ? 'engineer' : 'self');

  const seatRow = rows.find((r) => r.key === seat);
  const mine = seatRow ? Number(seatRow.amount) || 0 : 0;

  return {
    total: outTotal,
    mine: isManager ? total : mine,
    rows: isAdmin ? rows : rows.filter((r) => REP_VISIBLE_SEATS.has(r.key)),
    legacy: false,
    seat,
    selfGen: !builder,
    builderRecruitId: (builder && builder.recruitId) || null,
    builderName: (builder && builder.name) || null,
    builderEmail: (builder && builder.email) || null,
    // Manager buckets: what the override seats earned. Zero, not omitted, for a
    // non-admin — Treasure sums these and a null would poison the total.
    captain: isAdmin ? ((rows.find((r) => r.key === 'captain') || {}).amount || 0) : 0,
    recruiter: isAdmin ? ((rows.find((r) => r.key === 'recruiter') || {}).amount || 0) : 0
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
    /**
     * The email the split is read against.
     *
     * The rep being looked at when one is selected, otherwise the viewer. On the
     * Everyone view it makes no difference — isManager already means `mine` is
     * the pool — but it is what makes "select Kenson, see Kenson's half" true.
     */
    const seatEmail = scopeTo || me;
    // An admin looking at the whole book is a manager view: they see the pool
    // and the override buckets, not one seat's share.
    const isManager = user.role === 'admin' && !requested;
    /**
     * TWO DIFFERENT QUESTIONS, kept apart.
     *
     * `isAdmin` decides which FIGURES a caller may see — the pool, and the
     * Captain/Recruiter rows. `isManager` decides whether `mine` means the pool
     * or one seat's share. They were one flag, which meant an admin looking at
     * a single rep's book stopped being allowed to see the total commission on
     * a deal whose comp plan they own.
     */
    const isAdmin = user.role === 'admin';

    /* --------------------------------------------------------------------
       THE ROSTER — who can be selected, and how their name maps to an email.

       The rep list used to be built from the Created_By_Rep values found on the
       contacts in scope, which had two consequences. A SETTER never appeared at
       all: they do not own the contacts they set, so their email is on no
       record and there was no way to select them. And the same person appeared
       twice, because that field holds "David West" on imported rows and
       "davidgwest17@gmail.com" on rows this app made.

       Recruits is the roster — the same source the Set-by picker reads — so
       every hired rep is selectable whether or not they own anything yet, and
       the name-to-email map below collapses the two spellings onto one person.
       -------------------------------------------------------------------- */
    const rosterByEmail = new Map();
    const rosterByName = new Map();
    let roster = [];
    /**
     * Fetched for EVERYONE, returned to admins only.
     *
     * The folding matters just as much for a rep looking at their own book: a
     * rep whose older contacts carry their display name in Created_By_Rep, as
     * the bulk import does, would not match their own email and would find
     * their own deals missing. Gating the fetch on role gave the two roles
     * different definitions of "whose deal is this", which is the same fact
     * computed two ways — the thing that goes wrong quietly.
     *
     * Nothing here reaches a rep's browser: only the `reps` list built at the
     * end is returned, and that is still admin-only.
     */
    {
      try {
        const rows = await zohoFetch('/crm/v2/coql', {
          method: 'POST',
          body: JSON.stringify({
            select_query:
              'select id, Name, Last_Name, Email, Secondary_Email, Status, Role ' +
              'from Recruits where Last_Name is not null limit 200'
          })
        });
        for (const r of (rows && rows.data) || []) {
          const email = String(r.Email || r.Secondary_Email || '').trim().toLowerCase();
          if (!email) continue;
          const first = String(r.Name || '').trim();
          const last = String(r.Last_Name || '').trim();
          const full = [first, last].filter(Boolean).join(' ');
          const entry = {
            email,
            name: full || first || email,
            status: r.Status || null,
            role: r.Role || null,
            // Only somebody who works here should be offered. An applicant with
            // no deals is noise; one WITH deals still gets listed below, because
            // the book is the truth about who has sold something.
            active: r.Status === 'Hired'
          };
          rosterByEmail.set(email, entry);
          for (const key of [full, first, last].filter(Boolean)) {
            rosterByName.set(key.toLowerCase(), email);
          }
          roster.push(entry);
        }
      } catch {
        // No roster is survivable: the list falls back to whoever owns deals.
        roster = [];
      }
    }

    /* ====================================================================
       GATHERING THE BOOK

       This used to start from Contacts: fetch everyone in scope, then ask for
       their projects with `where Contact in (...)`. Two things were wrong with
       it, and together they emptied the Everyone view.

       COQL CAPS AN `IN` LIST AT 100 VALUES. With more than a hundred contacts
       the projects query came back LIMIT_EXCEEDED, the retry loop looked for a
       field name in the message, found none, and fell through to
       `projects = []`. The Beach then showed only deals that happened to have a
       saved proposal in Supabase — one row — while scoping to a single rep
       worked fine, because that query had sixteen ids in it. A cap being hit
       looked exactly like a rep having no deals.

       AND CONTACTS ARE THE WRONG STARTING POINT ANYWAY. A deal needs a project
       or a saved proposal; a contact with neither contributes nothing. Paging
       through 400 contacts to find 20 deals is backwards, and the 200-row cap
       on that first query silently decided which deals existed.

       So: start from projects and proposals, work out which are deals, and only
       then fetch the contacts those deals belong to. Every list is paged and
       every `IN` is chunked, so nothing is quietly cut off.
       ==================================================================== */

    /** COQL refuses an IN list longer than this. Not a tuning knob. */
    const IN_CHUNK = 100;
    const chunk = (list, size) => {
      const out = [];
      for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
      return out;
    };
    const quote = (v) => `'${String(v).replace(/'/g, '')}'`;

    /**
     * Page through a COQL select until it runs dry.
     *
     * `limit offset, size` is Zoho's pagination form — the same one
     * api/_routes/clients.js has always used, which is why the Client Dashboard
     * showed every client while the Beach did not.
     */
    const coqlAll = async (selectFields, fromAndWhere, pages = 10) => {
      const out = [];
      const size = 200;
      for (let page = 0; page < pages; page++) {
        const r = await zohoFetch('/crm/v2/coql', {
          method: 'POST',
          body: JSON.stringify({
            select_query: `select ${selectFields} ${fromAndWhere} limit ${page * size}, ${size}`
          })
        });
        const batch = (r && r.data) || [];
        out.push(...batch);
        if (batch.length < size) break;
      }
      return out;
    };

    // --- every project, paged ---
    //
    // The Beach shows the DEAL, so it selects the Proposal_* fields. The audit's
    // Purchase_Type / Contract_Value / Term / Monthly_Payment describe the
    // customer's existing system and have no business on a pipeline row.
    const projectFields = ['id', 'Contact', 'Project_Status'];
    // Optional because a field may not exist on this org's module yet. Dropped
    // ONE AT A TIME on failure rather than abandoning the whole set: an earlier
    // version retried once with none of them, so a single missing column cost
    // the Pipeline its install dates and its equipment.
    let optional = [
      'Sales_Stage', 'Proposal_Purchase_Type', 'Proposal_Contract_Value',
      'Proposal_Term', 'Proposal_Monthly_Payment', 'Proposal_Lender',
      'Proposal_Date', 'Install_Date', 'PTO_Date', 'Battery_Install_Date',
      'System_Size_kW', 'Battery_Capacity_kWh', 'Battery_Manufacturer',
      'Number_of_Modules', 'Panel_Model', 'Utility_Provider', 'NEM_Version'
    ];

    let projects = [];
    /**
     * Whether the CRM read actually worked.
     *
     * Reported to the client, because "no deals" and "the query failed" looked
     * identical from the browser and that is what made this bug survive. An
     * empty Beach now says which it is.
     */
    let sourceError = null;

    for (let attempt = 0; attempt <= optional.length; attempt++) {
      try {
        projects = await coqlAll(
          [...projectFields, ...optional].join(', '),
          'from Solar_Projects where id is not null'
        );
        break;
      } catch (e) {
        const msg = e.message || '';
        const bad = optional.find((f) => msg.includes(f));
        if (bad) { optional = optional.filter((f) => f !== bad); continue; }
        // A real failure. Say so rather than presenting an empty book as fact.
        projects = [];
        sourceError = msg;
        break;
      }
    }

    // --- every saved proposal ---
    // One read, unfiltered: the split inside each proposal is what decides whose
    // deal it is, and that cannot be expressed as a Zoho query.
    const proposals = {};
    if (SUPABASE_URL && SERVICE_KEY) {
      try {
        // Explicit limit: PostgREST caps a response on its own and a silently
        // truncated list is exactly the failure this whole route just had.
        const rows = await sbFetch(
          '/client_data?select=contact_id,proposal&proposal=not.is.null&limit=2000'
        );
        for (const row of rows || []) {
          if (row.proposal) proposals[row.contact_id] = row.proposal;
        }
      } catch { /* proposals are an enrichment, not a requirement */ }
    }

    /* --------------------------------------------------------------------
       WHICH OF THESE ARE ACTUALLY DEALS

       Done before any contact is fetched, because it removes almost all of
       them. See tideFor: a bulk-imported service client carrying
       Project_Status "PTO-Approved" and nothing else was never sold by anybody
       here, and has no commission and no contract value to show.
       -------------------------------------------------------------------- */
    const contactIdOf = (project) =>
      (project.Contact && (project.Contact.id || project.Contact)) || null;

    const dealProjects = [];
    const wanted = new Set();
    for (const project of projects) {
      const contactId = contactIdOf(project);
      if (!contactId) continue;
      if (!tideFor(project, proposals[contactId] || null)) continue;
      dealProjects.push(project);
      wanted.add(String(contactId));
    }
    // A proposal saved against a contact with no project row still counts.
    for (const contactId of Object.keys(proposals)) wanted.add(String(contactId));

    // --- the contacts those deals belong to, chunked ---
    let contacts = [];
    const ids = [...wanted];
    for (const group of chunk(ids, IN_CHUNK)) {
      try {
        contacts.push(...await coqlAll(
          'id, Full_Name, Email, Created_By_Rep, Last_Activity_Time',
          `from Contacts where id in (${group.map(quote).join(',')})`
        ));
      } catch (e) {
        // One bad chunk must not cost the others.
        sourceError = sourceError || e.message;
      }
    }
    const byId = Object.fromEntries(contacts.map((c) => [c.id, c]));

    /* --------------------------------------------------------------------
       WHOSE DEAL IS IT

       Created_By_Rep holds a mixture: an email on records this app created, a
       display name ("David West") on the bulk import, and null on the oldest
       rows. So ownership cannot be matched with a string compare, which is also
       why `where Created_By_Rep = 'kenson@…'` returned nothing for a rep whose
       records say "Kenson Manassero".

       identityOf folds both spellings onto the roster's email. A value that
       matches no recruit is kept as itself, lowercased, so an unknown owner is
       still consistently one owner rather than several.
       -------------------------------------------------------------------- */
    const identityOf = (value) => {
      if (!value) return null;
      const raw = String(value).trim();
      if (!raw) return null;
      const lower = raw.toLowerCase();
      if (rosterByEmail.has(lower)) return lower;
      const byName = rosterByName.get(lower);
      if (byName) return byName;
      return lower;
    };

    /**
     * Is this deal in the requested rep's book?
     *
     * Ownership OR having set it. A builder does not own the contact — the
     * engineer who closed it does — so scoping on ownership alone hid a setter's
     * own deals from their own Beach, which is precisely the money they most
     * want to see. It also made an admin selecting a setter get an empty screen.
     */
    const inScope = (contact, proposal) => {
      if (!scopeTo) return true;                 // Everyone
      const owner = identityOf(contact && contact.Created_By_Rep);
      if (owner && owner === scopeTo) return true;
      const b = builderOf(proposal && proposal.internal);
      return !!(b && b.email && b.email === scopeTo);
    };

    // --- assemble ---
    const deals = [];
    const seen = new Set();

    for (const project of dealProjects) {
      const contactId = contactIdOf(project);
      const contact = byId[contactId];
      const proposal = proposals[contactId] || null;
      const tide = tideFor(project, proposal);
      if (!tide) continue;
      if (!inScope(contact, proposal)) continue;
      seen.add(String(contactId));
      /**
       * WHOSE SHARE IS "mine"?
       *
       * The rep whose book is being looked at, NOT the person looking. An admin
       * viewing Kenson's Beach was getting the seat computed against their own
       * email, so a deal Kenson SET showed the closer's half under Kenson's
       * name — the opposite of the question being asked.
       */
      const comm = commissionFor(proposal, seatEmail, { isAdmin, isManager });
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
        /**
         * WHO SET IT, sent to the row so the Pipeline editor can show it.
         *
         * These were missing, and their absence was a money bug rather than a
         * cosmetic one. EditRow seeded its "Set by" control from
         * `deal.builderName`, which was always undefined, so every deal opened
         * showing "No setter — self-gen" however it was actually saved — and
         * saving the row then sent that empty value on, clearing the builder and
         * flipping the deal to self-gen. Correcting an install date silently
         * took a builder's half of the commission away.
         */
        builderRecruitId: comm.builderRecruitId || null,
        builderName: comm.builderName || null,
        builderEmail: comm.builderEmail || null,
        proposalDate: (proposal && proposal.createdAt) || project.Proposal_Date || null,
        projectStatus: project.Project_Status || null,
        rep: (contact && contact.Created_By_Rep) || null,

        // ---- Pipeline columns ----
        // Sold is when a deal reached a signed stage, which the proposal knows
        // and the project does not; the CRM's Proposal_Date is the fallback.
        soldDate: (proposal && proposal.stepsUpdatedAt && proposal.stage === 'Project')
          ? proposal.stepsUpdatedAt
          : (project.Proposal_Date || null),
        /**
         * TWO INSTALL DATES, and they are not interchangeable.
         *
         * `installDate` is when THIS DEAL goes in — Battery_Install_Date. No
         * fallback to Install_Date any more: that is the existing array's
         * turn-on date, so falling back printed a date from years ago in a
         * column headed "Install" on a deal that has not been scheduled.
         *
         * `originalInstallDate` is that existing turn-on date, carried
         * separately and shown read-only, because it is an audit input.
         */
        installDate: project.Battery_Install_Date || null,
        originalInstallDate: project.Install_Date || null,
        ptoDate: project.PTO_Date || null,
        lastContact: (contact && contact.Last_Activity_Time) || null,
        // Equipment: the saved proposal is what was SOLD, the project is what
        // is on the roof. For a pipeline row the sold system is the answer,
        // with the installed record as fallback for older jobs.
        battery: batteryLabel(proposal, project),
        batteryKwh: (proposal && proposal.system && proposal.system.usableKwh)
          || project.Battery_Capacity_kWh || 0,
        /**
         * TWO DIFFERENT SOLAR FIGURES, kept apart.
         *
         * `solarKw` is the array already on the roof — a Solar_Project field,
         * and the basis of the whole audit. `addedKw` is what THIS DEAL puts
         * up, which only the saved proposal knows. Collapsing them into one
         * number is what made an 8.8 kW add-on onto a 4 kW roof show in the
         * pipeline as a 4 kW job.
         */
        solarKw: project.System_Size_kW || 0,
        addedKw: (proposal && proposal.solar && proposal.solar.addedKw) || 0,
        addedKwhPerYear:
          (proposal && proposal.solar && proposal.solar.annualProductionKwh) || 0,
        // Panels being ADDED where the proposal says so, else what is installed.
        panels: (proposal && proposal.solar && proposal.solar.panels)
          || project.Number_of_Modules || 0,
        panelModel: project.Panel_Model || null,
        utility: project.Utility_Provider || null,
        nemVersion: project.NEM_Version || null
      });
    }

    // A proposal saved against a contact with no project row still counts.
    for (const [contactId, proposal] of Object.entries(proposals)) {
      if (seen.has(String(contactId)) || !byId[contactId]) continue;
      if (!inScope(byId[contactId], proposal)) continue;
      const comm = commissionFor(proposal, seatEmail, { isAdmin, isManager });
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
        /**
         * WHO SET IT, sent to the row so the Pipeline editor can show it.
         *
         * These were missing, and their absence was a money bug rather than a
         * cosmetic one. EditRow seeded its "Set by" control from
         * `deal.builderName`, which was always undefined, so every deal opened
         * showing "No setter — self-gen" however it was actually saved — and
         * saving the row then sent that empty value on, clearing the builder and
         * flipping the deal to self-gen. Correcting an install date silently
         * took a builder's half of the commission away.
         */
        builderRecruitId: comm.builderRecruitId || null,
        builderName: comm.builderName || null,
        builderEmail: comm.builderEmail || null,
        proposalDate: proposal.createdAt || null,
        projectStatus: null,
        rep: byId[contactId].Created_By_Rep || null,
        soldDate: null,
        installDate: null,
        originalInstallDate: null,
        ptoDate: null,
        lastContact: byId[contactId].Last_Activity_Time || null,
        battery: batteryLabel(proposal, null),
        batteryKwh: (proposal.system && proposal.system.usableKwh) || 0,
        // No project row, so nothing is known about the existing roof.
        solarKw: 0,
        addedKw: (proposal.solar && proposal.solar.addedKw) || 0,
        addedKwhPerYear: (proposal.solar && proposal.solar.annualProductionKwh) || 0,
        panels: (proposal.solar && proposal.solar.panels) || 0,
        panelModel: (proposal.solar && proposal.solar.panelModel) || null,
        utility: null,
        nemVersion: null
      });
    }

    deals.sort((a, b) => (b.proposalDate || '').localeCompare(a.proposalDate || ''));

    /* --------------------------------------------------------------------
       THE REP LIST — admins only.

       Every hired recruit, plus anyone who actually owns or set a deal even if
       the roster does not call them active. Objects rather than bare strings, so
       the dropdown can show a name and send an email: the old list sent whatever
       string sat in Created_By_Rep, which is why selecting "David West" and
       selecting "davidgwest17@gmail.com" behaved like two different people.

       A REP GETS AN EMPTY LIST. Not a filtered one — an empty one. There is
       nothing for them to choose between, and a list of their colleagues'
       addresses is not theirs to have.
       -------------------------------------------------------------------- */
    let reps = [];
    if (isAdmin) {
      const byEmail = new Map();
      for (const entry of roster) {
        if (entry.active) byEmail.set(entry.email, { ...entry, hasDeals: false });
      }
      // Anyone carrying deals belongs on the list whatever their roster status:
      // the book is the truth about who has sold something.
      const owners = new Set();
      for (const c of contacts) {
        const id = identityOf(c.Created_By_Rep);
        if (id) owners.add(id);
      }
      for (const proposal of Object.values(proposals)) {
        const b = builderOf(proposal && proposal.internal);
        if (b && b.email) owners.add(b.email);
      }
      for (const email of owners) {
        const known = rosterByEmail.get(email);
        const existing = byEmail.get(email);
        byEmail.set(email, {
          email,
          name: (known && known.name) || (existing && existing.name) || email,
          status: (known && known.status) || null,
          role: (known && known.role) || null,
          active: !!(known && known.active),
          hasDeals: true
        });
      }
      reps = [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    return res.status(200).json({
      ok: true,
      deals,
      reps,
      scope: scopeTo || 'all',
      role: user.role,
      /**
       * Said out loud, because an empty Beach used to be indistinguishable from
       * a failed CRM read — which is exactly how a query hitting COQL's
       * hundred-value IN cap passed for "this rep has no deals" until somebody
       * noticed the whole company had one.
       */
      sourceError
    });
  } catch (e) {
    return sendError(res, e);
  }
}
