/**
 * FILE: src/tech/warrantyData.js
 *
 * PRODUCT-LEVEL WARRANTY TABLE + remaining-coverage calculator.
 *
 * Why this exists separately from equipmentData.js:
 *   equipmentData.js holds ONE warranty number per manufacturer. That's too
 *   coarse in two ways that matter for a 15-year book of business:
 *
 *   1. PRODUCT LINE. Franklin's aPower is 12 years; aPower 2 is 15. Enphase's
 *      IQ Battery 5P is 15 years where the older IQ 3/10 were 10.
 *   2. ERA. Warranty terms moved. Qcells, Jinko, Trina and Canadian Solar all
 *      shipped 10-12 year product warranties early last decade and moved to 25
 *      years around 2019-2021. A 2014 Jinko array and a 2023 Jinko array do not
 *      have the same coverage, and telling a 2014 client they have 25 years is
 *      simply wrong.
 *
 * So rules are matched on (make, category, install year, optional product).
 *
 * ============================ ACCURACY NOTICE ============================
 * These are typical US residential terms as published by manufacturers. They
 * are a STARTING POINT for a conversation, not a legal statement of coverage.
 * Real coverage varies by:
 *   - installer certification (REC's 25yr ProTrust needs a certified installer)
 *   - product registration (Fronius ships 5yr + 5yr on registration)
 *   - region and purchase channel
 *   - extended-warranty purchases at time of sale
 *   - transfer rules on home sale
 * Every rule carries a `confidence` field. Anything below 'high' should be
 * verified against the client's actual warranty certificate before you quote
 * it. When in doubt, say "typically X years — let's confirm on your paperwork."
 * =======================================================================
 *
 * Used by: equipment/warranty tracker, end-of-life planning, and the
 * retroactive-battery campaign (who is out of coverage and due for service).
 */

/** Confidence in the encoded term. 'low' means verify before quoting. */
const HIGH = 'high';
const MED = 'medium';
const LOW = 'low';

/**
 * PANELS
 * productYears     = workmanship/product defect coverage
 * performanceYears = power output guarantee
 * endOutputPct     = guaranteed output at end of performance term
 */
export const PANEL_WARRANTIES = [
  // --- Premium tier: 25yr product for the whole modern era ---
  { make: 'sunpower', product: 'Maxeon / X / E Series', from: 2010, to: null, productYears: 25, performanceYears: 25, endOutputPct: 92, confidence: MED,
    note: 'SunPower Chapter 11 (2024). Coverage now serviced via successor channels — treat as at-risk.' },
  { make: 'lg', product: 'NeON / NeON 2 / NeON R', from: 2013, to: 2022, productYears: 25, performanceYears: 25, endOutputPct: 88.4, confidence: MED,
    note: 'LG exited panel manufacturing in 2022. LG stated it would honor existing warranties; verify claim path.' },
  { make: 'panasonic', product: 'HIT / EverVolt', from: 2010, to: null, productYears: 25, performanceYears: 25, endOutputPct: 92, confidence: MED,
    note: 'Panasonic wound down its own module manufacturing (~2021-22); EverVolt branding continues via partners.' },
  { make: 'rec', product: 'Alpha / Alpha Pure', from: 2019, to: null, productYears: 25, performanceYears: 25, endOutputPct: 92, confidence: MED,
    note: '25yr product requires REC-certified (ProTrust) installer; otherwise typically 20yr.' },
  { make: 'rec', product: 'TwinPeak / Peak Energy', from: 2010, to: 2018, productYears: 12, performanceYears: 25, endOutputPct: 80.7, confidence: MED,
    note: 'Pre-Alpha REC product warranty was 10-12yr, later extended on some lines to 20yr.' },
  { make: 'silfab', product: 'All series', from: 2012, to: null, productYears: 25, performanceYears: 25, endOutputPct: 82, confidence: MED,
    note: 'Some newer Silfab lines carry 30yr product — check the model.' },
  { make: 'mission', product: 'MSE series', from: 2014, to: null, productYears: 25, performanceYears: 25, endOutputPct: 80, confidence: MED },

  // --- Volume tier: the 10-12yr -> 25yr transition. This is the big one. ---
  { make: 'qcells', product: 'Q.PEAK DUO', from: 2019, to: null, productYears: 25, performanceYears: 25, endOutputPct: 86, confidence: MED },
  { make: 'qcells', product: 'Q.PEAK / Q.PRO (early)', from: 2010, to: 2018, productYears: 12, performanceYears: 25, endOutputPct: 83, confidence: MED,
    note: 'Early Qcells product warranty was 12yr — do NOT quote 25yr on pre-2019 arrays.' },
  { make: 'jinko', product: 'Tiger / Tiger Neo', from: 2021, to: null, productYears: 25, performanceYears: 25, endOutputPct: 87.4, confidence: MED },
  { make: 'jinko', product: 'Eagle / Cheetah', from: 2010, to: 2020, productYears: 12, performanceYears: 25, endOutputPct: 80.7, confidence: MED,
    note: 'Older Jinko product warranty was 10-12yr.' },
  { make: 'canadian', product: 'HiKu / BiHiKu', from: 2020, to: null, productYears: 25, performanceYears: 25, endOutputPct: 84.8, confidence: MED },
  { make: 'canadian', product: 'CS6 / KuMax (early)', from: 2010, to: 2019, productYears: 12, performanceYears: 25, endOutputPct: 80.7, confidence: MED },
  { make: 'trina', product: 'Vertex', from: 2020, to: null, productYears: 25, performanceYears: 25, endOutputPct: 84.8, confidence: MED },
  { make: 'trina', product: 'Allmax / Honey (early)', from: 2010, to: 2019, productYears: 10, performanceYears: 25, endOutputPct: 80, confidence: MED },

  // --- Orphaned / bankrupt: warranty exists on paper, not in practice ---
  { make: 'solarworld', product: 'Sunmodule', from: 2010, to: 2018, productYears: 10, performanceYears: 25, endOutputPct: 80, confidence: MED,
    note: 'SolarWorld insolvent (2017-18). Treat coverage as effectively void.' },
  { make: 'suniva', product: 'Optimus', from: 2010, to: 2017, productYears: 10, performanceYears: 25, endOutputPct: 80, confidence: LOW,
    note: 'Suniva bankruptcy. Coverage effectively void.' },
  { make: 'yingli', product: 'YGE / Panda', from: 2010, to: 2019, productYears: 10, performanceYears: 25, endOutputPct: 80, confidence: LOW,
    note: 'Yingli financial distress; claims unlikely to be serviced.' },
  { make: 'kyocera', product: 'KD / KU series', from: 2010, to: 2018, productYears: 10, performanceYears: 20, endOutputPct: 80, confidence: LOW,
    note: 'Kyocera exited residential solar (2018).' },
  { make: 'sharp', product: 'ND / NU series', from: 2010, to: 2016, productYears: 10, performanceYears: 25, endOutputPct: 80, confidence: LOW,
    note: 'Sharp exited US residential modules.' },

  // fallback
  { make: 'other_panel', product: 'Unknown', from: 2010, to: null, productYears: 10, performanceYears: 25, endOutputPct: 80, confidence: LOW,
    note: 'Unknown manufacturer — assume the conservative 10yr product term until the certificate is found.' }
];

/**
 * INVERTERS
 * Microinverters and optimizers generally carry far longer terms than string
 * inverters, which is often the single biggest service-cost difference between
 * two otherwise similar systems.
 */
export const INVERTER_WARRANTIES = [
  { make: 'enphase', product: 'IQ7 / IQ8', from: 2018, to: null, productYears: 25, confidence: HIGH },
  { make: 'enphase', product: 'IQ6 / S-series', from: 2014, to: 2018, productYears: 25, confidence: MED },
  { make: 'enphase', product: 'M215 / M250', from: 2011, to: 2014, productYears: 25, confidence: MED,
    note: 'M-series shipped with 15yr and was extended to 25yr on many units — verify serial.' },
  { make: 'enphase', product: 'M190 (early)', from: 2009, to: 2011, productYears: 15, confidence: LOW,
    note: 'Earliest generation; many are past term and failing. Prime replacement candidates.' },

  { make: 'solaredge', product: 'HD-Wave / Home Hub', from: 2016, to: null, productYears: 12, confidence: HIGH,
    note: '12yr standard. Extensions to 20/25yr exist but are uncommon in practice — assume 12 unless the paperwork says otherwise. Power optimizers are 25yr.' },
  { make: 'solaredge', product: 'Original SE string', from: 2010, to: 2016, productYears: 12, confidence: MED,
    note: 'Optimizers 25yr; the inverter is the part that ages out first.' },

  { make: 'sma', product: 'Sunny Boy', from: 2010, to: null, productYears: 10, confidence: MED,
    note: 'Standard 10yr, extendable to 15/20yr. Older units frequently past term.' },
  { make: 'fronius', product: 'Primo / Symo', from: 2013, to: null, productYears: 10, confidence: MED,
    note: 'Typically 5yr + 5yr on product registration — unregistered units may only have 5.' },
  { make: 'apsystems', product: 'DS3 / QS1', from: 2018, to: null, productYears: 25, confidence: MED },
  { make: 'apsystems', product: 'YC500 (early)', from: 2012, to: 2018, productYears: 10, confidence: LOW },
  { make: 'tesla_inv', product: 'Tesla Solar Inverter', from: 2021, to: null, productYears: 12.5, confidence: MED },
  { make: 'generac_inv', product: 'PWRcell inverter', from: 2019, to: null, productYears: 10, confidence: MED },
  { make: 'solark', product: 'Sol-Ark 12K/15K', from: 2019, to: null, productYears: 10, confidence: LOW,
    note: 'Some models 12yr — verify.' },
  { make: 'delta', product: 'Delta string', from: 2014, to: 2022, productYears: 10, confidence: LOW,
    note: 'Delta wound down US residential support — orphaned.' },
  { make: 'abb', product: 'ABB / Power-One Aurora', from: 2010, to: 2019, productYears: 10, confidence: LOW,
    note: 'ABB exited solar inverters (sold to FIMER, 2019). Support is thin — common failure point on 2012-2016 systems.' },
  { make: 'other_inverter', product: 'Unknown', from: 2010, to: null, productYears: 10, confidence: LOW }
];

/**
 * BATTERIES
 * Terms are usually stated as "X years OR Y throughput, whichever first," with
 * an end-of-term capacity retention figure. We track years (the binding term
 * for typical residential cycling) plus retention for the health conversation.
 */
export const BATTERY_WARRANTIES = [
  // Tesla
  { make: 'tesla_pw', product: 'Powerwall 3', from: 2024, to: null, productYears: 10, retentionPct: 70, confidence: HIGH },
  { make: 'tesla_pw', product: 'Powerwall+', from: 2021, to: 2024, productYears: 10, retentionPct: 70, confidence: HIGH },
  { make: 'tesla_pw', product: 'Powerwall 2', from: 2016, to: 2023, productYears: 10, retentionPct: 70, confidence: HIGH,
    note: 'Earliest PW2 units reach end of term from 2026 onward — a real service-conversation trigger.' },

  // Enphase — the 10 -> 15 year jump matters
  { make: 'enphase_bat', product: 'IQ Battery 5P', from: 2023, to: null, productYears: 15, retentionPct: 70, confidence: MED,
    note: '5P moved to a 15yr term — longer than the earlier IQ line.' },
  { make: 'enphase_bat', product: 'IQ Battery 10C / 5C', from: 2024, to: null, productYears: 15, retentionPct: 70, confidence: MED },
  { make: 'enphase_bat', product: 'IQ Battery 3 / 10', from: 2019, to: 2023, productYears: 10, retentionPct: 70, confidence: MED },

  // Franklin — Dave's specific callout: aPower vs aPower 2 differ
  { make: 'franklinwh', product: 'aPower 2', from: 2024, to: null, productYears: 15, retentionPct: 70, confidence: MED,
    note: 'aPower 2 carries a longer term than the original aPower — confirm which unit is installed.' },
  { make: 'franklinwh', product: 'aPower (original)', from: 2021, to: 2024, productYears: 12, retentionPct: 70, confidence: MED },

  { make: 'solaredge_bat', product: 'SolarEdge Home Battery', from: 2019, to: null, productYears: 10, retentionPct: 70, confidence: MED },
  { make: 'generac_pwr', product: 'PWRcell', from: 2019, to: null, productYears: 10, retentionPct: 70, confidence: MED },
  { make: 'sonnen', product: 'sonnenCore / eco', from: 2015, to: null, productYears: 10, retentionPct: 70, confidence: MED,
    note: 'Often stated as 10yr or 10,000 cycles, whichever comes first.' },
  { make: 'panasonic_ev', product: 'EverVolt', from: 2020, to: null, productYears: 10, retentionPct: 60, confidence: LOW,
    note: 'Some EverVolt generations state 12yr — verify model.' },
  { make: 'lg_ess', product: 'RESU 10H / 16H', from: 2016, to: 2022, productYears: 10, retentionPct: 60, confidence: LOW,
    note: 'LG exited residential ESS. Certain RESU units were subject to a fire-risk recall — check serial against the recall list before any service visit.' },
  { make: 'lunar', product: 'Lunar System', from: 2023, to: null, productYears: 12.5, retentionPct: 70, confidence: LOW },
  { make: 'other_battery', product: 'Unknown', from: 2010, to: null, productYears: 10, retentionPct: 70, confidence: LOW }
];

const TABLES = {
  panel: PANEL_WARRANTIES,
  inverter: INVERTER_WARRANTIES,
  battery: BATTERY_WARRANTIES
};

/**
 * Resolve the warranty rule for a component.
 * Matches on make + install year, so a 2014 Jinko gets the 12yr rule and a
 * 2023 Jinko gets 25yr. Falls back to the category's 'other_*' rule.
 */
export const resolveWarranty = (category, make, installYear) => {
  const table = TABLES[category];
  if (!table) return null;
  const yr = Number(installYear);
  const key = (make || '').toLowerCase();

  const candidates = table.filter((r) => r.make === key);
  if (candidates.length && Number.isFinite(yr)) {
    const hit = candidates.find((r) => yr >= r.from && (r.to === null || yr <= r.to));
    if (hit) return hit;
    // Year outside every band — use the closest band rather than nothing.
    return candidates[0];
  }
  if (candidates.length) return candidates[0];
  return table.find((r) => r.make.startsWith('other')) || null;
};

/**
 * Remaining coverage for one component.
 *
 * @param category    'panel' | 'inverter' | 'battery'
 * @param make        slug matching the tables above
 * @param installDate ISO date string, or a year number
 * @param asOf        optional Date for testing
 */
export const getWarrantyStatus = (category, make, installDate, asOf = new Date()) => {
  if (!installDate) return null;

  let start;
  if (typeof installDate === 'number') {
    start = new Date(installDate, 0, 1);
  } else {
    const d = new Date(installDate);
    if (Number.isNaN(d.getTime())) return null;
    start = d;
  }
  const installYear = start.getFullYear();

  const rule = resolveWarranty(category, make, installYear);
  if (!rule) return null;

  const term = rule.productYears;
  const end = new Date(start.getFullYear() + Math.floor(term), start.getMonth(), start.getDate());
  // handle half-year terms (e.g. 12.5)
  if (term % 1 !== 0) end.setMonth(end.getMonth() + Math.round((term % 1) * 12));

  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const yearsRemainingExact = (end.getTime() - asOf.getTime()) / msPerYear;
  const expired = yearsRemainingExact <= 0;
  const yearsRemaining = Math.max(0, Math.floor(yearsRemainingExact));
  const monthsRemainder = Math.max(0, Math.round(yearsRemainingExact * 12) % 12);

  // Coverage risk: a 25-year warranty from a company that no longer exists is
  // not a 25-year warranty. This is the honest version of the number.
  const orphaned = /Chapter 11|exited|insolvent|bankrupt|void|wound down|orphaned|distress/i.test(rule.note || '');

  let status;
  if (expired) status = 'expired';
  else if (orphaned) status = 'at-risk';
  else if (yearsRemainingExact <= 2) status = 'expiring';
  else status = 'covered';

  return {
    category,
    make,
    product: rule.product,
    termYears: term,
    installYear,
    endDate: end.toISOString().slice(0, 10),
    endYear: end.getFullYear(),
    yearsRemaining,
    monthsRemainder,
    yearsRemainingExact: Math.max(0, yearsRemainingExact),
    expired,
    status,                 // covered | expiring | at-risk | expired
    orphaned,
    confidence: rule.confidence,
    note: rule.note || null,
    performanceYears: rule.performanceYears || null,
    endOutputPct: rule.endOutputPct || null,
    retentionPct: rule.retentionPct || null,
    needsVerification: rule.confidence !== HIGH
  };
};

/**
 * Whole-system warranty snapshot. Panels and inverter run off the SOLAR install
 * date; the battery runs off its OWN install date, which is often years later
 * on a retrofit — that difference is the whole point of tracking them apart.
 */
/**
 * PPA / LEASE COVERAGE
 *
 * On a third-party-owned system the provider carries full O&M for the term of
 * the agreement — typically 25 years — regardless of what the component
 * manufacturer's own warranty says. So a 2015 PPA client whose panels shipped
 * with a 12-year product warranty is still covered, because the PPA company is
 * contractually on the hook to keep the system running.
 *
 * Two things this does NOT mean, and both matter in a conversation:
 *
 *   1. Equipment still fails. Coverage is a promise to repair, not immunity.
 *      An inverter at year 14 will still go out; the difference is who pays.
 *      Response time depends entirely on the provider still being solvent and
 *      responsive.
 *   2. Coverage ends when the agreement does. At buyout or end of term the
 *      client owns the hardware outright — and reverts to whatever is left of
 *      the MANUFACTURER warranty, which is often nothing. That's the moment a
 *      20-year-old array becomes the homeowner's problem.
 *
 * We therefore report BOTH: the contract coverage they have now, and the
 * underlying manufacturer position they'd inherit on buyout.
 */
export const PPA_TERM_YEARS = 25;

const isThirdPartyOwned = (program) =>
  program === 'PPA' || program === 'Lease' || program === 'PPA/Lease';

export const getSystemWarrantyStatus = ({
  solarInstallDate,
  batteryInstallDate,
  panelManufacturer,
  inverterManufacturer,
  batteryManufacturer,
  program = null,              // 'PPA' | 'Lease' | 'Loan' | 'Cash' | 'Other'
  extendedWarranty = false     // rep-confirmed extended coverage purchased
}, asOf = new Date()) => {
  const out = {
    panel: panelManufacturer ? getWarrantyStatus('panel', panelManufacturer, solarInstallDate, asOf) : null,
    inverter: inverterManufacturer ? getWarrantyStatus('inverter', inverterManufacturer, solarInstallDate, asOf) : null,
    battery: batteryManufacturer ? getWarrantyStatus('battery', batteryManufacturer, batteryInstallDate || solarInstallDate, asOf) : null
  };

  // ---- Extended warranty (uncommon — only when the rep has confirmed it) ----
  // Applies to the inverter, which is where extensions are actually sold.
  if (extendedWarranty && out.inverter) {
    const extendedTerm = 25;
    if (extendedTerm > out.inverter.termYears) {
      const restated = getWarrantyStatus('inverter', inverterManufacturer, solarInstallDate, asOf);
      if (restated) {
        const start = new Date(restated.installYear, 0, 1);
        const end = new Date(start.getFullYear() + extendedTerm, start.getMonth(), start.getDate());
        const yrsExact = (end.getTime() - asOf.getTime()) / (365.25 * 24 * 3600 * 1000);
        out.inverter = {
          ...out.inverter,
          termYears: extendedTerm,
          endYear: end.getFullYear(),
          endDate: end.toISOString().slice(0, 10),
          yearsRemaining: Math.max(0, Math.floor(yrsExact)),
          monthsRemainder: Math.max(0, Math.round(yrsExact * 12) % 12),
          yearsRemainingExact: Math.max(0, yrsExact),
          expired: yrsExact <= 0,
          status: yrsExact <= 0 ? 'expired' : (yrsExact <= 2 ? 'expiring' : 'covered'),
          extended: true,
          note: 'Extended warranty on file — term raised from the standard 12yr.'
        };
      }
    }
  }

  // ---- Third-party-owned: provider covers O&M for the agreement term ----
  const tpo = isThirdPartyOwned(program);
  let ppa = null;
  if (tpo && solarInstallDate) {
    const start = new Date(typeof solarInstallDate === 'number'
      ? new Date(solarInstallDate, 0, 1) : solarInstallDate);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getFullYear() + PPA_TERM_YEARS, start.getMonth(), start.getDate());
      const yrsExact = (end.getTime() - asOf.getTime()) / (365.25 * 24 * 3600 * 1000);
      ppa = {
        termYears: PPA_TERM_YEARS,
        endYear: end.getFullYear(),
        yearsRemaining: Math.max(0, Math.floor(yrsExact)),
        monthsRemainder: Math.max(0, Math.round(yrsExact * 12) % 12),
        expired: yrsExact <= 0,
        // What they'd inherit if they bought the system out today.
        underlyingExpiredComponents: [out.panel, out.inverter, out.battery]
          .filter((c) => c && c.expired)
          .map((c) => c.category)
      };
    }
  }

  const parts = [out.panel, out.inverter, out.battery].filter(Boolean);
  const anyExpired = parts.some((p) => p.expired);
  const anyExpiring = parts.some((p) => p.status === 'expiring');
  const anyAtRisk = parts.some((p) => p.status === 'at-risk');

  return {
    ...out,
    ppa,
    thirdPartyOwned: tpo,
    // Warranty follows the system, not the owner — it transfers on sale.
    transfersOnSale: true,
    summary: {
      componentsTracked: parts.length,
      anyExpired,
      anyExpiring,
      anyAtRisk,
      // The single line a rep should lead with.
      headline: (ppa && !ppa.expired)
        ? `Covered by your agreement for ${ppa.yearsRemaining} more year${ppa.yearsRemaining === 1 ? '' : 's'}`
        : anyExpired
        ? 'One or more components are out of warranty'
        : anyAtRisk
          ? 'Warranty is on paper but the manufacturer is gone'
          : anyExpiring
            ? 'Warranty coverage ends within 2 years'
            : 'All tracked components are in warranty',
      needsVerification: parts.some((p) => p.needsVerification)
    }
  };
};
