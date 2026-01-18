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
  }
};

// Time-of-Use Rate Structures
export const TOU_RATES = {
  SCE: { 
    peak: 0.55,          // 4-9 PM
    offPeak: 0.27,       // All other times
    superOffPeak: 0.24   // 8 AM - 4 PM weekdays
  },
  PGE: { 
    peak: 0.58, 
    offPeak: 0.30, 
    superOffPeak: 0.26 
  },
  SDGE: { 
    peak: 0.73, 
    offPeak: 0.45, 
    superOffPeak: 0.32 
  }
};

// Utility provider options
export const UTILITY_OPTIONS = [
  { value: 'SCE', label: 'Southern California Edison (SCE)' },
  { value: 'PGE', label: 'Pacific Gas & Electric (PG&E)' },
  { value: 'SDGE', label: 'San Diego Gas & Electric (SDG&E)' }
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