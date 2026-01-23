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
  ppaPaidOff: false,  // NEW: Track if PPA paid off
  ppaPaidOffYear: currentDate.year,  // NEW: Year PPA was paid off
  
  // Loan specific
  loanDownpayment: 0,
  loanPrincipal: 24000,
  loanTerm: 20,
  loanInterestRate: 5.99,  // NEW: Interest rate
  taxCredit: 0,  // Will auto-calculate as 30% if 0
  taxCreditApplied: false,  // NEW: Changed from appliedToLoan for clarity
  loanPaidOff: false,  // NEW: Track if loan paid off
  loanPaidOffYear: currentDate.year,  // NEW: Year loan was paid off
  
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
 * Annual solar panel degradation rate
 */
export const ANNUAL_DEGRADATION_RATE = 0.0055; // 0.55% per year

/**
 * NEM 2.0 connection fee (monthly)
 */
export const NEM2_CONNECTION_FEE = 12; // $12/month

/**
 * PPA buyout discount (percentage of remaining payments)
 */
export const PPA_BUYOUT_DISCOUNT = 0.30; // 30% discount

/**
 * Federal solar tax credit percentage (ITC)
 */
export const FEDERAL_TAX_CREDIT_PERCENTAGE = 0.30; // 30%
