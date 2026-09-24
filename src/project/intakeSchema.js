/**
 * FILE: src/project/intakeSchema.js
 *
 * THE NEW PROJECT INTAKE FORM — modelled from the contractor's own workbook.
 *
 * This is NOT a homeowner questionnaire. It is the deal handoff: the packet a
 * rep sends the installer to get a job built, and it carries costs and the
 * rep's commission. An earlier version of this file asked homeowners about
 * roof age and gate codes, which was the wrong document entirely.
 *
 * ---------------------------------------------------------------------------
 * THE COST BUILD-UP, verified against the supplied workbook
 *
 *   Total Project Cost = services + commission + loan fees      exact match
 *   Net Total          = total - PE prepaid - SDCP/SGIP         exact match
 *
 * Worked from that sheet: services 11,880 + 12,300 + 1,000 = 25,180; plus
 * commission 9,134.12; plus loan fees 2,650.875 = 36,964.995. Net Total after
 * a 10,457.39709 PE prepaid = 26,507.59791. Both reconcile to the cent.
 *
 * THE LOAN FEE IS CIRCULAR, and worth understanding before trusting it. The
 * fee is 10% of a base, and that base is very nearly the Net Total — which
 * itself depends on the fee. The workbook appears to goal-seek it: its base
 * reads 26,508.75 where a clean solve gives 26,507.47, a $1.28 difference,
 * and the sheet carries a 0.005 residual cell that looks like a convergence
 * check left in.
 *
 * So `loanFeeBase` is an explicit, editable value here, defaulting to the
 * converged solve. A rep who needs to match the contractor's sheet penny for
 * penny can type their number in; nobody has to reverse-engineer a circular
 * reference under time pressure.
 *
 * THE DEALER FEE IS COMPUTED TWO WAYS, and the difference is the point.
 * The customer's contract carries 10% OF THE CONTRACT. The loan fee the
 * contractor bills is 10% OF THE NET. That gap — net x fee^2/(1-fee), or $222.22
 * on a $20,000 net sale at 10% — is money that stays in the deal, so the
 * commission on THIS FORM is higher than the commission everywhere else by
 * exactly that amount. Deliberately scoped to the handoff: the comp plan is
 * written against the net sale, and moving it in five places to gain $222 would
 * leave every screen disagreeing with every other.
 *
 * Used by: src/project/IntakeForm.jsx, api/intake.js
 */

import { intakeFeeSpread } from '../pricing/commission';

/**
 * The services table, in the workbook's own order. `id` is stable and is what
 * the generated spreadsheet and any later API integration key on; `label` is
 * the contractor's wording and is free to change.
 */
export const SERVICE_LINES = [
  { id: 'panels',              label: 'Panels' },
  { id: 'battery',             label: 'Battery' },
  { id: 'roof_repair',         label: 'Roof Repair' },
  { id: 'ev_charger',          label: 'EV Charger' },
  { id: 'circuit_relocation',  label: 'Circuit Relocation' },
  { id: 'service_upgrade',     label: 'Service Upgrade' },
  { id: 'ground_mount',        label: 'Ground Mount' },
  { id: 'restringing',         label: 'Restringing' },
  { id: 'other_electrical',    label: 'Other Electrical' }
];

/** Documents the contractor requires alongside the form. */
export const REQUIRED_DOCUMENTS = [
  { id: 'contract',          label: 'Contract', required: true },
  { id: 'protection_guide',  label: 'Solar Consumer Protection Guide', required: true },
  { id: 'electrical_bill',   label: 'Electrical Bill', required: true,
    hint: 'A recent utility bill — this is the one that holds jobs up most often.' },
  { id: 'proposal',          label: 'Proposal', required: true,
    hint: 'Generated automatically from the saved proposal if you do not upload one.' }
];

/** Payment types, as the contractor's form words them. */
export const PAYMENT_TYPES = ['Cash', 'Loan', 'PPA'];

/** Default dealer/loan fee rate. Verified at 10% against the supplied sheet. */
export const DEFAULT_LOAN_FEE_RATE = 0.10;

/**
 * Solve the circular loan fee.
 *
 * The fee is a rate applied to a base that is itself (near enough) the net
 * total after the fee. Rearranged:
 *
 *   B = services + commission + rate*B - prepaid - rebate
 *   B(1 - rate) = services + commission - prepaid - rebate
 *
 * Returns the converged base. When the rate is 0 or 1 the expression has no
 * useful solution, so it falls back to the un-feed subtotal rather than
 * dividing by zero.
 */
export function solveLoanFeeBase({ services = 0, commission = 0, prepaid = 0, rebate = 0, rate = DEFAULT_LOAN_FEE_RATE }) {
  const r = Number(rate) || 0;
  const numerator = (Number(services) || 0) + (Number(commission) || 0)
    - (Number(prepaid) || 0) - (Number(rebate) || 0);
  if (r <= 0 || r >= 1) return Math.max(0, numerator);
  return Math.max(0, numerator / (1 - r));
}

/**
 * The whole cost stack for an intake.
 *
 * Every figure the contractor's form shows, derived in one place so the screen
 * and the generated spreadsheet cannot disagree.
 */
export function computeIntakeCosts(intake = {}) {
  const lines = intake.services || {};
  const servicesTotal = SERVICE_LINES.reduce(
    (a, s) => a + (Number(lines[s.id] && lines[s.id].cost) || 0), 0
  );

  const commission = Number(intake.commission) || 0;
  const prepaid = intake.prepaidLease ? (Number(intake.prepaidAmount) || 0) : 0;
  const rebate = Number(intake.rebateAmount) || 0;
  const rate = intake.loanFeeRate != null ? Number(intake.loanFeeRate) : DEFAULT_LOAN_FEE_RATE;

  // A loan fee only applies to financed paper. Cash and PPA carry none.
  const feeApplies = (intake.paymentType || 'Loan') === 'Loan';

  const base = !feeApplies ? 0
    : (intake.loanFeeBase != null && intake.loanFeeBase !== ''
        ? Number(intake.loanFeeBase)
        : solveLoanFeeBase({ services: servicesTotal, commission, prepaid, rebate, rate }));

  const loanFees = feeApplies ? base * rate : 0;
  const totalProjectCost = servicesTotal + commission + loanFees;
  const netTotal = totalProjectCost - prepaid - rebate;

  return {
    servicesTotal,
    commission,
    loanFeeRate: rate,
    loanFeeBase: base,
    loanFees,
    totalProjectCost,
    prepaid,
    rebate,
    netTotal,
    feeApplies
  };
}

/**
 * Pre-fill an intake from the saved proposal and the client record.
 *
 * Almost everything on the contractor's form is already known: the rep priced
 * it, so panels, battery, adders, financing and commission all exist. The rep
 * should be confirming and topping up, not retyping. Anything that cannot be
 * derived is left blank rather than guessed — a plausible wrong cost on a
 * handoff form is worse than an obvious gap.
 */
export function prefillIntake({ proposal = null, contact = null, repName = '', settings = null } = {}) {
  const f = (proposal && proposal.financing) || {};
  const p = (proposal && proposal.pricing) || {};
  const sys = (proposal && proposal.system) || {};
  const solar = (proposal && proposal.solar) || null;

  const services = {};
  for (const line of SERVICE_LINES) services[line.id] = { type: '', quantity: '', cost: '', notes: '' };

  if (solar && solar.panels) {
    services.panels = {
      type: solar.panelModel || '',
      quantity: solar.panels,
      cost: '',            // per-panel pricing is a contractor number, not ours
      notes: solar.nonExport ? 'Non-export design' : ''
    };
  }
  if (sys.usableKwh) {
    services.battery = {
      type: sys.model || '',
      quantity: sys.batteryCount || 1,
      cost: '',
      notes: `${sys.usableKwh} kWh usable`
    };
  }

  // Adders map onto the contractor's service lines where they correspond.
  const ADDER_TO_SERVICE = {
    mpu: 'service_upgrade',
    ev_wiring: 'ev_charger',
    subpanel: 'circuit_relocation',
    non_export: 'other_electrical'
  };
  for (const adder of (p.adders || [])) {
    const target = ADDER_TO_SERVICE[adder.id];
    if (!target) continue;
    services[target] = {
      type: adder.label,
      quantity: adder.units || 1,
      cost: adder.cost || '',
      notes: services[target].notes || ''
    };
  }

  const addr = contact
    ? [contact.Mailing_Street, contact.Mailing_City, contact.Mailing_State, contact.Mailing_Zip]
        .filter(Boolean).join(', ')
    : '';

  const paymentType = f.purchaseType === 'loan' ? 'Loan'
    : f.purchaseType === 'cash' ? 'Cash'
    : f.purchaseType === 'lease' ? 'PPA' : 'Loan';

  const feeSpread = intakeFeeSpread({
    netSale: (proposal && proposal.internal && proposal.internal.netSale) || 0,
    mode: paymentType === 'Loan' ? 'loan' : 'cash',
    dealerFeePct: (proposal && proposal.internal && proposal.internal.dealerFeePct) || 0
  });

  return {
    // --- customer ---
    customerName: (contact && contact.Full_Name) || (proposal && proposal.client && proposal.client.name) || '',
    customerPhone: (contact && contact.Phone) || '',
    customerEmail: (contact && contact.Email) || '',
    homeAddress: addr,

    // --- rep ---
    repName: repName || '',
    dateSubmitted: new Date().toISOString().slice(0, 10),

    // --- payment ---
    paymentType,
    financeCompany: f.lenderName || '',
    interestRate: f.apr != null ? f.apr : '',

    // --- project ---
    services,

    // --- money ---
    /**
     * COMMISSION ON THE HANDOFF IS HIGHER, and on purpose.
     *
     * The customer's contract carries 10% OF THE CONTRACT; the contractor bills
     * 10% OF THE NET. That difference stays in the deal, so it is added here —
     * and only here. Every other screen measures commission on the net sale,
     * because that is what the comp plan is written against.
     */
    commission: (() => {
      const base = (proposal && proposal.internal
        && (proposal.internal.total ?? proposal.internal.commission)) || 0;
      return base ? Math.round((base + feeSpread) * 100) / 100 : '';
    })(),
    commissionBase: (proposal && proposal.internal
      && (proposal.internal.total ?? proposal.internal.commission)) || '',
    commissionFeeSpread: feeSpread ? Math.round(feeSpread * 100) / 100 : 0,
    loanFeeRate: DEFAULT_LOAN_FEE_RATE,
    loanFeeBase: '',
    prepaidLease: false,
    prepaidAmount: '',
    rebateAmount: p.storageRebate || '',

    gatewayNote: '',
    documents: {}
  };
}

/**
 * What is still missing before this can be submitted.
 * Returned as a list rather than a boolean so the UI can point at each gap.
 */
export function validateIntake(intake = {}, costs = null) {
  const problems = [];
  if (!intake.customerName) problems.push('Customer name');
  if (!intake.homeAddress) problems.push('Home address');
  if (!intake.customerPhone && !intake.customerEmail) problems.push('A phone number or email');
  if (!intake.repName) problems.push('Sales rep name');
  if (!intake.paymentType) problems.push('Payment type');
  if (intake.paymentType === 'Loan' && !intake.financeCompany) problems.push('Finance company');

  const c = costs || computeIntakeCosts(intake);
  if (c.servicesTotal <= 0) problems.push('At least one service line with a cost');

  for (const doc of REQUIRED_DOCUMENTS) {
    if (doc.required && !(intake.documents && intake.documents[doc.id])) {
      problems.push(doc.label);
    }
  }
  return problems;
}
