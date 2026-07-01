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
    blurb: 'Charging at home — the single biggest load most homes add.',
    defaultKwh: 3500,
    minKwh: 2000,
    maxKwh: 6000,
    defaultDaytimePct: 30, // most people charge overnight
    note: 'Based on ~12,000 miles/year. A second EV roughly doubles this.'
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
