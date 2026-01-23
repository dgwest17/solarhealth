/**
 * Get current date
 */
const getCurrentDate = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
};

const currentDate = getCurrentDate();

/**
 * Default input values for the solar calculator
 */
export const DEFAULT_INPUTS = {
  installedYear: 2020,
  installedMonth: 1,
  nowYear: currentDate.year,
  nowMonth: currentDate.month,
  utility: 'SCE',
  systemSize: 8.0,
  annualUsageAtInstall: 10000,
  currentAnnualUsage: 11500,
  annualProduction: 12000,
  
  // Program-specific fields
  program: 'Loan',
  
  // PPA/Lease specific
  ppaInitialRate: 0.12,
  escalator: 0.9,
  ppaDownpayment: 0,
  ppaPaidOffEarly: false,  // NEW: Track if PPA paid off early
  
  // Loan specific
  loanDownpayment: 0,
  loanInitialPayment: 150,
  loanPrincipal: 24000,
  loanTerm: 20,
  taxCredit: 0,  // Will auto-calculate as 30% if 0
  appliedToLoan: false,
  paidOffEarly: false,  // NEW: Track if loan paid off early
  
  // Cash specific
  cashNetCost: 16800, // After 30% tax credit
  
  hasBattery: false,
  nemVersion: 'NEM2',
  exportRate: 0.07,
  onCareProgram: false,
  batteryCapacity: 13.5,
  batteryEfficiency: 90,
  batteryMonthlyPayment: 0,
  apiProvider: 'enphase',
  apiKey: '',
  systemId: '',
  useTOU: false
};

/**
 * Default API status
 */
export const DEFAULT_API_STATUS = {
  connected: false,
  lastSync: null,
  error: null
};

/**
 * Performance thresholds for system health (System Score)
 */
export const PERFORMANCE_THRESHOLDS = {
  excellent: 95,  // >=95% - No alert
  good: 85,       // 85-94% - Yellow alert
  fair: 70,       // 70-84% - Orange alert
  poor: 0         // <70% - Red alert
};

/**
 * California solar production average (kWh per kW per year)
 */
export const CA_SOLAR_PRODUCTION_AVG = 1400;

/**
 * Default loan term in years
 */
export const DEFAULT_LOAN_TERM_YEARS = 20;

/**
 * Default battery lifetime in years
 */
export const DEFAULT_BATTERY_TERM_YEARS = 10;

/**
 * CARE program discount percentage
 */
export const CARE_DISCOUNT_PERCENTAGE = 0.30; // 30% discount

/**
 * Tax credit application period in months
 */
export const TAX_CREDIT_APPLICATION_MONTHS = 18;

/**
 * Federal solar tax credit percentage (ITC)
 */
export const FEDERAL_TAX_CREDIT_PERCENTAGE = 0.30; // 30%

/**
 * NEM 3.0 default export rate
 */
export const NEM3_DEFAULT_EXPORT_RATE = 0.05;
