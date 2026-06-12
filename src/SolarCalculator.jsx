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

const SolarCalculator = () => {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [dataSource, setDataSource] = useState('manual');
  const [apiStatus, setApiStatus] = useState(DEFAULT_API_STATUS);
  const [showHistoricalRates, setShowHistoricalRates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Phase 2: AI-generated narrative (shared between the UI card and the PDF)
  const [narrative, setNarrative] = useState(null);

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
            <h1 className="text-2xl font-bold text-slate-900">Solar Financial Audit</h1>
            <div className="text-right text-xs text-slate-600">
              {clientName && <p>Prepared for: <strong>{clientName}</strong></p>}
              <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

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

        {/* System Report Card */}
        <SystemScore
          calculations={calculations}
          inputs={inputs}
        />

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

        <ResultsDashboard calculations={calculations} />

        {/* Phase 2: AI-Powered Personalized Narrative */}
        <AINarrative
          inputs={inputs}
          calculations={calculations}
          narrative={narrative}
          onNarrativeGenerated={setNarrative}
        />

        {/* Customer-facing PDF report (includes narrative when generated) */}
        <PDFReportGenerator
          clientName={clientName}
          setClientName={setClientName}
        />

        <ChartsSection
          yearlyData={calculations.yearlyData}
          inputs={inputs}
          showHistoricalRates={showHistoricalRates}
          setShowHistoricalRates={setShowHistoricalRates}
        />

        <SummaryTables calculations={calculations} inputs={inputs} />

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
  );
};

export default SolarCalculator;
