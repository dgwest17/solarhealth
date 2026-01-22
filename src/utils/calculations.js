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
 * Calculate NEW System Score based on financial performance and true-up status
 * S = SuperSolar, A, B, C, D, F
 */
export const calculateSystemScore = (
  annualUtilityCost, 
  cumulativeSavings, 
  currentNEMImpact, 
  hasBattery,
  program,
  yearlyData
) => {
  // Determine if savings are trending positive (compare last 2 years if available)
  let savingsTrendingPositive = true;
  if (yearlyData.length >= 2) {
    const lastYear = yearlyData[yearlyData.length - 1];
    const prevYear = yearlyData[yearlyData.length - 2];
    savingsTrendingPositive = lastYear.annualSavings >= prevYear.annualSavings;
  }
  
  const cumulativeSavingsNum = parseFloat(cumulativeSavings);
  const annualTrueUp = currentNEMImpact.type === 'trueup' ? currentNEMImpact.amount : 0;
  const annualCredit = currentNEMImpact.type === 'credit' ? currentNEMImpact.amount : 0;
  
  // Approximate connection fees (varies by utility, using ~$120/year average)
  const approximateConnectionFees = 120;
  const onlyPayingConnectionFees = annualUtilityCost <= approximateConnectionFees * 1.2; // 20% buffer
  
  let score, status, message, recommendation;
  
  // S for SuperSolar
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
  else if (cumulativeSavingsNum > 0 && 
           savingsTrendingPositive && 
           annualTrueUp >= 0 && 
           annualTrueUp <= 500) {
    score = 'B';
    status = 'good';
    message = 'Good system performance with solid savings.';
    recommendation = `Your system is doing well and you've saved a lot. However, you may want to consider adding extra solar${!hasBattery ? ' and a battery may improve system savings while adding backup capabilities' : ''}.`;
  }
  
  // C Grade
  else if (cumulativeSavingsNum > 0 && 
           savingsTrendingPositive && 
           annualTrueUp > 500 && 
           annualTrueUp <= 2000) {
    score = 'C';
    status = 'fair';
    message = 'Fair performance - system working but could be optimized.';
    recommendation = `You've saved money with solar, it's better than having no solar! However, your system may need an update. Consider adding more panels${!hasBattery ? ' and/or a battery' : ''} to reduce your annual true-up.`;
  }
  
  // D Grade
  else if (cumulativeSavingsNum >= 100 && 
           !savingsTrendingPositive && 
           annualTrueUp >= 1000) {
    score = 'D';
    status = 'poor';
    message = 'Below expectations - system needs attention.';
    recommendation = `You've saved money with solar, it's better than having no solar! However, your system may need an update or repair. It is highly recommended you consult a repair firm or add more panels${!hasBattery ? ' and a battery' : ''} to reduce your annual true-up.`;
  }
  
  // F Grade
  else if (cumulativeSavingsNum < 100 && 
           annualTrueUp >= 1000) {
    score = 'F';
    status = 'failing';
    message = 'System significantly underperforming - immediate action needed.';
    
    if (program === 'PPA' || program === 'Lease') {
      recommendation = `Shoot! We believe in solar and what it can do for people. However there are many variables that can lead to a poor experience for a few systems. You may need a system repair or whole new system. Since you have a ${program}, reach out to the company who owns the system for repairs or pursue other actions such as buying out the system or consulting with an installation company.`;
    } else {
      recommendation = `Shoot! We believe in solar and what it can do for people. However there are many variables that can lead to a poor experience for a few systems. You may need a system repair or whole new system. Consult with a repair company or installation company.`;
    }
  }
  
  // Default to C if none of the above match
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
      annualTrueUp,
      annualCredit
    }
  };
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
    // Tax credit applied to loan - payment stays the same throughout
    return { 
      effectivePayment: loanInitialPayment, 
      first18MonthsExtra: loanInitialPayment,
      reducedPayment: loanInitialPayment,
      after18Months: loanInitialPayment
    };
  }
  
  // Tax credit NOT applied - calculate reduced payment after 18 months
  const newPrincipal = loanPrincipal - taxCredit;
  const monthlyRate = 0.05 / 12; // Assume 5% APR
  const remainingMonths = (loanTerm * 12) - 18;
  
  // Calculate new reduced payment after principal reduction
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
  
  // Auto-calculate tax credit as 30% of principal if not provided
  let calculatedTaxCredit = inputs.taxCredit;
  if (inputs.program === 'Loan' && (!inputs.taxCredit || inputs.taxCredit === 0)) {
    calculatedTaxCredit = inputs.loanPrincipal * 0.30;
  } else if (inputs.program === 'Cash' && (!inputs.taxCredit || inputs.taxCredit === 0)) {
    const grossCost = inputs.cashNetCost / 0.70;
    calculatedTaxCredit = grossCost * 0.30;
  }
  
  let loanPaymentStructure = { effectivePayment: 0, first18MonthsExtra: 0, reducedPayment: 0, after18Months: 0 };
  
  if (inputs.program === 'Loan') {
    loanPaymentStructure = calculateLoanPaymentImpact(
      inputs.program, 
      inputs.loanInitialPayment, 
      calculatedTaxCredit,
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
  const currentRate = getUtilityRate(inputs.nowYear, inputs.utility, inputs.onCareProgram);
  
  const utilityBillAtInstall = (inputs.annualUsageAtInstall / 12) * initialRate;
  const utilityBillNow = (inputs.currentAnnualUsage / 12) * currentRate;
  
  let currentAnnualUtilityCost = 0;
  
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
      solarCost = 0;
    } else if (inputs.program === 'PPA') {
      const monthlyProduction = inputs.annualProduction / 12;
      solarCost = monthlyProduction * inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, year);
    } else if (inputs.program === 'Loan') {
      const monthsIntoLoan = year * 12;
      if (!inputs.appliedToLoan && monthsIntoLoan >= 18) {
        solarCost = loanPaymentStructure.after18Months;
      } else {
        solarCost = inputs.loanInitialPayment;
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
    
    // Track current year annual utility cost
    if (year === Math.floor(yearsSinceInstall)) {
      currentAnnualUtilityCost = (solarCost + batteryCost) * 12;
      if (nemImpact.type === 'trueup') {
        currentAnnualUtilityCost += nemImpact.amount;
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
  
  // Add tax credit to savings for Loan if NOT applied to loan, or for Cash
  if (inputs.program === 'Loan' && !inputs.appliedToLoan && calculatedTaxCredit > 0) {
    cumulativeSavings += calculatedTaxCredit;
  } else if (inputs.program === 'Cash' && calculatedTaxCredit > 0) {
    cumulativeSavings += calculatedTaxCredit;
  }
  
  // Calculate total investment
  let totalInvestment;
  if (inputs.program === 'Cash') {
    totalInvestment = inputs.cashNetCost;
  } else if (inputs.program === 'PPA') {
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
    totalInvestment = inputs.loanInitialPayment * 12 * 20;
  }
  
  if (inputs.hasBattery && inputs.batteryMonthlyPayment > 0) {
    totalInvestment += inputs.batteryMonthlyPayment * 12 * 10;
  }
  
  const paybackYears = totalInvestment / (cumulativeSavings / yearsSinceInstall);
  const offsetPercentage = (inputs.annualProduction / inputs.currentAnnualUsage) * 100;
  const roi = ((cumulativeSavings / totalInvestment) * 100);
  
  const currentNEMImpact = calculateNEMImpact(
    inputs.annualProduction, 
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
    totalInvestment: totalInvestment.toFixed(2),
    currentNEMImpact,
    loanPaymentStructure,
    calculatedTaxCredit: calculatedTaxCredit.toFixed(2),
    utilityBillAtInstall: utilityBillAtInstall.toFixed(2),
    utilityBillNow: utilityBillNow.toFixed(2),
    utilityBillIncrease: ((utilityBillNow - utilityBillAtInstall) / utilityBillAtInstall * 100).toFixed(1),
    currentAnnualUtilityCost: currentAnnualUtilityCost.toFixed(2)
  };
};
