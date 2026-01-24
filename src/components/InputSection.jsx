import React from 'react';
import { Database, RefreshCw, AlertCircle, Battery } from 'lucide-react';
import { UTILITY_OPTIONS, NEM_OPTIONS, PROGRAM_OPTIONS, API_PROVIDERS, TOU_RATES, PPA_ESCALATOR_OPTIONS } from '../utils/rateData';
import { calculateMonthlyPayment } from '../utils/loanCalculations';

const InputSection = ({ 
  inputs, 
  onInputChange, 
  dataSource, 
  setDataSource,
  apiStatus,
  onApiConnect,
  calculations,
  onUpdate,
  isUpdating
}) => {
  // Generate year options (1999 to current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = 1999; year <= currentYear; year++) {
    yearOptions.push(year);
  }
  
  // Generate month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];
  
  // Calculate PPA current payment
  const calculatePPACurrentPayment = () => {
    const yearsSinceInstall = (inputs.nowYear - inputs.installedYear) + 
                             (inputs.nowMonth - inputs.installedMonth) / 12;
    const monthlyProduction = inputs.annualProduction / 12;
    const currentRate = inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, yearsSinceInstall);
    return (monthlyProduction * currentRate).toFixed(2);
  };
  
  // Calculate loan payments with correct logic
  const taxCredit = calculations.calculatedTaxCredit || (inputs.loanPrincipal * 0.30);
  
  let initialLoanPayment = 0;
  let paymentAfter18Months = 0;
  
  if (inputs.program === 'Loan' && inputs.loanPrincipal > 0) {
    // Calculate base payment on full principal
    initialLoanPayment = calculateMonthlyPayment(inputs.loanPrincipal, inputs.loanInterestRate || 5.99, inputs.loanTerm);
    
    if (inputs.taxCreditApplied) {
      // Tax credit WILL BE applied at month 18: payment reduces after 18 months
      const reducedPrincipal = inputs.loanPrincipal - taxCredit;
      const remainingYears = inputs.loanTerm - 1.5;
      paymentAfter18Months = calculateMonthlyPayment(reducedPrincipal, inputs.loanInterestRate || 5.99, remainingYears);
    } else {
      // Tax credit NOT applied: payment stays same (customer gets tax credit as cash)
      paymentAfter18Months = initialLoanPayment;
    }
  }

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl p-8 mb-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 mb-2 flex items-center gap-2">
            ⚡ California Solar Financial Audit
          </h1>
          <p className="text-cyan-300 text-sm">NEM Analysis • Real Utility Rates • CARE Program Support</p>
        </div>
        
        <div className="bg-slate-900/60 rounded-lg p-1 flex gap-1 border border-cyan-500/30">
          <button
            onClick={() => setDataSource('manual')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
              dataSource === 'manual' ? 'bg-cyan-500 shadow-lg text-white' : 'text-cyan-400 hover:bg-slate-800'
            }`}
          >
            <Database size={16} />
            Manual
          </button>
          <button
            onClick={() => setDataSource('api')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
              dataSource === 'api' ? 'bg-cyan-500 shadow-lg text-white' : 'text-cyan-400 hover:bg-slate-800'
            }`}
          >
            <RefreshCw size={16} />
            API
          </button>
        </div>
      </div>

      {/* API Integration Section */}
      {dataSource === 'api' && (
        <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-300 mb-4 flex items-center gap-2">
            <RefreshCw size={20} />
            API Integration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-blue-200 mb-1">Provider</label>
              <select
                value={inputs.apiProvider}
                onChange={(e) => onInputChange('apiProvider', e.target.value)}
                className="w-full px-3 py-2 border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              >
                {API_PROVIDERS.map(provider => (
                  <option key={provider.value} value={provider.value}>{provider.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">API Key</label>
              <input
                type="password"
                value={inputs.apiKey}
                onChange={(e) => onInputChange('apiKey', e.target.value)}
                className="w-full px-3 py-2 border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">System ID</label>
              <input
                type="text"
                value={inputs.systemId}
                onChange={(e) => onInputChange('systemId', e.target.value)}
                className="w-full px-3 py-2 border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              />
            </div>
          </div>
          
          <button
            onClick={onApiConnect}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Connect
          </button>
          
          {apiStatus.connected && (
            <span className="ml-4 text-green-400">✓ Connected</span>
          )}
        </div>
      )}

      {/* Date Inputs - NOW WITH DROPDOWNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-cyan-400 border-b border-cyan-500/30 pb-2">Installation</h3>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Year</label>
            <select
              value={inputs.installedYear}
              onChange={(e) => onInputChange('installedYear', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Month</label>
            <select
              value={inputs.installedMonth}
              onChange={(e) => onInputChange('installedMonth', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
            >
              {monthOptions.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-green-400 border-b border-green-500/30 pb-2">
            Current Date <span className="text-xs text-green-300">(Auto-Updated)</span>
          </h3>
          <div>
            <label className="block text-sm text-green-300 mb-1">Year</label>
            <input
              type="number"
              value={inputs.nowYear}
              className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/40 text-green-300 text-lg"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm text-green-300 mb-1">Month</label>
            <input
              type="number"
              value={inputs.nowMonth}
              className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/40 text-green-300 text-lg"
              readOnly
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-cyan-400 border-b border-cyan-500/30 pb-2">Utility</h3>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Provider</label>
            <select
              value={inputs.utility}
              onChange={(e) => onInputChange('utility', e.target.value)}
              className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
            >
              {UTILITY_OPTIONS.map(util => (
                <option key={util.value} value={util.value}>{util.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.onCareProgram}
                onChange={(e) => onInputChange('onCareProgram', e.target.checked)}
                className="w-4 h-4 accent-green-400"
              />
              <span className="text-sm text-cyan-300">CARE Program (30% discount)</span>
            </label>
          </div>
          <div className="bg-cyan-500/20 p-3 rounded-lg border border-cyan-400/30">
            <div className="text-xs text-cyan-300 mb-1">Current Rate</div>
            <div className="text-2xl font-bold text-cyan-400">
              ${calculations.currentUtilityRate}/kWh
            </div>
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm text-cyan-300 mb-1">System Size (kW)</label>
          <input
            type="number"
            step="0.1"
            value={inputs.systemSize}
            onChange={(e) => onInputChange('systemSize', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Usage at Install (kWh/yr)</label>
          <input
            type="number"
            value={inputs.annualUsageAtInstall}
            onChange={(e) => onInputChange('annualUsageAtInstall', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Current Usage (kWh/yr)</label>
          <input
            type="number"
            value={inputs.currentAnnualUsage}
            onChange={(e) => onInputChange('currentAnnualUsage', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Growth Rate</label>
          <div className="w-full px-3 py-2 border border-orange-400/30 rounded-lg bg-orange-500/20 font-semibold text-orange-400 text-lg">
            {calculations.usageGrowthRate}%
          </div>
        </div>
      </div>

      {/* System Production & NEM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Annual System Production (kWh/yr)</label>
          <input
            type="number"
            value={inputs.annualProduction}
            onChange={(e) => onInputChange('annualProduction', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
          />
          <p className="text-xs text-gray-400 mt-1">
            Current (with 0.55% degradation): {calculations.currentDegradedProduction} kWh/yr
          </p>
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Usage Offset</label>
          <div className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-green-500/20 font-semibold text-green-400 text-lg">
            {calculations.offsetPercentage}%
          </div>
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">NEM Version</label>
          <select
            value={inputs.nemVersion}
            onChange={(e) => onInputChange('nemVersion', e.target.value)}
            className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
          >
            {NEM_OPTIONS.map(nem => (
              <option key={nem.value} value={nem.value}>{nem.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Solar Program Selection */}
      <div className="mb-6">
        <label className="block text-sm text-cyan-300 mb-2">Solar Program</label>
        <select
          value={inputs.program}
          onChange={(e) => onInputChange('program', e.target.value)}
          className="w-full md:w-1/2 px-4 py-3 border-2 border-cyan-400/50 rounded-lg bg-slate-900/60 text-cyan-300 text-lg font-medium"
        >
          {PROGRAM_OPTIONS.map(prog => (
            <option key={prog.value} value={prog.value}>{prog.label}</option>
          ))}
        </select>
      </div>

      {/* PPA/Lease Specific Inputs */}
      {inputs.program === 'PPA' && (
        <div className="bg-purple-900/20 border-2 border-purple-400/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-purple-300 mb-4 text-lg">PPA/Lease Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1">Down Payment ($)</label>
              <input
                type="number"
                value={inputs.ppaDownpayment}
                onChange={(e) => onInputChange('ppaDownpayment', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1">Initial kWh Rate ($/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={inputs.ppaInitialRate}
                onChange={(e) => onInputChange('ppaInitialRate', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1">Escalator</label>
              <select
                value={inputs.escalator}
                onChange={(e) => onInputChange('escalator', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
              >
                {PPA_ESCALATOR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1">Initial Monthly Payment</label>
              <div className="w-full px-3 py-2 border border-cyan-400/30 rounded-lg bg-cyan-500/20 font-semibold text-cyan-400 text-lg">
                ${((inputs.annualProduction / 12) * inputs.ppaInitialRate).toFixed(2)}
              </div>
            </div>
          </div>

          {/* System Paid Off Section */}
          <div className="mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.ppaPaidOff}
                onChange={(e) => onInputChange('ppaPaidOff', e.target.checked)}
                className="w-4 h-4 accent-purple-400"
              />
              <span className="text-sm text-purple-200">System Paid Off / Bought Out?</span>
            </label>
          </div>

          {inputs.ppaPaidOff && (
            <div className="mb-4">
              <label className="block text-sm text-purple-200 mb-1">Year Paid Off</label>
              <select
                value={inputs.ppaPaidOffYear}
                onChange={(e) => onInputChange('ppaPaidOffYear', parseInt(e.target.value))}
                className="w-full md:w-64 px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
              >
                {yearOptions.filter(y => y >= inputs.installedYear && y <= currentYear).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {calculations.ppaBuyoutCost > 0 && (
                <p className="text-xs text-purple-300 mt-1">
                  Estimated buyout cost: ${parseFloat(calculations.ppaBuyoutCost).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 bg-pink-900/20 border border-pink-400/30 rounded-lg p-4">
            <h4 className="font-semibold text-pink-300 mb-3 text-sm">💳 Payment Structure</h4>
            <div className="text-sm text-pink-200 space-y-2">
              <p>Initial Payment ({inputs.installedYear}): <span className="font-bold text-purple-300 text-xl">${((inputs.annualProduction / 12) * inputs.ppaInitialRate).toFixed(2)}/month</span></p>
              <p>Current Payment ({inputs.nowYear}): <span className="font-bold text-pink-400 text-xl">${inputs.ppaPaidOff ? '0.00' : calculatePPACurrentPayment()}/month</span></p>
              <p>Years Since Install: <span className="font-bold text-cyan-400">{((inputs.nowYear - inputs.installedYear) + (inputs.nowMonth - inputs.installedMonth) / 12).toFixed(1)} years</span></p>
              <p className="text-xs text-pink-300/60 mt-2">
                {inputs.ppaPaidOff ? 
                  `System paid off in ${inputs.ppaPaidOffYear} - no longer making payments` : 
                  `Payment increases ${inputs.escalator}% annually based on escalator`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loan Specific Inputs - WITH CORRECTED LOGIC */}
      {inputs.program === 'Loan' && (
        <div className="bg-green-900/20 border-2 border-green-400/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-green-300 mb-4 text-lg">Loan Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-green-200 mb-1">Principal ($)</label>
              <input
                type="number"
                value={inputs.loanPrincipal}
                onChange={(e) => onInputChange('loanPrincipal', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={inputs.loanInterestRate}
                onChange={(e) => onInputChange('loanInterestRate', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Term (years)</label>
              <input
                type="number"
                value={inputs.loanTerm}
                onChange={(e) => onInputChange('loanTerm', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Down Payment ($)</label>
              <input
                type="number"
                value={inputs.loanDownpayment}
                onChange={(e) => onInputChange('loanDownpayment', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-lg"
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-green-200 mb-1">Tax Credit (30% of Principal)</label>
              <input
                type="number"
                value={taxCredit}
                onChange={(e) => onInputChange('taxCredit', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-lg"
                placeholder={(inputs.loanPrincipal * 0.30).toFixed(2)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={inputs.taxCreditApplied}
                  onChange={(e) => onInputChange('taxCreditApplied', e.target.checked)}
                  className="w-4 h-4 accent-green-400"
                />
                <span className="text-sm text-green-200">Tax credit applied to loan principal?</span>
              </label>
            </div>
          </div>

          {/* System Paid Off Section */}
          <div className="mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.loanPaidOff}
                onChange={(e) => onInputChange('loanPaidOff', e.target.checked)}
                className="w-4 h-4 accent-green-400"
              />
              <span className="text-sm text-green-200">Loan Paid Off Early?</span>
            </label>
          </div>

          {inputs.loanPaidOff && (
            <div className="mb-4">
              <label className="block text-sm text-green-200 mb-1">Year Paid Off</label>
              <select
                value={inputs.loanPaidOffYear}
                onChange={(e) => onInputChange('loanPaidOffYear', parseInt(e.target.value))}
                className="w-full md:w-64 px-3 py-2 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-lg"
              >
                {yearOptions.filter(y => y >= inputs.installedYear && y <= currentYear).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {calculations.loanPaymentStructure && calculations.loanPaymentStructure.principalAtPayoff > 0 && (
                <p className="text-xs text-green-300 mt-1">
                  Remaining principal at payoff: ${parseFloat(calculations.loanPaymentStructure.principalAtPayoff).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 bg-cyan-900/20 border border-cyan-400/30 rounded-lg p-4">
            <h4 className="font-semibold text-cyan-300 mb-3 text-sm">💳 Payment Structure</h4>
            <div className="text-sm text-cyan-200 space-y-2">
              {inputs.taxCreditApplied ? (
                <>
                  <p className="text-orange-400 font-semibold">⚠ Tax credit will be applied at month 18</p>
                  <p>First 18 Months: <span className="font-bold text-cyan-400 text-xl">${initialLoanPayment.toFixed(2)}/month</span></p>
                  <p>After 18 Months: <span className="font-bold text-green-400 text-xl">${paymentAfter18Months.toFixed(2)}/month</span></p>
                  <p className="text-xs text-cyan-300/60 mt-2">Higher payment first 18 months, then payment reduces when tax credit is applied to principal</p>
                </>
              ) : (
                <>
                  <p className="text-green-400 font-semibold">✓ Tax credit NOT applied - you receive as cash back</p>
                  <p>Monthly Payment (entire term): <span className="font-bold text-green-400 text-xl">${initialLoanPayment.toFixed(2)}/month</span></p>
                  <p className="text-xs text-cyan-300/60 mt-2">Payment stays same entire time - you keep tax credit as cash back</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash Specific Inputs */}
      {inputs.program === 'Cash' && (
        <div className="bg-blue-900/20 border-2 border-blue-400/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-300 mb-4 text-lg">Cash Purchase Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-blue-200 mb-1">
                Net Project Cost ($)
                <span className="ml-2 text-xs text-green-400 font-semibold">After Tax Credits & Rebates</span>
              </label>
              <input
                type="number"
                value={inputs.cashNetCost}
                onChange={(e) => onInputChange('cashNetCost', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-blue-400/30 rounded-lg bg-slate-900/60 text-blue-300 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">Tax Credit Received (30%)</label>
              <input
                type="number"
                value={inputs.taxCredit}
                onChange={(e) => onInputChange('taxCredit', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-blue-400/30 rounded-lg bg-slate-900/60 text-blue-300 text-lg"
                placeholder={((inputs.cashNetCost / 0.70) * 0.30).toFixed(2)}
              />
            </div>
          </div>
        </div>
      )}

      {/* NEM 2.0 Export Rate */}
      {inputs.nemVersion === 'NEM2' && (
        <div className="mb-6">
          <label className="block text-sm text-cyan-300 mb-1">NEM 2.0 Export Rate ($/kWh)</label>
          <input
            type="number"
            step="0.01"
            value={inputs.exportRate}
            onChange={(e) => onInputChange('exportRate', parseFloat(e.target.value))}
            className="w-full md:w-64 px-3 py-2 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-lg"
          />
          <p className="text-xs text-gray-400 mt-1">Typical range: $0.06 - $0.08/kWh | Connection fee: $12/month</p>
        </div>
      )}

      {/* Battery & TOU Options */}
      <div className="flex gap-6 mb-6">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.hasBattery}
            onChange={(e) => onInputChange('hasBattery', e.target.checked)}
            className="w-4 h-4 accent-cyan-400"
          />
          <span className="text-sm text-cyan-300">🔋 Battery system present?</span>
        </label>
        
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.useTOU}
            onChange={(e) => onInputChange('useTOU', e.target.checked)}
            className="w-4 h-4 accent-cyan-400"
          />
          <span className="text-sm text-cyan-300">⚡ Use TOU rates?</span>
        </label>
      </div>

      {/* Battery Configuration */}
      {inputs.hasBattery && (
        <div className="bg-purple-900/20 border-2 border-purple-400/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-purple-300 mb-4 flex items-center gap-2">
            <Battery className="text-purple-400" />
            Battery System Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1">Capacity (kWh)</label>
              <input
                type="number"
                step="0.1"
                value={inputs.batteryCapacity}
                onChange={(e) => onInputChange('batteryCapacity', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm text-purple-200 mb-1">Efficiency (%)</label>
              <input
                type="number"
                value={inputs.batteryEfficiency}
                onChange={(e) => onInputChange('batteryEfficiency', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
                min="70"
                max="100"
              />
            </div>
            
            <div>
              <label className="block text-sm text-purple-200 mb-1">Monthly Payment ($)</label>
              <input
                type="number"
                value={inputs.batteryMonthlyPayment}
                onChange={(e) => onInputChange('batteryMonthlyPayment', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm text-purple-200 mb-1">Arbitrage Savings</label>
              <div className="w-full px-3 py-2 border border-purple-400/30 rounded-lg bg-purple-500/20 font-semibold text-purple-300 text-lg">
                ${parseFloat(calculations.cumulativeArbitrageSavings).toLocaleString()}
              </div>
            </div>
          </div>
          
          {inputs.useTOU && (
            <div className="mt-4 bg-slate-900/40 rounded-lg p-4">
              <h4 className="font-medium text-purple-200 mb-2 text-sm">TOU Rate Structure</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Peak:</span>
                  <span className="ml-2 font-semibold text-red-400">${TOU_RATES[inputs.utility].peak}/kWh</span>
                </div>
                <div>
                  <span className="text-gray-400">Off-Peak:</span>
                  <span className="ml-2 font-semibold text-green-400">${TOU_RATES[inputs.utility].offPeak}/kWh</span>
                </div>
                <div>
                  <span className="text-gray-400">Super Off-Peak:</span>
                  <span className="ml-2 font-semibold text-blue-400">${TOU_RATES[inputs.utility].superOffPeak}/kWh</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update System Data Button */}
      <div className="flex justify-center">
        <button
          onClick={onUpdate}
          disabled={isUpdating}
          className={`px-8 py-4 rounded-xl font-bold text-lg shadow-2xl transition-all ${
            isUpdating 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
          }`}
        >
          {isUpdating ? '🔄 Updating...' : '✨ Update System Data'}
        </button>
      </div>
    </div>
  );
};

export default InputSection;
