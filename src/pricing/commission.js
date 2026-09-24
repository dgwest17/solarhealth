/**
 * FILE: src/pricing/commission.js
 *
 * WHO GETS PAID WHAT, AND WHY — the one place commission is decided.
 *
 * Everything that shows a commission figure reads from here: Deep Seas, the
 * Forecast planner, Treasure, and the manager's pipeline view. There is exactly
 * one derivation, because the failure mode is specific and expensive — a rep
 * seeing one number on the pricing screen and a different one in their Treasure
 * is a trust problem, not a rounding problem.
 *
 * ---------------------------------------------------------------------------
 * THE MODEL, IN ORDER
 *
 *   1. REDLINE          the non-commissionable base. $14,500 for a battery.
 *                       Below it, nobody earns anything.
 *
 *   2. NET SALE PRICE   what the rep writes the deal at, before any dealer fee.
 *                       This is the number the rep controls.
 *
 *   3. TOTAL COMMISSION = net sale − redline. The whole pool, all roles.
 *                       This is what Zoho's Rep_Commission field holds.
 *
 *   4. THE SPLIT        Builder 42 / Engineer 42 / Captain 12 / Recruiter 4.
 *                       Self-gen — one rep both builds and closes — takes the
 *                       combined 84, leaving Captain and Recruiter untouched.
 *
 *   5. CUSTOMER CONTRACT = net sale grossed up for the dealer fee on financed
 *                       paper. Cash carries no fee, so contract = net sale.
 *
 * ---------------------------------------------------------------------------
 * THE DEALER FEE IS A GROSS-UP, NOT A DEDUCTION, AND THE DIRECTION MATTERS
 *
 * A 10% dealer fee on a $20,000 net sale makes the customer's contract
 * $20,000 / (1 − 0.10) = $22,222.22 — not $22,000. The lender takes its 10%
 * OF THE CONTRACT, so the contract has to be large enough that what remains
 * after the fee is the $20,000 the company needs:
 *
 *   $22,222.22 × 10% = $2,222.22 fee, leaving exactly $20,000.
 *   $22,000.00 × 10% = $2,200.00 fee, leaving $19,800 — $200 short, every deal.
 *
 * Multiplying by 1.10 instead of dividing by 0.90 is the classic version of
 * this error and it always under-recovers.
 *
 * COMMISSION IS MEASURED ON THE NET SALE, NOT THE GROSSED-UP CONTRACT. The fee
 * is the lender's, not the company's margin, so paying commission on it would
 * pay reps out of money that left the building. A cash deal and a loan written
 * at the same net price therefore earn the same commission — the loan simply
 * costs the customer more.
 *
 * ---------------------------------------------------------------------------
 * TWO DEAL SHAPES, ONE TAIL
 *
 * A battery-only deal redlines at a flat $14,500 per pack. A solar deal builds
 * its redline up: basePPW x watts, plus $13,000 for the first battery, plus
 * adders. Both then behave identically — net sale minus redline is the pool,
 * the dealer fee grosses the contract up on financed paper, and the same four
 * seats split it.
 *
 * The battery figure differs between the two ($13,000 against $14,500) because
 * the deal shapes differ: a battery going in alongside panels shares a truck
 * roll, a permit and a crew day, and a standalone battery carries all of that
 * by itself. They are two separate settings so that moving one never silently
 * moves the other.
 *
 * Used by: src/battery/BatteryStabilization.jsx, src/beach/Forecast.jsx,
 *          src/beach/Treasure.jsx, api/_routes/beach.js
 */

/* ---------------------------------------------------------------------------
 * DEFAULTS — every one of these is overridable in Admin → Platform Defaults.
 * ------------------------------------------------------------------------- */

/** The roles a deal can pay, and their share of the pool. Must total 100. */
export const COMMISSION_ROLES = [
  { key: 'builder',   label: 'Builder',   alt: 'Setter',   pct: 42 },
  { key: 'engineer',  label: 'Engineer',  alt: 'Closer',   pct: 42 },
  { key: 'captain',   label: 'Captain',   alt: 'Manager',  pct: 12 },
  { key: 'recruiter', label: 'Recruiter', alt: '',         pct: 4  }
];

/** One rep who both set and closed it. Builder + Engineer, combined. */
export const SELF_GEN_PCT = 84;

/** Non-commissionable base, per battery. Cash and loan alike. */
export const BATTERY_REDLINE = 14500;

/** Dealer fee on financed paper. Grosses the contract UP — see the header. */
export const DEALER_FEE_PCT = 0.10;

/**
 * Solar base price per watt, by system size. The redline in $/W terms: margin
 * above it is commissionable. Tiers are panel COUNT, not kW, because that is
 * how the pricing is actually quoted.
 *
 * `extraAdder` on the smallest tier is a flat amount that also comes out
 * before commission.
 */
export const SOLAR_PPW_TIERS = [
  { minPanels: 11, maxPanels: Infinity, basePPW: 2.25, extraAdder: 0,
    note: '440 W Hyundai, 11 panels and up' },
  { minPanels: 8,  maxPanels: 10,       basePPW: 2.35, extraAdder: 0,
    note: '8–10 panel systems' },
  { minPanels: 4,  maxPanels: 7,        basePPW: 2.70, extraAdder: 1000,
    note: '4–7 panel systems, plus a $1,000 adder' }
];

/** Watts per panel, for turning a panel count into system watts. */
export const PANEL_WATTS = 440;

/**
 * Battery carve-out on a SOLAR deal. Distinct from BATTERY_REDLINE, and the
 * difference is an open question rather than a considered decision — see the
 * file header.
 */
export const SOLAR_FIRST_BATTERY_CARVE_OUT = 13000;

/* ---------------------------------------------------------------------------
 * THE SPLIT
 * ------------------------------------------------------------------------- */

/**
 * How a pool divides, given who is on the deal.
 *
 * @param {object}  o
 * @param {boolean} o.selfGen   One rep both built and closed it.
 * @param {Array}   o.roles     Role table; defaults to COMMISSION_ROLES.
 * @param {number}  o.selfGenPct
 * @returns {Array} [{ key, label, pct }] — always totalling 100 when the
 *                  configured table does.
 */
export function splitRows({ selfGen = false, roles = null, selfGenPct = null } = {}) {
  const table = (roles && roles.length) ? roles : COMMISSION_ROLES;
  if (!selfGen) return table.map((r) => ({ key: r.key, label: r.label, pct: Number(r.pct) || 0 }));

  const pct = selfGenPct != null ? Number(selfGenPct) : SELF_GEN_PCT;
  const keep = table.filter((r) => r.key !== 'builder' && r.key !== 'engineer');
  return [
    { key: 'self', label: 'Rep (self-gen)', pct },
    ...keep.map((r) => ({ key: r.key, label: r.label, pct: Number(r.pct) || 0 }))
  ];
}

/**
 * One person's share of a pool.
 *
 * A self-gen deal pays the combined rate to whoever holds BOTH seats, so
 * asking for 'builder' or 'engineer' on a self-gen deal returns the combined
 * figure rather than half of it. That is the whole point of the flag, and
 * getting it wrong under-pays a rep by half on their own best deals.
 */
export function shareFor(roleKey, { total = 0, selfGen = false, roles = null, selfGenPct = null } = {}) {
  const rows = splitRows({ selfGen, roles, selfGenPct });
  const key = String(roleKey || '').toLowerCase();
  const row = selfGen && (key === 'builder' || key === 'engineer' || key === 'self')
    ? rows.find((r) => r.key === 'self')
    : rows.find((r) => r.key === key);
  if (!row) return { pct: 0, amount: 0 };
  return { pct: row.pct, amount: (Number(total) || 0) * row.pct / 100 };
}

/* ---------------------------------------------------------------------------
 * BATTERY
 * ------------------------------------------------------------------------- */

/**
 * Commission and customer contract for a battery deal.
 *
 * @param {object}  o
 * @param {number}  o.netSale        What the rep is writing it at, pre-fee.
 * @param {number}  o.batteryCount   Redline multiplies by unit count.
 * @param {number}  o.redlinePerUnit
 * @param {string}  o.mode           'cash' | 'loan' | 'lease'
 * @param {number}  o.dealerFeePct   Applied on financed paper only.
 * @param {number}  o.addersCost     Pass-through equipment; not commissionable
 *                                   and not part of the redline, but it IS in
 *                                   the customer's contract.
 */
export function calcBatteryCommission({
  netSale = 0,
  batteryCount = 1,
  redlinePerUnit = BATTERY_REDLINE,
  mode = 'loan',
  dealerFeePct = DEALER_FEE_PCT,
  addersCost = 0,
  selfGen = false,
  roles = null,
  selfGenPct = null
} = {}) {
  const sale = Math.max(0, Number(netSale) || 0);
  const units = Math.max(1, Math.round(Number(batteryCount) || 1));
  const redline = (Number(redlinePerUnit) || 0) * units;
  const adders = Math.max(0, Number(addersCost) || 0);

  // The pool. Never negative: a deal written under the redline earns nothing
  // rather than owing something.
  const total = Math.max(0, sale - redline);
  const belowRedline = sale < redline;

  // Cash carries no dealer fee. Lease is handled by the lessor's own pricing,
  // so it is treated as fee-free here too until there is a reason not to.
  const feePct = mode === 'loan' ? Math.max(0, Math.min(0.9, Number(dealerFeePct) || 0)) : 0;

  // Gross-up, not mark-up. Dividing is what makes the fee come out whole.
  const grossedSale = feePct > 0 ? sale / (1 - feePct) : sale;
  const dealerFee = grossedSale - sale;

  // The customer's contract: the grossed sale plus any pass-through equipment.
  const customerContract = grossedSale + adders;

  return {
    netSale: sale,
    redline,
    redlinePerUnit: Number(redlinePerUnit) || 0,
    batteryCount: units,
    total,
    belowRedline,
    shortfall: belowRedline ? redline - sale : 0,
    feePct,
    dealerFee,
    grossedSale,
    addersCost: adders,
    customerContract,
    rows: splitRows({ selfGen, roles, selfGenPct }).map((r) => ({
      ...r, amount: total * r.pct / 100
    })),
    selfGen: !!selfGen
  };
}

/**
 * Invert it: what net sale price produces a given total commission?
 * Used by the Forecast planner, which works backwards from a target.
 */
export const netSaleForCommission = (total, { batteryCount = 1, redlinePerUnit = BATTERY_REDLINE } = {}) =>
  (Number(total) || 0) + (Number(redlinePerUnit) || 0) * Math.max(1, Math.round(Number(batteryCount) || 1));

/* ---------------------------------------------------------------------------
 * SOLAR
 * ------------------------------------------------------------------------- */

/** The PPW tier a panel count falls in. */
export const solarTierFor = (panels, tiers = null) => {
  const list = (tiers && tiers.length) ? tiers : SOLAR_PPW_TIERS;
  const n = Math.max(0, Math.round(Number(panels) || 0));
  return list.find((t) => n >= t.minPanels && n <= (t.maxPanels ?? Infinity)) || null;
};

/**
 * THE REDLINE FOR A SOLAR DEAL, built up rather than a flat figure.
 *
 *   redline = basePPW x watts  +  first battery  +  adders
 *
 * Same shape as a battery deal — a non-commissionable base the rep sells above
 * — but the base is computed from the system rather than being one number. That
 * is why this is a build-up and not a constant: a 20-panel system and a
 * 6-panel system have nothing in common except the arithmetic.
 *
 * THE BATTERY CARVE-OUT IS $13,000 HERE, NOT THE $14,500 A BATTERY-ONLY DEAL
 * REDLINES AT. Both figures are as stated. They differ because the deal shapes
 * differ — a battery attached to a solar install shares a truck roll, a permit
 * and a crew day with the panels, and a standalone battery carries all of that
 * alone. Kept as two separate settings so that if one is ever meant to move,
 * moving it does not silently move the other.
 */
export function solarRedline({
  panels = 0,
  panelWatts = PANEL_WATTS,
  includesBattery = true,
  firstBatteryCarveOut = SOLAR_FIRST_BATTERY_CARVE_OUT,
  addersCost = 0,
  tiers = null
} = {}) {
  const n = Math.max(0, Math.round(Number(panels) || 0));
  const tier = solarTierFor(n, tiers);
  const watts = n * (Number(panelWatts) || PANEL_WATTS);
  const basePPW = tier ? Number(tier.basePPW) || 0 : 0;
  const baseCost = basePPW * watts;
  // The small-system adder is part of the base, not commissionable margin.
  const tierAdder = tier ? Number(tier.extraAdder) || 0 : 0;
  const battery = includesBattery ? Math.max(0, Number(firstBatteryCarveOut) || 0) : 0;
  const adders = Math.max(0, Number(addersCost) || 0);

  return {
    panels: n, watts, tier, basePPW, baseCost, tierAdder,
    batteryCarveOut: battery,
    addersCost: adders,
    redline: baseCost + tierAdder + battery + adders
  };
}

/**
 * Commission and customer contract for a SOLAR deal.
 *
 * Identical downstream of the redline to a battery deal: net sale minus
 * redline is the pool, the dealer fee grosses the contract up on financed
 * paper, and the split is the same table. Sharing that tail is deliberate —
 * two implementations of "sale minus base, split four ways" would eventually
 * disagree about a rounding or a fee direction.
 */
export function calcSolarCommission({
  netSale = 0,
  panels = 0,
  panelWatts = PANEL_WATTS,
  includesBattery = true,
  firstBatteryCarveOut = SOLAR_FIRST_BATTERY_CARVE_OUT,
  addersCost = 0,
  tiers = null,
  mode = 'loan',
  dealerFeePct = DEALER_FEE_PCT,
  selfGen = false,
  roles = null,
  selfGenPct = null
} = {}) {
  const base = solarRedline({
    panels, panelWatts, includesBattery, firstBatteryCarveOut, addersCost, tiers
  });
  const sale = Math.max(0, Number(netSale) || 0);
  const total = Math.max(0, sale - base.redline);

  const feePct = mode === 'loan' ? Math.max(0, Math.min(0.9, Number(dealerFeePct) || 0)) : 0;
  const grossedSale = feePct > 0 ? sale / (1 - feePct) : sale;

  return {
    ...base,
    netSale: sale,
    total,
    belowRedline: sale < base.redline,
    shortfall: sale < base.redline ? base.redline - sale : 0,
    feePct,
    dealerFee: grossedSale - sale,
    grossedSale,
    customerContract: grossedSale,
    rows: splitRows({ selfGen, roles, selfGenPct }).map((r) => ({
      ...r, amount: total * r.pct / 100
    })),
    selfGen: !!selfGen
  };
}

/* ---------------------------------------------------------------------------
 * THE FUNNEL — how much door-knocking a goal costs
 * ------------------------------------------------------------------------- */

/**
 * Stated conversion rates. Ratios rather than percentages because that is how
 * they were given and how a rep thinks about them: one in five doors reaches a
 * decision maker.
 */
export const FUNNEL_DEFAULTS = {
  doorsPerDecisionMaker: 5,      // 1 in 5 doors reaches a DM
  decisionMakersPerAppt: 15,     // 1 in 15 DMs books an appointment
  apptsPerClose: 3,              // 1 in 3 appointments closes
  installRate: 0.85,             // 85% of closed deals reach installation
  workingDaysPerMonth: 22
};

/**
 * Work backwards from a money goal to doors per day.
 *
 * INSTALLS ARE THE PAID EVENT, not closes. 15% of signed deals never reach
 * installation, and a plan built on closes overstates income by that much
 * while understating the doors needed. The distinction is the difference
 * between a plan that works and one that is 18% short.
 *
 * @param {number} goal              Money the rep wants.
 * @param {number} months            Over how long.
 * @param {number} commissionPerInstall  Their OWN share, not the pool.
 */
export function planFunnel({
  goal = 0,
  months = 3,
  commissionPerInstall = 0,
  funnel = null
} = {}) {
  const f = { ...FUNNEL_DEFAULTS, ...(funnel || {}) };
  const target = Math.max(0, Number(goal) || 0);
  const span = Math.max(1, Number(months) || 1);
  const per = Math.max(0, Number(commissionPerInstall) || 0);

  const installs = per > 0 ? target / per : 0;
  // Backwards up the funnel: installs -> closes -> appointments -> DMs -> doors.
  const closes = f.installRate > 0 ? installs / f.installRate : 0;
  const appts = closes * f.apptsPerClose;
  const decisionMakers = appts * f.decisionMakersPerAppt;
  const doors = decisionMakers * f.doorsPerDecisionMaker;

  const days = span * f.workingDaysPerMonth;
  const weeks = span * (52 / 12);

  return {
    goal: target, months: span, commissionPerInstall: per,
    installs, closes, appts, decisionMakers, doors,
    doorsPerDay: days > 0 ? doors / days : 0,
    doorsPerWeek: weeks > 0 ? doors / weeks : 0,
    apptsPerWeek: weeks > 0 ? appts / weeks : 0,
    installsPerMonth: installs / span,
    /** What a single knock is worth, averaged. The number that makes the
     *  whole plan feel survivable or not. */
    dollarsPerDoor: doors > 0 ? target / doors : 0,
    doorsPerInstall: f.installRate > 0
      ? (f.doorsPerDecisionMaker * f.decisionMakersPerAppt * f.apptsPerClose) / f.installRate
      : 0,
    funnel: f
  };
}

/* ---------------------------------------------------------------------------
 * NET INCOME — gross is not take-home
 * ------------------------------------------------------------------------- */

export const NET_DEFAULTS = {
  expensesPct: 12,    // fuel, phone, gear
  investPct: 10,      // put away before it is spent
  taxPct: 28          // 1099 income, so this lands as a bill later
};

/**
 * Gross commission down to what actually reaches the rep's account.
 *
 * TAX IS APPLIED AFTER EXPENSES, not to the gross. A 1099 rep is taxed on
 * profit, and taxing the gross would overstate the bill by the tax rate times
 * expenses — on a $150k plan with 12% expenses that is roughly $5,000 of
 * phantom tax, which is enough to talk somebody out of a plan that works.
 *
 * Investment comes out of post-tax money, because it is a choice about
 * already-earned income rather than a cost of doing business.
 */
export function netIncome({ gross = 0, expensesPct = null, investPct = null, taxPct = null } = {}) {
  const g = Math.max(0, Number(gross) || 0);
  const ePct = (expensesPct != null ? Number(expensesPct) : NET_DEFAULTS.expensesPct) / 100;
  const iPct = (investPct != null ? Number(investPct) : NET_DEFAULTS.investPct) / 100;
  const tPct = (taxPct != null ? Number(taxPct) : NET_DEFAULTS.taxPct) / 100;

  const expenses = g * ePct;
  const profit = Math.max(0, g - expenses);
  const tax = profit * tPct;
  const afterTax = profit - tax;
  const invested = afterTax * iPct;

  return {
    gross: g,
    expenses,
    profit,
    tax,
    afterTax,
    invested,
    takeHome: afterTax - invested,
    effectiveRate: g > 0 ? (expenses + tax + invested) / g : 0
  };
}
