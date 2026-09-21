/**
 * FILE: src/admin/settingsSchema.js
 *
 * EDITABLE DEFAULTS — the single place market assumptions can be changed
 * without touching code.
 *
 * Every value here starts as the constant already defined in its own module
 * (loanPricing, programData, BatteryDispatch, rateData). This file does not
 * re-type those numbers; it imports them and presents them as an editable
 * layer on top. That matters: if nobody has ever opened the admin page, the
 * app behaves exactly as if this file did not exist, and there is still only
 * one definition of the dealer fee, the rate table, or the battery catalog.
 *
 * Shape of the stored object — only what has been CHANGED is persisted, so a
 * later change to a code default still reaches anyone who has not overridden
 * it. `mergeSettings` applies the stored patch over the live defaults.
 *
 * Catalogs (batteries, lenders, adders, panels) are the exception: a list is
 * stored whole once edited, because "the third row was deleted" cannot be
 * expressed as a patch.
 *
 * Read by: src/admin/SettingsContext.jsx
 * Edited by: src/admin/AdminSettings.jsx
 * Persisted by: api/settings.js
 */

import {
  DEALER_FEE, DEFAULT_CONTRACT_VALUE, LOAN_APR, LOAN_TERMS_YEARS,
  FED_PCT_MIN, FED_PCT_MAX, FED_PCT_DEFAULT, LOCAL_REBATE_PER_KWH, ADDERS,
  COMMISSION_FLOOR_STANDARD, COMMISSION_FLOOR_UNSUBSIDISED, UNSUBSIDISED_APR,
  COMMISSION_FLOOR_PER_ADDED_PANEL
} from '../pricing/loanPricing';
import { BATTERY_MODELS, INCENTIVE_PROGRAMS, UTILITY_RATE_DEFAULTS } from '../incentives/programData';
import { CONNECTION_FEE_SCHEDULE } from '../utils/rateData';

/** Bump when a stored payload needs migrating. */
export const SETTINGS_VERSION = 1;

/**
 * Lenders. Not previously modelled — financing was one hard-coded rate. Each
 * lender carries its own rate card, so adding a lender is a data entry job.
 * `dealerFee` is the fee baked into the contract value for that lender's paper.
 */
export const DEFAULT_LENDERS = [
  {
    id: 'house',
    name: 'Standard (house paper)',
    dealerFee: DEALER_FEE,
    terms: [
      ...LOAN_TERMS_YEARS.map((years) => ({
        years, apr: LOAN_APR, minContractValue: COMMISSION_FLOOR_STANDARD
      })),
      // The unsubsidised product: a higher customer rate needs far less
      // dealer-fee buy-down, so the deal can be written lower.
      { years: 20, apr: UNSUBSIDISED_APR, minContractValue: COMMISSION_FLOOR_UNSUBSIDISED,
        label: '20 years (no buy-down)' }
    ],
    defaultTermYears: LOAN_TERMS_YEARS[0],
    prepaymentPenalty: false,
    notes: 'Default rate card. 5.49% subsidised, 8.49% unsubsidised.'
  }
];

/**
 * Solar panel options for the per-panel add-on. Empty by design — Dave said
 * per-panel pricing comes later, and an invented price is worse than a blank
 * that the UI reports as "price not set".
 */
export const DEFAULT_PANEL_OPTIONS = [];

/**
 * Modelling assumptions that are not catalogs. These are the knobs that move
 * as market conditions change.
 */
export const DEFAULT_ASSUMPTIONS = {
  // --- pricing ---
  contractValue: DEFAULT_CONTRACT_VALUE,
  dealerFee: DEALER_FEE,
  fedPctDefault: FED_PCT_DEFAULT,
  fedPctMin: FED_PCT_MIN,
  fedPctMax: FED_PCT_MAX,
  localRebatePerKwh: LOCAL_REBATE_PER_KWH,

  // --- projection ---
  rateEscalationPct: 8,
  leaseEscalatorOptions: [0, 0.9, 1.9, 2.9, 3.5],
  horizonYears: 20,

  // --- utility ---
  connectionFeeSchedule: CONNECTION_FEE_SCHEDULE,

  // --- eligibility / sizing ---
  // Share of a day's consumption that lands inside the solar window. Only used
  // as a fallback when no consumption profile is available — the estimator
  // prefers hour-by-hour overlap against the selected profile.
  fallbackDaytimeLoadShare: 0.42,
  defaultConsumptionProfile: 'evening_heavy',
  chargeEfficiency: 0.96,

  // --- rep commission ---
  commissionFloorStandard: COMMISSION_FLOOR_STANDARD,
  commissionFloorUnsubsidised: COMMISSION_FLOOR_UNSUBSIDISED,
  commissionUnsubsidisedApr: UNSUBSIDISED_APR,
  commissionFloorPerAddedPanel: COMMISSION_FLOOR_PER_ADDED_PANEL,

  // --- tide ---
  sdcpFundsRunOutMonths: 2,
  equipmentInflationPct: 3,
  opportunityCostPct: 5,
  averageDailyCyclePct: 88,
  roundTripEfficiencyPct: 89
};

/**
 * The complete default settings object. Built fresh from the live module
 * constants every time it is called, so a code-level change is picked up.
 */
export const buildDefaultSettings = () => ({
  version: SETTINGS_VERSION,
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  batteries: BATTERY_MODELS.map((b) => ({ ...b })),
  lenders: DEFAULT_LENDERS.map((l) => ({ ...l, terms: l.terms.map((t) => ({ ...t })) })),
  adders: ADDERS.map((a) => ({ ...a })),
  panels: DEFAULT_PANEL_OPTIONS.map((p) => ({ ...p })),
  programs: Object.fromEntries(
    Object.entries(INCENTIVE_PROGRAMS).map(([k, v]) => [k, { ...v }])
  ),
  rates: Object.fromEntries(
    Object.entries(UTILITY_RATE_DEFAULTS).map(([k, v]) => [k, { ...v }])
  )
});

/** Lists are replaced wholesale; objects are merged key by key. */
const LIST_KEYS = ['batteries', 'lenders', 'adders', 'panels'];
const MAP_KEYS = ['programs', 'rates'];

/**
 * Apply a stored patch over the live defaults.
 * A stored value of `undefined` or a missing key means "use the default".
 */
export function mergeSettings(stored) {
  const base = buildDefaultSettings();
  if (!stored || typeof stored !== 'object') return base;

  const out = { ...base };

  if (stored.assumptions && typeof stored.assumptions === 'object') {
    out.assumptions = { ...base.assumptions, ...stored.assumptions };
  }

  for (const key of LIST_KEYS) {
    if (Array.isArray(stored[key])) out[key] = stored[key].map((r) => ({ ...r }));
  }

  for (const key of MAP_KEYS) {
    if (stored[key] && typeof stored[key] === 'object') {
      out[key] = { ...base[key] };
      for (const [k, v] of Object.entries(stored[key])) {
        out[key][k] = { ...(base[key][k] || {}), ...v };
      }
    }
  }

  out.version = SETTINGS_VERSION;
  out.updatedAt = stored.updatedAt || null;
  out.updatedBy = stored.updatedBy || null;
  return out;
}

/**
 * Reduce a full settings object back to only what differs from the defaults,
 * so the stored payload stays small and future default changes still land.
 */
export function diffSettings(full) {
  const base = buildDefaultSettings();
  const patch = { version: SETTINGS_VERSION };

  const assumptions = {};
  for (const [k, v] of Object.entries(full.assumptions || {})) {
    if (JSON.stringify(v) !== JSON.stringify(base.assumptions[k])) assumptions[k] = v;
  }
  if (Object.keys(assumptions).length) patch.assumptions = assumptions;

  for (const key of LIST_KEYS) {
    if (JSON.stringify(full[key]) !== JSON.stringify(base[key])) patch[key] = full[key];
  }

  for (const key of MAP_KEYS) {
    const changed = {};
    for (const [k, v] of Object.entries(full[key] || {})) {
      if (JSON.stringify(v) !== JSON.stringify(base[key][k])) changed[k] = v;
    }
    if (Object.keys(changed).length) patch[key] = changed;
  }

  return patch;
}

/**
 * Field definitions for the admin page. Keeping the labels and input hints
 * here rather than in JSX means adding a knob is one line, in one file.
 */
export const ASSUMPTION_FIELDS = [
  { group: 'Pricing', key: 'contractValue', label: 'Default contract value', type: 'money', step: 500,
    help: 'Installed battery price before adders. Includes the dealer fee.' },
  { group: 'Pricing', key: 'dealerFee', label: 'Dealer fee', type: 'pct', step: 0.5,
    help: 'Carried inside the contract value. Never shown to the customer.' },
  { group: 'Pricing', key: 'fedPctDefault', label: 'Federal deduction, default', type: 'pct', step: 1 },
  { group: 'Pricing', key: 'fedPctMin', label: 'Federal deduction, slider minimum', type: 'pct', step: 1 },
  { group: 'Pricing', key: 'fedPctMax', label: 'Federal deduction, slider maximum', type: 'pct', step: 1 },
  { group: 'Pricing', key: 'localRebatePerKwh', label: 'Storage rebate', type: 'money', step: 25,
    help: 'Per kWh of usable capacity. SDCP standard tier.' },

  { group: 'Projection', key: 'rateEscalationPct', label: 'Utility rate escalation', type: 'pct', step: 0.5 },
  { group: 'Projection', key: 'horizonYears', label: 'Comparison horizon', type: 'int', suffix: 'yr' },

  { group: 'Sizing', key: 'averageDailyCyclePct', label: 'Average daily cycle', type: 'pct', step: 1 },
  { group: 'Sizing', key: 'roundTripEfficiencyPct', label: 'Round-trip efficiency', type: 'pct', step: 1 },
  { group: 'Sizing', key: 'chargeEfficiency', label: 'Charge efficiency', type: 'ratio', step: 0.01,
    help: "The sizing workbook's haircut when testing whether surplus fills a pack." },
  { group: 'Sizing', key: 'fallbackDaytimeLoadShare', label: 'Fallback daytime load share', type: 'ratio', step: 0.01,
    help: 'Only used when no consumption profile is available. The estimator normally computes hour-by-hour overlap instead.' },

  { group: 'Commission', key: 'commissionFloorStandard', label: 'Floor — subsidised rate', type: 'money', step: 250,
    help: 'Lowest contract value on the 5.49% rate card. Everything above it is commission.' },
  { group: 'Commission', key: 'commissionFloorUnsubsidised', label: 'Floor — cash / no buy-down', type: 'money', step: 250,
    help: 'Applies to cash and to the unsubsidised rate card.' },
  { group: 'Commission', key: 'commissionUnsubsidisedApr', label: 'Unsubsidised APR threshold', type: 'ratio', step: 0.0001,
    help: 'At or above this rate, the lower floor applies.' },
  { group: 'Commission', key: 'commissionFloorPerAddedPanel', label: 'Floor uplift per added panel', type: 'money', step: 25,
    help: 'Raises the floor as solar is added, so panel cost is not paid out of commission. Zero until the real scale is set.' },

  { group: 'Tide', key: 'sdcpFundsRunOutMonths', label: 'Rebate funds run out in', type: 'int', suffix: 'mo' },
  { group: 'Tide', key: 'equipmentInflationPct', label: 'Equipment / labor inflation', type: 'pct', step: 0.5 },
  { group: 'Tide', key: 'opportunityCostPct', label: 'Return on money not spent', type: 'pct', step: 0.5 }
];
