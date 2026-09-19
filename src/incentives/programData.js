/**
 * FILE: src/incentives/programData.js
 *
 * Battery catalog + utility incentive programs.
 *
 * Shared by the Eligibility tab and the Tide tab so a battery's usable kWh and
 * a program's rebate rate are defined exactly once. Rebates scale on USABLE
 * kWh, so that figure is the single most load-bearing number here.
 *
 * Battery list transcribed from the contractor System Sizing Tool (v4.5,
 * Q2 2026) "DataVal" sheet — the same list the program administrator validates
 * against, so it should stay in step with that workbook rather than with any
 * marketing spec sheet.
 */

import { RATE_PLANS } from '../battery/BatteryDispatch';
import { resolveWarranty } from '../tech/warrantyData';

/** Usable capacity in kWh, per the sizing tool's DataVal sheet. */
export const BATTERY_MODELS = [
  { id: 'fwh_apower_x',   make: 'FranklinWH', model: 'aPower X',                        usableKwh: 13.6, warrantyMake: 'franklinwh' },
  { id: 'fwh_apower_2',   make: 'FranklinWH', model: 'aPower 2',                        usableKwh: 15.0, warrantyMake: 'franklinwh' },
  { id: 'fwh_apower_s',   make: 'FranklinWH', model: 'aPower S',                        usableKwh: 15.0, warrantyMake: 'franklinwh' },
  { id: 'tesla_pw3',      make: 'Tesla',      model: 'Powerwall 3',                     usableKwh: 13.5, warrantyMake: 'tesla_pw' },
  { id: 'tesla_pw3_x1',   make: 'Tesla',      model: 'Powerwall 3 + 1 Expansion Pack',  usableKwh: 27.0, warrantyMake: 'tesla_pw' },
  { id: 'tesla_pw3_x2',   make: 'Tesla',      model: 'Powerwall 3 + 2 Expansion Packs', usableKwh: 40.5, warrantyMake: 'tesla_pw' },
  { id: 'enphase_10c',    make: 'Enphase',    model: '10C',                             usableKwh: 9.5, warrantyMake: 'enphase_bat' },
  { id: 'enphase_5p',     make: 'Enphase',    model: '5P',                              usableKwh: 4.5, warrantyMake: 'enphase_bat' },
  { id: 'se_home_400v',   make: 'SolarEdge',  model: 'Home Battery 400V',               usableKwh: 9.7, warrantyMake: 'solaredge_bat' },
  { id: 'se_nexis_5k',    make: 'SolarEdge',  model: 'Nexis NX-BLCK-5K',                usableKwh: 4.65, warrantyMake: 'solaredge_bat' },
  { id: 'lunar_10',       make: 'Lunar',      model: 'L2-ESS-10KWH',                    usableKwh: 10.0, warrantyMake: 'lunar' },
  { id: 'lunar_15',       make: 'Lunar',      model: 'L2-ESS-15KWH',                    usableKwh: 15.0, warrantyMake: 'lunar' },
  { id: 'lunar_20',       make: 'Lunar',      model: 'L2-ESS-20KWH',                    usableKwh: 20.0, warrantyMake: 'lunar' },
  { id: 'lunar_25',       make: 'Lunar',      model: 'L2-ESS-20KWH + LE-DC-UNIT',       usableKwh: 25.0, warrantyMake: 'lunar' },
  { id: 'lunar_30',       make: 'Lunar',      model: 'L2-ESS-20KWH + 2x LE-DC-UNIT',    usableKwh: 30.0, warrantyMake: 'lunar' }
];

/**
 * Warranty term for a pack, resolved from the shared warranty table rather
 * than re-typed here. This is the year the manufacturer's retention figure
 * (70% for every pack we sell) is measured at — which is exactly what the Tide
 * degradation curve needs, so the two can't disagree.
 */
export const getBatteryWarrantyYears = (battery, asOfYear = new Date().getFullYear()) => {
  const rule = resolveWarranty('battery', (battery && battery.warrantyMake) || 'other_battery', asOfYear);
  return (rule && rule.productYears) || 10;
};

export const getBattery = (id) =>
  BATTERY_MODELS.find((b) => b.id === id) || BATTERY_MODELS[3]; // default Powerwall 3

/**
 * Utility incentive programs.
 *
 * `rebateCare` / `rebateStandard` are $/kWh of USABLE capacity, paid up front.
 * `perfPerKwh` is the ongoing performance payment on dispatched energy during
 * weekday event windows. `perfYears` is how long that runs.
 *
 * SDCP figures confirmed against program materials; the others are placeholders
 * flagged `verified: false` so nobody quotes them as fact. Edit here, not in a
 * component — both tabs read this table.
 */
export const INCENTIVE_PROGRAMS = {
  SDGE: {
    id: 'SDCP',
    utility: 'SDGE',
    utilityLabel: 'SDG&E',
    name: 'San Diego Community Power',
    short: 'SDCP',
    rebateCare: 350,
    rebateStandard: 250,
    rebateCap: 10000,
    perfPerKwh: 0.10,
    perfYears: 5,
    weekdayOnly: true,
    enrollmentYears: 5,
    verified: true,
    note: 'Rebate tier is set by CARE status on the day of install. Performance payments run weekday evening events only.'
  },
  SMUD: {
    id: 'SMUD_STORAGE',
    utility: 'SMUD',
    utilityLabel: 'SMUD',
    name: 'SMUD storage incentive',
    short: 'SMUD',
    rebateCare: 300,
    rebateStandard: 200,
    rebateCap: 7500,
    perfPerKwh: 0.05,
    perfYears: 5,
    weekdayOnly: true,
    enrollmentYears: 5,
    verified: false,
    note: 'Representative figures — verify current SMUD program terms before quoting.'
  },
  PGE: {
    id: 'NONE_PGE',
    utility: 'PGE',
    utilityLabel: 'PG&E',
    name: 'No community storage program',
    short: 'None',
    rebateCare: 0,
    rebateStandard: 0,
    rebateCap: 0,
    perfPerKwh: 0,
    perfYears: 0,
    weekdayOnly: true,
    enrollmentYears: 0,
    verified: true,
    note: 'No equivalent community-power storage rebate in this territory. SGIP may still apply and is not modelled here.'
  },
  SCE: {
    id: 'NONE_SCE',
    utility: 'SCE',
    utilityLabel: 'SCE',
    name: 'No community storage program',
    short: 'None',
    rebateCare: 0,
    rebateStandard: 0,
    rebateCap: 0,
    perfPerKwh: 0,
    perfYears: 0,
    weekdayOnly: true,
    enrollmentYears: 0,
    verified: true,
    note: 'No equivalent community-power storage rebate in this territory. SGIP may still apply and is not modelled here.'
  }
};

export const getProgram = (utility) =>
  INCENTIVE_PROGRAMS[utility] || INCENTIVE_PROGRAMS.SDGE;

/**
 * Up-front rebate for a given pack, honouring the program cap.
 * CARE status picks the tier — that is the whole reason the tab has a toggle.
 */
export const calcRebate = (program, usableKwh, qty = 1, onCare = false) => {
  if (!program) return { rate: 0, gross: 0, amount: 0, capped: false };
  const rate = onCare ? program.rebateCare : program.rebateStandard;
  const gross = rate * usableKwh * qty;
  const amount = program.rebateCap ? Math.min(program.rebateCap, gross) : gross;
  return { rate, gross, amount, capped: program.rebateCap > 0 && gross > program.rebateCap };
};

/**
 * SEASONAL RATE TABLE — derived, not re-typed.
 *
 * SDG&E's tiers come straight out of RATE_PLANS in the dispatch engine, which
 * is the rate table Dave confirmed. Tide used to carry its own copy, and the
 * copy had drifted: winter peak read $0.354 against an actual $0.503, and the
 * "super off-peak" figures ($0.035 / $0.042) were export avoided-cost values
 * masquerading as retail rates. Two tables answering one question is the bug
 * that has bitten this codebase three times now — so there is one table.
 *
 * A battery client lands on EV-TOU-5: the midday super-off-peak window is what
 * makes storage work, so that is the default plan for the Tide model. TOU-DR1
 * is selectable for a client who will not switch.
 */
export const RATE_PLAN_OPTIONS = {
  SDGE: [
    { id: 'SDGE_EVTOU5',  label: 'EV-TOU-5 (recommended with storage)' },
    { id: 'SDGE_TOU_DR1', label: 'TOU-DR1 (standard)' }
  ]
};

const fromPlan = (plan) => ({
  wpeak: plan.winter.peak,
  woff:  plan.winter.offPeak,
  wsop:  plan.winter.superOffPeak,
  speak: plan.summer.peak,
  soff:  plan.summer.offPeak,
  ssop:  plan.summer.superOffPeak,
  planId: plan.id,
  planLabel: plan.label,
  estimated: !!plan.winterEstimated
});

/**
 * Non-SDG&E territories have no confirmed seasonal table yet. These are
 * placeholders scaled off each utility's TOU_RATES entry so the shape is right
 * and the arithmetic runs — they are flagged `estimated` and the UI says so.
 * Replace with real tariff data before quoting outside San Diego.
 */
const estimateSeasonal = (peak, offPeak, superOffPeak) => ({
  speak: peak,
  soff:  offPeak,
  ssop:  superOffPeak,
  // Winter peak runs materially below summer peak on every CA TOU tariff, but
  // nowhere near as far below as Tide previously assumed.
  wpeak: Number((peak * 0.73).toFixed(3)),
  woff:  Number((offPeak * 0.93).toFixed(3)),
  wsop:  superOffPeak,
  planId: null,
  planLabel: 'Estimated seasonal split',
  estimated: true
});

export const UTILITY_RATE_DEFAULTS = {
  SDGE: fromPlan(RATE_PLANS.SDGE_EVTOU5),
  SMUD: estimateSeasonal(0.3765, 0.1550, 0.1000),
  PGE:  estimateSeasonal(0.5800, 0.3000, 0.2600),
  SCE:  estimateSeasonal(0.6500, 0.3500, 0.2500)
};

/** Rate defaults for a utility, optionally for a specific named plan. */
export const getRateDefaults = (utility, planId = null) => {
  if (planId && RATE_PLANS[planId]) return fromPlan(RATE_PLANS[planId]);
  return UTILITY_RATE_DEFAULTS[utility] || UTILITY_RATE_DEFAULTS.SDGE;
};
