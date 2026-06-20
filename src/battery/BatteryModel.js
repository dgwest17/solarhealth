/**
 * Battery Analysis — load + production modeling
 *
 * All curves are 24 normalized hourly weights (index 0 = 12am … 23 = 11pm).
 * Weights are relative shape only; they get scaled to the client's actual
 * annual usage / production so the overlay reflects THEIR system.
 *
 * These are sensible defaults — tune the shapes here as needed.
 */

// Normalized consumption shapes (relative weights, any scale — we normalize)
export const CONSUMPTION_PROFILES = {
  evening_heavy: {
    label: 'Evening Heavy',
    // Spike 4pm–10pm
    hourly: [3, 2, 2, 2, 2, 3, 4, 5, 4, 3, 3, 3, 3, 3, 3, 4, 7, 9, 10, 10, 9, 7, 5, 4]
  },
  wfh_couple: {
    label: 'Work From Home Couple',
    // Elevated through the workday, moderate evening
    hourly: [3, 2, 2, 2, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 6, 5, 4, 4, 3]
  },
  wfh_kids: {
    label: 'Work From Home With Kids',
    // Daytime + strong morning and evening peaks
    hourly: [3, 2, 2, 2, 3, 4, 6, 7, 6, 6, 6, 6, 6, 6, 6, 7, 8, 9, 9, 8, 6, 5, 4, 3]
  },
  retired_couple: {
    label: 'Retired Couple',
    // Fairly flat, home all day, gentle evening rise
    hourly: [3, 2, 2, 2, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 5, 4, 4, 3]
  },
  daytime_heavy: {
    label: 'Daytime Heavy',
    // Midday dominant (pool pumps, daytime AC, business at home)
    hourly: [2, 2, 2, 2, 2, 2, 3, 4, 6, 8, 9, 10, 10, 10, 9, 8, 6, 5, 4, 3, 3, 2, 2, 2]
  },
  ev_midnight: {
    label: 'EV Charging After Midnight',
    // Big overnight charging block 12am–3am + normal evening
    hourly: [10, 10, 10, 8, 4, 3, 4, 5, 4, 3, 3, 3, 3, 3, 3, 4, 6, 7, 7, 6, 5, 5, 6, 8]
  },
  summer_cooling: {
    label: 'Summer Cooling',
    // AC ramps midday and holds into late evening
    hourly: [4, 3, 3, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 9, 8, 7, 6, 5, 5, 4]
  },
  winter_heating: {
    label: 'Winter Electric Heating',
    // Morning + evening heating peaks
    hourly: [5, 4, 4, 4, 5, 7, 9, 10, 8, 6, 5, 5, 5, 5, 5, 6, 7, 9, 10, 9, 8, 7, 6, 5]
  }
};

/**
 * Solar production shape — SoCal daytime bell curve.
 * ~6am first light, ~7pm last light, peak ~1pm. Normalized weights.
 */
export const PRODUCTION_SHAPE = [
  0, 0, 0, 0, 0, 0,        // 12am–5am: dark
  0.5, 2, 4.5, 7, 9, 10,   // 6am–11am: ramp up
  10.5, 10, 8.5, 6.5, 4.5, 2.5, // 12pm–5pm: peak then fall
  0.8, 0, 0, 0, 0, 0       // 6pm–11pm: dusk to dark
];

/**
 * Scale a normalized 24h shape so its daily total equals dailyTotalKwh.
 */
const scaleShapeToDaily = (shape, dailyTotalKwh) => {
  const sum = shape.reduce((a, b) => a + b, 0);
  if (sum === 0) return shape.map(() => 0);
  return shape.map((w) => (w / sum) * dailyTotalKwh);
};

/**
 * Build the 24-hour overlay dataset for the chart.
 * Returns [{ hour, hourLabel, consumption, production }] plus summary stats.
 */
export const buildDailyOverlay = (profileKey, annualUsageKwh, annualProductionKwh) => {
  const profile = CONSUMPTION_PROFILES[profileKey] || CONSUMPTION_PROFILES.evening_heavy;
  const dailyUsage = annualUsageKwh / 365;
  const dailyProduction = annualProductionKwh / 365;

  const consumption = scaleShapeToDaily(profile.hourly, dailyUsage);
  const production = scaleShapeToDaily(PRODUCTION_SHAPE, dailyProduction);

  const hourLabel = (h) => {
    if (h === 0) return '12a';
    if (h === 12) return '12p';
    return h < 12 ? `${h}a` : `${h - 12}p`;
  };

  let daytimeOverproduction = 0; // kWh/day produced beyond consumption (exportable)
  let nighttimeImport = 0;       // kWh/day consumed with no production (imported)

  const data = production.map((prod, h) => {
    const cons = consumption[h];
    const surplus = Math.max(0, prod - cons);
    daytimeOverproduction += surplus;
    if (prod === 0) nighttimeImport += cons;

    return {
      hour: h,
      hourLabel: hourLabel(h),
      consumption: Math.round(cons * 100) / 100,
      production: Math.round(prod * 100) / 100,
      // Overlap band: the portion of production that goes to the grid
      surplus: Math.round(surplus * 100) / 100
    };
  });

  const isOverProducer = dailyProduction > dailyUsage;

  return {
    data,
    dailyUsage,
    dailyProduction,
    isOverProducer,
    annualDaytimeOverproduction: Math.round(daytimeOverproduction * 365),
    annualNighttimeImport: Math.round(nighttimeImport * 365)
  };
};

/* ============================================================
   SECTION 3 & 4 — Export economics + battery recovery
   ============================================================ */

// Hardcoded constants (from research / NEM rules). Override in code as needed.
export const GRID_LOSS_PCT = 15;            // line/transmission loss
export const NET_COMPENSATION_RATE = 0.06;  // $/kWh net export comp (NEM3-style)
export const NEM3_EXPORT_RATE = 0.035;       // $/kWh daytime export once NEM ends (~$0.03–0.04)

/**
 * The rate at which exported daytime energy is CREDITED, by utility.
 * Most CA TOU plans value midday export at the super-off-peak tier, but
 * SDG&E credits daytime export at the OFF-PEAK tier (higher than super-off-peak).
 * Centralizing this so every calc uses the correct per-utility export rate.
 */
export const getExportCreditRate = (touRates, utility) => {
  if (utility === 'SDGE') return touRates.offPeak;
  return touRates.superOffPeak;
};

/**
 * Hours considered "daytime" (production) vs "nighttime" (import).
 * Aligns with the production bell curve (~6am–7pm).
 */
const isDaytimeHour = (h) => h >= 6 && h <= 18;

/**
 * Section 3 — Export inefficiency economics.
 *
 * exportKwh / importKwh: annual kWh. If manual=false they come from the
 * overlay model; if manual=true the caller supplies them.
 *
 * Daytime sell rate = utility superOffPeak (midday, when solar dumps to grid).
 * Night buy rate     = utility peak (4-9pm+ when home pulls from grid).
 */
export const calculateExportEconomics = (touRates, exportKwh, importKwh, utility) => {
  const daytimeSellRate = getExportCreditRate(touRates, utility); // per-utility export value
  const nightBuyRate = touRates.peak;            // evening/peak import cost

  const valueSold = exportKwh * daytimeSellRate;
  const valueBought = importKwh * nightBuyRate;
  const netCompensation = (exportKwh - importKwh) * NET_COMPENSATION_RATE;

  return {
    daytimeSellRate,
    nightBuyRate,
    valueSold,
    valueBought,
    netCompensation,
    exportKwh,
    importKwh
  };
};

/**
 * Section 4 — Battery recovery value.
 *
 * Instead of dumping daytime surplus to the grid at the low midday rate
 * and buying back at peak, a battery stores that surplus and offsets the
 * peak-rate import. Recovered value = energy shifted × (peak − midday).
 *
 * recoverableKwh is the lesser of daytime surplus and nighttime need
 * (a battery can't shift more than it stores or more than the home uses),
 * further capped by usable battery capacity over the year.
 */
export const calculateBatteryRecovery = (touRates, exportKwh, importKwh, batteryCapacityKwh, batteryEfficiency = 90, utility) => {
  // How much surplus a battery could realistically time-shift annually
  const maxShiftable = Math.min(exportKwh, importKwh);

  // Capacity ceiling: one usable cycle/day for a year
  const usableDaily = (batteryCapacityKwh || 13.5) * (batteryEfficiency / 100);
  const capacityCeiling = usableDaily * 365;

  const shiftedKwh = Math.min(maxShiftable, capacityCeiling);

  const exportRate = getExportCreditRate(touRates, utility);
  // Without battery: that energy was sold low (export rate) — value = shifted × export
  const withoutBatteryValue = shiftedKwh * exportRate;
  // With battery: that energy offsets peak imports — value = shifted × peak
  const withBatteryValue = shiftedKwh * touRates.peak;

  const annualRecovered = withBatteryValue - withoutBatteryValue;

  return {
    shiftedKwh: Math.round(shiftedKwh),
    capacityCeiling: Math.round(capacityCeiling),
    withoutBatteryValue,
    withBatteryValue,
    annualRecovered,
    peakRate: touRates.peak,
    middayRate: exportRate
  };
};

/* ============================================================
   ENERGY CREDITS vs. REAL MONEY (NEM 1.0 / 2.0 reframing)
   ------------------------------------------------------------
   Exporting to the grid banks "energy credits" valued at the
   export/midday rate — NOT cash. The only real money is the
   year-end net true-up at NET_COMPENSATION_RATE ($0.06/kWh)
   on net exported kWh. A customer can gross-overproduce and
   STILL owe a true-up, because daytime credits (banked low)
   don't cover nighttime imports (charged high).
   ============================================================ */

/**
 * Energy-credit economics without a battery.
 *
 * Reframed true-up logic:
 *  - A NET OVER-PRODUCER (exports >= imports, by kWh) does NOT owe a real
 *    true-up under current NEM 2.0/1.0 — their banked credits net out the
 *    annual balance. We still surface the POTENTIAL true-up they'd face once
 *    net-metering goes away (post-NEM), so they see the looming risk.
 *  - A NET OVER-CONSUMER (imports > exports) owes a real true-up now:
 *    the kWh shortfall billed at the import (peak) rate.
 *
 * export rate is per-utility (SDG&E credits daytime export at off-peak).
 */
export const calculateEnergyCredits = (touRates, exportKwh, importKwh, utility) => {
  const exportRate = getExportCreditRate(touRates, utility); // per-utility credit rate
  const importRate = touRates.peak;          // evening/peak import rate

  const creditsEarned = exportKwh * exportRate;
  const importCost = importKwh * importRate;
  const netKwh = exportKwh - importKwh;
  const isNetOverProducer = netKwh >= 0;

  // Real money paid to a net over-producer at year-end (NEM3-style net comp)
  const realMoney = netKwh > 0 ? netKwh * NET_COMPENSATION_RATE : 0;

  // REAL true-up today: only when they're a net over-CONSUMER (kWh shortfall).
  const shortfallKwh = netKwh < 0 ? Math.abs(netKwh) : 0;
  const trueUpOwed = shortfallKwh * importRate;

  // POTENTIAL true-up once net metering ends (NEM 3.0 reality): daytime export
  // collapses to ~$0.03–0.04/kWh while imports stay at full nighttime peak.
  // So the gap is imports-at-peak MINUS exports-at-the-tiny-NEM3-rate — far
  // larger than today's credit shortfall.
  const nem3CreditsEarned = exportKwh * NEM3_EXPORT_RATE;
  const potentialTrueUp = Math.max(0, importCost - nem3CreditsEarned);

  return {
    exportRate,
    importRate,
    creditsEarned,
    importCost,
    netKwh,
    realMoney,
    trueUpOwed,          // real, current — nonzero only for over-consumers
    potentialTrueUp,     // looming risk as NEM is lost
    shortfallKwh,
    isNetOverProducer
  };
};

/**
 * Energy Credits Recovered by a battery.
 * With a battery the customer "sells to themselves": stored surplus offsets
 * peak imports, so the shifted kWh is effectively recovered at the PEAK rate
 * instead of being dumped at the midday rate.
 */
export const calculateCreditsRecovered = (touRates, exportKwh, importKwh, batteryCapacityKwh, batteryEfficiency = 90, utility) => {
  const recovery = calculateBatteryRecovery(touRates, exportKwh, importKwh, batteryCapacityKwh, batteryEfficiency, utility);
  const credits = calculateEnergyCredits(touRates, exportKwh, importKwh, utility);

  return {
    ...recovery,
    creditsRecovered: recovery.annualRecovered, // peak − export spread on shifted kWh
    realMoneyNetExport: credits.realMoney,       // $0.06 × net export (over-producers)
    isNetOverProducer: credits.isNetOverProducer,
    netKwh: credits.netKwh
  };
};

/**
 * 10-year projection of credit value LOST if the customer does nothing,
 * as the utility keeps raising nighttime/peak rates to cope with rising
 * demand (data centers, AI, EVs). Each year peak import rate escalates;
 * the gap between what they pay at night and the credits they banked at
 * midday widens.
 *
 * peakEscalationPct: annual % increase in peak import rate (default 8%).
 * Returns yearly rows + cumulative lost credit value over 10 years.
 */
export const projectCreditLoss = (touRates, exportKwh, importKwh, peakEscalationPct = 8, years = 10, utility) => {
  const rows = [];
  let cumulative = 0;
  const baseImportRate = touRates.peak;
  const exportRate = getExportCreditRate(touRates, utility);

  for (let y = 0; y < years; y++) {
    const escalatedImportRate = baseImportRate * Math.pow(1 + peakEscalationPct / 100, y);
    // Annual gap: what they pay to import at night vs. credits banked by day
    const importCost = importKwh * escalatedImportRate;
    const creditsEarned = exportKwh * exportRate; // export credits roughly flat (already suppressed)
    const annualGap = Math.max(0, importCost - creditsEarned);
    cumulative += annualGap;

    rows.push({
      year: new Date().getFullYear() + y,
      importRate: Math.round(escalatedImportRate * 1000) / 1000,
      annualGap: Math.round(annualGap),
      cumulative: Math.round(cumulative)
    });
  }

  return {
    rows,
    totalLost: Math.round(cumulative),
    peakEscalationPct,
    finalYearRate: rows[rows.length - 1].importRate
  };
};

/* ============================================================
   SECTION 6 — Battery Stabilization economics
   (Upfront / Finance / Lease + VPP rebate)
   ============================================================ */

/**
 * Estimated essential backup hours from raw total storage.
 * Uses RAW kWh (note in UI: ~90% round-trip efficiency + reserve apply).
 */
export const estimateBackupHours = (totalKwh, essentialLoadKw = 0.75) => {
  if (!essentialLoadKw) return 0;
  return Math.round((totalKwh / essentialLoadKw) * 10) / 10;
};

/**
 * Stabilization value for each purchase option.
 *
 * recoveredValuePerYear = Energy Credits Recovered / year (from §4)
 * vppPerYear            = VPP rebate $/battery/yr × battery count (if enabled)
 * ARS (Annual Recovered Savings) = recoveredValuePerYear + vppPerYear
 *
 * Upfront:  netInvestment = batteryValue − federal − localRebate
 *           roiYears = netInvestment / ARS
 * Finance/Lease: MRS = ARS / 12; monthlyInvestment = payment − MRS
 *           if positive → "only $X/mo"; if negative → annual net win = |monthly|×12
 */
export const calculateStabilization = (option, inputs, recoveredValuePerYear, batteryCount, vppEnabled, vppPerBattery) => {
  const vppPerYear = vppEnabled ? (vppPerBattery || 250) * (batteryCount || 1) : 0;
  const ars = recoveredValuePerYear + vppPerYear;

  const base = { ars, vppPerYear, recoveredValuePerYear };

  if (option === 'upfront') {
    const batteryValue = Number(inputs.batteryValue) || 0;
    const federal = Number(inputs.federalIncentive) || 0;
    const local = Number(inputs.localRebate) || 0;
    const netInvestment = Math.max(0, batteryValue - federal - local);
    const roiYears = ars > 0 ? netInvestment / ars : null;
    return { ...base, option, netInvestment, roiYears };
  }

  // Finance & Lease share the monthly math
  const monthlyPayment = Number(inputs.monthlyPayment) || 0;
  const mrs = ars / 12;
  const monthlyInvestment = monthlyPayment - mrs; // positive = net cost, negative = net win
  const isNetWin = monthlyInvestment < 0;
  const annualNetWin = isNetWin ? Math.abs(monthlyInvestment) * 12 : 0;

  return {
    ...base,
    option,
    monthlyPayment,
    mrs,
    monthlyInvestment,
    isNetWin,
    annualNetWin
  };
};
