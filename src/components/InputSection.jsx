import React, { useState } from 'react';
import { Database, RefreshCw, AlertCircle, Battery, ChevronDown, ChevronRight } from 'lucide-react';
import { UTILITY_OPTIONS, NEM_OPTIONS, PROGRAM_OPTIONS, API_PROVIDERS, TOU_RATES, PPA_ESCALATOR_OPTIONS, INSTALLER_OPTIONS } from '../utils/rateData';
import { calculateMonthlyPayment } from '../utils/loanCalculations';
import { PANEL_MANUFACTURERS, INVERTER_MANUFACTURERS, BATTERY_MANUFACTURERS } from '../tech/equipmentData';
import { BRANDING } from '../config/branding';
import Tip from './Tip';

const InputSection = ({ 
  inputs, 
  onInputChange, 
  dataSource, 
  setDataSource,
  apiStatus,
  onApiConnect,
  calculations,
  onUpdate,
  isUpdating,
  ratePlan = 'standard',
  onRatePlanChange = null,
  gbApplied = false
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

  // ---- Collapsible sections ----
  // 'system' open by default; the rest collapsed so the form doesn't swallow
  // the whole screen. Each collapsed header shows a live summary of its values.
  const [openSections, setOpenSections] = useState({ system: true, financing: false, battery: false });
  const [ppaMode, setPpaMode] = useState('rate'); // 'rate' | 'payment'
  const [showProdOverride, setShowProdOverride] = useState(false);
  const toggleSection = (id) => setOpenSections((p) => ({ ...p, [id]: !p[id] }));

  const utilShort = (UTILITY_OPTIONS.find((u) => u.value === inputs.utility)?.label.match(/\(([^)]+)\)/)?.[1]) || inputs.utility;
  const nemShort = (NEM_OPTIONS.find((n) => n.value === inputs.nemVersion)?.label) || inputs.nemVersion;
  const systemSummary = `${inputs.systemSize} kW · ${Number(inputs.annualProduction).toLocaleString()} kWh/yr · ${utilShort} · ${nemShort} · ${inputs.installedYear}`;
  const financingSummary = inputs.program === 'PPA'
    ? `PPA/Lease · $${inputs.ppaInitialRate}/kWh · ${inputs.escalator}% esc`
    : inputs.program === 'Loan'
      ? `Loan · $${Number(inputs.loanPrincipal).toLocaleString()} @ ${inputs.loanInterestRate || 5.99}% · ${inputs.loanTerm} yr`
      : inputs.program === 'Cash'
        ? `Cash · $${Number(inputs.cashNetCost).toLocaleString()} net`
        : 'Other';
  const batterySummary = [
    inputs.hasBattery ? `${inputs.batteryCapacity} kWh battery` : 'No battery',
    inputs.useTOU ? 'TOU on' : null,
    inputs.nemVersion === 'NEM2' ? `export $${inputs.exportRate}/kWh` : null
  ].filter(Boolean).join(' · ');

  // Plain render function (NOT a nested component — keeps input focus stable).
  const renderSection = (id, title, summary, content) => {
    const open = openSections[id];
    return (
      <div className="border border-cyan-500/20 rounded-xl mb-3">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-900/80 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown size={16} className="text-cyan-400 shrink-0" /> : <ChevronRight size={16} className="text-cyan-400 shrink-0" />}
            <span className="font-semibold text-cyan-300 text-sm">{title}</span>
            {!open && <span className="text-xs text-slate-400 truncate ml-2">{summary}</span>}
          </div>
          {!open && <span className="text-[10px] text-cyan-500/70 shrink-0 ml-2">edit</span>}
        </button>
        {open && <div className="px-4 pt-4 pb-1">{content}</div>}
      </div>
    );
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl p-5 md:p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 mb-1 flex items-center gap-2">
            ⚡ {BRANDING.appName}
          </h1>
          <p className="text-cyan-300 text-xs">NEM Analysis • Real Utility Rates • CARE Program Support</p>
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
              <label className="block text-sm text-blue-200 mb-1">Provider<Tip k="utility" /></label>
              <select
                value={inputs.apiProvider}
                onChange={(e) => onInputChange('apiProvider', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
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
                className="w-full px-2.5 py-1.5 border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">System ID</label>
              <input
                type="text"
                value={inputs.systemId}
                onChange={(e) => onInputChange('systemId', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-blue-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
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

      {/* ============ SECTION: SYSTEM & SITE ============ */}
      {renderSection('system', '🏠 System & Site', systemSummary, (<>
      {/* Date Inputs - NOW WITH DROPDOWNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="space-y-4">
          <h3 className="font-semibold text-cyan-400 border-b border-cyan-500/30 pb-2">Installation</h3>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Year<Tip k="installYear" /></label>
            <select
              value={inputs.installedYear}
              onChange={(e) => onInputChange('installedYear', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Month<Tip k="installMonth" /></label>
            <select
              value={inputs.installedMonth}
              onChange={(e) => onInputChange('installedMonth', parseInt(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
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
              className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/40 text-green-300 text-sm"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm text-green-300 mb-1">Month</label>
            <input
              type="number"
              value={inputs.nowMonth}
              className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/40 text-green-300 text-sm"
              readOnly
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-cyan-400 border-b border-cyan-500/30 pb-2">Utility</h3>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Provider<Tip k="utility" /></label>
            <select
              value={inputs.utility}
              onChange={(e) => onInputChange('utility', e.target.value)}
              className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-sm text-cyan-300 mb-1">System Size (kW)<Tip k="systemSize" /></label>
          <input
            type="number"
            step="0.1"
            value={inputs.systemSize}
            onChange={(e) => onInputChange('systemSize', parseFloat(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Usage at Install (kWh/yr)<Tip k="usageAtInstall" /></label>
          <input
            type="number"
            value={inputs.annualUsageAtInstall}
            onChange={(e) => onInputChange('annualUsageAtInstall', parseInt(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Current Usage (kWh/yr)<Tip k="currentUsage" /></label>
          {gbApplied && (
            <div className="text-[10px] text-emerald-300 mb-1">📊 Taken from Green Button data — assumes the system is functioning properly</div>
          )}
          <input
            type="number"
            value={inputs.currentAnnualUsage}
            onChange={(e) => onInputChange('currentAnnualUsage', parseInt(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Growth Rate</label>
          <div className="w-full px-2.5 py-1.5 border border-orange-400/30 rounded-lg bg-orange-500/20 font-semibold text-orange-400 text-sm">
            {calculations.usageGrowthRate}%
          </div>
        </div>
      </div>

      {/* System Production & NEM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm text-cyan-300 mb-1">INSTALLED Annual System Production (kWh/yr)<Tip k="annualProduction" /></label>
          <input
            type="number"
            value={inputs.annualProduction}
            onChange={(e) => onInputChange('annualProduction', parseInt(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
          />
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-cyan-300">
              Current calculated production: {Number(calculations.currentDegradedProduction).toLocaleString()} kWh/yr
              {calculations.productionIsOverridden
                ? <span className="text-emerald-400 text-xs ml-1">(overridden)</span>
                : <span className="text-gray-500 text-xs ml-1">(0.55%/yr degradation)</span>}
            </span>
            <button type="button" onClick={() => setShowProdOverride((v) => !v)}
              className="text-xs px-2.5 py-1 rounded-lg border border-cyan-400/40 text-cyan-300 hover:bg-cyan-900/30">
              {showProdOverride ? 'Hide override' : 'Override'}
            </button>
          </div>
          {showProdOverride && (
            <div className="mt-2">
              <label className="block text-xs text-cyan-300/80 mb-1">Override if you know the exact current annual production from the monitoring app</label>
              <input type="number" value={inputs.currentProductionOverride || ''}
                onChange={(e) => onInputChange('currentProductionOverride', parseFloat(e.target.value) || 0)}
                placeholder="e.g. 9,850 kWh/yr — leave empty to use the degradation model"
                className="w-full md:w-72 px-2.5 py-1.5 border border-emerald-400/40 rounded-lg bg-slate-900/60 text-emerald-300 text-sm" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Usage Offset</label>
          <div className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-green-500/20 font-semibold text-green-400 text-sm">
            {calculations.offsetPercentage}%
          </div>
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">NEM Version<Tip k="nemVersion" /></label>
          <select
            value={inputs.nemVersion}
            onChange={(e) => onInputChange('nemVersion', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
          >
            {NEM_OPTIONS.map(nem => (
              <option key={nem.value} value={nem.value}>{nem.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Installer Selection */}
      <div className="mb-6">
        <label className="block text-sm text-cyan-300 mb-2">Installer</label>
        <select
          value={inputs.installer || ''}
          onChange={(e) => onInputChange('installer', e.target.value)}
          className="w-full md:w-1/2 px-4 py-3 border-2 border-cyan-400/50 rounded-lg bg-slate-900/60 text-cyan-300 text-sm font-medium"
        >
          <option value="">Select installer…</option>
          <optgroup label="Active installers">
            {INSTALLER_OPTIONS.filter(i => !i.defunct).map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </optgroup>
          <optgroup label="No longer in business">
            {INSTALLER_OPTIONS.filter(i => i.defunct).map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </optgroup>
        </select>
        {(() => {
          const sel = INSTALLER_OPTIONS.find(i => i.value === inputs.installer);
          if (sel && sel.defunct) {
            return (
              <div className="mt-2 bg-orange-500/15 border border-orange-400/40 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-orange-400 mt-0.5 shrink-0" />
                <span className="text-sm text-orange-200">
                  This installer is no longer in business — the system likely has an <strong>orphaned workmanship warranty</strong> and no active monitoring support. A strong reason for an audit and a monitoring/service plan.
                </span>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Equipment (drives warranty/service schedule on the report) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Panel Manufacturer<Tip k="panelManufacturer" /></label>
          <select
            value={inputs.panelManufacturer || ''}
            onChange={(e) => onInputChange('panelManufacturer', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          >
            <option value="">Select…</option>
            {PANEL_MANUFACTURERS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}{m.defunct ? ' ⚠' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Inverter Manufacturer<Tip k="inverterManufacturer" /></label>
          <select
            value={inputs.inverterManufacturer || ''}
            onChange={(e) => onInputChange('inverterManufacturer', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          >
            <option value="">Select…</option>
            {INVERTER_MANUFACTURERS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}{m.defunct ? ' ⚠' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-cyan-300 mb-1">Battery Manufacturer<Tip k="batteryManufacturer" /></label>
          <select
            value={inputs.batteryManufacturer || ''}
            onChange={(e) => onInputChange('batteryManufacturer', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300"
          >
            <option value="">Select…</option>
            {BATTERY_MANUFACTURERS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}{m.defunct ? ' ⚠' : ''}</option>
            ))}
          </select>
        </div>
      </div>
      </>))}

      {/* ============ SECTION: FINANCING ============ */}
      {renderSection('financing', '💳 Financing', financingSummary, (<>
      {/* Solar Program Selection */}
      <div className="mb-6">
        <label className="block text-sm text-cyan-300 mb-2">Solar Program<Tip k="program" /></label>
        <select
          value={inputs.program}
          onChange={(e) => onInputChange('program', e.target.value)}
          className="w-full md:w-1/2 px-4 py-3 border-2 border-cyan-400/50 rounded-lg bg-slate-900/60 text-cyan-300 text-sm font-medium"
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

          {/* Entry mode: contract rate OR current monthly payment */}
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-purple-200">I know:</span>
            <button type="button" onClick={() => setPpaMode('rate')}
              className={`px-3 py-1.5 rounded-lg border ${ppaMode === 'rate' ? 'bg-purple-500 text-white border-purple-400' : 'border-purple-400/40 text-purple-300 hover:bg-purple-900/30'}`}>
              Contract kWh rate
            </button>
            <button type="button" onClick={() => setPpaMode('payment')}
              className={`px-3 py-1.5 rounded-lg border ${ppaMode === 'payment' ? 'bg-purple-500 text-white border-purple-400' : 'border-purple-400/40 text-purple-300 hover:bg-purple-900/30'}`}>
              Current monthly payment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1">Down Payment ($)<Tip k="ppaDownpayment" /></label>
              <input
                type="number"
                value={inputs.ppaDownpayment}
                onChange={(e) => onInputChange('ppaDownpayment', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
                placeholder="0"
              />
            </div>
            {ppaMode === 'rate' ? (
            <div>
              <label className="block text-sm text-purple-200 mb-1">Initial kWh Rate ($/kWh)<Tip k="ppaInitialRate" /></label>
              <input
                type="number"
                step="0.01"
                value={inputs.ppaInitialRate}
                onChange={(e) => onInputChange('ppaInitialRate', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
              />
            </div>
            ) : (
            <div>
              <label className="block text-sm text-purple-200 mb-1">Current Monthly Payment ($)<Tip k="ppaCurrentPayment" /></label>
              <input
                type="number"
                step="1"
                value={inputs.ppaCurrentPayment || ''}
                onChange={(e) => {
                  const payment = parseFloat(e.target.value) || 0;
                  onInputChange('ppaCurrentPayment', payment);
                  // Back-calculate the contract (initial) rate from today's payment:
                  // currentRate = payment / monthlyProduction; initial = current / (1+esc)^years
                  const monthlyProd = (inputs.annualProduction || 0) / 12;
                  const years = Math.max(0, (inputs.nowYear - inputs.installedYear) + (inputs.nowMonth - inputs.installedMonth) / 12);
                  if (monthlyProd > 0 && payment > 0) {
                    const currentRate = payment / monthlyProd;
                    const initialRate = currentRate / Math.pow(1 + (inputs.escalator || 0) / 100, years);
                    onInputChange('ppaInitialRate', Math.round(initialRate * 10000) / 10000);
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
              />
            </div>
            )}
            <div>
              <label className="block text-sm text-purple-200 mb-1">Escalator<Tip k="escalator" /></label>
              <select
                value={inputs.escalator}
                onChange={(e) => onInputChange('escalator', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
              >
                {PPA_ESCALATOR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-purple-200 mb-1">{ppaMode === 'payment' ? 'Derived: contract rate & initial payment' : 'Initial Monthly Payment'}</label>
              <div className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-cyan-500/20 font-semibold text-cyan-400 text-sm">
                {ppaMode === 'payment'
                  ? <>
                      <span className="block text-sm">Current rate: ${((inputs.ppaCurrentPayment || 0) / ((inputs.annualProduction || 1) / 12)).toFixed(3)}/kWh</span>
                      <span className="block text-sm">Initial: ${inputs.ppaInitialRate}/kWh → ${((inputs.annualProduction / 12) * inputs.ppaInitialRate).toFixed(2)}/mo</span>
                    </>
                  : <>${((inputs.annualProduction / 12) * inputs.ppaInitialRate).toFixed(2)}</>}
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
                className="w-full md:w-64 px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
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
                className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Interest Rate (%)<Tip k="loanInterestRate" /></label>
              <input
                type="number"
                step="0.01"
                value={inputs.loanInterestRate}
                onChange={(e) => onInputChange('loanInterestRate', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Term (years)<Tip k="loanTerm" /></label>
              <input
                type="number"
                value={inputs.loanTerm}
                onChange={(e) => onInputChange('loanTerm', parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Down Payment ($)</label>
              <input
                type="number"
                value={inputs.loanDownpayment}
                onChange={(e) => onInputChange('loanDownpayment', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-sm"
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
                className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-sm"
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
                className="w-full md:w-64 px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-slate-900/60 text-green-300 text-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-blue-200 mb-1">
                Total System Cost ($)
                <span className="ml-2 text-xs text-blue-300/70">Before incentives</span>
              <Tip k="cashGrossCost" /></label>
              <input
                type="number"
                value={inputs.cashGrossCost ?? Math.round((inputs.cashNetCost || 0) / 0.70)}
                onChange={(e) => {
                  const gross = parseFloat(e.target.value) || 0;
                  onInputChange('cashGrossCost', gross);
                  onInputChange('taxCredit', Math.round(gross * 0.30));
                  onInputChange('cashNetCost', Math.round(gross * 0.70));
                }}
                className="w-full px-2.5 py-1.5 border border-blue-400/30 rounded-lg bg-slate-900/60 text-blue-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">Federal Tax Credit (30%)</label>
              <div className="w-full px-2.5 py-1.5 border border-green-400/30 rounded-lg bg-green-500/20 font-semibold text-green-400 text-sm">
                −${Number(inputs.taxCredit || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">Net Cost After Credit</label>
              <div className="w-full px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-cyan-500/20 font-semibold text-cyan-400 text-sm">
                ${Number(inputs.cashNetCost || 0).toLocaleString()}
              </div>
            </div>
          </div>
          <p className="text-xs text-blue-300/60 mt-2">Tax credit and net cost are calculated automatically from the total system cost.</p>
        </div>
      )}
      </>))}

      {/* ============ SECTION: NEM EXPORT, BATTERY & TOU ============ */}
      {renderSection('battery', '🔋 NEM Export, Battery & TOU', batterySummary, (<>
      {/* NEM 2.0 Export Rate */}
      {inputs.nemVersion === 'NEM2' && (
        <div className="mb-6">
          <label className="block text-sm text-cyan-300 mb-1">NEM 2.0 Export Rate ($/kWh)<Tip k="exportRate" /></label>
          <input
            type="number"
            step="0.01"
            value={inputs.exportRate}
            onChange={(e) => onInputChange('exportRate', parseFloat(e.target.value))}
            className="w-full md:w-64 px-2.5 py-1.5 border border-cyan-400/30 rounded-lg bg-slate-900/60 text-cyan-300 text-sm"
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
            checked={ratePlan === 'SDGE_EVTOU5'}
            onChange={(e) => onRatePlanChange && onRatePlanChange(e.target.checked ? 'SDGE_EVTOU5' : 'standard')}
            disabled={inputs.utility !== 'SDGE'}
            className="w-4 h-4 accent-emerald-400"
          />
          <span className={`text-sm ${inputs.utility === 'SDGE' ? 'text-emerald-300' : 'text-slate-500'}`}>
            ⚡ Using EV-TOU{inputs.utility !== 'SDGE' ? ' (SDG&E only)' : ' (super off-peak 12–6am + wkdy 10am–2pm)'}
          </span>
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
              <label className="block text-sm text-purple-200 mb-1">Capacity (kWh)<Tip k="batteryCapacity" /></label>
              <input
                type="number"
                step="0.1"
                value={inputs.batteryCapacity}
                onChange={(e) => onInputChange('batteryCapacity', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm text-purple-200 mb-1">Efficiency (%)<Tip k="batteryEfficiency" /></label>
              <input
                type="number"
                value={inputs.batteryEfficiency}
                onChange={(e) => onInputChange('batteryEfficiency', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
                min="70"
                max="100"
              />
            </div>
            
            <div>
              <label className="block text-sm text-purple-200 mb-1">Monthly Payment ($)<Tip k="batteryMonthlyPayment" /></label>
              <input
                type="number"
                value={inputs.batteryMonthlyPayment}
                onChange={(e) => onInputChange('batteryMonthlyPayment', parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-slate-900/60 text-purple-300 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm text-purple-200 mb-1">Arbitrage Savings</label>
              <div className="w-full px-2.5 py-1.5 border border-purple-400/30 rounded-lg bg-purple-500/20 font-semibold text-purple-300 text-sm">
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
      </>))}

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
