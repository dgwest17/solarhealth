import React, { useState, useMemo, useEffect } from 'react';
import { calculateComprehensiveSavings } from './utils/calculations';
import { DEFAULT_INPUTS, DEFAULT_API_STATUS } from './constants/defaults';
import InputSection from './components/InputSection';
import ResultsDashboard from './components/ResultsDashboard';
import NEMStatusCard from './components/NEMStatusCard';
import SystemHealthAlert from './components/SystemHealthAlert';
import ChartsSection from './components/ChartsSection';
import SummaryTables from './components/SummaryTables';
import SystemScore from './components/SystemScore';
import AINarrative from './components/AINarrative';
import PDFReportGenerator from './components/PDFReportGenerator';
import SystemSpecsSheet from './components/SystemSpecsSheet';
import BatteryAnalysis from './battery/BatteryAnalysis';
import LoadSimulator from './simulator/LoadSimulator';

const SolarCalculator = ({ prefilledInputs = null, clientLabel = '', onBack = null }) => {
  const [inputs, setInputs] = useState(prefilledInputs ? { ...DEFAULT_INPUTS, ...prefilledInputs } : DEFAULT_INPUTS);
  const [dataSource, setDataSource] = useState('manual');
  const [apiStatus, setApiStatus] = useState(DEFAULT_API_STATUS);
  const [showHistoricalRates, setShowHistoricalRates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Phase 2: AI-generated narrative (shared between the UI card and the PDF)
  const [narrative, setNarrative] = useState(null);

  // Client name shown on the printed report header
  const [clientName, setClientName] = useState(clientLabel || '');

  // Tab switcher: 'audit' (the financial audit) | 'battery' (battery analysis)
  const [activeTab, setActiveTab] = useState('audit');

  // The simulator adds load on top of a base. Snapshot the usage that was in
  // effect the first time the simulator is opened, so toggling loads on/off is
  // reversible and layered on the real number (not compounding).
  const [simBaseUsage, setSimBaseUsage] = useState(null);

  const openSimulator = () => {
    if (simBaseUsage == null) setSimBaseUsage(inputs.currentAnnualUsage);
    setActiveTab('simulator');
  };

  const handleSimulatorUsage = (newUsage) => {
    setInputs((prev) => ({ ...prev, currentAnnualUsage: newUsage }));
  };

  // Auto-update current date on mount
  useEffect(() => {
    const now = new Date();
    setInputs(prev => ({
      ...prev,
      nowYear: now.getFullYear(),
      nowMonth: now.getMonth() + 1
    }));
  }, []);

  const calculations = useMemo(
    () => calculateComprehensiveSavings(inputs),
    [inputs]
  );

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    // Audit data changed — any existing narrative is now stale
    setNarrative(null);
  };

  const handleApiConnect = () => {
    setApiStatus({ connected: false, lastSync: null, error: 'Connecting...' });
    setTimeout(() => {
      if (inputs.apiKey && inputs.systemId) {
        setApiStatus({ connected: true, lastSync: new Date().toISOString(), error: null });
      } else {
        setApiStatus({ connected: false, lastSync: null, error: 'Invalid API credentials' });
      }
    }, 1500);
  };

  const handleUpdateSystem = () => {
    setIsUpdating(true);
    const now = new Date();
    setInputs(prev => ({
      ...prev,
      nowYear: now.getFullYear(),
      nowMonth: now.getMonth() + 1
    }));
    setTimeout(() => setIsUpdating(false), 1500);
  };

  return (
    <div className="app-root min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Print-only report header */}
        <div className="hidden print:block mb-4 pb-3 border-b-2 border-amber-500">
          <div className="flex justify-between items-end">
            <h1 className="text-2xl font-bold text-slate-900">California Solar Audit</h1>
            <div className="text-right text-xs text-slate-600">
              {clientName && <p>Prepared for: <strong>{clientName}</strong></p>}
              <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Tab navigation (hidden in print) */}
        <div className="print:hidden flex gap-2 mb-6 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 w-fit">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'audit'
                ? 'bg-amber-400 text-slate-900'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Financial Audit
          </button>
          <button
            onClick={() => setActiveTab('battery')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'battery'
                ? 'bg-amber-400 text-slate-900'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Battery Analysis
          </button>
          <button
            onClick={openSimulator}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'simulator'
                ? 'bg-amber-400 text-slate-900'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Load Simulator
          </button>
        </div>

        {/* BATTERY ANALYSIS TAB */}
        {activeTab === 'battery' && (
          <div className="print:hidden">
            <BatteryAnalysis inputs={inputs} nemImpact={calculations.currentNEMImpact} />
          </div>
        )}

        {/* LOAD SIMULATOR TAB */}
        {activeTab === 'simulator' && (
          <div className="print:hidden">
            <LoadSimulator
              baseUsage={simBaseUsage != null ? simBaseUsage : inputs.currentAnnualUsage}
              production={inputs.annualProduction}
              onUsageChange={handleSimulatorUsage}
              nemImpact={calculations.currentNEMImpact}
            />
          </div>
        )}

        {/* FINANCIAL AUDIT TAB */}
        <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
        <div className="print:hidden">
        <InputSection
          inputs={inputs}
          onInputChange={handleInputChange}
          dataSource={dataSource}
          setDataSource={setDataSource}
          apiStatus={apiStatus}
          onApiConnect={handleApiConnect}
          calculations={calculations}
          onUpdate={handleUpdateSystem}
          isUpdating={isUpdating}
        />
        </div>

        {/* Sections render in natural source order. In print, page breaks
            (.print-break-before) split them into the client-facing PDF pages
            without affecting the on-screen layout. */}

        {/* System Score */}
        <SystemScore
          calculations={calculations}
          inputs={inputs}
        />

        {/* NEM Analysis */}
        <NEMStatusCard
          currentNEMImpact={calculations.currentNEMImpact}
          nemVersion={inputs.nemVersion}
          cumulativeNEMCredits={calculations.cumulativeNEMCredits}
          cumulativeTrueUpCharges={calculations.cumulativeTrueUpCharges}
        />

        <SystemHealthAlert
          systemHealth={calculations.systemHealth}
          annualProduction={inputs.annualProduction}
        />

        {/* Savings/Payback summary (the 4 KPI cards) — last thing on PDF page 1 */}
        <ResultsDashboard calculations={calculations} />

        {/* AI Narrative — on screen only, excluded from the PDF (print:hidden) */}
        <div className="print:hidden">
        <AINarrative
          inputs={inputs}
          calculations={calculations}
          narrative={narrative}
          onNarrativeGenerated={setNarrative}
        />
        </div>

        {/* PDF: hidden (config UI, not for clients) */}
        <PDFReportGenerator
          clientName={clientName}
          setClientName={setClientName}
        />

        {/* Charts — priority two on page 1, rest flow to page 2 (handled in print CSS) */}
        <ChartsSection
          yearlyData={calculations.yearlyData}
          inputs={inputs}
          showHistoricalRates={showHistoricalRates}
          setShowHistoricalRates={setShowHistoricalRates}
        />

        {/* PDF page 2: Financial Summary + System Metrics */}
        <SummaryTables calculations={calculations} inputs={inputs} />

        {/* PDF page 3: System Specifications (print-only, has its own page break) */}
        <SystemSpecsSheet inputs={inputs} />

        <div className="print:hidden bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4 text-sm text-cyan-300/80">
          <p className="font-semibold mb-2 text-cyan-400">Data Sources:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Utility rates: CPUC reports with updated 2025 rates (PG&E: $0.48/kWh, SDG&E: $0.52/kWh, SCE: $0.314/kWh)</li>
            <li>NEM calculations: Retail rate (NEM 1.0), wholesale rate (NEM 2.0), reduced rate (NEM 3.0)</li>
            <li>CARE Program: 30% discount applied to all utility rates</li>
            <li>Performance: California average 1400 kWh/kW/year</li>
          </ul>
        </div>
        </div>
      </div>
    </div>
  );
};

export default SolarCalculator;
