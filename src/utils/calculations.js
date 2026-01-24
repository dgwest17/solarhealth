import { UTILITY_RATES, TOU_RATES } from './rateData';
import { 
  calculateMonthlyPayment, 
  calculateRemainingPrincipal, 
  calculatePaymentAfterTaxCredit 
} from './loanCalculations';
import { 
  ANNUAL_DEGRADATION_RATE, 
  NEM2_CONNECTION_FEE, 
  PPA_BUYOUT_DISCOUNT 
} from '../constants/defaults';

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
 * Solar panels degrade 0.55% per year
 */
export const getDegradedProduction = (initialProduction, yearsSinceInstall) => {
  const degradationFactor = Math.pow(1 - ANNUAL_DEGRADATION_RATE, yearsSinceInstall);
  return initialProduction * degradationFactor;
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
 * Calculate PPA buyout amount
 * Assumes buyout = remaining payments over 25 years at 30% discount
 */
export const calculatePPABuyout = (
  ppaInitialRate,
  escalator,
  annualProduction,
  yearsPaid,
  ppaDownpayment = 0
) => {
  const totalPPAYears = 25;
  const remainingYears = totalPPAYears - yearsPaid;
  
  if (remainingYears <= 0) return 0;
  
  let totalRemainingPayments = 0;
  const monthlyProduction = annualProduction / 12;
  
  for (let year = yearsPaid; year < totalPPAYears; year++) {
    const yearRate = ppaInitialRate * Math.pow(1 + escalator / 100, year);
    const annualPayment = monthlyProduction * yearRate * 12;
    totalRemainingPayments += annualPayment;
  }
  
  // Apply 30% discount for buyout
  const buyoutAmount = totalRemainingPayments * (1 - PPA_BUYOUT_DISCOUNT);
  
  return buyoutAmount;
};

/**
 * Calculate loan payment structure with CORRECTED tax credit logic
 * 
 * CORRECTED LOGIC:
 * - taxCreditApplied = false: Same payment entire time (customer gets tax credit as cash back)
 * - taxCreditApplied = true: Higher payment first 18 months, then LOWER (tax credit reduces principal at 18 months)
 */
export const calculateLoanPaymentStructure = (
  loanPrincipal,
  loanInterestRate,
  loanTerm,
  taxCredit,
  taxCreditApplied,
  loanPaidOff,
  loanPaidOffYear,
  installedYear
) => {
  if (taxCreditApplied) {
    // Tax credit APPLIED to loan at month 18
    // Customer pays HIGHER for 18 months, then principal is reduced and payment LOWERS
    const initialPayment = calculateMonthlyPayment(loanPrincipal, loanInterestRate, loanTerm);
    
    // After 18 months, principal is reduced by tax credit
    const reducedPrincipal = loanPrincipal - taxCredit;
    const remainingYears = loanTerm - 1.5; // 18 months = 1.5 years
    const paymentAfter18Months = calculateMonthlyPayment(reducedPrincipal, loanInterestRate, remainingYears);
    
    return {
      initialPayment: initialPayment,
      paymentAfter18Months: paymentAfter18Months,
      description: 'Tax credit applied at month 18 - payment reduces after',
      principalAtPayoff: loanPaidOff ? 
        calculateRemainingPrincipal(
          reducedPrincipal, 
          loanInterestRate, 
          remainingYears, 
          Math.max(0, ((loanPaidOffYear - installedYear) * 12) - 18)
        ) : 0
    };
  } else {
    // Tax credit NOT applied to loan
    // Customer receives tax credit as cash back, payment stays the same
    const monthlyPayment = calculateMonthlyPayment(loanPrincipal, loanInterestRate, loanTerm);
    
    return {
      initialPayment: monthlyPayment,
      paymentAfter18Months: monthlyPayment, // SAME payment - no change
      description: 'Tax credit NOT applied to loan - payment stays same',
      principalAtPayoff: loanPaidOff ?
        calculateRemainingPrincipal(
          loanPrincipal,
          loanInterestRate,
          loanTerm,
          (loanPaidOffYear - installedYear) * 12
        ) : 0
    };
  }
};

/**
 * Calculate months since installation
 */
export const getMonthsSinceInstall = (installedYear, installedMonth, nowYear, nowMonth) => {
  return (nowYear - installedYear) * 12 + (nowMonth - installedMonth);
};

/**
 * Calculate NEW System Score based on financial performance
 * EXACT CRITERIA per user specifications
 */
export const calculateSystemScore = (
  annualUtilityCost, 
  cumulativeSavings, 
  currentNEMImpact, 
  hasBattery,
  program,
  yearlyData
) => {
  // Determine if savings are trending positive
  let savingsTrendingPositive = true;
  if (yearlyData.length >= 2) {
    const lastYear = yearlyData[yearlyData.length - 1];
    const prevYear = yearlyData[yearlyData.length - 2];
    savingsTrendingPositive = lastYear.annualSavings >= prevYear.annualSavings;
  }
  
  const cumulativeSavingsNum = parseFloat(cumulativeSavings);
  const annualTrueUpOwed = currentNEMImpact.type === 'trueup' ? currentNEMImpact.amount : 0;
  const annualCredit = currentNEMImpact.type === 'credit' ? currentNEMImpact.amount : 0;
  
  // Connection fees threshold (~$120/year)
  const approximateConnectionFees = 120;
  const onlyPayingConnectionFees = annualUtilityCost <= approximateConnectionFees * 1.2;
  
  let score, status, message, recommendation;
  
  // S for SuperSolar
  // Annual utility costs = connection fees only, cumulative savings positive & trending, Annual TRUE-UP IS A CREDIT > $250
  if (onlyPayingConnectionFees && 
      cumulativeSavingsNum > 0 && 
      savingsTrendingPositive && 
      annualCredit > 250) {
    score = 'S';
    status = 'supersolar';
    message = 'SuperSolar Performance! Your system is exceeding expectations.';
    recommendation = `No changes needed. Your system is performing amazingly and you have saved boatloads of money! You are earning money and there is room to grow usage!${!hasBattery ? ' Battery will add backup capabilities.' : ''}`;
  }
  
  // A Grade
  // Annual utility costs = connection fees only, cumulative savings positive & trending, Annual TRUE-UP IS A CREDIT $0-$250
  else if (onlyPayingConnectionFees && 
           cumulativeSavingsNum > 0 && 
           savingsTrendingPositive && 
           annualCredit >= 0 && 
           annualCredit <= 250) {
    score = 'A';
    status = 'excellent';
    message = 'Excellent system performance with strong savings!';
    recommendation = `No changes needed to system, you are earning money and your system has saved you thousands!${!hasBattery ? ' Battery may improve system savings and add backup capabilities.' : ''}`;
  }
  
  // B Grade
  // Cumulative savings positive & trending, Annual true-up OWED $0-$500
  else if (cumulativeSavingsNum > 0 && 
           savingsTrendingPositive && 
           annualTrueUpOwed >= 0 && 
           annualTrueUpOwed <= 500) {
    score = 'B';
    status = 'good';
    message = 'Good system performance with solid savings.';
    recommendation = `Your system is doing well and you've saved a lot. However, you may want to consider adding extra solar${!hasBattery ? ' and a battery may improve system savings while adding backup capabilities' : ''}.`;
  }
  
  // C Grade
  // Cumulative savings positive & trending, Annual true-up OWED $500-$2000
  else if (cumulativeSavingsNum > 0 && 
           savingsTrendingPositive && 
           annualTrueUpOwed > 500 && 
           annualTrueUpOwed <= 2000) {
    score = 'C';
    status = 'fair';
    message = 'Fair performance - system working but could be optimized.';
    recommendation = `You've saved money with solar, it's better than having no solar! However, your system may need an update. Consider adding more panels${!hasBattery ? ' and/or a battery' : ''} to reduce your annual true-up.`;
  }
  
  // F Grade - CHECK FIRST (more specific)
  // Cumulative savings < $100 and may not improve OR Annual true-up OWED $1000+
  else if (cumulativeSavingsNum < 100 || annualTrueUpOwed >= 1000) {
    score = 'F';
    status = 'failing';
    message = 'System significantly underperforming - immediate action needed.';
    
    if (program === 'PPA' || program === 'Lease') {
      recommendation = `Shoot! We believe in solar and what it can do for people. However there are many variables that can lead to a poor experience for a few systems. You may need a system repair or whole new system. Since you have a ${program}, reach out to the company who owns the system for repairs or pursue other actions such as buying out the system or consulting with an installation company.`;
    } else {
      recommendation = `Shoot! We believe in solar and what it can do for people. However there are many variables that can lead to a poor experience for a few systems. You may need a system repair or whole new system. Consult with a repair company or installation company.`;
    }
  }
  
  // D Grade
  // Cumulative savings low and may not improve OR Annual true-up OWED $1000+
  else if (!savingsTrendingPositive || annualTrueUpOwed >= 1000) {
    score = 'D';
    status = 'poor';
    message = 'Below expectations - system needs attention.';
    recommendation = `You've saved money with solar, it's better than having no solar! However, your system may need an update or repair. It is highly recommended you consult a repair firm or add more panels${!hasBattery ? ' and a battery' : ''} to reduce your annual true-up.`;
  }
  
  // Default to C if none match
  else {
    score = 'C';
    status = 'fair';
    message = 'System performance is adequate but could be improved.';
    recommendation = `Your system is working, but there's room for improvement. Consider adding more panels${!hasBattery ? ' and/or a battery' : ''} to reduce your annual true-up.`;
  }
  
  return {
    score,
    status,
    message,
    recommendation,
    metrics: {
      onlyPayingConnectionFees,
      cumulativeSavings: cumulativeSavingsNum,
      savingsTrendingPositive,
      annualTrueUpOwed,
      annualCredit
    }
  };
};
      savingsTrendingPositive,
      annualTrueUpOwed,
      annualCredit
    }
  };
};

/**
 * Main comprehensive savings calculation with ALL FIXES
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
  
  // Auto-calculate tax credit as 30% of principal if not provided
  let calculatedTaxCredit = inputs.taxCredit;
  if (inputs.program === 'Loan' && (!inputs.taxCredit || inputs.taxCredit === 0)) {
    calculatedTaxCredit = inputs.loanPrincipal * 0.30;
  } else if (inputs.program === 'Cash' && (!inputs.taxCredit || inputs.taxCredit === 0)) {
    const grossCost = inputs.cashNetCost / 0.70;
    calculatedTaxCredit = grossCost * 0.30;
  }
  
  // Calculate loan payment structure with FIXED logic
  let loanPaymentStructure = null;
  if (inputs.program === 'Loan') {
    loanPaymentStructure = calculateLoanPaymentStructure(
      inputs.loanPrincipal,
      inputs.loanInterestRate,
      inputs.loanTerm,
      calculatedTaxCredit,
      inputs.taxCreditApplied,  // FIXED: Now uses correct field
      inputs.loanPaidOff,
      inputs.loanPaidOffYear,
      inputs.installedYear
    );
  }
  
  // Calculate PPA buyout if paid off
  let ppaBuyoutCost = 0;
  if (inputs.program === 'PPA' && inputs.ppaPaidOff) {
    const yearsPaid = inputs.ppaPaidOffYear - inputs.installedYear;
    ppaBuyoutCost = calculatePPABuyout(
      inputs.ppaInitialRate,
      inputs.escalator,
      inputs.annualProduction,
      yearsPaid,
      inputs.ppaDownpayment
    );
  }
  
  let cumulativeSavings = 0;
  let cumulativeCost = 0;
  let cumulativeBatteryCost = 0;
  let cumulativeArbitrageSavings = 0;
  let cumulativeNEMCredits = 0;
  let cumulativeTrueUpCharges = 0;
  let cumulativeConnectionFees = 0;  // NEW: Track NEM2 connection fees
  let yearlyData = [];
  
  const initialRate = getUtilityRate(inputs.installedYear, inputs.utility, inputs.onCareProgram);
  const currentRate = getUtilityRate(inputs.nowYear, inputs.utility, inputs.onCareProgram);
  
  // Calculate utility bill at install vs now
  const utilityBillAtInstall = (inputs.annualUsageAtInstall / 12) * initialRate;
  const utilityBillNow = (inputs.currentAnnualUsage / 12) * currentRate;
  
  let currentAnnualUtilityCost = 0;
  
  for (let year = 0; year <= yearsSinceInstall; year++) {
    const currentYear = inputs.installedYear + year;
    const utilityRate = getUtilityRate(currentYear, inputs.utility, inputs.onCareProgram);
    const projectedUsage = inputs.annualUsageAtInstall * Math.pow(1 + usageGrowthRate, year);
    
    // Apply degradation to production (0.55% per year)
    const degradedProduction = getDegradedProduction(inputs.annualProduction, year);
    
    const nemImpact = calculateNEMImpact(
      degradedProduction, 
      projectedUsage, 
      utilityRate, 
      inputs.nemVersion, 
      inputs.exportRate
    );
    
    const utilityWouldPay = (projectedUsage / 12) * utilityRate;
    
    // Calculate solar cost based on program
    let solarCost = 0;
    
    if (inputs.program === 'Cash') {
      solarCost = 0; // No monthly payment for cash
    } 
    else if (inputs.program === 'PPA') {
      // Check if paid off this year
      if (inputs.ppaPaidOff && currentYear >= inputs.ppaPaidOffYear) {
        solarCost = 0; // No more payments after payoff
      } else {
        const monthlyProduction = degradedProduction / 12;
        solarCost = monthlyProduction * inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, year);
      }
    } 
    else if (inputs.program === 'Loan') {
      // Check if paid off or term ended
      if (inputs.loanPaidOff && currentYear >= inputs.loanPaidOffYear) {
        solarCost = 0; // No more payments after payoff
      } else if (year >= inputs.loanTerm) {
        solarCost = 0; // Loan term ended
      } else {
        const monthsIntoLoan = year * 12;
        if (monthsIntoLoan < 18) {
          solarCost = loanPaymentStructure.initialPayment;
        } else {
          solarCost = loanPaymentStructure.paymentAfter18Months;
        }
      }
    } 
    else {
      solarCost = 0;
    }
    
    const batteryCost = inputs.hasBattery ? inputs.batteryMonthlyPayment : 0;
    const arbitrageSavings = calculateBatteryArbitrage(
      inputs.hasBattery, 
      inputs.useTOU, 
      inputs.utility, 
      inputs.batteryCapacity, 
      inputs.batteryEfficiency
    ) / 12;
    
    // NEM 2.0 connection fee
    const connectionFee = inputs.nemVersion === 'NEM2' ? NEM2_CONNECTION_FEE : 0;
    
    const monthlyNEMImpact = nemImpact.amount / 12;
    
    let monthlySavings;
    if (nemImpact.type === 'credit') {
      monthlySavings = utilityWouldPay - solarCost - batteryCost - connectionFee + arbitrageSavings + monthlyNEMImpact;
    } else {
      monthlySavings = utilityWouldPay - solarCost - batteryCost - connectionFee + arbitrageSavings - monthlyNEMImpact;
    }
    
    const monthsInYear = year === Math.floor(yearsSinceInstall) ? (monthsSinceInstall % 12 || 12) : 12;
    
    for (let m = 0; m < monthsInYear; m++) {
      cumulativeSavings += monthlySavings;
      cumulativeCost += solarCost;
      cumulativeBatteryCost += batteryCost;
      cumulativeArbitrageSavings += arbitrageSavings;
      cumulativeConnectionFees += connectionFee;
      
      if (nemImpact.type === 'credit') {
        cumulativeNEMCredits += monthlyNEMImpact;
      } else {
        cumulativeTrueUpCharges += monthlyNEMImpact;
      }
    }
    
    // Track current year annual utility cost for System Score
    if (year === Math.floor(yearsSinceInstall)) {
      currentAnnualUtilityCost = (solarCost + batteryCost + connectionFee) * 12;
      if (nemImpact.type === 'trueup') {
        currentAnnualUtilityCost += nemImpact.amount;
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
        connectionFees: Math.round(connectionFee * 12),
        annualSavings: Math.round(monthlySavings * 12),
        cumulativeSavings: Math.round(cumulativeSavings),
        arbitrageSavings: Math.round(arbitrageSavings * 12),
        nemImpact: nemImpact.type === 'credit' ? Math.round(nemImpact.amount) : -Math.round(nemImpact.amount),
        netProduction: nemImpact.type === 'credit' ? Math.round(nemImpact.netProduction) : Math.round(nemImpact.shortage)
      });
    }
  }
  
  // Add tax credit to savings for Loan if NOT applied, or for Cash
  if (inputs.program === 'Loan' && !inputs.taxCreditApplied && calculatedTaxCredit > 0) {
    cumulativeSavings += calculatedTaxCredit;
  } else if (inputs.program === 'Cash' && calculatedTaxCredit > 0) {
    cumulativeSavings += calculatedTaxCredit;
  }
  
  // Add payoff costs if applicable
  if (inputs.program === 'Loan' && inputs.loanPaidOff && loanPaymentStructure) {
    cumulativeCost += loanPaymentStructure.principalAtPayoff;
  }
  if (inputs.program === 'PPA' && inputs.ppaPaidOff) {
    cumulativeCost += ppaBuyoutCost;
  }
  
  // Calculate total investment
  let totalInvestment;
  if (inputs.program === 'Cash') {
    totalInvestment = inputs.cashNetCost;
  } else if (inputs.program === 'PPA') {
    totalInvestment = cumulativeCost + inputs.ppaDownpayment;
  } else if (inputs.program === 'Loan') {
    totalInvestment = cumulativeCost + inputs.loanDownpayment;
  } else {
    totalInvestment = cumulativeCost;
  }
  
  if (inputs.hasBattery && inputs.batteryMonthlyPayment > 0) {
    totalInvestment += cumulativeBatteryCost;
  }
  
  const paybackYears = totalInvestment / (cumulativeSavings / yearsSinceInstall);
  const offsetPercentage = (getDegradedProduction(inputs.annualProduction, yearsSinceInstall) / inputs.currentAnnualUsage) * 100;
  const roi = ((cumulativeSavings / totalInvestment) * 100);
  
  const currentNEMImpact = calculateNEMImpact(
    getDegradedProduction(inputs.annualProduction, yearsSinceInstall),
    inputs.currentAnnualUsage, 
    currentRate,
    inputs.nemVersion,
    inputs.exportRate
  );
  
  // Calculate System Score
  const systemScore = calculateSystemScore(
    currentAnnualUtilityCost,
    cumulativeSavings.toFixed(2),
    currentNEMImpact,
    inputs.hasBattery,
    inputs.program,
    yearlyData
  );
  
  // Provide backward compatibility for old components
  const systemHealth = {
    performanceRatio: 95,
    status: systemScore.status,
    message: systemScore.message,
    expectedProduction: inputs.systemSize * 1400
  };
  
  // Add backward compatibility for old InputSection
  const backwardCompatibleLoanStructure = loanPaymentStructure ? {
    ...loanPaymentStructure,
    after18Months: loanPaymentStructure.paymentAfter18Months,
    effectivePayment: loanPaymentStructure.initialPayment,
    first18MonthsExtra: loanPaymentStructure.initialPayment,
    reducedPayment: loanPaymentStructure.paymentAfter18Months
  } : {
    after18Months: 0,
    effectivePayment: 0,
    first18MonthsExtra: 0,
    reducedPayment: 0,
    initialPayment: 0,
    paymentAfter18Months: 0
  };

  return {
    cumulativeSavings: cumulativeSavings.toFixed(2),
    cumulativeCost: cumulativeCost.toFixed(2),
    cumulativeBatteryCost: cumulativeBatteryCost.toFixed(2),
    cumulativeArbitrageSavings: cumulativeArbitrageSavings.toFixed(2),
    cumulativeNEMCredits: cumulativeNEMCredits.toFixed(2),
    cumulativeTrueUpCharges: cumulativeTrueUpCharges.toFixed(2),
    cumulativeConnectionFees: cumulativeConnectionFees.toFixed(2),
    monthsSinceInstall,
    yearsSinceInstall: yearsSinceInstall.toFixed(1),
    avgMonthlySavings: (cumulativeSavings / monthsSinceInstall).toFixed(2),
    currentUtilityRate: currentRate.toFixed(3),
    initialUtilityRate: initialRate.toFixed(3),
    rateIncrease: (((currentRate - initialRate) / initialRate) * 100).toFixed(1),
    yearlyData,
    paybackYears: paybackYears.toFixed(1),
    paybackMonths: (paybackYears * 12).toFixed(1),
    roi: roi.toFixed(1),
    offsetPercentage: offsetPercentage.toFixed(0),
    usageGrowthRate: (usageGrowthRate * 100).toFixed(1),
    systemScore,
    systemHealth, // Backward compatibility
    totalInvestment: totalInvestment.toFixed(2),
    currentNEMImpact,
    loanPaymentStructure: backwardCompatibleLoanStructure, // FIXED: Backward compatible
    ppaBuyoutCost: ppaBuyoutCost.toFixed(2),
    calculatedTaxCredit: calculatedTaxCredit.toFixed(2),
    utilityBillAtInstall: utilityBillAtInstall.toFixed(2),
    utilityBillNow: utilityBillNow.toFixed(2),
    utilityBillIncrease: ((utilityBillNow - utilityBillAtInstall) / utilityBillAtInstall * 100).toFixed(1),
    currentAnnualUtilityCost: currentAnnualUtilityCost.toFixed(2),
    currentDegradedProduction: getDegradedProduction(inputs.annualProduction, yearsSinceInstall).toFixed(0)
  };
};
