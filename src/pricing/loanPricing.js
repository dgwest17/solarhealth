/**
 * FILE: src/pricing/loanPricing.js
 *
 * BATTERY LOAN PRICING — the money math behind "Stabilize Your Bill".
 *
 * Pure functions, no React. Everything the pricing UI shows is derived here so
 * the displayed payment and the Breakdown accordion can never disagree — the
 * failure mode that put a $1,889/yr gap between the battery tab and the
 * consultation report.
 *
 * ---------------------------------------------------------------------------
 * ORDER OF OPERATIONS (this order is load-bearing — do not reshuffle)
 *
 *   1. Contract value        = base + adders          (includes the dealer fee)
 *   2. Federal deduction     = contract x fedPct      (25-30%, default 30%)
 *   3. Payment base          = contract - federal     <-- LOAN IS SIZED HERE
 *   4. Local rebate (SDCP)   = $250 x usable kWh      (cash to the homeowner)
 *   5. Net investment        = payment base - rebate  (Breakdown only)
 *
 * The rebate sits BELOW the loan on purpose. It arrives months after funding,
 * so the payment is sized on step 3. If the homeowner elects to put the rebate
 * back into the loan, `applyRebateToLoan` re-sizes off step 5 instead — that is
 * the only case where the rebate touches the payment.
 *
 * ---------------------------------------------------------------------------
 * DEALER FEE
 *
 * The default contract value carries a 10% dealer fee inside it. It is a named
 * constant rather than a baked-in number because the fee changes as terms are
 * added, and when it does, only this line should move. It is never surfaced in
 * the UI — `grossBeforeDealerFee` exists for internal reconciliation only.
 *
 * Used by: src/battery/BatteryStabilization.jsx
 */

/** Dealer fee carried inside the contract value. Internal — never displayed. */
export const DEALER_FEE = 0.10;

/** Default installed contract value, dealer fee included. */
export const DEFAULT_CONTRACT_VALUE = 20500;

/** Fixed lending rate. Hidden from the customer-facing UI by design. */
export const LOAN_APR = 0.0549;

/** Selectable terms, in years. First entry is the default. */
export const LOAN_TERMS_YEARS = [20, 15, 12, 8];

/** Federal deduction bounds for the slider. */
export const FED_PCT_MIN = 0.25;
export const FED_PCT_MAX = 0.30;
export const FED_PCT_DEFAULT = 0.30;

/** Local storage rebate, $/kWh of USABLE capacity (SDCP standard tier). */
export const LOCAL_REBATE_PER_KWH = 250;

/**
 * Contract adders. `perUnit` items multiply by a quantity; `flat` items are on
 * or off. Conduit is billed per foot BEYOND the first 10 (included in base).
 *
 * Non-export is the consequential one: a non-exporting system cannot enrol in
 * SDCP, so selecting it zeroes the rebate everywhere downstream.
 */
export const ADDERS = [
  { id: 'subpanel',   label: 'Sub-panel',                 kind: 'flat',    amount: 1000 },
  { id: 'mpu',        label: 'Main panel upgrade',        kind: 'flat',    amount: 4000 },
  { id: 'ev_wiring',  label: 'EV charger wiring',         kind: 'flat',    amount: 700 },
  { id: 'conduit',    label: 'Conduit run',               kind: 'perUnit', amount: 20,
    unit: 'ft', freeUnits: 10, hint: 'First 10 ft included' },
  { id: 'solar_add',  label: 'Solar add-on',              kind: 'perUnit', amount: 0,
    unit: 'panels', minUnits: 4, pending: true,
    hint: 'Minimum 4 panels. Per-panel cost not yet set — enter it to price.' },
  { id: 'non_export', label: 'Non-export system',         kind: 'flat',    amount: 1200,
    blocksRebate: true, hint: 'A non-exporting system is not eligible for the storage rebate.' }
];

export const getAdder = (id) => ADDERS.find((a) => a.id === id) || null;

/**
 * Cost of one adder given its selection state.
 * `sel` is { on: bool, units?: number, amount?: number } — `amount` overrides
 * the catalogue price, which is how the solar add-on gets its per-panel cost
 * once Dave sets it.
 */
export function adderCost(adder, sel) {
  if (!adder || !sel || !sel.on) return 0;
  const rate = Number.isFinite(Number(sel.amount)) && sel.amount !== '' && sel.amount != null
    ? Number(sel.amount)
    : adder.amount;
  if (adder.kind === 'flat') return rate;
  const raw = Number(sel.units) || 0;
  const billable = Math.max(0, raw - (adder.freeUnits || 0));
  const floored = adder.minUnits && raw > 0 ? Math.max(billable, Math.max(0, adder.minUnits - (adder.freeUnits || 0))) : billable;
  return rate * floored;
}

/** Total of all selected adders, plus whether any of them kills the rebate. */
export function sumAdders(selections = {}) {
  let total = 0;
  let blocksRebate = false;
  const lines = [];
  for (const adder of ADDERS) {
    const sel = selections[adder.id];
    if (!sel || !sel.on) continue;
    const cost = adderCost(adder, sel);
    if (adder.blocksRebate) blocksRebate = true;
    total += cost;
    lines.push({ id: adder.id, label: adder.label, cost, units: sel.units || null, pending: !!adder.pending && !cost });
  }
  return { total, blocksRebate, lines };
}

/**
 * Standard amortised payment. Returns 0 for a zero or negative principal so a
 * fully-offset system shows $0/mo rather than NaN.
 */
export function monthlyPayment(principal, apr = LOAN_APR, termYears = 20) {
  const P = Number(principal) || 0;
  if (P <= 0) return 0;
  const n = Math.max(1, Math.round(termYears * 12));
  const r = (Number(apr) || 0) / 12;
  if (r === 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Full price stack for a battery deal.
 *
 * @param {object}  o
 * @param {number}  o.contractValue  Base contract before adders.
 * @param {object}  o.adderSelections
 * @param {number}  o.fedPct         0.25-0.30.
 * @param {number}  o.usableKwh      Usable capacity (drives the rebate).
 * @param {boolean} o.rebateEligible Program eligibility from the Eligibility tab.
 * @param {number}  o.rebatePerKwh
 * @param {number}  o.rebateCap      0 or falsy = uncapped.
 * @param {number}  o.termYears
 * @param {boolean} o.applyRebateToLoan  Roll the rebate into the financed amount.
 */
export function priceBattery({
  contractValue = DEFAULT_CONTRACT_VALUE,
  adderSelections = {},
  fedPct = FED_PCT_DEFAULT,
  usableKwh = 0,
  rebateEligible = true,
  rebatePerKwh = LOCAL_REBATE_PER_KWH,
  rebateCap = 10000,
  termYears = LOAN_TERMS_YEARS[0],
  applyRebateToLoan = false,
  apr = LOAN_APR
} = {}) {
  const base = Number(contractValue) || 0;
  const adders = sumAdders(adderSelections);

  // 1. Contract
  const contract = base + adders.total;

  // 2. Federal
  const pct = Math.min(FED_PCT_MAX, Math.max(FED_PCT_MIN, Number(fedPct) || 0));
  const federal = contract * pct;

  // 3. Payment base — what the loan is written against
  const paymentBase = Math.max(0, contract - federal);

  // 4. Local rebate. Non-export forfeits it outright.
  const eligible = !!rebateEligible && !adders.blocksRebate;
  const rebateGross = eligible ? (Number(rebatePerKwh) || 0) * (Number(usableKwh) || 0) : 0;
  const rebate = rebateCap ? Math.min(rebateCap, rebateGross) : rebateGross;
  const rebateCapped = !!rebateCap && rebateGross > rebateCap;

  // 5. Net investment
  const net = Math.max(0, paymentBase - rebate);

  const financed = applyRebateToLoan ? net : paymentBase;
  const payment = monthlyPayment(financed, apr, termYears);
  const totalOfPayments = payment * termYears * 12;

  return {
    base,
    adders,
    contract,
    fedPct: pct,
    federal,
    paymentBase,
    rebate,
    rebateGross,
    rebateCapped,
    rebateEligible: eligible,
    rebateBlockedByAdder: adders.blocksRebate,
    net,
    financed,
    termYears,
    apr,
    monthlyPayment: payment,
    dailyPayment: (payment * 12) / 365,
    totalOfPayments,
    totalInterest: Math.max(0, totalOfPayments - financed),
    applyRebateToLoan: !!applyRebateToLoan,
    // Internal reconciliation only — never rendered.
    grossBeforeDealerFee: contract * (1 - DEALER_FEE),
    dealerFeeAmount: contract * DEALER_FEE
  };
}

/**
 * Twenty-year side-by-side: stay on the utility, or add the battery.
 *
 * The horizon is fixed at 20 years even when a shorter loan term is chosen —
 * the whole point is showing what happens after the loan ends and the savings
 * keep running. A 12-year loan goes quiet in year 13 and the curve separates.
 *
 * Connection fees are modelled explicitly because they are the floor the bill
 * cannot go below: a battery can zero the energy charge and the homeowner still
 * pays to stay connected. Under NEM 2.0 and 3.0 export credits cannot offset
 * them at all, so they escalate untouched.
 *
 * @param {number} o.monthlyBillToday    Current all-in utility bill.
 * @param {number} o.monthlyConnectionFee
 * @param {number} o.monthlySavings      Estimated monthly savings from storage.
 * @param {number} o.escalationPct       Annual utility escalation, e.g. 8.
 * @param {boolean} o.creditsOffsetFees  True only on NEM 1.0.
 */
export function projectTwentyYear({
  monthlyBillToday = 0,
  monthlyConnectionFee = 0,
  monthlySavings = 0,
  monthlyPayment: pmt = 0,
  termYears = 20,
  escalationPct = 8,
  horizonYears = 20,
  creditsOffsetFees = false,
  rebateCash = 0
} = {}) {
  const esc = (Number(escalationPct) || 0) / 100;
  const bill0 = Number(monthlyBillToday) || 0;
  const fee0 = Number(monthlyConnectionFee) || 0;
  const save0 = Number(monthlySavings) || 0;
  const rows = [];

  let cumUtility = 0;
  let cumBattery = 0;

  for (let y = 1; y <= horizonYears; y++) {
    const infl = Math.pow(1 + esc, y - 1);

    // No battery: the whole bill escalates.
    const utilityMonthly = bill0 * infl;

    // With a battery: savings escalate with rates (they are avoided rate), but
    // the bill cannot fall below the connection fee unless credits can offset
    // it — only NEM 1.0 allows that.
    const escalatedSavings = save0 * infl;
    const escalatedFee = fee0 * infl;
    const floor = creditsOffsetFees ? 0 : escalatedFee;
    const residualUtility = Math.max(floor, utilityMonthly - escalatedSavings);
    const loanMonthly = y <= termYears ? pmt : 0;
    const batteryMonthly = residualUtility + loanMonthly;

    cumUtility += utilityMonthly * 12;
    cumBattery += batteryMonthly * 12;

    rows.push({
      year: y,
      utilityMonthly,
      utilityDaily: (utilityMonthly * 12) / 365,
      utilityYearly: utilityMonthly * 12,
      residualUtility,
      loanMonthly,
      batteryMonthly,
      batteryDaily: (batteryMonthly * 12) / 365,
      batteryYearly: batteryMonthly * 12,
      monthlyDelta: batteryMonthly - utilityMonthly,
      cumUtility,
      cumBattery,
      // Positive = ahead by adding the battery.
      netPosition: cumUtility - cumBattery + (Number(rebateCash) || 0),
      loanActive: y <= termYears
    });
  }

  const last = rows[rows.length - 1];
  // Strictly positive: a projection where nothing happens (no payment, no
  // savings) sits at exactly zero forever and must not report "break-even
  // in year 1".
  const crossover = rows.find((r) => r.netPosition > 0);

  return {
    rows,
    totalUtility: last ? last.cumUtility : 0,
    totalBattery: last ? last.cumBattery : 0,
    lifetimeSavings: last ? last.netPosition : 0,
    breakEvenYear: crossover ? crossover.year : null
  };
}
