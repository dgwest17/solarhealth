/**
 * FILE: src/incentives/eligibility.js
 *
 * SDCP / community-storage ELIGIBILITY ENGINE.
 *
 * Ported from the contractor System Sizing Tool (v4.5, Q2 2026). The workbook
 * is the administrator's own instrument, so the rules below follow its formulas
 * rather than a re-derivation:
 *
 *   Charge thresholds (Analysis!Y11, Y13):
 *     80% test = (qty x usableKwh x 0.80) x 0.96
 *     60% test = (qty x usableKwh x 0.60) x 0.96
 *   The 0.96 is the workbook's charging-efficiency haircut.
 *
 *   Monthly test (Analysis!AE3:AE14):
 *     A month passes when its AVERAGE WEEKDAY daily excess solar exceeds the
 *     threshold for that month. Weekends are excluded entirely — the program
 *     dispatches on weekdays, so weekend surplus is irrelevant to qualifying.
 *
 *   Seasonal split observed in the workbook: months 5-10 (May-Oct) are tested
 *   against the 80% threshold, months 11-4 (Nov-Apr) against the 60% one.
 *   Winter gets the softer bar because there is simply less sun.
 *
 *   Data completeness (Analysis!AH3:AH14): a month is COMPLETE when at least
 *   75% of its hours are present in the interval data.
 *
 *   Verdict cascade (Analysis!AB17), in priority order:
 *     1. <6 complete months            -> INSUFFICIENT DATA
 *     2. any high-risk month           -> REQUIRES STAFF REVIEW
 *        (incomplete data that is nonetheless passing — the dangerous case,
 *         because a thin month can pass on a handful of sunny days)
 *     3. 6-11 complete months          -> PARTIAL YEAR DATA
 *     4. all 12 pass                   -> SUFFICIENT
 *     5. otherwise                     -> INSUFFICIENT SIZING
 *
 * Qualifying questions (Instructions!E8:E10) gate the whole thing: existing
 * solar, installed over a year, and whether new solar is being added.
 */

import { getBattery } from './programData';

export const CHARGE_EFFICIENCY = 0.96;
export const THRESHOLD_HIGH = 0.80;
export const THRESHOLD_LOW = 0.60;
export const COMPLETE_MONTH_PCT = 0.75;
export const MIN_MONTHS = 6;

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

/** Summer months (1-indexed) test against the higher bar. */
const isHighThresholdMonth = (month) => month >= 5 && month <= 10;

/**
 * Charge thresholds for a pack.
 * @returns { high, low } kWh of daily excess solar required
 */
export const getChargeThresholds = (usableKwh, qty = 1) => {
  const pack = (Number(usableKwh) || 0) * (Number(qty) || 1);
  return {
    packKwh: pack,
    high: pack * THRESHOLD_HIGH * CHARGE_EFFICIENCY,
    low: pack * THRESHOLD_LOW * CHARGE_EFFICIENCY
  };
};

/**
 * Evaluate the twelve monthly tests.
 *
 * @param monthlyExcess  array of 12 numbers — average WEEKDAY daily excess
 *                       solar (kWh) for each month, Jan..Dec. null/undefined
 *                       means no data for that month.
 * @param monthlyHourPct array of 12 numbers 0..1 — share of hours present in
 *                       the interval data. Omit to assume complete.
 */
export const evaluateMonths = (monthlyExcess = [], monthlyHourPct = null, usableKwh = 13.5, qty = 1) => {
  const { high, low, packKwh } = getChargeThresholds(usableKwh, qty);

  return MONTH_NAMES.map((name, i) => {
    const month = i + 1;
    const threshold = isHighThresholdMonth(month) ? high : low;
    const raw = monthlyExcess[i];
    const hasData = raw !== null && raw !== undefined && Number.isFinite(Number(raw));
    const excess = hasData ? Number(raw) : null;

    const hourPct = monthlyHourPct && Number.isFinite(Number(monthlyHourPct[i]))
      ? Number(monthlyHourPct[i])
      : (hasData ? 1 : 0);
    const complete = hourPct >= COMPLETE_MONTH_PCT;
    const passes = hasData && excess > threshold;

    // The case the workbook singles out for staff review: the month passes,
    // but on data too thin to trust. A few sunny days can carry a sparse month.
    const highRisk = passes && !complete;

    return {
      month, name, excess, threshold,
      thresholdTier: isHighThresholdMonth(month) ? '80%' : '60%',
      hasData, hourPct, complete, passes, highRisk,
      shortfall: hasData ? excess - threshold : null,
      packKwh
    };
  });
};

/**
 * The qualifying questions from the Instructions sheet.
 * Returns null when the answers don't disqualify, or a reason string when they do.
 */
export const checkQualifyingQuestions = ({ hasExistingSolar, solarOverOneYear, addingSolar }) => {
  // No existing solar and none being added — nothing to charge a battery from.
  if (!hasExistingSolar && !addingSolar) {
    return 'No existing solar and none being added — there is no surplus generation to charge a battery from.';
  }
  // Existing solar under a year old has no meaningful production history.
  if (hasExistingSolar && !solarOverOneYear && !addingSolar) {
    return 'Existing solar has been in service under a year, so there is not yet enough production history to size against.';
  }
  return null;
};

/**
 * Full eligibility assessment.
 */
export const assessEligibility = ({
  monthlyExcess = [],
  monthlyHourPct = null,
  batteryId = 'tesla_pw3',
  usableKwhOverride = null,
  qty = 1,
  hasExistingSolar = true,
  solarOverOneYear = true,
  addingSolar = false
} = {}) => {
  const battery = getBattery(batteryId);
  const usableKwh = Number.isFinite(Number(usableKwhOverride)) && Number(usableKwhOverride) > 0
    ? Number(usableKwhOverride)
    : battery.usableKwh;

  const blocker = checkQualifyingQuestions({ hasExistingSolar, solarOverOneYear, addingSolar });
  const months = evaluateMonths(monthlyExcess, monthlyHourPct, usableKwh, qty);

  const completeCount = months.filter((m) => m.complete && m.hasData).length;
  const passCount = months.filter((m) => m.passes).length;
  const highRiskMonths = months.filter((m) => m.highRisk);
  const { high, low, packKwh } = getChargeThresholds(usableKwh, qty);

  let status, headline, detail;

  if (blocker) {
    status = 'ineligible';
    headline = 'Does not qualify';
    detail = blocker;
  } else if (completeCount < MIN_MONTHS) {
    status = 'insufficient-data';
    headline = `Insufficient data — ${completeCount} complete month${completeCount === 1 ? '' : 's'}`;
    detail = `A minimum of ${MIN_MONTHS} months of interval data is required. With less than that, the solar-to-battery ratio is used instead of a measured assessment.`;
  } else if (highRiskMonths.length > 0) {
    status = 'review';
    headline = `Requires staff review — ${highRiskMonths.length} high-risk month${highRiskMonths.length === 1 ? '' : 's'}`;
    detail = `${highRiskMonths.map((m) => m.name).join(', ')} pass the threshold on incomplete data. A reviewer has to confirm real data would still support them.`;
  } else if (completeCount < 12) {
    status = 'partial';
    headline = `Partial year — ${completeCount} of 12 months complete`;
    detail = `${passCount} complete month${passCount === 1 ? '' : 's'} pass. Staff review is needed before approval.`;
  } else if (passCount === 12) {
    status = 'sufficient';
    headline = 'Project sizing is sufficient';
    detail = 'All twelve months clear the charge threshold on complete data.';
  } else {
    status = 'insufficient-sizing';
    headline = 'Project sizing is insufficient';
    detail = `${12 - passCount} month${12 - passCount === 1 ? '' : 's'} fall short. Either add solar or reduce storage size.`;
  }

  return {
    status, headline, detail,
    blocker,
    months,
    completeCount,
    passCount,
    highRiskMonths,
    battery,
    usableKwh,
    qty,
    packKwh,
    thresholds: { high, low },
    eligible: status === 'sufficient',
    needsReview: status === 'review' || status === 'partial'
  };
};

/**
 * Derive average weekday daily excess per month from an hourly interval series.
 * Mirrors the workbook: daily excess is the running surplus within a day, and
 * only weekdays count toward the monthly average.
 *
 * @param hourly array of { date: Date|ISO string, production, consumption }
 */
export const deriveMonthlyExcess = (hourly = []) => {
  const byDay = new Map();
  for (const h of hourly) {
    const d = h.date instanceof Date ? h.date : new Date(h.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    const surplus = Math.max(0, (Number(h.production) || 0) - (Number(h.consumption) || 0));
    const prev = byDay.get(key) || { month: d.getMonth(), dow: d.getDay(), excess: 0, hours: 0 };
    prev.excess += surplus;
    prev.hours += 1;
    byDay.set(key, prev);
  }

  const sums = Array.from({ length: 12 }, () => ({ total: 0, days: 0, hours: 0, possible: 0 }));
  for (const [, v] of byDay) {
    const bucket = sums[v.month];
    bucket.hours += v.hours;
    bucket.possible += 24;
    if (v.dow === 0 || v.dow === 6) continue; // weekends excluded
    bucket.total += v.excess;
    bucket.days += 1;
  }

  return {
    monthlyExcess: sums.map((s) => (s.days > 0 ? s.total / s.days : null)),
    monthlyHourPct: sums.map((s) => (s.possible > 0 ? s.hours / s.possible : 0))
  };
};
