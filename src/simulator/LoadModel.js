import { getEvTouPlan } from '../utils/rateData';

/**
 * Load simulator model.
 *
 * Each "load" is an electrification upgrade a homeowner might add. Adding it
 * raises annual usage by an estimated kWh amount, which flows back into the
 * audit engine (currentAnnualUsage) so true-up / offset / battery numbers all
 * recalculate live.
 *
 * kWh estimates are typical California single-family figures. `defaultKwh` is
 * the slider's starting point; min/max bound it. Climate and habits vary, so
 * these are planning estimates, not guarantees.
 */

export const LOAD_TYPES = [
  {
    id: 'ev',
    label: 'Electric Vehicle',
    icon: 'car',
    blurb: 'Charging at home — pick the EV and how many miles you\u2019ll charge here.',
    defaultKwh: 3500,
    minKwh: 500,
    maxKwh: 12000,
    defaultDaytimePct: 30, // most people charge overnight
    note: 'Calculated from the vehicle\u2019s efficiency and your home-charged miles.'
  },
  {
    id: 'hottub',
    label: 'Hot Tub / Spa',
    icon: 'hottub',
    blurb: 'Heating + pumps — scales with tub size and daily soak time.',
    defaultKwh: 2200,
    minKwh: 800,
    maxKwh: 8000,
    defaultDaytimePct: 25, // evening soaks dominate
    note: 'Calculated from tub size and hours of use per day.'
  },
  {
    id: 'heatpump',
    label: 'Heat Pump (HVAC)',
    icon: 'thermostat',
    blurb: 'Replaces gas furnace / older A/C for heating + cooling.',
    defaultKwh: 4000,
    minKwh: 2500,
    maxKwh: 6000,
    defaultDaytimePct: 55,
    note: 'Varies widely by climate zone and home size.'
  },
  {
    id: 'hpwh',
    label: 'Heat Pump Water Heater',
    icon: 'water',
    blurb: 'Replaces a gas or electric-resistance water heater.',
    defaultKwh: 2000,
    minKwh: 1200,
    maxKwh: 3000,
    defaultDaytimePct: 50,
    note: 'Efficient, but adds steady year-round load.'
  },
  {
    id: 'ac',
    label: 'Central A/C',
    icon: 'snow',
    blurb: 'Adding or upgrading air conditioning.',
    defaultKwh: 2500,
    minKwh: 1000,
    maxKwh: 4500,
    defaultDaytimePct: 65, // runs hottest in afternoon/evening
    note: 'Summer-heavy; pairs strongly with solar + battery.'
  },
  {
    id: 'pool',
    label: 'Pool Pump',
    icon: 'pool',
    blurb: 'Pool / spa circulation and heating.',
    defaultKwh: 3000,
    minKwh: 1500,
    maxKwh: 5000,
    defaultDaytimePct: 80, // usually scheduled midday
    note: 'Variable-speed pumps use less; heaters use much more.'
  },
  {
    id: 'appliances',
    label: 'Electric Appliances',
    icon: 'appliance',
    blurb: 'Induction range, electric dryer, etc. (going all-electric).',
    defaultKwh: 1500,
    minKwh: 800,
    maxKwh: 2500,
    defaultDaytimePct: 45,
    note: 'Replacing gas range + dryer with electric.'
  },
  {
    id: 'custom',
    label: 'Other / Custom',
    icon: 'plus',
    blurb: 'Anything else — a workshop, server, second fridge, etc.',
    defaultKwh: 1000,
    minKwh: 200,
    maxKwh: 8000,
    defaultDaytimePct: 50,
    note: 'Set the annual kWh and its day/night split yourself.'
  }
];

/**
 * Total added kWh from the active loads map: { [id]: { kwh, daytimePct } }.
 */
export function totalAddedKwh(activeLoads) {
  return Object.values(activeLoads).reduce((sum, l) => sum + (Number(l.kwh) || 0), 0);
}

export function getLoadType(id) {
  return LOAD_TYPES.find((l) => l.id === id) || null;
}

/**
 * EV catalog — miles-per-kWh efficiency for the common home-charged vehicles.
 * 'custom' lets the user type their own conversion (plug-in hybrids, unusual
 * EVs). Annual kWh = home-charged miles ÷ (mi/kWh), divided by ~0.90 charger
 * efficiency (wall-to-battery losses).
 */
export const EV_MODELS = [
  { id: 'model3', label: 'Tesla Model 3', miPerKwh: 4.0 },
  { id: 'modely', label: 'Tesla Model Y', miPerKwh: 3.6 },
  { id: 'ioniq5', label: 'Hyundai Ioniq 5', miPerKwh: 3.3 },
  { id: 'leaf', label: 'Nissan Leaf', miPerKwh: 3.3 },
  { id: 'bolt', label: 'Chevy Bolt / Equinox EV', miPerKwh: 3.5 },
  { id: 'mache', label: 'Ford Mustang Mach-E', miPerKwh: 3.0 },
  { id: 'r1t', label: 'Rivian R1T / R1S', miPerKwh: 2.1 },
  { id: 'lightning', label: 'Ford F-150 Lightning', miPerKwh: 2.0 },
  { id: 'phev', label: 'Plug-in Hybrid (typical)', miPerKwh: 3.0 },
  { id: 'custom', label: 'Custom / enter efficiency', miPerKwh: 3.0 }
];

export const CHARGER_EFFICIENCY = 0.90; // wall-to-battery losses

export function evAnnualKwh(milesPerYear, miPerKwh) {
  const mi = Number(milesPerYear) || 0;
  const eff = Number(miPerKwh) || 3.0;
  if (mi <= 0 || eff <= 0) return 0;
  return Math.round(mi / eff / CHARGER_EFFICIENCY);
}

/**
 * Hot tub sizes. Daily energy = standby heat-keeping (baseDailyKwh, scales
 * with water volume/surface) + per-hour-of-use energy (heater recovery +
 * jets). Annual = daily × 365.
 */
export const HOTTUB_SIZES = [
  { id: 'small', label: 'Small (2–3 person, ~250 gal)', baseDailyKwh: 2.5, perHourKwh: 1.2 },
  { id: 'medium', label: 'Medium (4–5 person, ~350 gal)', baseDailyKwh: 3.5, perHourKwh: 1.6 },
  { id: 'large', label: 'Large (6–7 person, ~450 gal)', baseDailyKwh: 4.5, perHourKwh: 2.0 },
  { id: 'swimspa', label: 'Swim spa (~1,200+ gal)', baseDailyKwh: 8.0, perHourKwh: 2.8 }
];

export function hottubAnnualKwh(sizeId, hoursPerDay) {
  const size = HOTTUB_SIZES.find((s) => s.id === sizeId) || HOTTUB_SIZES[1];
  const hrs = Math.max(0, Number(hoursPerDay) || 0);
  return Math.round((size.baseDailyKwh + size.perHourKwh * hrs) * 365);
}

/**
 * Weighted average daytime % across all active loads (for display).
 */
export function blendedDaytimePct(activeLoads) {
  const total = totalAddedKwh(activeLoads);
  if (!total) return 0;
  const dayKwh = Object.values(activeLoads)
    .reduce((s, l) => s + (Number(l.kwh) || 0) * ((Number(l.daytimePct) || 0) / 100), 0);
  return Math.round((dayKwh / total) * 100);
}

/**
 * EXTRA-USAGE COST MODEL
 *
 * Rules (per product spec):
 *  - Extra load only starts costing money once total consumption exceeds
 *    production. The "headroom" = production − baseUsage. If the home already
 *    owes a true-up (headroom <= 0), ALL extra load is billable immediately.
 *  - Billable extra kWh is priced by time-of-use:
 *      daytime portion  -> off-peak / super-off-peak (solar hours, cheaper)
 *      nighttime portion -> peak (evening, most expensive)
 *  - Each load carries its own daytimePct, so a midday pool pump draws mostly
 *    off-peak, while an always-on jacuzzi spreads across the tiers.
 *
 * Simplified TOU mapping used here:
 *   daytime kWh   -> off-peak rate (conservative midpoint of super-off-peak/off-peak solar hours)
 *   nighttime kWh -> peak rate
 *
 * Returns { billableKwh, freeKwh, daytimeKwh, nighttimeKwh, cost, effectiveRate }.
 */
export function calcExtraUsageCost(activeLoads, baseUsage, production, touRates) {
  const addedKwh = totalAddedKwh(activeLoads);
  if (addedKwh <= 0 || !touRates) {
    return { billableKwh: 0, freeKwh: 0, daytimeKwh: 0, nighttimeKwh: 0, cost: 0, effectiveRate: 0 };
  }

  // Headroom: production still unused by baseline usage. Negative = already owe.
  const headroom = production - baseUsage;
  const freeKwh = Math.max(0, Math.min(addedKwh, headroom));
  const billableKwh = addedKwh - freeKwh;

  if (billableKwh <= 0) {
    return { billableKwh: 0, freeKwh, daytimeKwh: 0, nighttimeKwh: 0, cost: 0, effectiveRate: 0 };
  }

  // Split the *billable* kWh by the blended day/night ratio of the added loads.
  // (The free kWh is assumed to come off the top proportionally.)
  const dayFrac = blendedDaytimePct(activeLoads) / 100;
  const billableDay = billableKwh * dayFrac;
  const billableNight = billableKwh * (1 - dayFrac);

  // Daytime extra drawn at off-peak (solar hours), nighttime at peak.
  const dayRate = touRates.offPeak;
  const nightRate = touRates.peak;

  const cost = billableDay * dayRate + billableNight * nightRate;
  const effectiveRate = billableKwh > 0 ? cost / billableKwh : 0;

  return {
    billableKwh: Math.round(billableKwh),
    freeKwh: Math.round(freeKwh),
    daytimeKwh: Math.round(billableDay),
    nighttimeKwh: Math.round(billableNight),
    cost,
    effectiveRate
  };
}


/**
 * Price billable extra usage on an EV-TOU plan: scheduled charging lands in
 * super off-peak (12am–6am nightly; weekdays 10am–2pm for the day share), so
 * BOTH shares price at the plan's SOP rate. Also returns the fallback: what
 * the same usage costs at the plan's OFF-PEAK rate if the utility ever
 * removes/narrows super off-peak.
 */
export function calcExtraUsageCostEvTou(billableKwh, planId) {
  const plan = getEvTouPlan(planId);
  if (!plan || billableKwh <= 0) return { cost: 0, fallbackCost: 0, plan: null };
  const cost = billableKwh * plan.superOffPeak;
  const fallbackCost = billableKwh * plan.offPeak;
  return { cost: Math.round(cost), fallbackCost: Math.round(fallbackCost), plan };
}


/**
 * Price extra usage when the EV is scheduled ENTIRELY inside the utility's EV
 * super-off-peak window, independent of the household's overall rate plan.
 *
 * This is the per-EV override: a customer can put just the car on the cheap
 * window without moving their whole account to EV-TOU-5. The EV's billable kWh
 * price at the SOP rate; every other appliance prices normally.
 *
 * Returns the EV portion only — the caller adds it to the non-EV cost.
 */
export function calcEvSuperOffPeakCost(evBillableKwh, planId = 'SDGE_EVTOU5') {
  const plan = getEvTouPlan(planId);
  if (!plan || evBillableKwh <= 0) return { cost: 0, fallbackCost: 0, rate: 0, plan: null };
  return {
    cost: Math.round(evBillableKwh * plan.superOffPeak),
    // If the utility narrows/removes super off-peak, this is the exposure.
    fallbackCost: Math.round(evBillableKwh * plan.offPeak),
    rate: plan.superOffPeak,
    plan
  };
}


// ---- EV vs GAS comparison ----
// Popular gas cars with EPA-combined MPG for the "what would gas cost" story.
export const GAS_CARS = [
  { id: 'camry', label: 'Toyota Camry', mpg: 32 },
  { id: 'rav4', label: 'Toyota RAV4', mpg: 30 },
  { id: 'crv', label: 'Honda CR-V', mpg: 30 },
  { id: 'civic', label: 'Honda Civic', mpg: 36 },
  { id: 'f150', label: 'Ford F-150', mpg: 20 },
  { id: 'silverado', label: 'Chevy Silverado', mpg: 19 },
  { id: 'wrangler', label: 'Jeep Wrangler', mpg: 22 },
  { id: 'highlander', label: 'Toyota Highlander', mpg: 24 },
  { id: 'accord', label: 'Honda Accord', mpg: 32 },
  { id: 'custom', label: 'Custom MPG…', mpg: 25 }
];

// California average regular gas ($/gal) — editable in the UI; update as prices move.
export const GAS_PRICE_DEFAULT = 4.79;

/** Annual gas cost for the same miles the EV would drive. */
export function gasAnnualCost(milesPerYear, mpg, pricePerGal) {
  const m = Number(milesPerYear) || 0, e = Number(mpg) || 1, p = Number(pricePerGal) || 0;
  if (e <= 0) return 0;
  return (m / e) * p;
}

/** Annual cost to home-charge the EV's kWh at the given rate. */
export function evChargeAnnualCost(evKwh, ratePerKwh) {
  return (Number(evKwh) || 0) * (Number(ratePerKwh) || 0);
}
