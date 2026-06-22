import React, { useState, useEffect } from 'react';
import { Battery } from 'lucide-react';
import { buildDailyOverlay, calculateCreditsRecovered } from './BatteryModel';
import { TOU_RATES } from '../utils/rateData';
import BatteryConsumptionProduction from './BatteryConsumptionProduction';
import BatteryEnergyLoss from './BatteryEnergyLoss';
import BatteryExportInefficiencies from './BatteryExportInefficiencies';
import BatteryRecovery from './BatteryRecovery';
import BatteryStabilization from './BatteryStabilization';

/**
 * Battery Analysis tab — four stacked sections:
 *   1. Production / Consumption overlay (profile dropdown)
 *   2. Energy Loss day/night graphic
 *   3. Export Inefficiencies (economics + grid demand)
 *   4. Battery Recovery (value recovered + backup)
 *
 * The overlay (built from the selected profile + the client's system data)
 * is computed once here and shared, so every section stays in sync.
 */
const BatteryAnalysis = ({ inputs }) => {
  const [profileKey, setProfileKey] = useState('evening_heavy');

  const overlay = buildDailyOverlay(
    profileKey,
    inputs.currentAnnualUsage,
    inputs.annualProduction
  );

  // Shared export/import figures — lifted here so §3 (Export Inefficiencies)
  // and §4 (Your Energy, Your Credits) always compute from the SAME numbers.
  // Default to the overlay; §3's manual toggle updates these for both sections.
  const [manualMode, setManualMode] = useState(false);
  const [exportKwh, setExportKwh] = useState(overlay.annualDaytimeOverproduction);
  const [importKwh, setImportKwh] = useState(overlay.annualNighttimeImport);

  // When the profile changes (and not in manual mode), follow the overlay.
  useEffect(() => {
    if (!manualMode) {
      setExportKwh(overlay.annualDaytimeOverproduction);
      setImportKwh(overlay.annualNighttimeImport);
    }
  }, [overlay.annualDaytimeOverproduction, overlay.annualNighttimeImport, manualMode]);

  const effExport = manualMode ? (Number(exportKwh) || 0) : overlay.annualDaytimeOverproduction;
  const effImport = manualMode ? (Number(importKwh) || 0) : overlay.annualNighttimeImport;

  // Energy Credits Recovered / year — shared with the stabilization ROI math,
  // now using the SAME effective export/import as §3 and §4.
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  const recovery = calculateCreditsRecovered(
    touRates,
    effExport,
    effImport,
    inputs.batteryCapacity,
    inputs.batteryEfficiency,
    inputs.utility
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 flex items-center gap-2">
          <Battery size={30} className="text-amber-400" />
          Battery Analysis
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          See how your system behaves over a day — and what a battery would recover.
        </p>
      </div>

      <BatteryConsumptionProduction
        inputs={inputs}
        profileKey={profileKey}
        setProfileKey={setProfileKey}
        overlay={overlay}
      />

      <BatteryEnergyLoss />

      <BatteryExportInefficiencies
        inputs={inputs}
        overlay={overlay}
        manualMode={manualMode}
        setManualMode={setManualMode}
        exportKwh={exportKwh}
        setExportKwh={setExportKwh}
        importKwh={importKwh}
        setImportKwh={setImportKwh}
        effExport={effExport}
        effImport={effImport}
      />

      <BatteryRecovery
        inputs={inputs}
        overlay={overlay}
        effExport={effExport}
        effImport={effImport}
      />

      <BatteryStabilization
        recoveredValuePerYear={recovery.creditsRecovered}
        overlay={overlay}
        inputs={inputs}
      />
    </div>
  );
};

export default BatteryAnalysis;
