// Historical utility rates ($/kWh) - Updated with correct current rates
export const UTILITY_RATES = {
  PGE: {
    2014: 0.189, 2015: 0.191, 2016: 0.199, 2017: 0.216, 2018: 0.229,
    2019: 0.245, 2020: 0.263, 2021: 0.285, 2022: 0.329, 2023: 0.375,
    2024: 0.420, 2025: 0.480, 2026: 0.495
  },
  SCE: {
    2014: 0.172, 2015: 0.171, 2016: 0.177, 2017: 0.188, 2018: 0.198,
    2019: 0.213, 2020: 0.226, 2021: 0.248, 2022: 0.284, 2023: 0.303,
    2024: 0.316, 2025: 0.314, 2026: 0.341
  },
  SDGE: {
    2014: 0.232, 2015: 0.235, 2016: 0.249, 2017: 0.265, 2018: 0.285,
    2019: 0.315, 2020: 0.265, 2021: 0.340, 2022: 0.420, 2023: 0.440,
    2024: 0.450, 2025: 0.490, 2026: 0.51
  },
  SMUD: {
    2014: 0.118, 2015: 0.121, 2016: 0.124, 2017: 0.128, 2018: 0.133,
    2019: 0.139, 2020: 0.146, 2021: 0.158, 2022: 0.178, 2023: 0.205,
    2024: 0.228, 2025: 0.245, 2026: 0.253
  }
};

// Time-of-Use Rate Structures
export const TOU_RATES = {
  SCE: { 
    peak: 0.65,          // 4-9 PM
    offPeak: 0.35,       // All other times
    superOffPeak: 0.25   // 8 AM - 4 PM weekdays
  },
  PGE: { 
    peak: 0.58, 
    offPeak: 0.30, 
    superOffPeak: 0.26 
  },
  SDGE: { 
    peak: 0.79, 
    offPeak: 0.48, 
    superOffPeak: 0.12 
  },
  SMUD: {
    peak: 0.3765,        // Summer peak: weekdays 5-8 PM
    offPeak: 0.1550,     // Summer off-peak: midnight-noon, weekends/holidays
    superOffPeak: 0.2139 // Summer mid-peak: noon-5 PM & 8 PM-midnight
  }
};

// Utility provider options
export const UTILITY_OPTIONS = [
  { value: 'SCE', label: 'Southern California Edison (SCE)' },
  { value: 'PGE', label: 'Pacific Gas & Electric (PG&E)' },
  { value: 'SDGE', label: 'San Diego Gas & Electric (SDG&E)' },
  { value: 'SMUD', label: 'Sacramento Municipal Utility District (SMUD)' }
];

// NEM version options
export const NEM_OPTIONS = [
  { value: 'NEM1', label: 'NEM 1.0', description: 'Retail rate compensation' },
  { value: 'NEM2', label: 'NEM 2.0', description: 'Wholesale rate compensation' },
  { value: 'NEM3', label: 'NEM 3.0', description: 'Significantly reduced export rate' }
];

// Program type options
export const PROGRAM_OPTIONS = [
  { value: 'PPA', label: 'Power Purchase Agreement (PPA)/Lease' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Loan', label: 'Loan' },
  { value: 'Other', label: 'Other' }
];

// PPA Escalator options (as percentages)
export const PPA_ESCALATOR_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 0.9, label: '0.9%' },
  { value: 1.9, label: '1.9%' },
  { value: 2.9, label: '2.9%' },
  { value: 3.5, label: '3.5%' },
  { value: 3.9, label: '3.9%' }
];

// API provider options
export const API_PROVIDERS = [
  { value: 'enphase', label: 'Enphase (Enlighten)' },
  { value: 'solaredge', label: 'SolarEdge' },
  { value: 'tesla', label: 'Tesla (Powerwall)' },
  { value: 'manual', label: 'Manual Override' }
];

// Installer options — Southern California.
// Grouped: active installers, national financiers/installers, and
// recently-defunct companies (warranty-orphaned customers — prime audit targets).
// "defunct" flag lets the UI/audit highlight orphaned-warranty systems.
export const INSTALLER_OPTIONS = [
  // ---- Active regional / SoCal installers ----
  { value: 'Baker Electric Home Energy', label: 'Baker Electric Home Energy', defunct: false },
  { value: 'Stellar Solar', label: 'Stellar Solar', defunct: false },
  { value: 'Semper Solaris', label: 'Semper Solaris', defunct: false },
  { value: 'Sullivan Solar Power', label: 'Sullivan Solar Power', defunct: true },
  { value: 'Sunline Energy', label: 'Sunline Energy', defunct: false },
  { value: 'SolarTech', label: 'SolarTech', defunct: false },
  { value: 'NRG Clean Power', label: 'NRG Clean Power', defunct: false },
  { value: 'GC Electric Solar', label: 'GC Electric Solar', defunct: false },
  { value: 'Ameco Solar', label: 'Ameco Solar', defunct: false },
  { value: 'Sunlux', label: 'Sunlux', defunct: false },
  { value: 'Action Solar', label: 'Action Solar', defunct: false },
  { value: 'HES Solar', label: 'HES Solar', defunct: false },
  { value: 'Sun Pacific Solar', label: 'Sun Pacific Solar', defunct: false },
  { value: 'Solar Optimum', label: 'Solar Optimum', defunct: false },
  { value: 'LA Solar Group', label: 'LA Solar Group', defunct: false },
  { value: 'Forme Solar', label: 'Forme Solar', defunct: false },
  { value: 'SunPower by (dealer)', label: 'SunPower (dealer install)', defunct: false },
  { value: 'Freedom Forever', label: 'Freedom Forever', defunct: false },
  { value: 'Tesla Energy', label: 'Tesla Energy', defunct: false },
  { value: 'Sunrun', label: 'Sunrun', defunct: false },
  { value: 'Aptos Solar', label: 'Aptos Solar', defunct: false },
  { value: 'Barnes Solar', label: 'Barnes Solar', defunct: false },
  { value: 'Renova Energy', label: 'Renova Energy', defunct: false },

  // ---- Recently defunct / bankrupt (warranty-orphaned) ----
  { value: 'SunPower (legacy corp.)', label: 'SunPower — legacy corp. (Ch.11 2024)', defunct: true },
  { value: 'Sunnova', label: 'Sunnova (Ch.11 2025)', defunct: true },
  { value: 'Titan Solar Power', label: 'Titan Solar Power (closed 2024)', defunct: true },
  { value: 'ADT Solar', label: 'ADT Solar (exited 2024)', defunct: true },
  { value: 'Sunpro Solar', label: 'Sunpro Solar (closed 2023)', defunct: true },
  { value: 'Sunworks', label: 'Sunworks (Ch.7 2024)', defunct: true },
  { value: 'Vivint Solar', label: 'Vivint Solar (absorbed by Sunrun)', defunct: true },
  { value: 'Kuubix', label: 'Kuubix (closed)', defunct: true },
  { value: 'Sungevity', label: 'Sungevity (defunct)', defunct: true },
  { value: 'Petersen Dean', label: 'PetersenDean / PD Solar (closed)', defunct: true },

  { value: 'Other', label: 'Other / Unknown', defunct: false },
];

// Hour-of-day TOU windows ([start,end) 24h) — shared by the battery TOU
// chart, the report, and Green Button bucketing. Hours not in peak or
// superOffPeak are off-peak.
export const TOU_WINDOWS = {
  SDGE: { peak: [16, 21], superOffPeak: [0, 6] },
  SCE: { peak: [16, 21], superOffPeak: [8, 16] },
  PGE: { peak: [16, 21], superOffPeak: [0, 7] },
  SMUD: { peak: [17, 20], superOffPeak: [0, 6] }
};
