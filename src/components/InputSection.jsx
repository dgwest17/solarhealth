import React from 'react';
import { Database, RefreshCw, Battery } from 'lucide-react';
import { UTILITY_OPTIONS, NEM_OPTIONS, PROGRAM_OPTIONS, API_PROVIDERS, TOU_RATES, PPA_ESCALATOR_OPTIONS } from '../utils/rateData';

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
  const calculatePPACurrentPayment = () => {
    const yearsSinceInstall = (inputs.nowYear - inputs.installedYear) + 
                             (inputs.nowMonth - inputs.installedMonth) / 12;
    const monthlyProduction = inputs.annualProduction / 12;
    const currentRate = inputs.ppaInitialRate * Math.pow(1 + inputs.escalator / 100, yearsSinceInstall);
    return (monthlyProduction * currentRate).toFixed(2);
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 mb-1">
            ⚡ California Solar Financial Audit
          </h1>
          <p className="text-cyan-300 text-xs">NEM Analysis • Real Utility Rates • CARE Program Support</p>
        </div>
        
        <div className="bg-slate-900/60 rounded-lg p-1 flex gap-1 border border-cyan-500/30">
          <button
            onClick={() => setDataSource('manual')}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 transition-all ${
              dataSource === 'manual' ? 'bg-cyan-500 shadow-lg text-white' : 'text-cyan-400 hover:bg-slate-800'
            }`}
          >
            <Database size={14} />
            Manual
          </button>
          <button
            onClick={() => setDataSource('api')}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 transition-all ${
              dataSource === 'api' ? 'bg-cyan-500 shadow-lg text-white' : 'text-cyan-400 hover:bg-slate-800'
            }`}
          >
            <RefreshCw size={14} />
            API
          </button>
        </div>
      </div>

      {/* API Integration Section */}
      {dataSource === 'api' && (
        <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-300 mb-3 flex items-center gap-2 text-sm">
            <RefreshCw size={16} />
            API Integration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-blue-200 mb-1">Provider</label>
              <select
                value={inputs.apiProvider}
                onChange={(e) => onInputChange('apiProvider', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              >
                {API_PROVIDERS.map(provider => (
                  <option key={provider.value} value={provider.value}>{provider.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-blue-200 mb-1">API Key</label>
              <input
                type="password"
                value={inputs.apiKey}
                onChange={(e) => onInputChange('apiKey', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-200 mb-1">System ID</label>
              <input
                type="text"
                value={inputs.systemId}
                onChange={(e) => onInputChange('systemId', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              />
            </div>
          </div>
          
          <button
            onClick={onApiConnect}
            className="bg-blue-500 text-white px-4 py-1.5 text-sm rounded-lg hover:bg-blue-600 transition-colors"
          >
            Connect
          </button>
          
          {apiStatus.connected && (
            <span className="ml-3 text-green-400 text-sm">✓ Connected</span>
          )}
        </div>
      )}

      {/* Date & Utility Section - COMPACT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-cyan-400 border-b border-cyan-500/30 pb-1 text-sm">Installation</h3>
          <div>
            <label className="block text-xs text-cyan-300 mb-1">Year</label>
            <select
              value={inputs.installedYear}
              onChange={(e) => onInputChange('installedYear', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
            >
              {Array.from({ length: 12 }, (_, i) => 2014 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-cyan-300 mb-1">Month</label>
            <select
              value={inputs.installedMonth}
              onChange={(e) => onInputChange('installedMonth', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
            >
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                <option key={idx + 1} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-green-400 border-b border-green-500/30 pb-1 text-sm">
            Current <span className="text-xs text-green-300">(Auto)</span>
          </h3>
          <div>
            <label className="block text-xs text-green-300 mb-1">Year</label>
            <input
              type="number"
              value={inputs.nowYear}
              className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/40 text-green-300"
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs text-green-300 mb-1">Month</label>
            <input
              type="number"
              value={inputs.nowMonth}
              className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/40 text-green-300"
              readOnly
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-cyan-400 border-b border-cyan-500/30 pb-1 text-sm">Utility</h3>
          <div>
            <label className="block text-xs text-cyan-300 mb-1">Provider</label>
            <select
              value={inputs.utility}
              onChange={(e) => onInputChange('utility', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
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
                className="w-3 h-3 accent-green-400"
              />
              <span className="text-xs text-cyan-300">CARE (30% off)</span>
            </label>
          </div>
          <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-400/30">
            <div className="text-xs text-cyan-300">Rate</div>
            <div className="text-lg font-bold text-cyan-400">
              ${calculations.currentUtilityRate}/kWh
            </div>
          </div>
        </div>
      </div>

      {/* System Details - COMPACT */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs text-cyan-300 mb-1">System Size (kW)</label>
          <input
            type="number"
            step="0.1"
            value={inputs.systemSize}
            onChange={(e) => onInputChange('systemSize', parseFloat(e.target.value))}
            className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          />
        </div>
        <div>
          <label className="block text-xs text-cyan-300 mb-1">Usage at Install (kWh/yr)</label>
          <input
            type="number"
            value={inputs.annualUsageAtInstall}
            onChange={(e) => onInputChange('annualUsageAtInstall', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          />
        </div>
        <div>
          <label className="block text-xs text-cyan-300 mb-1">Current Usage (kWh/yr)</label>
          <input
            type="number"
            value={inputs.currentAnnualUsage}
            onChange={(e) => onInputChange('currentAnnualUsage', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          />
        </div>
        <div>
          <label className="block text-xs text-cyan-300 mb-1">Growth Rate</label>
          <div className="w-full px-2 py-1.5 text-sm border border-orange-400/30 rounded-lg bg-orange-500/20 font-semibold text-orange-400">
            {calculations.usageGrowthRate}%
          </div>
        </div>
      </div>

      {/* Production & NEM - COMPACT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-cyan-300 mb-1">Annual Production (kWh/yr)</label>
          <input
            type="number"
            value={inputs.annualProduction}
            onChange={(e) => onInputChange('annualProduction', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          />
          <p className="text-xs text-yellow-400 mt-0.5">Now (degraded): {calculations.currentDegradedProduction} kWh/yr</p>
        </div>
        <div>
          <label className="block text-xs text-cyan-300 mb-1">Usage Offset</label>
          <div className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-green-500/20 font-semibold text-green-400">
            {calculations.offsetPercentage}%
          </div>
        </div>
        <div>
          <label className="block text-xs text-cyan-300 mb-1">NEM Version</label>
          <select
            value={inputs.nemVersion}
            onChange={(e) => onInputChange('nemVersion', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          >
            {NEM_OPTIONS.map(nem => (
              <option key={nem.value} value={nem.value}>{nem.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Solar Program Selection */}
      <div className="mb-4">
        <label className="block text-xs text-cyan-300 mb-1">Solar Program</label>
        <select
          value={inputs.program}
          onChange={(e) => onInputChange('program', e.target.value)}
          className="w-full md:w-1/2 px-3 py-2 text-sm border-2 border-cyan-400/50 rounded-lg bg-slate-900/60 text-cyan-300 font-medium"
        >
          {PROGRAM_OPTIONS.map(prog => (
            <option key={prog.value} value={prog.value}>{prog.label}</option>
          ))}
        </select>
      </div>

      {/* PPA/Lease Section - Keep existing content but compact styling */}
      {inputs.program === 'PPA' && (
        <div className="bg-purple-900/20 border-2 border-purple-400/50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-purple-300 mb-3 text-sm">PPA/Lease Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-purple-200 mb-1">Down Payment ($)</label>
              <input
                type="number"
                value={inputs.ppaDownpayment}
                onChange={(e) => onInputChange('ppaDownpayment', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-200 mb-1">Initial Rate ($/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={inputs.ppaInitialRate}
                onChange={(e) => onInputChange('ppaInitialRate', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-200 mb-1">Escalator</label>
              <select
                value={inputs.escalator}
                onChange={(e) => onInputChange('escalator', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
              >
                {PPA_ESCALATOR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-purple-200 mb-1">Initial Monthly</label>
              <div className="w-full px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-cyan-500/20 font-semibold text-cyan-400">
                ${((inputs.annualProduction / 12) * inputs.ppaInitialRate).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.ppaPaidOff}
                onChange={(e) => onInputChange('ppaPaidOff', e.target.checked)}
                className="w-3 h-3 accent-purple-400"
              />
              <span className="text-xs text-purple-200">Paid Off Early?</span>
            </label>
          </div>

          {inputs.ppaPaidOff && (
            <div className="mb-3">
              <label className="block text-xs text-purple-200 mb-1">Year Paid Off</label>
              <select
                value={inputs.ppaPaidOffYear}
                onChange={(e) => onInputChange('ppaPaidOffYear', parseInt(e.target.value))}
                className="w-full md:w-48 px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
              >
                {Array.from({ length: inputs.nowYear - inputs.installedYear + 1 }, (_, i) => inputs.installedYear + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <p className="text-xs text-purple-300 mt-1">
                Buyout (30% discount): ${parseFloat(calculations.ppaBuyoutAmount).toLocaleString()}
              </p>
            </div>
          )}

          <div className="mt-3 bg-pink-900/20 border border-pink-400/30 rounded-lg p-3">
            <h4 className="font-semibold text-pink-300 mb-2 text-xs">💳 Payment Info</h4>
            <div className="text-xs text-pink-200 space-y-1">
              <p>Initial ({inputs.installedYear}): <span className="font-bold text-purple-300">${((inputs.annualProduction / 12) * inputs.ppaInitialRate).toFixed(2)}/mo</span></p>
              {!inputs.ppaPaidOff && (
                <p>Current ({inputs.nowYear}): <span className="font-bold text-pink-400">${calculatePPACurrentPayment()}/mo</span></p>
              )}
              {inputs.ppaPaidOff && (
                <p className="text-green-400 font-semibold">✓ Paid off in {inputs.ppaPaidOffYear}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loan Section - Compact */}
      {inputs.program === 'Loan' && (
        <div className="bg-green-900/20 border-2 border-green-400/50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-green-300 mb-3 text-sm">Loan Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-green-200 mb-1">Down Payment ($)</label>
              <input
                type="number"
                value={inputs.loanDownpayment}
                onChange={(e) => onInputChange('loanDownpayment', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-green-200 mb-1">Monthly Payment ($)</label>
              <input
                type="number"
                value={inputs.loanInitialPayment}
                onChange={(e) => onInputChange('loanInitialPayment', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300"
              />
            </div>
            <div>
              <label className="block text-xs text-green-200 mb-1">Principal ($)</label>
              <input
                type="number"
                value={inputs.loanPrincipal}
                onChange={(e) => onInputChange('loanPrincipal', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300"
              />
            </div>
            <div>
              <label className="block text-xs text-green-200 mb-1">Term (years)</label>
              <input
                type="number"
                value={inputs.loanTerm}
                onChange={(e) => onInputChange('loanTerm', parseInt(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-green-200 mb-1">Tax Credit (30%)</label>
              <input
                type="number"
                value={inputs.taxCredit}
                onChange={(e) => onInputChange('taxCredit', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300"
                placeholder={calculations.autoTaxCredit}
              />
              <p className="text-xs text-green-300 mt-0.5">Auto: ${calculations.autoTaxCredit}</p>
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={inputs.appliedToLoan}
                  onChange={(e) => onInputChange('appliedToLoan', e.target.checked)}
                  className="w-3 h-3 accent-green-400"
                />
                <span className="text-xs text-green-200">Apply to principal?</span>
              </label>
            </div>
          </div>

          <div className="mb-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.loanPaidOff}
                onChange={(e) => onInputChange('loanPaidOff', e.target.checked)}
                className="w-3 h-3 accent-green-400"
              />
              <span className="text-xs text-green-200">Paid Off Early?</span>
            </label>
          </div>

          {inputs.loanPaidOff && (
            <div className="mb-3">
              <label className="block text-xs text-green-200 mb-1">Year Paid Off</label>
              <select
                value={inputs.loanPaidOffYear}
                onChange={(e) => onInputChange('loanPaidOffYear', parseInt(e.target.value))}
                className="w-full md:w-48 px-2 py-1.5 text-sm border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300"
              >
                {Array.from({ length: inputs.nowYear - inputs.installedYear + 1 }, (_, i) => inputs.installedYear + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <p className="text-xs text-green-300 mt-1">
                Remaining principal: ${parseFloat(calculations.loanPrincipalAtPayoff).toLocaleString()}
              </p>
            </div>
          )}

          <div className="mt-3 bg-cyan-900/20 border border-cyan-400/30 rounded-lg p-3">
            <h4 className="font-semibold text-cyan-300 mb-2 text-xs">💳 Payment Structure</h4>
            <div className="text-xs text-cyan-200 space-y-1">
              <p>First 18 Months: <span className="font-bold text-cyan-400">${calculations.loanPaymentStructure.first18MonthsPayment.toFixed(2)}/mo</span></p>
              <p>After 18 Months: <span className="font-bold text-green-400">${calculations.loanPaymentStructure.after18MonthsPayment.toFixed(2)}/mo</span></p>
              {inputs.loanPaidOff && (
                <p className="text-green-400 font-semibold">✓ Paid off in {inputs.loanPaidOffYear}</p>
              )}
              <p className="text-xs text-cyan-300/60 mt-1">
                {inputs.appliedToLoan 
                  ? 'Tax credit applied - same first 18 months, then reduces' 
                  : 'Tax credit not applied - consistent payment throughout'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cash Section - Compact */}
      {inputs.program === 'Cash' && (
        <div className="bg-blue-900/20 border-2 border-blue-400/50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-300 mb-3 text-sm">Cash Purchase</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-blue-200 mb-1">
                Net Cost ($) <span className="text-green-400 font-semibold">After Credits</span>
              </label>
              <input
                type="number"
                value={inputs.cashNetCost}
                onChange={(e) => onInputChange('cashNetCost', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-blue-400/30 rounded-lg bg-slate-900/60 text-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-200 mb-1">Tax Credit (30%)</label>
              <input
                type="number"
                value={inputs.taxCredit}
                onChange={(e) => onInputChange('taxCredit', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-blue-400/30 rounded-lg bg-slate-900/60 text-blue-300"
                placeholder={calculations.autoTaxCredit}
              />
              <p className="text-xs text-blue-300 mt-0.5">Auto: ${calculations.autoTaxCredit}</p>
            </div>
          </div>
        </div>
      )}

      {/* NEM 2.0 Export Rate */}
      {inputs.nemVersion === 'NEM2' && (
        <div className="mb-4">
          <label className="block text-xs text-cyan-300 mb-1">NEM 2.0 Export Rate ($/kWh)</label>
          <input
            type="number"
            step="0.01"
            value={inputs.exportRate}
            onChange={(e) => onInputChange('exportRate', parseFloat(e.target.value))}
            className="w-full md:w-48 px-2 py-1.5 text-sm border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          />
          <p className="text-xs text-gray-400 mt-0.5">Range: $0.06-$0.08/kWh • Includes $12/mo fee</p>
        </div>
      )}

      {/* Battery & TOU */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.hasBattery}
            onChange={(e) => onInputChange('hasBattery', e.target.checked)}
            className="w-3 h-3 accent-cyan-400"
          />
          <span className="text-xs text-cyan-300">🔋 Battery?</span>
        </label>
        
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.useTOU}
            onChange={(e) => onInputChange('useTOU', e.target.checked)}
            className="w-3 h-3 accent-cyan-400"
          />
          <span className="text-xs text-cyan-300">⚡ TOU rates?</span>
        </label>
      </div>

      {/* Battery Config - Compact */}
      {inputs.hasBattery && (
        <div className="bg-purple-900/20 border-2 border-purple-400/50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-purple-300 mb-3 flex items-center gap-2 text-sm">
            <Battery className="text-purple-400" size={16} />
            Battery System
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-purple-200 mb-1">Capacity (kWh)</label>
              <input
                type="number"
                step="0.1"
                value={inputs.batteryCapacity}
                onChange={(e) => onInputChange('batteryCapacity', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
              />
            </div>
            
            <div>
              <label className="block text-xs text-purple-200 mb-1">Efficiency (%)</label>
              <input
                type="number"
                value={inputs.batteryEfficiency}
                onChange={(e) => onInputChange('batteryEfficiency', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
                min="70"
                max="100"
              />
            </div>
            
            <div>
              <label className="block text-xs text-purple-200 mb-1">Monthly Payment ($)</label>
              <input
                type="number"
                value={inputs.batteryMonthlyPayment}
                onChange={(e) => onInputChange('batteryMonthlyPayment', parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300"
              />
            </div>
            
            <div>
              <label className="block text-xs text-purple-200 mb-1">Arbitrage Savings</label>
              <div className="w-full px-2 py-1.5 text-sm border border-purple-400/30 rounded-lg bg-purple-500/20 font-semibold text-purple-300">
                ${parseFloat(calculations.cumulativeArbitrageSavings).toLocaleString()}
              </div>
            </div>
          </div>
          
          {inputs.useTOU && (
            <div className="mt-3 bg-slate-900/40 rounded-lg p-3">
              <h4 className="font-medium text-purple-200 mb-2 text-xs">TOU Rates</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Peak:</span>
                  <span className="ml-1 font-semibold text-red-400">${TOU_RATES[inputs.utility].peak}</span>
                </div>
                <div>
                  <span className="text-gray-400">Off:</span>
                  <span className="ml-1 font-semibold text-green-400">${TOU_RATES[inputs.utility].offPeak}</span>
                </div>
                <div>
                  <span className="text-gray-400">Super:</span>
                  <span className="ml-1 font-semibold text-blue-400">${TOU_RATES[inputs.utility].superOffPeak}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update Button */}
      <div className="flex justify-center">
        <button
          onClick={onUpdate}
          disabled={isUpdating}
          className={`px-6 py-3 rounded-xl font-bold text-sm shadow-2xl transition-all ${
            isUpdating 
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
          }`}
        >
          {isUpdating ? 'Updating...' : '🔄 Update System Data'}
        </button>
      </div>
    </div>
  );
};

export default InputSection;
