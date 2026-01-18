import { UTILITY_RATES, TOU_RATES } from './rateData';
import { ANNUAL_DEGRADATION_RATE, NEM2_CONNECTION_FEE } from '../constants/defaults';

/**
 * Get utility rate for a specific year with optional CARE discount
 */
export const getUtilityRate = (year, utility, careDiscount = false) => {
  const rates = UTILITY_RATES[utility];
  let rate;
  
  if (rates[year]) {
    rate = rates[year];
  } else {
    const years = Object.keys(rates).map(Number).sort((a, b) => a - b);
    if (year < years[0]) {
      rate = rates[years[0]];
    } else if (year > years[years.length - 1]) {
      const lastYear = years[years.length - 1];
      const prevYear = years[years.length - 2];
      const avgIncrease = (rates[lastYear] - rates[prevYear]) / rates[prevYear];
      rate = rates[lastYear] * Math.pow(1 + avgIncrease, year - lastYear);
    } else {
      let lowerYear = years[0];
      let upperYear = years[years.length - 1];
      for (let i = 0; i < years.length - 1; i++) {
        if (years[i] <= year && years[i + 1] > year) {
          lowerYear = years[i];
          upperYear = years[i + 1];
          break;
        }
      }
      const ratio = (year - lowerYear) / (upperYear - lowerYear);
      rate = rates[lowerYear] + (rates[upperYear] - rates[lowerYear]) * ratio;
    }
  }
  
  if (careDiscount) {
    rate = rate * 0.70; // 30% discount
  }
  
  return rate;
};

/**
 * Calculate degraded production for a given year
 */
export const getDegradedProduction = (baseProduction, yearsSinceInstall) => {
  return baseProduction * Math.pow(1 - ANNUAL_DEGRADATION_RATE, yearsSinceInstall);
};

/**
 * Calculate usage growth rate based on install vs current usage
 */
export const getUsageGrowthRate = (annualUsageAtInstall, currentAnnualUsage, yearsSinceInstall) => {
  if (yearsSinceInstall === 0) return 0;
  return Math.pow(currentAnnualUsage / annualUsageAtInstall, 1 / yearsSinceInstall) - 1;
};

/**
 * Calculate battery arbitrage savings from TOU rate differentials
 */
export const calculateBatteryArbitrage = (hasBattery, useTOU, utility, batteryCapacity, batteryEfficiency) => {
  if (!hasBattery || !useTOU) return 0;
  
  const touRates = TOU_RATES[utility];
  const dailyCycles = 1;
  const daysPerYear = 365;
  const usableCapacity = batteryCapacity * (batteryEfficiency / 100);
  
  const dailySavings = usableCapacity * (touRates.peak - touRates.offPeak);
  const annualArbitrageSavings = dailySavings * dailyCycles * daysPerYear;
  
  return annualArbitrageSavings;
};

/**
 * Calculate system health and performance ratio
 */
export const calculateSystemHealth = (systemSize, annualProduction) => {
  const expectedProduction = systemSize * 1400; // California average: 1400 kWh/kW/year
  const actualProduction = annualProduction;
  const performanceRatio = (actualProduction / expectedProduction) * 100;
  
  let status = 'excellent';
  let message = 'System performing above expectations';
  
  if (performanceRatio < 70) {
    status = 'poor';
    message = 'System significantly underperforming - inspection recommended';
  } else if (performanceRatio < 85) {
    status = 'fair';
    message = 'System underperforming - may need maintenance';
  } else if (performanceRatio < 95) {
    status = 'good';
    message = 'System performing as expected';
  }
  
  return { performanceRatio, status, message, expectedProduction };
};

/**
 * Calculate NEM impact - credits for overproduction or true-up for under-production
 */
export const calculateNEMImpact = (annualProduction, annualUsage, utilityRate, nemVersion, exportRate) => {
  const netProduction = annualProduction - annualUsage;
  
  if (netProduction > 0) {
    // Overproducing - they receive compensation
    let compensationRate;
    if (nemVersion === 'NEM1') {
      compensationRate = utilityRate; // Retail rate
    } else if (nemVersion === 'NEM2') {
      compensationRate = exportRate; // Typically $0.06-0.08/kWh
    } else {
      compensationRate = 0.05; // NEM 3.0 very low export rate
    }
    
    return {
      type: 'credit',
      amount: netProduction * compensationRate,
      netProduction: netProduction,
      rate: compensationRate
    };
  } else {
    // Under-producing - they owe true-up
    const shortage = Math.abs(netProduction);
    const trueUpAmount = shortage * utilityRate;
    
    return {
      type: 'trueup',
      amount: trueUpAmount,
      shortage: shortage,
      rate: utilityRate
    };
  }
};

/**
 * Calculate loan payment structure with correct tax credit logic
 */
export const calculateLoanPaymentImpact = (program, loanInitialPayment, taxCredit, appliedToLoan, loanPrincipal, loanTerm) => {
  if (program !== 'Loan') {
    return { 
      effectivePayment: 0, 
      first18MonthsPayment: 0,
      after18MonthsPayment: 0,
      description: ''
    };
  }
  
  const monthlyRate = 0.05 / 12; // Assume 5% APR
  const totalMonths = loanTerm * 12;
  
  // First 18 months payment is ALWAYS the same (based on full principal)
  const first18Payment = loanInitialPayment;
  
  if (appliedToLoan) {
    // Tax credit APPLIED to loan - reduces principal after 18 months
    // After 18 months, principal is reduced by tax credit
    const newPrincipal = loanPrincipal - taxCredit;
    const remainingMonths = totalMonths - 18;
    
    const reducedPayment = (newPrincipal * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) / 
                           (Math.pow(1 + monthlyRate, remainingMonths) - 1);
    
    return {
      effectivePayment: first18Payment, // For calculations during first 18 months
      first18MonthsPayment: first18Payment,
      after18MonthsPayment: reducedPayment,
      description: 'Tax credit applied - same first 18 months, then reduces'
    };
  } else {
    // Tax credit NOT applied - payment stays the same throughout
    return {
      effectivePayment: first18Payment,
      first18MonthsPayment: first18Payment,
      after18MonthsPayment: first18Payment,
      description: 'Tax credit not applied - consistent payment throughout'
    };
  }
};

/**
 * Calculate PPA buyout amount (30% discount on remaining payments)
 */
export const calculatePPABuyout = (ppaInitialRate, annualProduction, escalator, yearsPaid, totalTerm = 25) => {
  let remainingValue = 0;
  
  for (let year = yearsPaid; year < totalTerm; year++) {
    const annualPayment = (annualProduction * ppaInitialRate * Math.pow(1 + escalator / 100, year));
    remainingValue += annualPayment;
  }
  
  // Apply 30% discount for buyout
  return remainingValue * 0.70;
};

/**
 * Calculate loan principal remaining at payoff
 */
export const calculateLoanPrincipalAtPayoff = (loanPrincipal, taxCredit, appliedToLoan, loanInitialPayment, yearsPaid, loanTerm) => {
  const monthlyRate = 0.05 / 12; // 5% APR
  const monthsPaid = yearsPaid * 12;
  
  let principal = appliedToLoan ? (loanPrincipal - taxCredit) : loanPrincipal;
  let payment = loanInitialPayment;
  
  // If tax credit not applied, recalculate payment after 18 months
  if (!appliedToLoan && monthsPaid >= 18) {
    // Calculate remaining principal after 18 months with higher payment
    for (let m = 0; m < 18; m++) {
      const interest = principal * monthlyRate;
      const principalPayment = payment - interest;
      principal -= principalPayment;
    }
    
    // Apply tax credit after 18 months
    principal -= taxCredit;
    
    // Recalculate payment for remaining term
    const remainingMonths = (loanTerm * 12) - 18;
    payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) / 
              (Math.pow(1 + monthlyRate, remainingMonths) - 1);
    
    // Continue amortization from month 19 to payoff
    for (let m = 18; m < monthsPaid; m++) {
      const interest = principal * monthlyRate;
      const principalPayment = payment - interest;
      principal -= principalPayment;
    }
  } else {
    // Standard amortization
    for (let m = 0; m < monthsPaid; m++) {
      const interest = principal * monthlyRate;
      const principalPayment = payment - interest;
      principal -= principalPayment;
      
      // Apply tax credit after 18 months if not applied upfront
      if (!appliedToLoan && m === 17) {
        principal -= taxCredit;
        // Recalculate payment
        const remainingMonths = (loanTerm * 12) - 18;
        payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) / 
                  (Math.pow(1 + monthlyRate, remainingMonths) - 1);
      }
    }
  }
  
  return Math.max(0, principal);
};

/**
 * Calculate months since installation
 */
export const getMonthsSinceInstall = (installedYear, installedMonth, nowYear, nowMonth) => {
  return (nowYear - installedYear) * 12 + (nowMonth - installedMonth);
};

/**
 * Main comprehensive savings calculation
 */
export const calculateComprehensiveSavings = (inputs) => {
  const monthsSinceInstall = getMonthsSinceInstall(
    inputs.installedYear, 
    inputs.installedMonth, 
    inputs.nowYear, 
    inputs.nowMonth
  );
  const yearsSinceInstall = monthsSinceInstall / 12;
  const usageGrowthRate = getUsageGrowthRate(
    inputs.annualUsageAtInstall, 
    inputs.currentAnnualUsage, 
    yearsSinceInstall
  );
  
  let loanPaymentStructure = { 
    effectivePayment: 0, 
    first18MonthsPayment: 0, 
    after18MonthsPayment: 0,
    description: '' 
  };
  
  if (inputs.program === 'Loan') {
    loanPaymentStructure = calculateLoanPaymentImpact(
      inputs.program, 
      inputs.loanInitialPayment, 
      inputs.taxCredit, 
      inputs.appliedToLoan,
      inputs.loanPrincipal,
      inputs.loanTerm
    );
  }
  
  let cumulativeSavings = 0;
  let cumulativeCost = 0;
  let cumulativeBatteryCost = 0;
  let cumulativeArbitrageSavings = 0;
  let cumulativeNEMCredits = 0;
  let cumulativeTrueUpCharges = 0;
  let cumulativeNEM2Fees = 0;
  let yearlyData = [];
  
  const initialRate = getUtilityRate(inputs.installedYear, inputs.utility, inputs.onCareProgram);
  
  // Calculate payoff amounts if applicable
  let ppaBuyoutAmount = 0;
  let loanPrincipalAtPayoff = 0;
  
  if (inputs.program === 'PPA' && inputs.ppaPaidOff) {
    const yearsPaid = inputs.ppaPaidOffYear - inputs.installedYear;
    ppaBuyoutAmount = calculatePPABuyout(
      inputs.ppaInitialRate,
      inputs.annualProduction,
      inputs.escalator,
      yearsPaid
    );
  }
  
  if (inputs.program === 'Loan' && inputs.loanPaidOff) {
    const yearsPaid = inputs.loanPaidOffYear - inputs.installedYear;
    loanPrincipalAtPayoff = calculateLoanPrincipalAtPayoff(
      inputs.loanPrincipal,
      inputs.taxCredit,
      inputs.appliedToLoan,
      inputs.loanInitialPayment,
      yearsPaid,
      inputs.loanTerm
    );
  }
  
  for (let year = 0; year <= yearsSinceInstall; year++) {
    const currentYear = inputs.installedYear + year;
    const utilityRate = getUtilityRate(currentYear, inputs.utility, inputs.onCareProgram);
    const projectedUsage = inputs.annualUsageAtInstall * Math.pow(1 + usageGrowthRate, year);
    
    // Apply degradation to production
    const degradedProduction = getDegradedProduction(inputs.annualProduction, year);
    
    const nemImpact = calculateNEMImpact(
      degradedProduction, 
      projectedUsage, 
      utilityRate, 
      inputs.nemVersion, 
      inputs.exportRate
    );
    
    const utilityWouldPay = (projectedUsage / 12) * utilityRate;
    
    // Add NEM 2.0 connection fee
    const nem2MonthlyFee = inputs.nemVersion === 'NEM2' ? NEM2_CONNECTION_FEE : 0;
    
    let solarCost;
    const loanTermEndYear = inputs.installedYear + inputs.loanTerm;
    const ppaTermEndYear = inputs.installedYear + 25; // Assume 25 year PPA term
    
    if (inputs.program === 'Cash') {
      solarCost = 0; // No monthly payment for cash
    } else if (inputs.program === 'PPA') {
      // Check if PPA is paid off or term ended
      if (inputs.ppaPaidOff && currentYear >= inputs.ppaPaidOffYear) {
        solarCost = 0;
      } else if (currentYear >= ppaTermEndYear) {
        solarCost = 0;
      } else {
        const monthlyProduction = degradedProduction / 12;
        solarCost = monthlyProduction * inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, year);
      }
    } else if (inputs.program === 'Loan') {
      // Check if loan is paid off or term ended
      if (inputs.loanPaidOff && currentYear >= inputs.loanPaidOffYear) {
        solarCost = 0;
      } else if (currentYear >= loanTermEndYear) {
        solarCost = 0;
      } else {
        const monthsIntoLoan = year * 12;
        if (monthsIntoLoan < 18) {
          solarCost = loanPaymentStructure.first18MonthsPayment;
        } else {
          solarCost = loanPaymentStructure.after18MonthsPayment;
        }
      }
    } else {
      solarCost = inputs.loanInitialPayment || 0;
    }
    
    const batteryCost = inputs.hasBattery ? inputs.batteryMonthlyPayment : 0;
    const arbitrageSavings = calculateBatteryArbitrage(
      inputs.hasBattery, 
      inputs.useTOU, 
      inputs.utility, 
      inputs.batteryCapacity, 
      inputs.batteryEfficiency
    ) / 12;
    
    const monthlyNEMImpact = nemImpact.amount / 12;
    
    let monthlySavings;
    if (nemImpact.type === 'credit') {
      monthlySavings = utilityWouldPay - solarCost - batteryCost + arbitrageSavings + monthlyNEMImpact - nem2MonthlyFee;
    } else {
      monthlySavings = utilityWouldPay - solarCost - batteryCost + arbitrageSavings - monthlyNEMImpact - nem2MonthlyFee;
    }
    
    const monthsInYear = year === Math.floor(yearsSinceInstall) ? (monthsSinceInstall % 12 || 12) : 12;
    
    for (let m = 0; m < monthsInYear; m++) {
      cumulativeSavings += monthlySavings;
      cumulativeCost += solarCost;
      cumulativeBatteryCost += batteryCost;
      cumulativeArbitrageSavings += arbitrageSavings;
      cumulativeNEM2Fees += nem2MonthlyFee;
      
      if (nemImpact.type === 'credit') {
        cumulativeNEMCredits += monthlyNEMImpact;
      } else {
        cumulativeTrueUpCharges += monthlyNEMImpact;
      }
    }
    
    if (monthsInYear === 12) {
      yearlyData.push({
        year: currentYear,
        utilityRate: utilityRate.toFixed(3),
        projectedUsage: Math.round(projectedUsage),
        degradedProduction: Math.round(degradedProduction),
        utilityCost: Math.round(utilityWouldPay * 12),
        solarCost: Math.round(solarCost * 12),
        batteryCost: Math.round(batteryCost * 12),
        annualSavings: Math.round(monthlySavings * 12),
        cumulativeSavings: Math.round(cumulativeSavings),
        arbitrageSavings: Math.round(arbitrageSavings * 12),
        nem2Fees: Math.round(nem2MonthlyFee * 12),
        nemImpact: nemImpact.type === 'credit' ? Math.round(nemImpact.amount) : -Math.round(nemImpact.amount),
        netProduction: nemImpact.type === 'credit' ? Math.round(nemImpact.netProduction) : Math.round(nemImpact.shortage)
      });
    }
  }
  
  // Add buyout amount to total cost if PPA was paid off
  if (inputs.program === 'PPA' && inputs.ppaPaidOff) {
    cumulativeCost += ppaBuyoutAmount;
  }
  
  // Add remaining principal to total cost if loan was paid off early
  if (inputs.program === 'Loan' && inputs.loanPaidOff) {
    cumulativeCost += loanPrincipalAtPayoff;
  }
  
  // Add tax credit to savings for Loan/Cash
  if ((inputs.program === 'Loan' || inputs.program === 'Cash') && inputs.taxCredit > 0) {
    cumulativeSavings += inputs.taxCredit;
  }
  
  // Calculate total investment
  let totalInvestment;
  if (inputs.program === 'Cash') {
    totalInvestment = inputs.cashNetCost;
  } else if (inputs.program === 'PPA') {
    if (inputs.ppaPaidOff) {
      // If paid off, investment is payments made + buyout
      totalInvestment = cumulativeCost + inputs.ppaDownpayment;
    } else {
      // Full term PPA investment
      const ppaYears = 25;
      let ppaTotal = 0;
      for (let y = 0; y < ppaYears; y++) {
        const yearProduction = getDegradedProduction(inputs.annualProduction, y);
        const monthlyCost = (yearProduction / 12) * inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, y);
        ppaTotal += monthlyCost * 12;
      }
      totalInvestment = ppaTotal + inputs.ppaDownpayment;
    }
  } else if (inputs.program === 'Loan') {
    if (inputs.loanPaidOff) {
      // If paid off, investment is payments made + remaining principal
      totalInvestment = cumulativeCost + inputs.loanDownpayment;
    } else {
      totalInvestment = inputs.loanPrincipal + inputs.loanDownpayment;
    }
  } else {
    totalInvestment = inputs.loanInitialPayment * 12 * 20;
  }
  
  if (inputs.hasBattery && inputs.batteryMonthlyPayment > 0) {
    totalInvestment += inputs.batteryMonthlyPayment * 12 * 10;
  }
  
  const paybackMonths = totalInvestment / (cumulativeSavings / monthsSinceInstall);
  const roi = ((cumulativeSavings / totalInvestment) * 100);
  const currentDegradedProduction = getDegradedProduction(inputs.annualProduction, yearsSinceInstall);
  const offsetPercentage = (currentDegradedProduction / inputs.currentAnnualUsage) * 100;
  const systemHealth = calculateSystemHealth(inputs.systemSize, inputs.annualProduction);
  
  const currentNEMImpact = calculateNEMImpact(
    currentDegradedProduction, 
    inputs.currentAnnualUsage, 
    getUtilityRate(inputs.nowYear, inputs.utility, inputs.onCareProgram),
    inputs.nemVersion,
    inputs.exportRate
  );
  
  return {
    cumulativeSavings: cumulativeSavings.toFixed(2),
    cumulativeCost: cumulativeCost.toFixed(2),
    cumulativeBatteryCost: cumulativeBatteryCost.toFixed(2),
    cumulativeArbitrageSavings: cumulativeArbitrageSavings.toFixed(2),
    cumulativeNEMCredits: cumulativeNEMCredits.toFixed(2),
    cumulativeTrueUpCharges: cumulativeTrueUpCharges.toFixed(2),
    cumulativeNEM2Fees: cumulativeNEM2Fees.toFixed(2),
    monthsSinceInstall,
    yearsSinceInstall: yearsSinceInstall.toFixed(1),
    avgMonthlySavings: (cumulativeSavings / monthsSinceInstall).toFixed(2),
    currentUtilityRate: getUtilityRate(inputs.nowYear, inputs.utility, inputs.onCareProgram).toFixed(3),
    initialUtilityRate: initialRate.toFixed(3),
    rateIncrease: (((getUtilityRate(inputs.nowYear, inputs.utility, inputs.onCareProgram) - initialRate) / initialRate) * 100).toFixed(1),
    yearlyData,
    paybackMonths: paybackMonths.toFixed(1),
    roi: roi.toFixed(1),
    offsetPercentage: offsetPercentage.toFixed(0),
    usageGrowthRate: (usageGrowthRate * 100).toFixed(1),
    systemHealth,
    totalInvestment: totalInvestment.toFixed(2),
    currentNEMImpact,
    loanPaymentStructure,
    ppaBuyoutAmount: ppaBuyoutAmount.toFixed(2),
    loanPrincipalAtPayoff: loanPrincipalAtPayoff.toFixed(2),
    currentDegradedProduction: currentDegradedProduction.toFixed(0),
    utilityBillAtInstall: ((inputs.annualUsageAtInstall / 12) * initialRate).toFixed(2),
    utilityBillNow: ((inputs.currentAnnualUsage / 12) * getUtilityRate(inputs.nowYear, inputs.utility, inputs.onCareProgram)).toFixed(2)
  };
};
