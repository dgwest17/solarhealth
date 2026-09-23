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
    duration: '1–2 days',
    appliesTo: ['loan', 'cash', 'lease'],
    actionable: true,
    kind: 'sign'
  },
  {
    id: 'site_inspection',
    label: 'Site Inspection',
    blurb: 'A technician measures your roof, panel and electrical service.',
    duration: '2–3 days',
    appliesTo: ['loan', 'cash', 'lease'],
    actionable: true,
    customerPresent: true,
    kind: 'form'
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
  bill = {}, solar = null, parties = {}, meta = {}
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
      return {
        adding: true,
        panels,
        wattsPerPanel: watts,
        addedKw: Number(((panels * watts) / 1000).toFixed(2)),
        annualProductionKwh: Number(solar.annualProductionKwh) || 0,
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
    internal: price && price.commission ? {
      commission: price.commission.amount,
      floor: price.commission.floor,
      floorReason: price.commission.reason
    } : null,

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
export function toZohoSummary(proposal) {
  if (!proposal) return null;
  const f = proposal.financing || {};
  const p = proposal.pricing || {};
  const s = proposal.savings || {};

  return {
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
    Rep_Commission: proposal.internal ? proposal.internal.commission : null,
    Lender_Qualification: proposal.steps.qualification || null,
    Documents_Step: proposal.steps.paperwork || null,
    Intake_Step: proposal.steps.site_inspection || null
  };
}

/**
 * The Zoho fields this module writes, split into what already exists and what
 * has to be created. Surfaced as data so the app can tell a rep exactly which
 * field is missing when a save partially fails, instead of a generic error.
 */
export const ZOHO_FIELDS = {
  /**
   * The existing system's finance terms. READ ONLY from the proposal path —
   * these describe the loan the customer already has, and the audit is built
   * entirely on them. Nothing in this app writes to them.
   */
  existingSystemReadOnly: [
    'Purchase_Type', 'Contract_Value', 'Term',
    'Escalator_or_Interest', 'Monthly_Payment', 'Finance_Provider'
  ],
  toCreate: [
    // --- the proposal's finance terms, parallel to the audit six above ---
    { api: 'Proposal_Purchase_Type', type: 'picklist',
      values: ['Loan', 'Cash', 'Lease', 'Other'] },
    { api: 'Proposal_Contract_Value', type: 'currency' },
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
    { api: 'Storage_Rebate', type: 'currency' },
    { api: 'Est_Monthly_Savings', type: 'currency' },
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
