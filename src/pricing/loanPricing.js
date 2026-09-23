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

/* ---------------------------------------------------------------------------
 * REP COMMISSION
 *
 * The floor is the lowest contract value the battery can be written at. Every
 * dollar above it is the rep's commission, so the commission slider and the
 * contract value are the same control seen from two ends.
 *
 * The floor moves with how the deal is paid for. Dealer-fee financing buys the
 * customer's rate down, and the cost of that buy-down sits inside the contract
 * value — so a deal that does not need it can be written lower. Cash needs no
 * buy-down at all, and the 8.49% paper needs much less than the 5.49%, which is
 * why both land on the same lower floor.
 *
 * These are rep-facing figures. Nothing here renders outside the hidden
 * Breakdown panel.
 * ------------------------------------------------------------------------- */

/** Floor on subsidised paper — the 5.49% product. */
export const COMMISSION_FLOOR_STANDARD = 16500;

/** Floor with no rate buy-down: cash, or the 8.49% / 20-year term. */
export const COMMISSION_FLOOR_UNSUBSIDISED = 15250;

/** APR at or above which the floor drops (the unsubsidised rate card). */
export const UNSUBSIDISED_APR = 0.0849;

/**
 * Added solar raises the floor, because the panels cost something to install
 * before anyone earns on them. Dave is setting the real scale later; until
 * then the adder's own price carries the whole increase and this stays at
 * zero, which is honest rather than a placeholder number nobody chose.
 */
export const COMMISSION_FLOOR_PER_ADDED_PANEL = 0;

/**
 * The floor for a given deal.
 *
 * @param {string} mode        'loan' | 'cash' | 'lease'
 * @param {object} termCard    { years, apr, minContractValue? }
 * @param {number} addedPanels Panels on the solar add-on, if any.
 */
export function commissionFloor({
  mode = 'loan',
  termCard = null,
  addedPanels = 0,
  floorStandard = COMMISSION_FLOOR_STANDARD,
  floorUnsubsidised = COMMISSION_FLOOR_UNSUBSIDISED,
  unsubsidisedApr = UNSUBSIDISED_APR,
  perAddedPanel = COMMISSION_FLOOR_PER_ADDED_PANEL
} = {}) {
  let base;
  let reason;

  // An explicit per-term floor from the rate card always wins — that is the
  // lever Dave uses when a lender changes terms.
  if (termCard && Number.isFinite(Number(termCard.minContractValue)) && mode !== 'cash') {
    base = Number(termCard.minContractValue);
    reason = `${termCard.years}-year rate card`;
  } else if (mode === 'cash') {
    base = floorUnsubsidised;
    reason = 'cash — no rate buy-down';
  } else if (termCard && Number(termCard.apr) >= unsubsidisedApr) {
    base = floorUnsubsidised;
    reason = 'unsubsidised rate';
  } else {
    base = floorStandard;
    reason = 'standard rate card';
  }

  const panelUplift = Math.max(0, Number(addedPanels) || 0) * (Number(perAddedPanel) || 0);
  return { floor: base + panelUplift, base, panelUplift, reason };
}

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
  { id: 'solar_add',  label: 'Solar add-on',              kind: 'solarPanels', amount: 500,
    unit: 'panels', minUnits: 4, maxUnits: 24,
    baselineAmount: 1000, baselineMaxUnits: 7,
    hint: 'Minimum 4 panels. A $1,000 baseline applies at 4-7 panels and drops away above 7.' },
  { id: 'non_export', label: 'Non-export system',         kind: 'flat',    amount: 1200,
    blocksRebate: true, hint: 'A non-exporting system is not eligible for the storage rebate.' },

  /* --------------------------- extra batteries ---------------------------
   * Additional packs are adders. They were briefly a parallel mechanism of
   * their own, which meant two places answered "what did the rep add to this
   * deal" — and two answers to one question is how the Breakdown and the
   * proposal end up disagreeing.
   *
   * `kind: 'battery'` carries what a flat adder cannot:
   *
   *   addsKwh        capacity the customer gets.
   *   rebateFactor   share of that capacity the rebate is actually paid on.
   *   makes          which manufacturer offers it, so a Tesla expansion pack
   *                  never appears under a FranklinWH configuration.
   *
   * THE REBATE FACTOR IS THE WHOLE REASON THIS IS NOT A FLAT ADDER. A second
   * Powerwall and a DC expansion add identical capacity; the program pays full
   * rebate on the first and half on the second. Collapse the two figures and
   * every expansion-pack deal quotes $1,687.50 the customer never receives.
   */
  { id: 'battery_tesla_pw3', label: 'Second Powerwall 3', kind: 'battery', amount: 11500,
    addsKwh: 13.5, rebateFactor: 1, makes: ['Tesla'], unit: 'packs',
    hint: 'A complete second unit with its own inverter. Full rebate on its capacity.' },
  { id: 'battery_tesla_dc', label: 'Tesla DC Expansion Pack', kind: 'battery', amount: 9500,
    addsKwh: 13.5, rebateFactor: 0.5, makes: ['Tesla'], unit: 'packs',
    hint: 'Storage only, off the first unit’s inverter. The program pays half the rebate on its capacity.' },
  { id: 'battery_enphase_10c', label: 'Additional IQ Battery 10C', kind: 'battery', amount: 9500,
    addsKwh: 9.5, rebateFactor: 1, makes: ['Enphase'], unit: 'batteries',
    hint: 'A further 10C pack. Full rebate on its capacity.' }
];

/** Adders that add storage, scoped to the pack's manufacturer. */
export const batteryAddersFor = (base, catalog = null) => {
  const list = Array.isArray(catalog) && catalog.length ? catalog : ADDERS;
  const make = (base && base.make) || '';
  return list.filter((a) => a.kind === 'battery'
    && (!a.makes || !a.makes.length || a.makes.includes(make)));
};

export const getAdder = (id) => ADDERS.find((a) => a.id === id) || null;

/**
 * SOLAR ADD-ON PRICING.
 *
 *   cost = panels x perPanel  +  baseline, where baseline applies only from
 *   `minUnits` through `baselineMaxUnits` and drops away above it.
 *
 * At the shipped numbers ($500/panel, $1,000 baseline through 7) that makes 8
 * panels cost $4,000 against 7 panels at $4,500 — the eighth panel is free and
 * then some. That is what the pricing says, so it is what this returns; the UI
 * points the cliff out at the slider rather than quietly smoothing it, because
 * a rep who knows about it can sell the eighth panel instead of the seventh.
 */
export function solarAddOnCost(adder, units) {
  if (!adder) return { cost: 0, panels: 0, perPanel: 0, baseline: 0, baselineApplies: false };
  const min = adder.minUnits || 0;
  const raw = Number(units) || 0;
  const panels = raw > 0 ? Math.max(min, raw) : 0;
  if (!panels) return { cost: 0, panels: 0, perPanel: adder.amount || 0, baseline: 0, baselineApplies: false };

  const perPanel = Number(adder.amount) || 0;
  const baselineAmount = Number(adder.baselineAmount) || 0;
  const baselineMax = Number(adder.baselineMaxUnits) || 0;
  const baselineApplies = baselineAmount > 0 && baselineMax > 0 && panels <= baselineMax;
  const baseline = baselineApplies ? baselineAmount : 0;

  return {
    panels,
    perPanel,
    baseline,
    baselineApplies,
    panelsCost: panels * perPanel,
    cost: panels * perPanel + baseline
  };
}

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
  if (adder.kind === 'battery') return rate * Math.max(0, Math.round(Number(sel.units) || 0));
  if (adder.kind === 'solarPanels') {
    return solarAddOnCost({ ...adder, amount: rate }, sel.units).cost;
  }
  const raw = Number(sel.units) || 0;
  const billable = Math.max(0, raw - (adder.freeUnits || 0));
  const floored = adder.minUnits && raw > 0 ? Math.max(billable, Math.max(0, adder.minUnits - (adder.freeUnits || 0))) : billable;
  return rate * floored;
}

/**
 * Total of all selected adders, plus whether any of them kills the rebate.
 *
 * `catalog` lets the org's edited adder list (Admin -> Platform Defaults) drive
 * pricing without this module knowing anything about where it came from. It
 * falls back to the shipped ADDERS, so a caller that has no settings still
 * prices correctly.
 */
export function sumAdders(selections = {}, catalog = null) {
  let total = 0;
  let blocksRebate = false;
  // Storage added by 'battery' adders, and the share of it the rebate is paid
  // on. Two figures because a DC expansion raises the first without fully
  // raising the second.
  let addedKwh = 0;
  let addedRebateKwh = 0;
  const lines = [];
  const list = Array.isArray(catalog) && catalog.length ? catalog : ADDERS;
  for (const adder of list) {
    const sel = selections[adder.id];
    if (!sel || !sel.on) continue;
    const cost = adderCost(adder, sel);
    if (adder.blocksRebate) blocksRebate = true;
    total += cost;
    const detail = adder.kind === 'solarPanels'
      ? solarAddOnCost({ ...adder, amount: (sel.amount != null && sel.amount !== '' ? Number(sel.amount) : adder.amount) }, sel.units)
      : null;
    let kwh = 0;
    if (adder.kind === 'battery') {
      const qty = Math.max(0, Math.round(Number(sel.units) || 0));
      kwh = (Number(adder.addsKwh) || 0) * qty;
      addedKwh += kwh;
      addedRebateKwh += kwh * (Number(adder.rebateFactor) ?? 1);
    }

    lines.push({
      id: adder.id, label: adder.label, cost,
      units: detail ? detail.panels : (sel.units || null),
      kind: adder.kind,
      addedKwh: kwh || null,
      detail,
      pending: !!adder.pending && !cost
    });
  }
  return {
    total, blocksRebate, lines, addedKwh, addedRebateKwh,
    /** Some added capacity earns less than full rebate — the UI says so. */
    hasPartialRebate: addedRebateKwh < addedKwh
  };
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
  adderCatalog = null,
  fedPct = FED_PCT_DEFAULT,
  usableKwh = 0,
  /**
   * Capacity of the BASE pack. Extra packs come in through adderSelections, so
   * this function reads their capacity and rebate share off the adder lines
   * rather than being told twice.
   */
  rebateEligible = true,
  rebatePerKwh = LOCAL_REBATE_PER_KWH,
  rebateCap = 10000,
  termYears = LOAN_TERMS_YEARS[0],
  applyRebateToLoan = false,
  apr = LOAN_APR,
  mode = 'loan',
  termCard = null,
  commissionSettings = null
} = {}) {
  const base = Number(contractValue) || 0;
  const adders = sumAdders(adderSelections, adderCatalog);

  // 1. Contract. Extra battery packs are adders, so they are already in
  //    adders.total — raising the contract and the federal deduction, and
  //    staying out of the commission base below, exactly as any other adder.
  const contract = base + adders.total;

  // 2. Federal
  const pct = Math.min(FED_PCT_MAX, Math.max(FED_PCT_MIN, Number(fedPct) || 0));
  const federal = contract * pct;

  // 3. Payment base — what the loan is written against
  const paymentBase = Math.max(0, contract - federal);

  // 4. Local rebate. Non-export forfeits it outright.
  const eligible = !!rebateEligible && !adders.blocksRebate;
  // Base pack capacity plus whatever the battery adders contribute, counting
  // each at its own rebate share. A DC expansion's 13.5 kWh lands here as
  // 6.75, which is the only reason these are two numbers and not one.
  const totalKwh = (Number(usableKwh) || 0) + (adders.addedKwh || 0);
  const payableKwh = (Number(usableKwh) || 0) + (adders.addedRebateKwh || 0);
  const rebateGross = eligible ? (Number(rebatePerKwh) || 0) * (Number(payableKwh) || 0) : 0;
  const rebate = rebateCap ? Math.min(rebateCap, rebateGross) : rebateGross;
  const rebateCapped = !!rebateCap && rebateGross > rebateCap;

  // 5. Net investment
  const net = Math.max(0, paymentBase - rebate);

  // ---- commission: everything the base contract carries above its floor ----
  const solarLine = adders.lines.find((l) => l.id === 'solar_add');
  const addedPanels = solarLine && solarLine.detail ? solarLine.detail.panels : 0;
  const floorInfo = commissionFloor({
    mode,
    termCard: termCard || { years: termYears, apr },
    addedPanels,
    ...(commissionSettings || {})
  });
  const commission = {
    ...floorInfo,
    addedPanels,
    // Measured against the BASE contract, not the adder-inflated one: adders
    // are pass-through cost, so loading a deal with a main-panel upgrade must
    // not read as commission the rep has not earned.
    contractValue: base,
    amount: Math.round(base - floorInfo.floor),
    belowFloor: base < floorInfo.floor
  };

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
    /** Capacity the rebate was actually calculated on. Below total capacity
     *  when a DC expansion is in the system — surfaced so the UI can say why
     *  the rebate is smaller than the kWh would suggest. */
    rebateKwh: payableKwh,
    /** Capacity including adder packs — what the customer actually gets. */
    totalKwh,
    addedKwh: adders.addedKwh || 0,
    hasPartialRebate: !!adders.hasPartialRebate,
    net,
    financed,
    termYears,
    apr,
    monthlyPayment: payment,
    dailyPayment: (payment * 12) / 365,
    totalOfPayments,
    totalInterest: Math.max(0, totalOfPayments - financed),
    applyRebateToLoan: !!applyRebateToLoan,
    // ---- rep-facing only ----
    commission,

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
 *
 * THE NEM CLIFF ("Sea Level Rise")
 *
 * Grandfathering ends 20 years after PTO. The day it does, exports that were
 * credited at or near retail drop to the successor tariff's avoided cost, and
 * a household that is still exporting takes a step increase in its bill that
 * never comes back. This is not gradual and it is not an escalation — it is a
 * cliff on a known date, which is why it gets its own marker rather than being
 * folded into the escalation rate.
 *
 * `nemCliffMonthlyAdder` is what that step costs per month, in today's dollars;
 * it escalates with everything else after it lands. A battery does not stop the
 * tariff change — it removes the exposure, because stored energy is consumed at
 * home instead of sold at avoided cost. `nemCliffBatteryShare` is the fraction
 * of that exposure a battery household still carries; 0 is the default and is
 * right for a pack sized to soak up the surplus.
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
  rebateCash = 0,
  nemCliffYear = null,
  nemCliffMonthlyAdder = 0,
  nemCliffBatteryShare = 0
} = {}) {
  const esc = (Number(escalationPct) || 0) / 100;
  const bill0 = Number(monthlyBillToday) || 0;
  const fee0 = Number(monthlyConnectionFee) || 0;
  const save0 = Number(monthlySavings) || 0;
  const rows = [];

  let cumUtility = 0;
  let cumBattery = 0;

  const cliffYear = Number.isFinite(Number(nemCliffYear)) && Number(nemCliffYear) > 0
    ? Math.ceil(Number(nemCliffYear))
    : null;
  const cliffAdder = Number(nemCliffMonthlyAdder) || 0;

  for (let y = 1; y <= horizonYears; y++) {
    const infl = Math.pow(1 + esc, y - 1);

    // The cliff lands once and stays, escalating with everything else.
    const cliffActive = cliffYear !== null && y >= cliffYear;
    const cliffNow = cliffActive ? cliffAdder * infl : 0;

    // No battery: the whole bill escalates, and carries the cliff in full.
    const utilityMonthly = bill0 * infl + cliffNow;

    // With a battery: savings escalate with rates (they are avoided rate), but
    // the bill cannot fall below the connection fee unless credits can offset
    // it — only NEM 1.0 allows that.
    const escalatedSavings = save0 * infl;
    const escalatedFee = fee0 * infl;
    const floor = creditsOffsetFees ? 0 : escalatedFee;
    // A battery household keeps only its residual share of the cliff.
    const batteryCliff = cliffNow * Math.min(1, Math.max(0, Number(nemCliffBatteryShare) || 0));
    const residualUtility = Math.max(
      floor,
      (bill0 * infl + batteryCliff) - escalatedSavings
    );
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
      // Split out for the stacked chart: fee floor, energy above it, payment.
      connectionFeeMonthly: escalatedFee,
      energyMonthly: Math.max(0, residualUtility - escalatedFee),
      utilityFeeMonthly: escalatedFee,
      utilityEnergyMonthly: Math.max(0, utilityMonthly - escalatedFee),
      cliffMonthly: cliffNow,
      cliffActive,
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
    cliffYear,
    cliffAdder,
    totalUtility: last ? last.cumUtility : 0,
    totalBattery: last ? last.cumBattery : 0,
    lifetimeSavings: last ? last.netPosition : 0,
    breakEvenYear: crossover ? crossover.year : null
  };
}
