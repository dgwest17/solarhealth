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
    // ~3,000–4,000 kWh/yr for ~12k miles at typical efficiency
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
    note: 'Set the annual kWh yourself.'
  }
];

/**
 * Total added kWh from the active loads map: { [id]: kWh }.
 */
export function totalAddedKwh(activeLoads) {
  return Object.values(activeLoads).reduce((sum, kwh) => sum + (Number(kwh) || 0), 0);
}

export function getLoadType(id) {
  return LOAD_TYPES.find((l) => l.id === id) || null;
}
