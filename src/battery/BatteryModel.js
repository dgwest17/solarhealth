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
export const calculateExportEconomics = (touRates, exportKwh, importKwh) => {
  const daytimeSellRate = touRates.superOffPeak; // midday export value
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
export const calculateBatteryRecovery = (touRates, exportKwh, importKwh, batteryCapacityKwh, batteryEfficiency = 90) => {
  // How much surplus a battery could realistically time-shift annually
  const maxShiftable = Math.min(exportKwh, importKwh);

  // Capacity ceiling: one usable cycle/day for a year
  const usableDaily = (batteryCapacityKwh || 13.5) * (batteryEfficiency / 100);
  const capacityCeiling = usableDaily * 365;

  const shiftedKwh = Math.min(maxShiftable, capacityCeiling);

  // Without battery: that energy was sold low (midday) — value = shifted × midday
  const withoutBatteryValue = shiftedKwh * touRates.superOffPeak;
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
    middayRate: touRates.superOffPeak
  };
};
