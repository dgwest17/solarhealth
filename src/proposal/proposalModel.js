/**
 * FILE: src/proposal/proposalModel.js
 *
 * WHAT THE REP PRICED — captured so it can be reopened, reread, and honoured.
 *
 * The problem this solves: a rep configures a deal live in front of a
 * customer, doesn't close on the spot, and three days later nobody can say
 * what was actually quoted. The customer remembers a number, the rep
 * remembers a different one, and the deal dies in the gap.
 *
 * ---------------------------------------------------------------------------
 * WHERE IT IS STORED, AND WHY IT IS SPLIT
 *
 * A proposal has two audiences with different needs, so it is written twice:
 *
 *   SUPABASE (client_data.proposal) — the FULL object. Every input, including
 *   the ones nobody will ever report on: which adders were ticked, the
 *   federal percentage chosen, the savings override the rep typed. This is
 *   what lets a rep reopen the tool and see exactly the screen the customer
 *   saw. It is one JSON blob, so adding a field later costs nothing.
 *
 *   ZOHO (Solar_Projects) — only the SUMMARY: the figures Dave needs to sort,
 *   filter and report on. Roughly a dozen values, six of which already have
 *   fields.
 *
 * The alternative — every field in Zoho — would mean ~20 new custom fields,
 * most of which exist only to be written and never queried, and each of which
 * is a migration when the pricing model changes. The split keeps the CRM the
 * system of record for the things a CRM is good at, and puts the working
 * state where it can evolve.
 *
 * ---------------------------------------------------------------------------
 * ONE PROPOSAL PER PROJECT
 *
 * Only the chosen option is stored. If a rep shows loan, cash and lease side
 * by side and the customer picks the loan, the loan is what gets saved.
 * `supersedes` carries the id of the previous proposal so a re-quote leaves a
 * trail rather than silently overwriting — which is the cheap half of version
 * history, and enough until there is a reason for the rest.
 *
 * Used by: src/battery/BatteryStabilization.jsx (capture),
 *          src/proposal/CustomerProposal.jsx (render),
 *          api/save-proposal.js (persist).
 */

/** Schema version. Bump when a stored proposal needs migrating on read. */
export const PROPOSAL_VERSION = 2;

/**
 * THE TWO COMPANIES ON A PROPOSAL.
 *
 * `seller` is the org the rep works for — whose name is on the page and whose
 * relationship the customer thinks they have. `contractor` is who actually
 * holds the licence and puts steel on the roof, and is often a different
 * company the customer has never heard of.
 *
 * Both are DATA, never hard-coded strings. Earlier drafts baked in a default
 * company name, which is exactly the thing that turns up six months later
 * on a white-labelled proposal nobody meant to send.
 *
 * Empty placeholders, not invented values: a proposal with no licence number
 * should say so rather than show a plausible-looking fake.
 */
export const EMPTY_PARTY = {
  name: '', logoUrl: '', license: '', phone: '', email: '', website: '', tagline: ''
};

export const makeParty = (p = {}) => ({ ...EMPTY_PARTY, ...p });

/**
 * Sales stage.
 *
 * THESE STRINGS MUST MATCH THE Sales_Stage PICKLIST ON Solar_Projects EXACTLY.
 * Zoho rejects or drops a value that is not an option on the field, and it
 * does so quietly — the rest of the record saves, so a stage that never lands
 * looks like a deal sitting at the wrong step rather than like an error. They
 * were verified against the live picklist rather than assumed, after an
 * earlier version of this file carried longer wording ("Not Contacted/New",
 * "Converted to Project") that matched nothing on the field.
 *
 * Every comparison against a stage reads from here. Two of them used to be
 * bare string literals in the API handlers, which is the same class of bug as
 * this one at a different distance: the constant changes, the literal does
 * not, and the mismatch surfaces as a deal quietly stuck in the wrong tide.
 *
 * The FIELD is Sales_Stage rather than Lead_Status because Zoho fields are
 * per-module: the two would be separate fields whatever they were named, and
 * two different fields sharing one name is a coin flip every time someone
 * picks one from a dropdown in a report builder.
 */
export const SALES_STAGE = {
  NEW:        'New',
  MET:        'Met',
  CONVERTED:  'Project',
  INSTALLED:  'Installed',
  LOST:       'Lost'
};

/**
 * THE JOURNEY — one list, two audiences.
 *
 * The customer reads this as "what happens now, and how long does it take".
 * The rep reads the first few rows as a checklist. Modelling it as one list
 * rather than two avoids the obvious trap: a customer-facing timeline and a
 * rep-facing gate that drift out of step, so the proposal says Permitting
 * while the CRM still says Documents.
 *
 * `actionable` marks the steps someone can actually DO right now — those are
 * the ones that carry a link and that gate the move to Converted to Project.
 * Everything after Design/Engineering is work the installer does; it shows as
 * a timeline so the customer knows what they bought, but nobody ticks it from
 * a proposal page.
 *
 * `customerPresent` mirrors the Kinobi deck's star: the two appointments the
 * homeowner has to be home for. Worth saying out loud, because "how much of
 * my time does this take" is a real objection.
 */
export const PROJECT_STEPS = [
  {
    id: 'qualification',
    label: 'Qualification',
    blurb: 'A soft credit check to confirm your terms. Minutes, and it does not affect your score to check.',
    duration: 'Same day',
    appliesTo: ['loan', 'lease'],
    actionable: true,
    kind: 'external'
  },
  {
    id: 'paperwork',
    label: 'Paperwork',
    blurb: 'Your agreement and disclosures, signed electronically.',
    duration: 'Same day',
    appliesTo: ['loan', 'cash', 'lease'],
    actionable: true,
    kind: 'sign'
  },
  /**
   * INTAKE IS NOT THE SITE INSPECTION, and conflating them was wrong.
   *
   * Intake is the packet a rep sends the installer to get the job built — it is
   * finished at the kitchen table. The site inspection is a technician standing
   * on the roof, days later. Submitting the intake used to mark Site Inspection
   * complete, which told the customer somebody had visited their house when
   * nobody had, and told the installer a measurement existed that did not.
   *
   * So intake is its own step, it is what a rep actually completes, and it is
   * what gates the move to Project. The site inspection follows, is not
   * actionable from a proposal page, and is ticked when the visit happens.
   */
  {
    id: 'intake',
    label: 'Project Intake',
    blurb: 'Your details go to the installer so they can schedule and build.',
    duration: 'Same day',
    appliesTo: ['loan', 'cash', 'lease'],
    actionable: true,
    kind: 'form'
  },
  {
    id: 'site_inspection',
    label: 'Site Inspection',
    blurb: 'A technician measures your roof, panel and electrical service.',
    duration: '2–3 days',
    appliesTo: ['loan', 'cash', 'lease'],
    customerPresent: true
  },
  {
    id: 'design',
    label: 'Design / Engineering',
    blurb: 'Your system is laid out and stamped by an engineer.',
    duration: '2–3 days',
    appliesTo: ['loan', 'cash', 'lease']
  },
  {
    id: 'permitting',
    label: 'Permitting',
    blurb: 'Your city reviews and approves the plans. The step nobody controls.',
    duration: '1–5 weeks',
    appliesTo: ['loan', 'cash', 'lease']
  },
  {
    id: 'installation',
    label: 'Installation',
    blurb: 'Crews mount and wire the system. Usually one day for storage.',
    duration: '1 day–1 week',
    appliesTo: ['loan', 'cash', 'lease'],
    customerPresent: true
  },
  {
    id: 'inspection',
    label: 'Inspection',
    blurb: 'The city signs off on the finished work.',
    duration: '1–2 weeks',
    appliesTo: ['loan', 'cash', 'lease']
  },
  {
    id: 'pto',
    label: 'Permission to Operate',
    blurb: 'Your utility gives the green light and the system switches on.',
    duration: '2–4 weeks',
    appliesTo: ['loan', 'cash', 'lease']
  }
];

export const STEP_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed'
};

/** Steps that apply to a purchase type — a cash deal skips qualification. */
export const stepsFor = (purchaseType) =>
  PROJECT_STEPS.filter((s) => s.appliesTo.includes(purchaseType));

/** The steps somebody can act on today — these carry links and gate the stage. */
export const actionableStepsFor = (purchaseType) =>
  stepsFor(purchaseType).filter((s) => s.actionable);

/**
 * Has the deal earned "Converted to Project"?
 *
 * Gated on the ACTIONABLE steps only. Waiting for Permission to Operate before
 * calling something a project would leave every signed, permitted, installed
 * job sitting at Met for two months.
 */
export const allStepsComplete = (purchaseType, stepStatus = {}) => {
  const steps = actionableStepsFor(purchaseType);
  if (!steps.length) return false;
  return steps.every((s) => stepStatus[s.id] === STEP_STATUS.COMPLETED);
};

/**
 * WHO SET THE DEAL — the one function that answers it.
 *
 * Reads a proposal's `internal` block and returns { recruitId, name, email } or
 * null for self-gen. Everything that needs to know — the Beach, Treasure, the
 * Pipeline, the CRM write — goes through here rather than reaching for
 * `internal.builderEmail` itself, so there is exactly one interpretation of the
 * stored shape.
 *
 * IT READS BOTH SHAPES ON PURPOSE. Proposals saved before the recruit id
 * existed have `builderName` and `builderEmail` and nothing else. Those are real
 * deals with real money attached, so the reader accommodates them instead of a
 * migration: a one-off backfill that missed a row would make somebody's
 * commission disappear, and nobody would find out until payday.
 */
export function builderOf(internal) {
  if (!internal) return null;
  const email = String(internal.builderEmail || '').trim().toLowerCase();
  const name = String(internal.builderName || '').trim();
  const recruitId = internal.builderRecruitId ? String(internal.builderRecruitId) : null;
  if (!email && !name && !recruitId) return null;
  return { recruitId, name, email: email || '' };
}

/**
 * Did one rep both set and close it?
 *
 * DERIVED, NEVER STORED AS AN INPUT. `selfGen` used to be passed in alongside
 * the builder, which meant a deal could arrive claiming to be self-gen while
 * carrying a builder — and then nobody could say who should have been paid.
 * The absence of a builder IS the flag, exactly as it is in the CRM.
 */
export const isSelfGen = (internal) => builderOf(internal) === null;

/**
 * Typical Southern California specific yield, kWh per kW of DC per year.
 *
 * Only used when the client has no existing system to measure against.
 */
export const DEFAULT_SPECIFIC_YIELD = 1550;

/**
 * How much a new array will make in a year, in kWh.
 *
 * DERIVED FROM THE CLIENT'S OWN ROOF WHERE POSSIBLE. Their existing system's
 * production per kW already contains everything a generic constant cannot know
 * about this address: the azimuth, the pitch, the shading from the neighbour's
 * eucalyptus, the marine layer. New panels on the same roof will behave far
 * more like the old ones than like a state average.
 *
 * CLAMPED, because the input it divides is not trustworthy at the edges.
 * `annualProduction` on a Solar_Project may be the original nameplate estimate
 * or a current, degraded figure — the field is used both ways — and a client
 * who typed their monthly average into an annual box produces a yield of 130.
 * Multiplying an added array by that gives a production figure the customer
 * will compare against their own bill and disbelieve, which costs more than an
 * approximation does. Outside the plausible band the site's own number is
 * discarded for the default.
 *
 * Returns whole kWh — a decimal place on an annual production estimate implies
 * a precision that is not there.
 */
export function estimateAddedProduction({
  addedKw = 0,
  existingKw = 0,
  existingAnnualKwh = 0
} = {}) {
  const kw = Number(addedKw) || 0;
  if (kw <= 0) return 0;

  const exKw = Number(existingKw) || 0;
  const exKwh = Number(existingAnnualKwh) || 0;
  const measured = exKw > 0 && exKwh > 0 ? exKwh / exKw : 0;
  // 1,250 is about as low as a working California array gets; 1,900 is about as
  // high as one gets. Anything outside that is a data-entry artefact.
  const yieldPerKw = measured >= 1250 && measured <= 1900 ? measured : DEFAULT_SPECIFIC_YIELD;

  return Math.round(kw * yieldPerKw);
}

/**
 * Build a proposal from the live pricing state.
 *
 * Takes the objects the pricing UI already has rather than a long argument
 * list, so adding an input to the pricing panel does not mean rewriting this
 * signature.
 *
 * @param {object} o
 * @param {object} o.price       Output of priceBattery().
 * @param {object} o.projection  Output of projectTwentyYear().
 * @param {object} o.inputs      The audit inputs (system, utility, NEM).
 * @param {object} o.battery     { kwhPerBattery, count, totalKwh }
 * @param {object} o.financing   { mode, lenderId, lenderName, termYears, apr, escalator, leasePayment }
 * @param {object} o.bill        { monthlyBill, connectionFee, monthlySavings, escalation }
 * @param {object} o.solar       { adding, panels, wattsPerPanel, annualProductionKwh, nonExport }
 * @param {object} o.parties     { seller, contractor }
 * @param {object} o.meta        { contactId, projectId, repEmail, clientName, supersedes }
 */
export function buildProposal({
  price, projection, inputs = {}, battery = {}, financing = {},
  bill = {}, solar = null, parties = {}, meta = {}, commission = null
} = {}) {
  const now = new Date();
  const mode = financing.mode || 'loan';

  const monthlyPayment =
    mode === 'lease' ? (Number(financing.leasePayment) || 0)
    : mode === 'cash' ? 0
    : (price ? price.monthlyPayment : 0);

  return {
    version: PROPOSAL_VERSION,
    id: `prop_${now.getTime()}`,
    supersedes: meta.supersedes || null,
    createdAt: now.toISOString(),
    createdBy: meta.repEmail || null,

    client: {
      contactId: meta.contactId || null,
      projectId: meta.projectId || null,
      name: meta.clientName || null
    },

    // Whose names appear on the page. Both stored with the proposal so an old
    // proposal still renders correctly after the org changes installers.
    parties: {
      seller: makeParty(parties.seller),
      contractor: makeParty(parties.contractor)
    },

    // ---- what they're buying ----
    system: {
      // What the customer is actually getting, by name. "27 kWh" tells them
      // nothing they can look up or compare; "Tesla Powerwall 3 + DC Expansion
      // Pack" is the thing they will search for that evening.
      make:  battery.make || '',
      model: battery.model || '',
      modelId: battery.modelId || '',
      baseKwh: Number(battery.baseKwh) || Number(battery.totalKwh) || 0,
      usableKwh: Number(battery.totalKwh) || 0,
      // Rebate-eligible capacity, which is lower than usable whenever a DC
      // expansion is in the system. Carried so the proposal's rebate line can
      // be reconciled against the kWh without looking like an error.
      rebateKwh: battery.rebateKwh != null ? Number(battery.rebateKwh) : (Number(battery.totalKwh) || 0),
      rebateEligible: battery.rebateEligible !== false,
      units: Array.isArray(battery.units) ? battery.units : [],
      panelsAdded: price && price.commission ? price.commission.addedPanels : 0
    },

    // ---- how they're paying ----
    financing: {
      purchaseType: mode,                 // loan | cash | lease
      lenderId: financing.lenderId || null,
      lenderName: financing.lenderName || null,
      termYears: mode === 'cash' ? 0 : (Number(financing.termYears) || 0),
      apr: mode === 'lease' ? null : (financing.apr != null ? Number(financing.apr) : null),
      escalatorPct: mode === 'lease' ? (Number(financing.escalator) || 0) : null,
      monthlyPayment,
      dailyEquivalent: monthlyPayment ? (monthlyPayment * 12) / 365 : 0,
      prepaymentPenalty: !!financing.prepaymentPenalty
    },

    // ---- the price stack, in the order it is presented ----
    pricing: price ? {
      contractValue: price.base,
      // `cost` stays in the stored proposal — the rep's Breakdown needs it and
      // so does the contractor handoff. The CUSTOMER page renders these as an
      // included-items list without money; see CustomerProposal.
      adders: price.adders.lines.map((l) => ({
        id: l.id, label: l.label, cost: l.cost, units: l.units,
        kind: l.kind || null, addedKwh: l.addedKwh || null
      })),
      addersTotal: price.adders.total,
      contractWithAdders: price.contract,
      federalPct: price.fedPct,
      federalAmount: Math.round(price.federal),
      amountFinanced: Math.round(price.paymentBase),
      storageRebate: Math.round(price.rebate),
      rebateEligible: price.rebateEligible,
      netInvestment: Math.round(price.net),
      rebateAppliedToLoan: price.applyRebateToLoan,
      totalOfPayments: Math.round(price.totalOfPayments || 0)
    } : null,

    // ---- what it does for them ----
    savings: {
      monthlyBillToday: Number(bill.monthlyBill) || 0,
      connectionFee: Number(bill.connectionFee) || 0,
      estMonthlySavings: Number(bill.monthlySavings) || 0,
      rateEscalationPct: Number(bill.escalation) || 0,
      newMonthlyAllIn: projection && projection.rows[0] ? Math.round(projection.rows[0].batteryMonthly) : null,
      twentyYearUtility: projection ? Math.round(projection.totalUtility) : null,
      twentyYearWithBattery: projection ? Math.round(projection.totalBattery) : null,
      lifetimeDifference: projection ? Math.round(projection.lifetimeSavings) : null,
      breakEvenYear: projection ? projection.breakEvenYear : null
    },

    // ---- solar, only when solar is actually being added ----
    //
    // A battery-only deal has no solar block at all, rather than a block full
    // of zeroes — the proposal should not raise a subject that isn't on the
    // table. When solar IS added, the consequential question is export: on
    // NEM 1.0 or 2.0 a new exporting array restarts the clock on the client's
    // grandfathered tariff, which is usually worth far more than the extra
    // production. A non-export design keeps it.
    solar: solar && solar.adding ? (() => {
      const panels = Number(solar.panels) || 0;
      const watts = Number(solar.wattsPerPanel) || 0;
      const nonExport = !!solar.nonExport;
      const grandfathered = inputs.nemVersion === 'NEM1' || inputs.nemVersion === 'NEM2';
      const addedKw = Number(((panels * watts) / 1000).toFixed(2));
      // An explicit figure wins — a rep with a real design from the engineering
      // team should not have it overwritten by an estimate. Otherwise derive it
      // from this roof's own measured yield.
      const annualProductionKwh = Number(solar.annualProductionKwh) > 0
        ? Math.round(Number(solar.annualProductionKwh))
        : estimateAddedProduction({
            addedKw,
            existingKw: Number(inputs.systemSize) || 0,
            existingAnnualKwh: Number(inputs.annualProduction) || 0
          });
      return {
        adding: true,
        panels,
        wattsPerPanel: watts,
        addedKw,
        annualProductionKwh,
        nonExport,
        // The honest verdict, computed rather than asserted.
        keepsNemStatus: !grandfathered || nonExport,
        nemAtRisk: grandfathered && !nonExport,
        nemVersion: inputs.nemVersion || null
      };
    })() : null,

    // ---- context, so the proposal reads correctly months later ----
    context: {
      utility: inputs.utility || null,
      nemVersion: inputs.nemVersion || null,
      systemSizeKw: Number(inputs.systemSize) || null,
      annualProduction: Number(inputs.annualProduction) || null,
      annualUsage: Number(inputs.currentAnnualUsage) || null,
      // The 20-year rows, so the proposal's graph is the SAME data the rep
      // showed rather than a re-projection that could differ.
      projectionRows: projection ? projection.rows.map((r) => ({
        year: r.year,
        utilityMonthly: Math.round(r.utilityMonthly * 100) / 100,
        batteryMonthly: Math.round(r.batteryMonthly * 100) / 100,
        connectionFeeMonthly: Math.round(r.connectionFeeMonthly * 100) / 100,
        energyMonthly: Math.round(r.energyMonthly * 100) / 100,
        loanMonthly: Math.round(r.loanMonthly * 100) / 100,
        cumUtility: Math.round(r.cumUtility),
        cumBattery: Math.round(r.cumBattery),
        netPosition: Math.round(r.netPosition)
      })) : []
    },

    // ---- rep-only. Never rendered on anything the customer sees. ----
    /**
     * REP-FACING ONLY. Never rendered on the customer proposal.
     *
     * `commission` is a SNAPSHOT of the split as it stood when the deal was
     * saved — total, redline, every seat's percentage and amount, and who held
     * which seat. Snapshotted rather than recomputed because comp plans change,
     * and a percentage read live from settings would retroactively rewrite what
     * every past deal paid. Treasure reads this, not the current rate card.
     *
     * `commission.total` is the whole pool, which is what Zoho's Rep_Commission
     * field holds — not any one rep's share.
     */
    internal: commission ? {
      dealKind: commission.dealKind || 'battery',
      solarPanels: commission.solarPanels || 0,
      solarWatts: commission.solarWatts || 0,
      commission: commission.total,
      total: commission.total,
      redline: commission.redline,
      netSale: commission.netSale,
      dealerFeePct: commission.dealerFeePct,
      dealerFee: commission.dealerFee,
      customerContract: commission.customerContract,
      seat: commission.seat || null,

      /**
       * WHO SET IT — three properties describing one person, which is a record
       * rather than a duplication. Each does a job the others cannot:
       *
       *   builderRecruitId  points at the Recruit record. This is what the CRM's
       *                     Set_By lookup field is written from.
       *   builderEmail      routes the money. The Beach finds a builder's deals
       *                     with a jsonb filter on this exact path, so it is
       *                     load-bearing and cannot move.
       *   builderName       renders the split without a round-trip to Zoho, and
       *                     survives the person being deleted from the roster.
       *
       * All three are a SNAPSHOT, like the percentages beside them. A rep who
       * changes their email next year does not retroactively change who this
       * deal paid.
       */
      builderRecruitId: commission.builderRecruitId
        ? String(commission.builderRecruitId) : null,
      builderName: commission.builderName || null,
      builderEmail: (commission.builderEmail || '').trim().toLowerCase() || null,
      // Derived from the builder, never taken from the caller. See isSelfGen.
      selfGen: !(commission.builderEmail || commission.builderName
        || commission.builderRecruitId),

      rows: commission.rows || []
    } : (price && price.commission ? {
      // Legacy shape, for proposals saved before the split model existed.
      commission: price.commission.amount,
      total: price.commission.amount,
      floor: price.commission.floor,
      floorReason: price.commission.reason,
      rows: []
    } : null),

    // ---- where it is in the pipeline ----
    stage: SALES_STAGE.MET,
    steps: Object.fromEntries(
      stepsFor(mode).map((s) => [s.id, STEP_STATUS.NOT_STARTED])
    )
  };
}

/**
 * The subset written to Zoho — the figures worth sorting and reporting on.
 *
 * TWO SETS OF FINANCE FIELDS, AND WHY THIS PAYLOAD TOUCHES ONLY ONE.
 *
 * A Solar_Project carries two completely different deals:
 *
 *   THE AUDIT    what the customer already has. Purchase_Type, Contract_Value,
 *                Term, Escalator_or_Interest, Monthly_Payment,
 *                Finance_Provider. This is the existing system's paperwork —
 *                the loan they signed years ago, the lender they pay every
 *                month. It is the entire basis of the audit: every "here is
 *                what you are on now" figure reads from it.
 *
 *   THE PROPOSAL what we are selling them. Same six concepts, different deal,
 *                stored in the Proposal_* fields below.
 *
 * An earlier version of this function wrote the proposal into the audit's six
 * fields. Saving a proposal therefore destroyed the record of the customer's
 * existing loan — silently, unrecoverably, and precisely for the customers
 * furthest along the pipeline. Nothing downstream could detect it, because the
 * overwritten values were perfectly plausible.
 *
 * So: this payload never writes the audit six. They are read-only to the
 * proposal path. If the existing-system figures need correcting, that is an
 * audit edit and belongs on its own path, where it is visible as one.
 */
/**
 * What this deal adds, in one word the CRM can group by.
 *
 * Derived, never stored as a separate flag the rep sets. The deal's contents
 * already say what it is; a field somebody ticks is a field that ends up
 * disagreeing with the panels and the kWh sitting next to it.
 */
export function proposalScope(proposal) {
  if (!proposal) return null;
  const addingSolar = !!(proposal.solar && proposal.solar.adding !== false);
  const hasBattery = Number(
    (proposal.system && (proposal.system.usableKwh || proposal.system.baseKwh)) || 0
  ) > 0;
  if (addingSolar && hasBattery) return 'Solar + Battery';
  if (addingSolar) return 'Solar';
  return 'Battery';
}

export function toZohoSummary(proposal) {
  if (!proposal) return null;
  const f = proposal.financing || {};
  const p = proposal.pricing || {};
  const s = proposal.savings || {};
  const solar = proposal.solar || null;

  const out = {
    // --- the proposal's own finance terms ---
    // Never Purchase_Type / Contract_Value / Term / Escalator_or_Interest /
    // Monthly_Payment / Finance_Provider: those six are the existing system.
    Proposal_Purchase_Type: f.purchaseType === 'loan' ? 'Loan'
      : f.purchaseType === 'cash' ? 'Cash'
      : f.purchaseType === 'lease' ? 'Lease' : 'Other',
    Proposal_Contract_Value: p.contractWithAdders ?? null,
    Proposal_Term: f.termYears || null,
    Proposal_Rate: f.purchaseType === 'lease'
      ? (f.escalatorPct ?? null)
      : (f.apr != null ? Number((f.apr * 100).toFixed(2)) : null),
    // Currency with decimals, not the audit field's integer: a $98.63 payment
    // rounded to $99 is wrong on every statement the customer ever compares
    // it against.
    Proposal_Monthly_Payment: f.monthlyPayment != null
      ? Number(Number(f.monthlyPayment).toFixed(2))
      : null,
    Proposal_Lender: f.lenderName || null,

    // --- new fields (see ZOHO_FIELDS) ---
    Sales_Stage: proposal.stage,
    Proposal_Date: proposal.createdAt ? proposal.createdAt.slice(0, 10) : null,
    Net_Investment: p.netInvestment ?? null,
    Storage_Rebate: p.storageRebate ?? null,
    Est_Monthly_Savings: s.estMonthlySavings ?? null,

    /**
     * WHAT IS BEING ADDED, beyond a battery.
     *
     * Three fields for one purpose: telling an add-on deal apart from a battery
     * sale in a report, and by how much. Before these, a solar-plus-battery deal
     * was indistinguishable in the CRM from a battery — System_Size_kW describes
     * what is ALREADY on the roof, so a 4 kW client having 8.8 kW added still
     * read as a 4 kW job, and the pipeline's Solar column showed the old array.
     *
     * Zero rather than null on a battery-only deal. A summed report over a null
     * column and a summed report over zeroes give the same answer, but a filter
     * for "added nothing" only works if the value is there.
     */
    /**
     * WHO INSTALLS IT. Install_Company already exists on Solar_Projects and
     * client.js already reads it, so this fills a field the app was asking for
     * and nothing was writing rather than adding another one.
     */
    Install_Company: (proposal.parties && proposal.parties.contractor
      && proposal.parties.contractor.name) || null,

    Proposal_Scope: proposalScope(proposal),
    Added_Solar_kW: solar && solar.adding !== false ? (solar.addedKw ?? 0) : 0,
    Added_Annual_Production_kWh: solar && solar.adding !== false
      ? (solar.annualProductionKwh ?? 0)
      : 0,

    // The TOTAL pool, not any one rep's share. A manager reading this field
    // sees what the deal paid out altogether; who got what comes from the
    // seat fields below and the snapshot in Supabase.
    Rep_Commission: proposal.internal ? (proposal.internal.total ?? proposal.internal.commission) : null,
    // WHO SET IT. Empty means self-gen — the closer both set and closed it.
    // There is deliberately no Self_Gen field alongside this: two fields
    // encoding one fact is how they end up disagreeing, and then nobody can
    // say who should have been paid. Emptiness IS the flag.
    /**
     * WHO SET IT — ONE FIELD, a lookup at the Recruit record.
     *
     * This was two fields, Set_By_Rep (text name) and Set_By_Rep_Email. The
     * justification written here for that was already stale when it was
     * written: it said a lookup needs a record id we do not have, but RepPicker
     * reads the roster from Recruits and has had the id all along. So the CRM was
     * storing a name and an email that the Recruit record already holds, with
     * nothing keeping the copies in step.
     *
     * A lookup is strictly better than either text field. It points at the
     * person rather than describing them, so a rep who changes their email or
     * whose name was misspelt is still the same record; the CRM shows their
     * details on hover; and Set_By becomes usable in a related list on the
     * Recruit — every deal a builder set, without a report.
     *
     * NULL WHEN THERE IS NO BUILDER, and it must survive the null-strip in
     * save-proposal for that reason: a deal wrongly attributed to somebody has
     * to be clearable, or it keeps pointing at a rep who did not earn it.
     * Emptiness is still the self-gen flag; there is no Self_Gen field.
     */
    Set_By: (() => {
      const b = builderOf(proposal.internal);
      // Only an id can be written to a lookup. A builder recorded before the id
      // existed, or typed in while the roster was down, has no record to point
      // at — the split still routes on the email in Supabase, so the money is
      // fine and only the CRM link is absent.
      return b && b.recruitId ? { id: b.recruitId } : null;
    })(),
    Lender_Qualification: proposal.steps.qualification || null,
    Documents_Step: proposal.steps.paperwork || null,
    Intake_Step: proposal.steps.site_inspection || null
  };

  /**
   * WHOLE NUMBERS FOR THE CRM'S INTEGER FIELDS.
   *
   * Zoho refuses a decimal in an integer field and rejects the value. The
   * contract a customer signs is grossed up for the dealer fee — $20,000 at
   * 10% is $22,222.22 — so Proposal_Contract_Value was refused on every
   * financed deal, and the save reported it as a field that "doesn't exist".
   * Storage_Rebate goes the same way on any Tesla DC expansion, which earns a
   * half rebate: $3,375 + $1,687.50.
   *
   * Rounded here, once, from the field types in ZOHO_FIELDS, rather than with
   * a Math.round at each line — the next integer field added to that list is
   * then handled without anybody having to remember this.
   *
   * The full-precision figures stay on the proposal in Supabase; this is only
   * the CRM's reporting copy.
   */
  for (const key of ZOHO_INTEGER_FIELDS) {
    if (typeof out[key] === 'number' && Number.isFinite(out[key])) out[key] = Math.round(out[key]);
  }
  return out;
}

export const ZOHO_FIELDS = {
  /**
   * The existing system's finance terms. READ ONLY from the proposal path —
   * these describe the loan the customer already has, and the audit is built
   * entirely on them. Nothing in this app writes to them.
   */
  /**
   * Fields this app used to write and no longer does. Safe to delete in Zoho.
   * Listed rather than forgotten so a stale column does not sit on the layout
   * half-populated, looking authoritative.
   */
  retired: [
    { api: 'Set_By_Rep',       replacedBy: 'Set_By' },
    { api: 'Set_By_Rep_Email', replacedBy: 'Set_By' }
  ],
  existingSystemReadOnly: [
    'Purchase_Type', 'Contract_Value', 'Term',
    'Escalator_or_Interest', 'Monthly_Payment', 'Finance_Provider'
  ],
  toCreate: [
    // --- the proposal's finance terms, parallel to the audit six above ---
    { api: 'Proposal_Purchase_Type', type: 'picklist',
      values: ['Loan', 'Cash', 'Lease', 'Other'] },
    { api: 'Proposal_Contract_Value', type: 'integer',
      note: 'Integer on the live org, so the CRM copy is rounded to whole dollars.' },
    { api: 'Proposal_Term', type: 'integer', note: 'Years: 20, 15, 12 or 8.' },
    { api: 'Proposal_Rate', type: 'percent',
      note: 'APR for a loan; annual escalator for a lease.' },
    { api: 'Proposal_Monthly_Payment', type: 'currency', decimals: 2,
      note: 'Two decimals. The audit’s Monthly_Payment is an integer, which '
          + 'is why this is a separate field rather than a reused one.' },
    { api: 'Proposal_Lender', type: 'text' },

    { api: 'Sales_Stage', type: 'picklist',
      values: [SALES_STAGE.NEW, SALES_STAGE.MET, SALES_STAGE.CONVERTED, SALES_STAGE.INSTALLED],
      note: 'Same wording as Sales_Stage on Leads, so the two pipelines report together.' },
    { api: 'Proposal_Date', type: 'date' },
    { api: 'Net_Investment', type: 'currency' },
    { api: 'Storage_Rebate', type: 'integer',
      note: 'Integer on the live org. A DC-expansion half rebate ends in .50, so this is rounded.' },
    { api: 'Est_Monthly_Savings', type: 'currency' },

    /**
     * ADD-ON TRACKING. See toZohoSummary for why these three exist.
     *
     * Deliberately NOT written into System_Size_kW or Annual_Production: those
     * describe the system already on the roof and the entire audit reads from
     * them. Adding the new array into them would make the audit compare the
     * client's bill against production they do not have yet — the same class of
     * mistake as writing the proposal's loan over the existing loan.
     */
    { api: 'Proposal_Scope', type: 'picklist',
      values: ['Battery', 'Solar + Battery', 'Solar'],
      note: 'Derived from the deal contents, not set by hand. Filter on this to '
          + 'find add-on deals.' },
    { api: 'Added_Solar_kW', type: 'decimal', decimals: 2,
      note: 'NEW DC kW only — not the existing System_Size_kW.' },
    { api: 'Added_Annual_Production_kWh', type: 'integer',
      note: 'Estimated annual kWh the new array adds. Derived from the existing '
          + 'system’s own measured yield per kW where there is one, so it '
          + 'reflects this roof rather than a state average.' },

    /**
     * ONE seat field, not four.
     *
     * The engineer is already Created_By_Rep on the Contact. Captain and
     * Recruiter are overrides on production rather than facts about a deal.
     * Self-gen is the ABSENCE of a setter, so a boolean for it would be a
     * second field encoding one fact.
     *
     * Text rather than a lookup to Recruits: the app knows the builder by the
     * email a rep typed, and a lookup needs a record id. Resolving one would
     * add a Zoho round-trip and a failure mode to every save, for a link the
     * split does not depend on — the authoritative split lives with the
     * proposal in Supabase. Swap it for a lookup later if CRM reporting wants
     * the relation; nothing downstream reads these.
     */
    { api: 'Set_By', type: 'lookup', lookupModule: 'Recruits',
      replaces: ['Set_By_Rep', 'Set_By_Rep_Email'],
      note: 'Lookup to Recruits. EMPTY MEANS SELF-GEN. Replaces the two text '
          + 'fields: the Recruit record already holds the name and the email, so '
          + 'copying them onto the project stored the same fact three times with '
          + 'nothing keeping the copies in step. Named Set_By rather than '
          + 'Set_By_Rep because a field\u2019s type cannot be changed in Zoho — '
          + 'the old text field has to be deleted, and its API name stays '
          + 'reserved until the recycle bin is purged, so reusing it yields '
          + 'Set_By_Rep1 and the write silently goes nowhere.' },
    { api: 'Rep_Commission', type: 'currency',
      note: 'Rep-facing. Restrict field permissions if reps should not see each other’s.' },
    { api: 'Lender_Qualification', type: 'picklist',
      values: [STEP_STATUS.NOT_STARTED, STEP_STATUS.IN_PROGRESS, STEP_STATUS.COMPLETED] },
    { api: 'Documents_Step', type: 'picklist',
      values: [STEP_STATUS.NOT_STARTED, STEP_STATUS.IN_PROGRESS, STEP_STATUS.COMPLETED] },
    { api: 'Intake_Step', type: 'picklist',
      values: [STEP_STATUS.NOT_STARTED, STEP_STATUS.IN_PROGRESS, STEP_STATUS.COMPLETED] }
  ]
};

/** External links used by the project steps. */
export const STEP_LINKS = {
  qualification:
    'https://app.loanspq.com/pl/PersonalLoan.aspx?enc=Kw21Wblm1yxpjJabdoZaD2Kzjt-Fak0yNuYF5VJ7nIXFDMTDG82C-_lKA9ec5oXM0_q2w937NS-CWReN3i6jkbo3BPhZt6Sjw5tGD6uYd0RWXnX_JeJB8KMh4F0SCPEPCsJBpWEnFtZnQAUuxyRL9eLaoGGreAJ3nUwE_mmQbxzrWseea0QO17-Tr4RvlAGoH_WWNhkLv5_IRWp7HgplzqetDk7-RP595rP_OVHO1ex1ujymuGJuzPVOUJHMd9BXRlKjMZTqf8cI84IxyK1Lsv-ruoafhV2Uf5r2mY0emy5LYoHCXG7E1CS2uutUY14C4l9RHwagY66bUN2JtcwpsibDmLtlogrIHg_65GMwMY8'
};

/** A short human summary for a list row: "Loan · 20yr · $20,500 · $98.63/mo". */
export const proposalSummaryLine = (proposal) => {
  if (!proposal) return '';
  const f = proposal.financing || {};
  const p = proposal.pricing || {};
  const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
  const parts = [
    f.purchaseType === 'loan' ? 'Loan' : f.purchaseType === 'cash' ? 'Cash' : 'Lease'
  ];
  if (f.termYears) parts.push(`${f.termYears} yr`);
  if (p.contractWithAdders) parts.push(money(p.contractWithAdders));
  if (f.monthlyPayment) parts.push(`${money(f.monthlyPayment)}/mo`);
  return parts.join(' · ');
};

/**
 * The CRM fields whose Zoho type is integer, read from ZOHO_FIELDS so the list
 * and the spec cannot drift apart. Checked against the live org: Proposal_Term,
 * Proposal_Contract_Value, Storage_Rebate and Added_Annual_Production_kWh.
 */
export const ZOHO_INTEGER_FIELDS = ZOHO_FIELDS.toCreate
  .filter((f) => f.type === 'integer')
  .map((f) => f.api);
