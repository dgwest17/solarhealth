import { CONSUMPTION_PROFILES, PRODUCTION_SHAPE } from './BatteryModel';

/**
 * BATTERY DISPATCH MODEL — hour-by-hour, month-by-month.
 *
 * Why this exists: a battery's value is NOT "capacity x peak rate x 365".
 * It is bounded by three hard ceilings that all bind at different times:
 *
 *   1. CAPACITY — a Powerwall 3 moves at most ~13.5 kWh per evening, no
 *      matter how big the household's deficit is.
 *   2. AVAILABLE CHARGE — you can only discharge what you first stored, and
 *      surplus solar collapses in winter (a 7,000 kWh/yr system makes ~11
 *      kWh/day in December vs ~25 in July).
 *   3. EVENING LOAD — energy used to serve the home's own 4-9pm load is
 *      avoided purchase, not export. Only the leftover gets exported.
 *
 * And the value is a SPREAD, not a gross. Without a battery that surplus
 * solar still exports midday and still earns a credit. The battery's real
 * gain is (evening rate - midday rate) on the energy it can actually shift.
 * Modelling gross peak export is the single biggest way these tools lie.
 *
 * So: simulate 24 hours x 12 months with real seasonal solar, dispatch the
 * battery under an explicit policy, and net it out under the client's actual
 * NEM rules.
 */

// Days per month (non-leap).
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Monthly share of annual PV production — coastal/inland California, fixed
 * south-facing array. December makes roughly 43% of what July makes.
 */
export const MONTHLY_SOLAR_SHAPE = [
  0.0543, 0.0642, 0.0839, 0.0967, 0.1056, 0.1086,
  0.1106, 0.1036, 0.0908, 0.0770, 0.0573, 0.0474
];

/**
 * Monthly share of annual household consumption — summer-peaked (AC) with a
 * mild winter bump (heating/lighting).
 */
export const MONTHLY_USAGE_SHAPE = [
  0.082, 0.074, 0.076, 0.072, 0.075, 0.082,
  0.098, 0.104, 0.095, 0.083, 0.078, 0.081
];

/**
 * SDG&E residential rate plans, seasonal.
 * Summer = June-October, Winter = November-May (SDG&E definition).
 *
 * Rates are $/kWh and EDITABLE — verify against the client's current tariff
 * sheet, they move constantly.
 */
export const RATE_PLANS = {
  SDGE_TOU_DR1: {
    id: 'SDGE_TOU_DR1',
    label: 'SDG&E TOU-DR1 (standard)',
    utility: 'SDGE',
    // 4-9pm on-peak every day
    peakHours: [16, 21],
    // midnight-6am super off-peak; no midday SOP window on this plan
    sopWindows: [[0, 6]],
    summer: { peak: 0.685, offPeak: 0.45, superOffPeak: 0.37 },
    winter: { peak: 0.503, offPeak: 0.42, superOffPeak: 0.35 },
    monthlyFee: 0,
    winterEstimated: true // summer figures confirmed; winter peak scaled from the EV-TOU seasonal ratio
  },
  SDGE_EVTOU5: {
    id: 'SDGE_EVTOU5',
    label: 'SDG&E EV-TOU-5',
    utility: 'SDGE',
    peakHours: [16, 21],
    // midnight-6am AND 10am-2pm — the midday window is what makes this plan
    // work with a battery: cheap grid charging exactly when solar peaks.
    sopWindows: [[0, 6], [10, 14]],
    summer: { peak: 0.79, offPeak: 0.45, superOffPeak: 0.12 },
    winter: { peak: 0.58, offPeak: 0.42, superOffPeak: 0.12 },
    monthlyFee: 16,
    winterEstimated: false
  }
};

/** SDG&E summer season: June (5) through October (9), zero-indexed months. */
const isSummerMonth = (m) => m >= 5 && m <= 9;

/** Non-bypassable charges deducted from NEM 2.0 export credits (~2-3c/kWh). */
export const NEM2_NBC = 0.025;

/** NEM 3.0 export compensation — avoided-cost, far below retail. */
export const NEM3_EXPORT_MIDDAY = 0.035;
export const NEM3_EXPORT_EVENING = 0.28; // evening avoided-cost runs much higher

const normalize = (arr) => {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum > 0 ? arr.map((v) => v / sum) : arr.map(() => 0);
};

const inWindow = (h, [start, end]) => h >= start && h < end;

/**
 * Which TOU period an hour falls in for a given plan.
 */
export const periodFor = (plan, hour) => {
  if (inWindow(hour, plan.peakHours)) return 'peak';
  for (const w of plan.sopWindows) {
    if (inWindow(hour, w)) return 'superOffPeak';
  }
  return 'offPeak';
};

/**
 * Export credit rate for a given hour under the client's NEM regime.
 *   NEM 1.0 — full retail for that TOU period.
 *   NEM 2.0 — retail minus non-bypassable charges.
 *   NEM 3.0 — avoided cost: pennies midday, meaningfully more in the evening.
 */
export const exportRateFor = (plan, rates, hour, nemVersion, sellRates = null, exportBonus = 0) => {
  const period = periodFor(plan, hour);
  // Explicit override: the rep entered the client's actual export credits off
  // their bill. Trust those over anything we would derive. The bonus (SDCP/
  // SMUD community-program adder, $/kWh) stacks on top either way.
  if (sellRates && Number.isFinite(sellRates[period])) return sellRates[period] + exportBonus;
  if (nemVersion === 'NEM3') {
    return (period === 'peak' ? NEM3_EXPORT_EVENING : NEM3_EXPORT_MIDDAY) + exportBonus;
  }
  const retail = rates[period];
  const base = nemVersion === 'NEM2' ? Math.max(0, retail - NEM2_NBC) : retail;
  return base + exportBonus;
};

/**
 * Simulate one representative day for a month.
 *
 * Dispatch policy (standard TOU arbitrage, what a Powerwall actually does):
 *   - Solar serves load first.
 *   - Surplus solar charges the battery until full; the rest exports.
 *   - Optionally top up from the grid during the midday super-off-peak
 *     window (EV-TOU-5 only) — cheap kWh in, expensive kWh out.
 *   - During 4-9pm the battery serves the home's load first (avoided
 *     purchase at the peak rate), then exports whatever is left IF export
 *     is worth more than holding it (true under NEM 1.0/2.0, false under
 *     NEM 3.0 where evening export still beats overnight off-peak).
 */
export const simulateDay = ({
  dailyProductionKwh,
  dailyUsageKwh,
  usageShape,
  plan,
  rates,
  sellRates = null,
  exportBonus = 0,
  nemVersion,
  batteryCapacityKwh = 0,
  roundTripEfficiency = 0.90,
  maxPowerKw = 5,           // Powerwall 3 continuous ~11.5kW; per-hour throughput cap
  allowGridCharging = false,
  reserveFraction = 0       // backup reserve held out of arbitrage (0-1)
}) => {
  const solarHourly = normalize(PRODUCTION_SHAPE).map((w) => w * dailyProductionKwh);
  const loadHourly = normalize(usageShape).map((w) => w * dailyUsageKwh);

  const usableCap = Math.max(0, batteryCapacityKwh * (1 - reserveFraction));
  const legEff = Math.sqrt(Math.max(0.5, Math.min(1, roundTripEfficiency)));

  // Two buckets: energy that came from SOLAR can be exported for NEM credit;
  // energy bought from the grid CANNOT (CPUC requires exports be solar-origin).
  // Grid-charged kWh are still useful — they serve the home's own evening load
  // and dodge the peak purchase — they just never earn a retail export credit.
  // A real BMS charges to meet the FORECAST evening need — it does not blindly
  // fill the pack from the grid. Without this cap, an oversized battery buys
  // super-off-peak energy it can never use (grid-origin kWh cannot be exported
  // for credit), and the model would wrongly show extra capacity losing money.
  let peakWindowLoad = 0;
  for (let h = 0; h < 24; h++) {
    if (periodFor(plan, h) === 'peak') peakWindowLoad += Math.max(0, loadHourly[h] - solarHourly[h]);
  }

  let socSolar = 0;
  let socGrid = 0;
  const out = {
    importByPeriod: { peak: 0, offPeak: 0, superOffPeak: 0 },
    exportByPeriod: { peak: 0, offPeak: 0, superOffPeak: 0 },
    exportCredit: 0,
    importCost: 0,
    batteryToLoad: 0,
    batteryToGrid: 0,
    solarToBattery: 0,
    gridToBattery: 0,
    directSelfUse: 0,
    curtailedBySoc: 0,
    unservedPeakLoad: 0
  };

  for (let h = 0; h < 24; h++) {
    const period = periodFor(plan, h);
    const buy = rates[period];
    const sell = exportRateFor(plan, rates, h, nemVersion, sellRates, exportBonus);
    const solar = solarHourly[h];
    const load = loadHourly[h];
    const net = solar - load;
    let throughput = 0; // inverter power limit applies to all battery flows this hour

    out.directSelfUse += Math.min(solar, load);

    if (net >= 0) {
      // ---- Surplus hour: solar charges the battery, remainder exports ----
      let surplus = net;
      const socTotal = socSolar + socGrid;
      if (usableCap > 0 && socTotal < usableCap) {
        const room = (usableCap - socTotal) / legEff;
        const charge = Math.min(surplus, room, maxPowerKw - throughput);
        if (charge > 0) {
          socSolar += charge * legEff;
          out.solarToBattery += charge;
          throughput += charge;
          surplus -= charge;
        }
      }
      if (surplus > 0) {
        if (usableCap > 0 && socSolar + socGrid >= usableCap - 1e-9) out.curtailedBySoc += surplus;
        out.exportByPeriod[period] += surplus;
        out.exportCredit += surplus * sell;
      }
    } else {
      // ---- Deficit hour: battery covers 4-9pm load first ----
      let deficit = -net;
      if (usableCap > 0 && period === 'peak' && (socSolar + socGrid) > 0) {
        const available = (socSolar + socGrid) * legEff;
        const discharge = Math.min(deficit, available, maxPowerKw - throughput);
        if (discharge > 0) {
          // Spend grid-origin energy first — it can never be exported anyway.
          const fromGrid = Math.min(discharge, socGrid * legEff);
          socGrid -= fromGrid / legEff;
          socSolar -= (discharge - fromGrid) / legEff;
          out.batteryToLoad += discharge;
          throughput += discharge;
          deficit -= discharge;
        }
      }
      if (deficit > 0) {
        out.importByPeriod[period] += deficit;
        out.importCost += deficit * buy;
        if (period === 'peak') out.unservedPeakLoad += deficit;
      }
    }

    // ---- Cheap midday top-up (EV-TOU-5 only): serves the home, never exported ----
    if (allowGridCharging && period === 'superOffPeak' && h >= 8 && h <= 15 && usableCap > 0) {
      // Only buy what tonight's peak load will actually consume, and only
      // after accounting for the solar already banked.
      const target = Math.min(usableCap, peakWindowLoad);
      const deficitToTarget = target - (socSolar + socGrid);
      const room = Math.max(0, deficitToTarget) / legEff;
      const gc = Math.min(room, maxPowerKw - throughput);
      if (gc > 0) {
        socGrid += gc * legEff;
        out.gridToBattery += gc;
        out.importByPeriod[period] += gc;
        out.importCost += gc * buy;
        throughput += gc;
      }
    }

    // ---- Export leftover SOLAR-origin charge during peak ----
    if (period === 'peak' && usableCap > 0 && socSolar > 0 && sell > rates.offPeak) {
      const available = socSolar * legEff;
      const ex = Math.min(available, Math.max(0, maxPowerKw - throughput));
      if (ex > 0) {
        socSolar -= ex / legEff;
        out.batteryToGrid += ex;
        out.exportByPeriod[period] += ex;
        out.exportCredit += ex * sell;
        throughput += ex;
      }
    }
  }

  return out;
};

/**
 * Full-year simulation for one scenario.
 */
export const simulateYear = ({
  annualProductionKwh,
  annualUsageKwh,
  consumptionProfile = 'evening_heavy',
  plan,
  nemVersion = 'NEM2',
  batteryCapacityKwh = 0,
  roundTripEfficiency = 0.90,
  maxPowerKw = 5,
  allowGridCharging = false,
  reserveFraction = 0,
  onCareProgram = false,
  exportBonus = 0
}) => {
  const profile = CONSUMPTION_PROFILES[consumptionProfile] || CONSUMPTION_PROFILES.evening_heavy;
  const care = onCareProgram ? 0.70 : 1;

  const months = [];
  const total = {
    importKwh: 0, exportKwh: 0, peakImportKwh: 0, importCost: 0, exportCredit: 0,
    batteryToLoad: 0, batteryToGrid: 0, solarToBattery: 0, gridToBattery: 0,
    curtailedBySoc: 0, unservedPeakLoad: 0, peakExportKwh: 0
  };

  for (let m = 0; m < 12; m++) {
    const days = DAYS[m];
    const summer = isSummerMonth(m);
    const baseRates = summer ? plan.summer : plan.winter;
    const rates = {
      peak: baseRates.peak * care,
      offPeak: baseRates.offPeak * care,
      superOffPeak: baseRates.superOffPeak * care
    };
    const dailyProduction = (annualProductionKwh * MONTHLY_SOLAR_SHAPE[m]) / days;
    const dailyUsage = (annualUsageKwh * MONTHLY_USAGE_SHAPE[m]) / days;

    // Explicit sell rates (override mode) are seasonal, same shape as buy rates.
    const rawSell = summer ? plan.sellSummer : plan.sellWinter;
    const sellRates = rawSell ? {
      peak: rawSell.peak * care,
      offPeak: rawSell.offPeak * care,
      superOffPeak: rawSell.superOffPeak * care
    } : null;

    const day = simulateDay({
      dailyProductionKwh: dailyProduction,
      dailyUsageKwh: dailyUsage,
      usageShape: profile.hourly,
      plan,
      rates,
      sellRates,
      exportBonus,
      nemVersion,
      batteryCapacityKwh,
      roundTripEfficiency,
      maxPowerKw,
      allowGridCharging,
      reserveFraction
    });

    const importKwh = day.importByPeriod.peak + day.importByPeriod.offPeak + day.importByPeriod.superOffPeak;
    const exportKwh = day.exportByPeriod.peak + day.exportByPeriod.offPeak + day.exportByPeriod.superOffPeak;

    const monthRow = {
      month: m,
      label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m],
      summer,
      days,
      dailyProduction,
      dailyUsage,
      productionKwh: dailyProduction * days,
      usageKwh: dailyUsage * days,
      importKwh: importKwh * days,
      peakImportKwh: day.importByPeriod.peak * days,
      exportKwh: exportKwh * days,
      peakExportKwh: day.exportByPeriod.peak * days,
      importCost: day.importCost * days,
      exportCredit: day.exportCredit * days,
      batteryToLoad: day.batteryToLoad * days,
      batteryToGrid: day.batteryToGrid * days,
      solarToBattery: day.solarToBattery * days,
      gridToBattery: day.gridToBattery * days,
      curtailedBySoc: day.curtailedBySoc * days,
      unservedPeakLoad: day.unservedPeakLoad * days,
      // how full the battery actually got on an average day this month
      // How full SOLAR alone gets the battery — this is where winter bites.
      solarFill: batteryCapacityKwh > 0 ? Math.min(1, day.solarToBattery / batteryCapacityKwh) : 0,
      batteryUtilization: batteryCapacityKwh > 0
        ? Math.min(1, (day.solarToBattery + day.gridToBattery) / batteryCapacityKwh)
        : 0,
      peakBuyRate: rates.peak
    };
    months.push(monthRow);

    total.importKwh += monthRow.importKwh;
    total.peakImportKwh += monthRow.peakImportKwh;
    total.exportKwh += monthRow.exportKwh;
    total.importCost += monthRow.importCost;
    total.exportCredit += monthRow.exportCredit;
    total.batteryToLoad += monthRow.batteryToLoad;
    total.batteryToGrid += monthRow.batteryToGrid;
    total.solarToBattery += monthRow.solarToBattery;
    total.gridToBattery += monthRow.gridToBattery;
    total.curtailedBySoc += monthRow.curtailedBySoc;
    total.unservedPeakLoad += monthRow.unservedPeakLoad;
    total.peakExportKwh += monthRow.peakExportKwh;
  }

  // ---- Annual settlement ----
  // NEM 1.0/2.0 net the year out; NEM 2.0/3.0 always carry the connection fee,
  // NEM 1.0 only when the client ends up owing.
  const energyNet = total.exportCredit - total.importCost;   // + = credit, - = owed
  const planFees = (plan.monthlyFee || 0) * 12;
  const CONNECTION_FEE_YEAR = 144;
  let connectionFees;
  if (nemVersion === 'NEM1') {
    connectionFees = energyNet >= 0 ? 0 : CONNECTION_FEE_YEAR;
  } else {
    connectionFees = CONNECTION_FEE_YEAR;
  }
  const netPosition = energyNet - connectionFees - planFees;

  return {
    months,
    plan,
    nemVersion,
    batteryCapacityKwh,
    totals: total,
    energyNet,
    connectionFees,
    planFees,
    netPurchaseKwh: total.importKwh - total.exportKwh, // the real energy gap
    netPosition,                                   // + = credit check, - = true-up
    trueUp: netPosition < 0 ? -netPosition : 0,
    credit: netPosition > 0 ? netPosition : 0
  };
};

/**
 * Compare the scenarios that actually matter to a homeowner:
 *   A. today — current plan, no battery
 *   B. battery on their current plan
 *   C. battery + switch to EV-TOU-5 (the big-spread play)
 *
 * Returns each scenario's annual position plus the delta vs today, so the
 * report can say "this is what the battery is worth" honestly.
 */
export const compareBatteryScenarios = ({
  annualProductionKwh,
  annualUsageKwh,
  consumptionProfile = 'evening_heavy',
  nemVersion = 'NEM2',
  batteryCapacityKwh = 13.5,
  roundTripEfficiency = 0.90,
  maxPowerKw = 5,
  currentPlanId = 'SDGE_TOU_DR1',
  onCareProgram = false,
  reserveFraction = 0,
  rateOverride = null,
  exportBonus = 0
}) => {
  // Rate override: merge the rep's entered figures over the published plan.
  // Anything left blank falls back to the default schedule.
  const applyOverride = (basePlan, ov) => {
    if (!ov) return basePlan;
    const merge = (base, patch) => {
      if (!patch) return base;
      const out = { ...base };
      for (const k of ['peak', 'offPeak', 'superOffPeak']) {
        const v = parseFloat(patch[k]);
        if (Number.isFinite(v) && v > 0) out[k] = v;
      }
      return out;
    };
    const hasSell = (p) => p && ['peak', 'offPeak', 'superOffPeak']
      .some((k) => Number.isFinite(parseFloat(p[k])) && parseFloat(p[k]) > 0);
    return {
      ...basePlan,
      summer: merge(basePlan.summer, ov.summer),
      winter: merge(basePlan.winter, ov.winter),
      sellSummer: hasSell(ov.sellSummer) ? merge(basePlan.summer, ov.sellSummer) : undefined,
      sellWinter: hasSell(ov.sellWinter) ? merge(basePlan.winter, ov.sellWinter) : undefined,
      overridden: true
    };
  };
  const currentPlan = applyOverride(RATE_PLANS[currentPlanId] || RATE_PLANS.SDGE_TOU_DR1, rateOverride && rateOverride.current);
  const evPlan = applyOverride(RATE_PLANS.SDGE_EVTOU5, rateOverride && rateOverride.battery);
  const common = {
    annualProductionKwh, annualUsageKwh, consumptionProfile,
    nemVersion, roundTripEfficiency, maxPowerKw, onCareProgram, reserveFraction, exportBonus
  };

  const today = simulateYear({ ...common, plan: currentPlan, batteryCapacityKwh: 0 });
  const withBattery = simulateYear({ ...common, plan: currentPlan, batteryCapacityKwh });
  const withBatteryEvTou = simulateYear({
    ...common, plan: evPlan, batteryCapacityKwh, allowGridCharging: true
  });

  const gain = (s) => s.netPosition - today.netPosition;

  // ---- Ceiling analysis: what a battery can and cannot do ----
  // A battery SHIFTS energy in time. It does not CREATE energy. A household
  // short 5,000 kWh/yr is still short 5,000 kWh/yr after installing one —
  // slightly more, in fact, once round-trip losses are counted. The win is
  // buying those kWh at super-off-peak instead of peak, and selling stored
  // solar into the 4-9pm window instead of the midday trough.
  // Closing the energy gap itself takes more panels, not more storage.
  const deficitKwh = Math.max(0, annualUsageKwh - annualProductionKwh);
  const theoreticalMax = batteryCapacityKwh * 365;
  const best = withBatteryEvTou;
  const actualShifted = best.totals.batteryToLoad + best.totals.batteryToGrid;

  // ---- Which scenario actually wins for THIS client ----
  // Not a foregone conclusion: EV-TOU-5's cheap midday window is gold for an
  // overconsumer, but it also collapses the midday EXPORT credit (retail SOP
  // 0.37 -> 0.12). A client who exports heavily at midday under NEM 1.0/2.0
  // can be made worse off by the same switch that saves an overconsumer
  // $1,400/yr. Always compare, never assume.
  const options = [
    { id: 'battery_current', label: `Battery, stay on ${currentPlan.label}`, gain: gain(withBattery), scenario: withBattery },
    { id: 'battery_evtou', label: 'Battery + switch to EV-TOU-5', gain: gain(withBatteryEvTou), scenario: withBatteryEvTou }
  ].sort((a, b) => b.gain - a.gain);
  const winner = options[0];
  const recommendation = {
    ...winner,
    worthIt: winner.gain > 0,
    planSwitchHelps: gain(withBatteryEvTou) > gain(withBattery),
    reason: gain(withBatteryEvTou) > gain(withBattery)
      ? 'Peak purchases dominate this bill — the cheap midday window is worth more than the midday export credit it gives up.'
      : 'This system exports heavily at midday. EV-TOU-5 would cut that export credit by more than the battery gains back, so the current plan wins.'
  };

  return {
    recommendation,
    today,
    withBattery,
    withBatteryEvTou,
    gains: {
      battery: gain(withBattery),
      batteryEvTou: gain(withBatteryEvTou),
      planSwitchOnly: withBatteryEvTou.netPosition - withBattery.netPosition
    },
    ceiling: {
      deficitKwh,
      theoreticalMaxKwh: theoreticalMax,
      actualShiftedKwh: actualShifted,
      utilizationPct: theoreticalMax > 0 ? (actualShifted / theoreticalMax) * 100 : 0,
      // The gap does NOT close — show it plainly, before and after.
      netPurchaseBeforeKwh: today.netPurchaseKwh,
      netPurchaseAfterKwh: best.netPurchaseKwh,
      // The actual win: peak-priced kWh bought before vs after.
      peakImportBeforeKwh: today.totals.peakImportKwh,
      peakImportAfterKwh: best.totals.peakImportKwh,
      peakImportAvoidedKwh: Math.max(0, today.totals.peakImportKwh - best.totals.peakImportKwh),
      // Stored solar sold into the 4-9pm window instead of the midday trough.
      peakExportKwh: best.totals.peakExportKwh,
      curtailedBySocKwh: best.totals.curtailedBySoc,
      unservedPeakKwh: best.totals.unservedPeakLoad,
      // Solar-only fill: the seasonal ceiling on how much the battery can bank.
      winterSolarFillPct: best.months.filter((m) => !m.summer)
        .reduce((a, m) => a + m.solarFill, 0) / 7 * 100,
      summerSolarFillPct: best.months.filter((m) => m.summer)
        .reduce((a, m) => a + m.solarFill, 0) / 5 * 100,
      // Would a bigger battery help, or is surplus solar the binding limit?
      bindingConstraint: (() => {
        const avgFill = best.months.reduce((a, m) => a + m.solarFill, 0) / 12;
        if (avgFill < 0.75) return 'solar';   // not enough surplus to fill it
        if (best.totals.curtailedBySoc > 200) return 'capacity'; // spilling surplus
        return 'balanced';
      })()
    }
  };
};

/**
 * ---------------------------------------------------------------------------
 * BATTERY HARDWARE CATALOG
 * ---------------------------------------------------------------------------
 * usableKwh    — usable (not nameplate) capacity, the number that matters
 * continuousKw — sustained output; caps how fast the pack can dump into the
 *                4-9pm window. A 5 kW unit over a 5-hour peak can deliver
 *                25 kWh, so power rarely binds on one battery — but it does
 *                on undersized packs with big evening loads.
 * rte          — round-trip efficiency. DC-coupled units skip a DC-AC-DC
 *                conversion when charging from solar and keep a few points.
 *
 * Specs are manufacturer figures as commonly published and shift with
 * firmware//revisions — verify on the spec sheet before quoting.
 */
export const BATTERY_CATALOG = {
  pw3: {
    id: 'pw3', brand: 'Tesla', model: 'Powerwall 3',
    usableKwh: 13.5, continuousKw: 11.5, rte: 0.89, coupling: 'DC',
    maxUnits: 4, note: 'Integrated inverter; highest continuous output in class.'
  },
  pw2: {
    id: 'pw2', brand: 'Tesla', model: 'Powerwall 2',
    usableKwh: 13.5, continuousKw: 5.0, rte: 0.90, coupling: 'AC',
    maxUnits: 10, note: 'AC-coupled; lower output than PW3 but stacks deep.'
  },
  enphase_5p: {
    id: 'enphase_5p', brand: 'Enphase', model: 'IQ Battery 5P',
    usableKwh: 5.0, continuousKw: 3.84, rte: 0.90, coupling: 'AC',
    maxUnits: 8, note: 'Small increments — size precisely to the evening load.'
  },
  enphase_10c: {
    id: 'enphase_10c', brand: 'Enphase', model: 'IQ Battery 10C',
    usableKwh: 10.0, continuousKw: 5.76, rte: 0.89, coupling: 'AC',
    maxUnits: 6, note: 'Mid-size AC-coupled; pairs with existing IQ systems.'
  },
  franklin_apower: {
    id: 'franklin_apower', brand: 'Franklin', model: 'aPower',
    usableKwh: 13.6, continuousKw: 5.0, rte: 0.89, coupling: 'AC',
    maxUnits: 6, note: 'Whole-home backup via aGate; retrofits most inverters.'
  },
  franklin_apower2: {
    id: 'franklin_apower2', brand: 'Franklin', model: 'aPower 2',
    usableKwh: 15.0, continuousKw: 10.0, rte: 0.90, coupling: 'AC',
    maxUnits: 6, note: 'Larger pack, double the output of the original aPower.'
  },
  solaredge_home: {
    id: 'solaredge_home', brand: 'SolarEdge', model: 'Home Battery 48V',
    usableKwh: 9.7, continuousKw: 5.0, rte: 0.945, coupling: 'DC',
    maxUnits: 3, note: 'DC-coupled — best round-trip efficiency in the list.'
  },
  lunar: {
    id: 'lunar', brand: 'Lunar Energy', model: 'Lunar System',
    usableKwh: 12.6, continuousKw: 7.6, rte: 0.90, coupling: 'DC',
    maxUnits: 4, note: 'DC-coupled with strong continuous output.'
  },
  generac_pwrcell: {
    id: 'generac_pwrcell', brand: 'Generac', model: 'PWRcell',
    usableKwh: 9.0, continuousKw: 4.5, rte: 0.87, coupling: 'DC',
    maxUnits: 4, note: 'Modular 3 kWh blocks; capacity varies by build.'
  },
  sonnen_core: {
    id: 'sonnen_core', brand: 'Sonnen', model: 'sonnenCore+',
    usableKwh: 10.0, continuousKw: 4.8, rte: 0.88, coupling: 'AC',
    maxUnits: 4, note: 'LFP chemistry; long cycle warranty.'
  }
};

/**
 * Run the dispatch model for one hardware choice at a given unit count.
 * DC-coupled packs get their efficiency edge on the solar-charging leg.
 */
export const evaluateHardware = ({ batteryId, units = 1, ...client }) => {
  const b = BATTERY_CATALOG[batteryId];
  if (!b) return null;
  const capacity = b.usableKwh * units;
  const result = compareBatteryScenarios({
    ...client,
    batteryCapacityKwh: capacity,
    roundTripEfficiency: b.rte,
    maxPowerKw: b.continuousKw * units
  });
  return { battery: b, units, capacityKwh: capacity, ...result };
};

/**
 * Compare hardware options AND unit counts, with marginal analysis.
 *
 * The point of the marginal column: when surplus solar — not capacity — is
 * the binding constraint, the second battery cannot bank any more sunshine.
 * It can still earn on grid arbitrage (buy at super-off-peak, avoid peak),
 * but the solar-credit half of the value stops growing. Showing gain-per-unit
 * keeps a 3-battery quote honest.
 */
export const compareHardwareOptions = ({
  batteryIds = ['pw3', 'franklin_apower2', 'enphase_10c', 'solaredge_home', 'lunar'],
  maxUnits = 3,
  ...client
}) => {
  const options = [];
  for (const id of batteryIds) {
    const b = BATTERY_CATALOG[id];
    if (!b) continue;
    const ladder = [];
    let prevGain = 0;
    const cap = Math.min(maxUnits, b.maxUnits);
    for (let u = 1; u <= cap; u++) {
      const r = evaluateHardware({ batteryId: id, units: u, ...client });
      if (!r) continue;
      const gain = r.recommendation.gain;
      ladder.push({
        units: u,
        capacityKwh: r.capacityKwh,
        gain,
        marginalGain: gain - prevGain,
        marginalPct: prevGain > 0 ? ((gain - prevGain) / prevGain) * 100 : 100,
        solarFillPct: (r.ceiling.summerSolarFillPct + r.ceiling.winterSolarFillPct) / 2,
        winterSolarFillPct: r.ceiling.winterSolarFillPct,
        bindingConstraint: r.ceiling.bindingConstraint,
        peakImportAfterKwh: r.ceiling.peakImportAfterKwh,
        peakExportKwh: r.ceiling.peakExportKwh,
        recommendedPlan: r.recommendation.label
      });
      prevGain = gain;
    }
    options.push({ battery: b, ladder });
  }
  return { options };
};


/**
 * ---------------------------------------------------------------------------
 * EXPORT REBATE / COMMUNITY-PROGRAM ADDERS
 * ---------------------------------------------------------------------------
 * Some CCAs and munis pay ABOVE the utility's export rate for exported kWh —
 * a flat $/kWh adder that stacks on top of NEM credits. It can flip a
 * marginal battery into a clear win, especially paired with evening export.
 *
 * SDCP (San Diego Community Power) — verify current program terms.
 * Amounts are EDITABLE and move with each program cycle.
 */
export const EXPORT_REBATE_PROGRAMS = {
  none:  { id: 'none',  label: 'None', bonusPerKwh: 0 },
  sdcp:  { id: 'sdcp',  label: 'SDCP — San Diego Community Power (+$0.10/kWh)', bonusPerKwh: 0.10 },
  smud:  { id: 'smud',  label: 'SMUD storage/export incentive (+$0.05/kWh)', bonusPerKwh: 0.05 },
  custom:{ id: 'custom', label: 'Custom adder…', bonusPerKwh: 0 }
};
