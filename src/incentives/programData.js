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

/** Usable capacity in kWh, per the sizing tool's DataVal sheet. */
export const BATTERY_MODELS = [
  { id: 'fwh_apower_x',   make: 'FranklinWH', model: 'aPower X',                        usableKwh: 13.6 },
  { id: 'fwh_apower_2',   make: 'FranklinWH', model: 'aPower 2',                        usableKwh: 15.0 },
  { id: 'fwh_apower_s',   make: 'FranklinWH', model: 'aPower S',                        usableKwh: 15.0 },
  { id: 'tesla_pw3',      make: 'Tesla',      model: 'Powerwall 3',                     usableKwh: 13.5 },
  { id: 'tesla_pw3_x1',   make: 'Tesla',      model: 'Powerwall 3 + 1 Expansion Pack',  usableKwh: 27.0 },
  { id: 'tesla_pw3_x2',   make: 'Tesla',      model: 'Powerwall 3 + 2 Expansion Packs', usableKwh: 40.5 },
  { id: 'enphase_10c',    make: 'Enphase',    model: '10C',                             usableKwh: 9.5 },
  { id: 'enphase_5p',     make: 'Enphase',    model: '5P',                              usableKwh: 4.5 },
  { id: 'se_home_400v',   make: 'SolarEdge',  model: 'Home Battery 400V',               usableKwh: 9.7 },
  { id: 'se_nexis_5k',    make: 'SolarEdge',  model: 'Nexis NX-BLCK-5K',                usableKwh: 4.65 },
  { id: 'lunar_10',       make: 'Lunar',      model: 'L2-ESS-10KWH',                    usableKwh: 10.0 },
  { id: 'lunar_15',       make: 'Lunar',      model: 'L2-ESS-15KWH',                    usableKwh: 15.0 },
  { id: 'lunar_20',       make: 'Lunar',      model: 'L2-ESS-20KWH',                    usableKwh: 20.0 },
  { id: 'lunar_25',       make: 'Lunar',      model: 'L2-ESS-20KWH + LE-DC-UNIT',       usableKwh: 25.0 },
  { id: 'lunar_30',       make: 'Lunar',      model: 'L2-ESS-20KWH + 2x LE-DC-UNIT',    usableKwh: 30.0 }
];

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
 * SDG&E seasonal rate defaults used by the Tide model. All-in = generation +
 * delivery. Peak is the 4–9pm window; super-off-peak is the midday/overnight
 * trough the battery charges from.
 */
export const UTILITY_RATE_DEFAULTS = {
  SDGE: { wpeak: 0.354, wsop: 0.0347, speak: 0.669, ssop: 0.0417 },
  SMUD: { wpeak: 0.180, wsop: 0.0900, speak: 0.310, ssop: 0.1000 },
  PGE:  { wpeak: 0.420, wsop: 0.2000, speak: 0.600, ssop: 0.2200 },
  SCE:  { wpeak: 0.380, wsop: 0.1800, speak: 0.550, ssop: 0.2000 }
};

export const getRateDefaults = (utility) =>
  UTILITY_RATE_DEFAULTS[utility] || UTILITY_RATE_DEFAULTS.SDGE;
