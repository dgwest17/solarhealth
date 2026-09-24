/**
 * FILE: src/battery/BatteryAnalysis.jsx
 *
 * Battery tab shell — owns shared math, stacks every battery section in accordions.
 */
import React, { useState, useEffect } from 'react';
import { Battery } from 'lucide-react';
import { buildOverlayWithAddedLoad, calculateTotalRecoveredValue } from './BatteryModel';
import { TOU_RATES } from '../utils/rateData';
import { calculateNEMImpact, getUtilityRate } from '../utils/calculations';
import BatteryConsumptionProduction from './BatteryConsumptionProduction';
import BatteryEnergyLoss from './BatteryEnergyLoss';
import BatteryExportInefficiencies from './BatteryExportInefficiencies';
import BatteryRecovery from './BatteryRecovery';
import BatteryStabilization from './BatteryStabilization';
import BatteryDispatchPanel from './BatteryDispatchPanel';
import Accordion from './Accordion';
import LimitedIncentives from './LimitedIncentives';
import NemCountdown from './NemCountdown';
import Nem3ValuePanel from './Nem3ValuePanel';

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
const BatteryAnalysis = ({ 
  /** Verdict from the Eligibility tab; drives the rebate Auto in Stabilize. */
  eligibility = null,
inputs, nemImpact: nemImpactProp = null, extraUsage = null, measured = null , consumptionProfile = null, onConsumptionProfileChange = null, calculations = null, rateOverride = null, onRateOverrideChange = null, clientContext = null, clientLabel = '' }) => {
  const [profileKeyInternal, setProfileKeyInternal] = useState('evening_heavy');
  const profileKey = consumptionProfile || profileKeyInternal;
  const setProfileKey = (k) => { setProfileKeyInternal(k); if (onConsumptionProfileChange) onConsumptionProfileChange(k); };

  // AUTHORITATIVE true-up / annual-check — from full annual usage vs production
  // at the real utility rate. Prefer the value computed by the audit tool
  // (passed in) so both tools ALWAYS agree; fall back to computing it here
  // (e.g. sandbox mode) using the same function the audit uses.
  const nemImpact = nemImpactProp || calculateNEMImpact(
    inputs.annualProduction,
    inputs.currentAnnualUsage,
    getUtilityRate(inputs.nowYear || new Date().getFullYear(), inputs.utility, inputs.onCareProgram),
    inputs.nemVersion,
    inputs.exportRate
  );
  // Normalized: positive owe = true-up, positive credit = utility pays them.
  const annualTrueUp = nemImpact.type === 'trueup' ? nemImpact.amount : 0;
  const annualCheck = nemImpact.type === 'credit' ? nemImpact.amount : 0;
  const owesUtility = nemImpact.type === 'trueup';

  // The overlay carries the planned load from the Load Simulator as a second
  // series. The client's real curve is never rewritten — the projection sits
  // over it, so every section below can show base and added separately.
  const addedKwh = (extraUsage && Number(extraUsage.addedKwh)) || 0;
  const addedDaytimePct = (extraUsage && Number(extraUsage.daytimePct)) || 40;
  const overlay = buildOverlayWithAddedLoad(
    profileKey,
    inputs.currentAnnualUsage,
    inputs.annualProduction,
    addedKwh,
    addedDaytimePct
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

  // MEASURED DATA: when a Green Button profile has been applied, its real
  // annual import/export replace the overlay estimates. Manual mode is
  // switched on so both §3 and §4 run off the measured numbers.
  const [useMeasured, setUseMeasured] = useState(false);
  useEffect(() => {
    if (measured && measured.ok) {
      setUseMeasured(true);
      setManualMode(true);
      setExportKwh(measured.annualExportKwh);
      setImportKwh(measured.annualImportKwh);
    } else {
      setUseMeasured(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  const toggleMeasured = (checked) => {
    setUseMeasured(checked);
    if (checked && measured && measured.ok) {
      setManualMode(true);
      setExportKwh(measured.annualExportKwh);
      setImportKwh(measured.annualImportKwh);
    } else {
      // Hand control back to the consumption-profile overlay / manual sliders.
      setManualMode(false);
    }
  };

  const effExport = manualMode ? (Number(exportKwh) || 0) : overlay.annualDaytimeOverproduction;
  const effImport = manualMode ? (Number(importKwh) || 0) : overlay.annualNighttimeImport;

  // THE SAME TWO FIGURES, WITH THE PLANNED LOAD ON TOP.
  //
  // Derived as a DELTA rather than read from the overlay's own with-added
  // fields, because those are only right in overlay mode. In manual mode the
  // rep has typed the figures, and with a Green Button upload they are
  // measured — in both cases they describe the house as it is TODAY, so a
  // planned EV still has to be layered onto them. The delta (surplus the load
  // eats, import it adds) is a property of the load's shape and applies to
  // whichever baseline is in force.
  //
  // Computed once here and passed down, because the previous attempt let each
  // section work it out for itself and one of them silently got the base
  // figures back — the cost-of-doing-nothing delta came out as exactly zero
  // on every client.
  const addedImportKwh = overlay.importAddedByLoad || 0;
  const addedSurplusLostKwh = overlay.surplusLostToAddedLoad || 0;
  const effExportWithAdded = Math.max(0, effExport - addedSurplusLostKwh);
  const effImportWithAdded = effImport + addedImportKwh;

  // Energy Credits Recovered / year — the overlay-driven time-shift value (the
  // rate-arbitrage spread a battery claws back). Kept exactly as designed.
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  // Single source of truth — the consultation report calls this same function,
  // so the two can't drift apart (they did: the report was omitting the
  // avoided-true-up half entirely).
  const recovery = calculateTotalRecoveredValue(
    touRates,
    effExport,
    effImport,
    inputs.batteryCapacity,
    inputs.batteryEfficiency,
    inputs.utility,
    annualTrueUp
  );
  const arbitrageRecovered = recovery.arbitrageRecovered;
  const avoidedTrueUp = recovery.avoidedTrueUp;
  const totalRecoveredPerYear = recovery.totalRecoveredPerYear;

  return (
    <div>
      {measured && measured.ok && (
        <div className={`mb-4 rounded-xl border-2 p-4 flex items-start justify-between gap-3 ${
          useMeasured ? 'bg-emerald-500/10 border-emerald-400/50' : 'bg-slate-800/60 border-slate-600/60'
        }`}>
          <div>
            <div className={`font-semibold text-sm flex items-center gap-2 ${useMeasured ? 'text-emerald-300' : 'text-slate-300'}`}>
              📊 {useMeasured ? 'Consumption Profile Overridden by Data Upload' : 'Measured data available (not applied)'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {useMeasured
                ? `Import/export figures use the client's measured Green Button data (${measured.annualImportKwh.toLocaleString()} kWh in · ${measured.annualExportKwh.toLocaleString()} kWh out, annualized from ${measured.days} days). Uncheck to adjust the consumption/production profile manually.`
                : 'Check to use the uploaded Green Button figures instead of the modeled profile.'}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={useMeasured}
              onChange={(e) => toggleMeasured(e.target.checked)}
              className="w-4 h-4 accent-emerald-400"
            />
            <span className="text-xs text-slate-300">Use measured data</span>
          </label>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 flex items-center gap-2">
          <Battery size={30} className="text-amber-400" />
          Battery Analysis
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          See how your system behaves over a day — and what a battery would recover.
        </p>
      </div>

      <Accordion title="Consumption vs Production" subtitle="Your energy through a typical day" accent="amber" defaultOpen icon={<Battery size={16} className="text-amber-400" />}>
        <BatteryConsumptionProduction
          inputs={inputs}
          profileKey={profileKey}
          setProfileKey={setProfileKey}
          overlay={overlay}
          extraUsage={extraUsage}
        />
      </Accordion>

      <Accordion title="Where Energy Is Lost (Net Energy Metering)" subtitle="How NEM credits your exports" accent="amber">
        <BatteryEnergyLoss />
      </Accordion>

      <Accordion title="Time of Use is Changing (Not for the better)" subtitle="What you give up exporting instead of storing" accent="amber">
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
          annualTrueUp={annualTrueUp}
          annualCheck={annualCheck}
          owesUtility={owesUtility}
          extraUsage={extraUsage}
        />
      </Accordion>

      {/* NEM 1.0/2.0 get the grandfathering countdown here. NEM 3.0 clients have
          nothing to count down — they're already on the successor tariff — so they
          get the forward-looking value story instead. */}
      <NemCountdown nemExpiry={calculations && calculations.nemExpiry} nemVersion={inputs.nemVersion} />
      <Nem3ValuePanel inputs={inputs} calculations={calculations} />

      <Accordion title="The Looming Grid Problem" subtitle="Why the grid squeeze costs you more every year" accent="emerald" defaultOpen>
        <BatteryRecovery
          inputs={inputs}
          overlay={overlay}
          effExport={effExport}
          effImport={effImport}
          effExportWithAdded={effExportWithAdded}
          effImportWithAdded={effImportWithAdded}
          annualTrueUp={annualTrueUp}
          annualCheck={annualCheck}
          owesUtility={owesUtility}
          avoidedTrueUp={avoidedTrueUp}
          arbitrageRecovered={arbitrageRecovered}
          totalRecoveredPerYear={totalRecoveredPerYear}
          extraUsage={extraUsage}
        />
      </Accordion>

      {/* Limited-time incentives — reserve before the funding runs out */}
      <LimitedIncentives />

      {/* Hour-by-hour dispatch economics — the accurate version */}
      <Accordion title="How Does a Battery Recover Credits?" subtitle="Hour-by-hour dispatch, hardware & rate comparison" accent="purple" defaultOpen icon={<Battery size={16} className="text-purple-400" />}>
        <BatteryDispatchPanel inputs={inputs} calculations={calculations} extraUsage={extraUsage} rateOverride={rateOverride} onRateOverrideChange={onRateOverrideChange} />
      </Accordion>

      <Accordion title="Stabilize Your Bill With Storage" subtitle="Smoothing your load and your bill" accent="cyan">
        <BatteryStabilization
          eligibility={eligibility}
          recoveredValuePerYear={totalRecoveredPerYear}
          overlay={overlay}
          inputs={inputs}
          annualTrueUp={annualTrueUp}
          calculations={calculations}
          annualExportKwh={effExport}
          clientContext={clientContext}
          clientLabel={clientLabel}
        />
      </Accordion>
    </div>
  );
};

export default BatteryAnalysis;
