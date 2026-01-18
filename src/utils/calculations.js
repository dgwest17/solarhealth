import { UTILITY_RATES, TOU_RATES } from './rateData';

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
 * Calculate loan payment structure when tax credit is not applied upfront
 */
export const calculateLoanPaymentImpact = (program, loanInitialPayment, taxCredit, appliedToLoan, loanPrincipal, loanTerm) => {
  if (program !== 'Loan') {
    return { 
      effectivePayment: 0, 
      first18MonthsExtra: 0,
      reducedPayment: 0,
      after18Months: 0
    };
  }
  
  if (appliedToLoan) {
    // Tax credit applied to loan - payment stays the same
    return { 
      effectivePayment: loanInitialPayment, 
      first18MonthsExtra: loanInitialPayment,
      reducedPayment: loanInitialPayment,
      after18Months: loanInitialPayment
    };
  }
  
  // Tax credit NOT applied - calculate reduced payment after 18 months
  // Assume they'll apply tax credit to principal after receiving it
  const newPrincipal = loanPrincipal - taxCredit;
  const monthlyRate = 0.05 / 12; // Assume 5% APR
  const remainingMonths = (loanTerm * 12) - 18;
  
  // Calculate new payment after principal reduction
  const reducedPayment = (newPrincipal * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) / 
                         (Math.pow(1 + monthlyRate, remainingMonths) - 1);
  
  return {
    effectivePayment: loanInitialPayment,
    first18MonthsExtra: loanInitialPayment,
    reducedPayment: reducedPayment,
    after18Months: reducedPayment
  };
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
  
  let loanPaymentStructure = { effectivePayment: 0, first18MonthsExtra: 0, reducedPayment: 0, after18Months: 0 };
  
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
  let yearlyData = [];
  
  const initialRate = getUtilityRate(inputs.installedYear, inputs.utility, inputs.onCareProgram);
  
  for (let year = 0; year <= yearsSinceInstall; year++) {
    const currentYear = inputs.installedYear + year;
    const utilityRate = getUtilityRate(currentYear, inputs.utility, inputs.onCareProgram);
    const projectedUsage = inputs.annualUsageAtInstall * Math.pow(1 + usageGrowthRate, year);
    
    const nemImpact = calculateNEMImpact(
      inputs.annualProduction, 
      projectedUsage, 
      utilityRate, 
      inputs.nemVersion, 
      inputs.exportRate
    );
    
    const utilityWouldPay = (projectedUsage / 12) * utilityRate;
    
    let solarCost;
    if (inputs.program === 'Cash') {
      solarCost = 0; // No monthly payment for cash
    } else if (inputs.program === 'PPA') {
      // PPA: Initial rate per kWh * production, escalated each year
      const monthlyProduction = inputs.annualProduction / 12;
      solarCost = monthlyProduction * inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, year);
    } else if (inputs.program === 'Loan') {
      const monthsIntoLoan = year * 12;
      if (!inputs.appliedToLoan && monthsIntoLoan < 18) {
        solarCost = loanPaymentStructure.first18MonthsExtra;
      } else if (!inputs.appliedToLoan && monthsIntoLoan >= 18) {
        solarCost = loanPaymentStructure.after18Months;
      } else {
        solarCost = inputs.loanInitialPayment;
      }
    } else {
      // Other - use a default monthly payment if provided
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
      monthlySavings = utilityWouldPay - solarCost - batteryCost + arbitrageSavings + monthlyNEMImpact;
    } else {
      monthlySavings = utilityWouldPay - solarCost - batteryCost + arbitrageSavings - monthlyNEMImpact;
    }
    
    const monthsInYear = year === Math.floor(yearsSinceInstall) ? (monthsSinceInstall % 12 || 12) : 12;
    
    for (let m = 0; m < monthsInYear; m++) {
      cumulativeSavings += monthlySavings;
      cumulativeCost += solarCost;
      cumulativeBatteryCost += batteryCost;
      cumulativeArbitrageSavings += arbitrageSavings;
      
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
        utilityCost: Math.round(utilityWouldPay * 12),
        solarCost: Math.round(solarCost * 12),
        batteryCost: Math.round(batteryCost * 12),
        annualSavings: Math.round(monthlySavings * 12),
        cumulativeSavings: Math.round(cumulativeSavings),
        arbitrageSavings: Math.round(arbitrageSavings * 12),
        nemImpact: nemImpact.type === 'credit' ? Math.round(nemImpact.amount) : -Math.round(nemImpact.amount),
        netProduction: nemImpact.type === 'credit' ? Math.round(nemImpact.netProduction) : Math.round(nemImpact.shortage)
      });
    }
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
    // For PPA, total investment is all payments over term (typically 20-25 years)
    const ppaYears = 20;
    let ppaTotal = 0;
    for (let y = 0; y < ppaYears; y++) {
      const monthlyProduction = inputs.annualProduction / 12;
      const monthlyCost = monthlyProduction * inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, y);
      ppaTotal += monthlyCost * 12;
    }
    totalInvestment = ppaTotal + inputs.ppaDownpayment;
  } else if (inputs.program === 'Loan') {
    totalInvestment = inputs.loanPrincipal + inputs.loanDownpayment;
  } else {
    totalInvestment = inputs.loanInitialPayment * 12 * 20; // Fallback
  }
  
  if (inputs.hasBattery && inputs.batteryMonthlyPayment > 0) {
    totalInvestment += inputs.batteryMonthlyPayment * 12 * 10;
  }
  
  const paybackMonths = totalInvestment / (cumulativeSavings / monthsSinceInstall);
  const roi = ((cumulativeSavings / totalInvestment) * 100);
  const offsetPercentage = (inputs.annualProduction / inputs.currentAnnualUsage) * 100;
  const systemHealth = calculateSystemHealth(inputs.systemSize, inputs.annualProduction);
  
  const currentNEMImpact = calculateNEMImpact(
    inputs.annualProduction, 
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
    loanPaymentStructure
  };
};
