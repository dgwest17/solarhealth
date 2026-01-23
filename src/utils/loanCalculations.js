/**
 * Calculate monthly loan payment using standard amortization formula
 * P = L[c(1 + c)^n]/[(1 + c)^n - 1]
 * where:
 * P = monthly payment
 * L = loan amount (principal)
 * c = monthly interest rate (annual rate / 12)
 * n = number of months (term in years * 12)
 */
export const calculateMonthlyPayment = (principal, annualRate, termYears) => {
  if (principal <= 0 || termYears <= 0) return 0;
  
  const monthlyRate = (annualRate / 100) / 12;
  const numPayments = termYears * 12;
  
  // Handle 0% interest rate
  if (monthlyRate === 0) {
    return principal / numPayments;
  }
  
  const payment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return payment;
};

/**
 * Calculate remaining principal after N months of payments
 */
export const calculateRemainingPrincipal = (principal, annualRate, termYears, monthsPaid) => {
  if (monthsPaid <= 0) return principal;
  if (monthsPaid >= termYears * 12) return 0;
  
  const monthlyRate = (annualRate / 100) / 12;
  const numPayments = termYears * 12;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termYears);
  
  // Remaining balance formula
  const remainingBalance = principal * Math.pow(1 + monthlyRate, monthsPaid) -
    monthlyPayment * ((Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate);
  
  return Math.max(0, remainingBalance);
};

/**
 * Calculate loan payment after tax credit is applied
 */
export const calculatePaymentAfterTaxCredit = (
  originalPrincipal,
  taxCredit,
  annualRate,
  termYears,
  monthsBeforeCredit = 18
) => {
  // New principal after tax credit reduces the loan
  const newPrincipal = originalPrincipal - taxCredit;
  
  // Remaining months after tax credit is applied
  const remainingMonths = (termYears * 12) - monthsBeforeCredit;
  const remainingYears = remainingMonths / 12;
  
  // Calculate new payment on reduced principal for remaining term
  return calculateMonthlyPayment(newPrincipal, annualRate, remainingYears);
};
