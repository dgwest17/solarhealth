/**
 * FILE: src/incentives/EligibilityTab.jsx
 *
 * Program eligibility check — can this client actually get the rebate?
 *
 * Mirrors the contractor System Sizing Tool's Analysis sheet. The question it
 * answers is narrow and specific: does this home produce enough WEEKDAY surplus
 * solar, in every month, to fill the proposed battery? That is what the program
 * administrator tests, so it is what a rep needs to know before promising a
 * rebate to anyone.
 *
 * Monthly excess can come from measured Green Button data (accurate) or be
 * estimated from annual production and usage (indicative only) — the panel is
 * explicit about which it used, because the difference decides whether the
 * answer is worth quoting.
 *
 * Rendered by: src/SolarCalculator.jsx (Eligibility tab)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, FileSearch } from 'lucide-react';
import { assessEligibility } from './eligibility';
import { BATTERY_MODELS, getProgram, calcRebate } from './programData';
import { estimateMonthlyDailyExcess } from '../battery/BatteryDispatch';
import { CONSUMPTION_PROFILES } from '../battery/BatteryModel';
import { useAssumptions } from '../admin/SettingsContext';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();

const STATUS_STYLE = {
  sufficient:           { ring: 'border-emerald-400/50 bg-emerald-900/18', text: 'text-emerald-300', Icon: CheckCircle2 },
  partial:              { ring: 'border-amber-400/50 bg-amber-900/15',     text: 'text-amber-300',   Icon: AlertTriangle },
  review:               { ring: 'border-amber-400/50 bg-amber-900/15',     text: 'text-amber-300',   Icon: AlertTriangle },
  'insufficient-data':  { ring: 'border-slate-500/50 bg-slate-800/40',     text: 'text-slate-300',   Icon: FileSearch },
  'insufficient-sizing':{ ring: 'border-red-400/50 bg-red-900/15',         text: 'text-red-300',     Icon: XCircle },
  ineligible:           { ring: 'border-red-400/50 bg-red-900/15',         text: 'text-red-300',     Icon: XCircle }
};

const EligibilityTab = ({
  /** Reports the verdict upward so Stabilize's rebate Auto can follow it. */
  onAssessed = null, inputs, gbProfile = null, consumptionProfile = null }) => {
  const assumptions = useAssumptions();
  const [batteryId, setBatteryId] = useState('tesla_pw3');
  const [qty, setQty] = useState(1);
  // The load shape drives the estimate more than anything else here, so it is
  // an explicit, visible control rather than a buried constant.
  const [profileKey, setProfileKey] = useState(
    consumptionProfile || assumptions.defaultConsumptionProfile || 'evening_heavy'
  );
  const [onCare, setOnCare] = useState(!!inputs.onCareProgram);
  const [hasExistingSolar, setHasExistingSolar] = useState(true);
  const [solarOverOneYear, setSolarOverOneYear] = useState(true);
  const [addingSolar, setAddingSolar] = useState(false);

  const program = getProgram(inputs.utility);

  // Measured data wins; otherwise estimate and say so.
  const measured = gbProfile && gbProfile.monthlyExcess ? gbProfile.monthlyExcess : null;
  const monthlyExcess = useMemo(
    () => measured || estimateMonthlyDailyExcess({
      annualProductionKwh: inputs.annualProduction,
      annualUsageKwh: inputs.currentAnnualUsage,
      consumptionProfile: profileKey,
      fallbackDaytimeShare: assumptions.fallbackDaytimeLoadShare
    }) || [],
    [measured, inputs.annualProduction, inputs.currentAnnualUsage, profileKey, assumptions.fallbackDaytimeLoadShare]
  );

  const result = useMemo(() => assessEligibility({
    monthlyExcess,
    batteryId,
    qty,
    hasExistingSolar,
    solarOverOneYear,
    addingSolar
  }), [monthlyExcess, batteryId, qty, hasExistingSolar, solarOverOneYear, addingSolar]);

  const rebate = calcRebate(program, result.usableKwh, qty, onCare);

  /**
   * Publish the verdict.
   *
   * Stabilize used to infer eligibility from the utility alone, which is the
   * coarsest possible proxy — it says a customer in SDG&E territory qualifies
   * even when this tab has just worked out that their surplus cannot fill the
   * battery in four months of the year. One assessment, computed here where the
   * inputs live, read there.
   */
  useEffect(() => {
    if (!onAssessed) return;
    onAssessed({
      status: result.status,
      eligible: result.status === 'eligible',
      rebate: rebate && rebate.total ? rebate.total : 0,
      usableKwh: result.usableKwh,
      reason: result.status === 'eligible' ? null : (result.reason || result.status)
    });
  }, [onAssessed, result.status, result.reason, result.usableKwh, rebate && rebate.total]);
  const st = STATUS_STYLE[result.status] || STATUS_STYLE['insufficient-data'];
  const { Icon } = st;
  const maxExcess = Math.max(...result.months.map((m) => Math.max(m.excess || 0, m.threshold)), 1);

  return (
    <div className="space-y-4">
      {/* ---- controls ---- */}
      <div className="bg-slate-800/50 border border-cyan-500/25 rounded-xl p-5">
        <h3 className="text-base font-bold text-cyan-300 mb-1">Program Eligibility</h3>
        <p className="text-[11.5px] text-slate-500 mb-4">
          {program.name} · {program.utilityLabel}. Tests whether weekday surplus solar can fill the
          proposed battery in every month — the same check the program administrator runs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Battery model</label>
            <select
              value={batteryId}
              onChange={(e) => setBatteryId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm"
            >
              {BATTERY_MODELS.map((b) => (
                <option key={b.id} value={b.id}>{b.make} {b.model} · {b.usableKwh} kWh</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Quantity</label>
            <select
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm"
            >
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>×{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Pack usable capacity</label>
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/40 border border-slate-700 text-purple-300 text-sm font-semibold">
              {result.packKwh.toFixed(1)} kWh
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-[12px]">
          {[
            ['Existing solar', hasExistingSolar, setHasExistingSolar],
            ['Installed over 1 year', solarOverOneYear, setSolarOverOneYear],
            ['Adding new solar', addingSolar, setAddingSolar],
            ['On CARE', onCare, setOnCare]
          ].map(([label, val, set]) => (
            <label key={label} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="w-3.5 h-3.5 accent-cyan-400" />
              <span className={val ? 'text-cyan-200' : 'text-slate-400'}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ---- verdict ---- */}
      <div className={`rounded-xl border-2 p-5 ${st.ring}`}>
        <div className="flex items-start gap-3">
          <Icon size={22} className={`${st.text} shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className={`text-lg font-bold ${st.text}`}>{result.headline}</div>
            <p className="text-[12px] text-slate-300 mt-1 leading-relaxed">{result.detail}</p>

            {result.status === 'sufficient' && rebate.amount > 0 && (
              <div className="mt-3 rounded-lg bg-slate-900/50 border border-emerald-400/30 px-3 py-2">
                <div className="text-[12px] text-emerald-200">
                  Estimated up-front rebate:{' '}
                  <span className="font-bold text-lg">{money(rebate.amount)}</span>
                  <span className="text-slate-400 font-normal">
                    {' '}({money(rebate.rate)}/kWh {onCare ? 'CARE tier' : 'standard tier'} × {result.packKwh.toFixed(1)} kWh)
                  </span>
                </div>
                {rebate.capped && (
                  <div className="text-[10.5px] text-amber-300 mt-1">
                    Capped at {money(program.rebateCap)} — the uncapped figure would be {money(rebate.gross)}.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- month by month ---- */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h4 className="text-sm font-bold text-slate-200">Month-by-month charge test</h4>
          <span className="text-[11px] text-slate-500">
            {measured ? 'From measured interval data' : 'Estimated — upload Green Button for a real answer'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Average <span className="text-slate-300">weekday</span> daily surplus vs the charge threshold.
          Summer months are tested at 80% of pack capacity, winter at 60%.
        </p>

        {!measured && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
            <label className="block text-[11px] text-slate-400 mb-1">
              Load shape used for the estimate
            </label>
            <select
              value={profileKey} onChange={(e) => setProfileKey(e.target.value)}
              className="w-full sm:w-[320px] px-2 py-1.5 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px]"
            >
              {Object.entries(CONSUMPTION_PROFILES).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
            </select>
            <p className="text-[10.5px] text-slate-500 mt-1.5 max-w-2xl">
              Surplus is the sun left over after the house has taken what it needs, hour by hour. A home that runs
              its load in the evening banks far more midday surplus than one running a pool pump at noon — which is
              why this control moves the verdict more than any other on the page.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          {result.months.map((m) => {
            const pct = Math.min(100, ((m.excess || 0) / maxExcess) * 100);
            const thPct = Math.min(100, (m.threshold / maxExcess) * 100);
            return (
              <div key={m.month} className="flex items-center gap-2.5">
                <span className="w-[74px] text-[11px] text-slate-400 shrink-0">{m.name}</span>
                <span className="w-[34px] text-[9.5px] text-slate-600 shrink-0">{m.thresholdTier}</span>
                <div className="flex-1 relative h-5 bg-slate-900/60 rounded">
                  <div
                    className={`absolute inset-y-0 left-0 rounded ${m.passes ? 'bg-emerald-500/45' : 'bg-red-500/40'}`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="absolute inset-y-0 w-[2px] bg-amber-400" style={{ left: `${thPct}%` }} title={`Threshold ${m.threshold.toFixed(1)} kWh`} />
                </div>
                <span className={`w-[54px] text-right text-[11px] font-mono shrink-0 ${m.passes ? 'text-emerald-300' : 'text-red-300'}`}>
                  {m.hasData ? m.excess.toFixed(1) : '—'}
                </span>
                <span className="w-[16px] text-center shrink-0">
                  {m.highRisk ? <span title="Passes on incomplete data" className="text-amber-400">!</span>
                    : m.passes ? <span className="text-emerald-400">✓</span>
                    : <span className="text-red-400">✕</span>}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
          <span><span className="inline-block w-3 h-[2px] bg-amber-400 mr-1 align-middle" />charge threshold</span>
          <span className="text-emerald-400">✓ passes</span>
          <span className="text-red-400">✕ short</span>
          <span className="text-amber-400">! incomplete data</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        Implements the contractor System Sizing Tool (v4.5, Q2 2026) charge test: threshold =
        pack usable kWh × 80% (summer) or 60% (winter) × 0.96 charging efficiency, measured against
        average weekday daily surplus. Weekends are excluded because the program dispatches on
        weekdays. A month counts as complete with at least 75% of its hours present.
        {!program.verified && ' Rebate figures for this utility are unverified placeholders — confirm before quoting.'}
      </p>
    </div>
  );
};

export default EligibilityTab;
