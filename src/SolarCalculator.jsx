import React, { useState, useMemo, useEffect } from 'react';
import { calculateComprehensiveSavings } from './utils/calculations';
import { DEFAULT_INPUTS, DEFAULT_API_STATUS } from './constants/defaults';
import InputSection from './components/InputSection';
import ResultsDashboard from './components/ResultsDashboard';
import SystemScore from './components/SystemScore';
import NEMStatusCard from './components/NEMStatusCard';
import SystemHealthAlert from './components/SystemHealthAlert';
import ChartsSection from './components/ChartsSection';
import SummaryTables from './components/SummaryTables';

const SolarCalculator = () => {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [dataSource, setDataSource] = useState('manual');
  const [apiStatus, setApiStatus] = useState(DEFAULT_API_STATUS);
  const [showHistoricalRates, setShowHistoricalRates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Auto-update current date on mount and when needed
  useEffect(() => {
    const updateCurrentDate = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      setInputs(prev => ({
        ...prev,
        nowYear: currentYear,
        nowMonth: currentMonth
      }));
    };

    updateCurrentDate();
  }, []);

  // Calculate all metrics whenever inputs change
  const calculations = useMemo(() => 
    calculateComprehensiveSavings(inputs), 
    [inputs]
  );

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleApiConnect = () => {
    setApiStatus({ connected: false, lastSync: null, error: 'Connecting...' });
    
    setTimeout(() => {
      if (inputs.apiKey && inputs.systemId) {
        setApiStatus({
          connected: true,
          lastSync: new Date().toISOString(),
          error: null
        });
      } else {
        setApiStatus({
          connected: false,
          lastSync: null,
          error: 'Invalid API credentials'
        });
      }
    }, 1500);
  };

  const handleUpdateSystem = () => {
    setIsUpdating(true);
    
    // Update current date
    const now = new Date();
    setInputs(prev => ({
      ...prev,
      nowYear: now.getFullYear(),
      nowMonth: now.getMonth() + 1
    }));

    // Simulate calculation time
    setTimeout(() => {
      setIsUpdating(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Input Section */}
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

        {/* System Score - NEW */}
        <SystemScore 
          calculations={calculations}
          inputs={inputs}
        />

        {/* NEM Status Card */}
        <NEMStatusCard 
          currentNEMImpact={calculations.currentNEMImpact}
          nemVersion={inputs.nemVersion}
          cumulativeNEMCredits={calculations.cumulativeNEMCredits}
          cumulativeTrueUpCharges={calculations.cumulativeTrueUpCharges}
        />

        {/* System Health Alert */}
        <SystemHealthAlert systemScore={calculations.systemScore} />

        {/* Results Dashboard */}
        <ResultsDashboard calculations={calculations} />

        {/* Charts Section */}
        <ChartsSection 
          yearlyData={calculations.yearlyData}
          inputs={inputs}
          showHistoricalRates={showHistoricalRates}
          setShowHistoricalRates={setShowHistoricalRates}
        />

        {/* Summary Tables */}
        <SummaryTables 
          calculations={calculations}
          inputs={inputs}
        />

        {/* Data Sources Footer */}
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4 text-sm text-cyan-300/80">
          <p className="font-semibold mb-2 text-cyan-400">Data Sources:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Utility rates: CPUC reports with updated 2025 rates (PG&E: $0.48/kWh, SDG&E: $0.52/kWh, SCE: $0.314/kWh)</li>
            <li>NEM calculations: Retail rate (NEM 1.0), wholesale rate (NEM 2.0), reduced rate (NEM 3.0)</li>
            <li>CARE Program: 30% discount applied to all utility rates</li>
            <li>Performance: California average 1400 kWh/kW/year</li>
            <li>Degradation: 0.55% annual solar panel degradation applied</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SolarCalculator;
