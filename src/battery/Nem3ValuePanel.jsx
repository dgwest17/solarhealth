/**
 * FILE: src/battery/Nem3ValuePanel.jsx
 *
 * NEM 3.0 value story — the FORWARD narrative.
 *
 * Why this is a separate panel: every other section in this tab reconstructs
 * what a system HAS done. A NEM 3.0 client has no favourable-export history to
 * look back on — they were on the successor tariff from day one, and most were
 * energised in 2025-2026. Showing them a retrospective is showing them nothing.
 *
 * The economics also invert. Under NEM 1.0/2.0 an exported kWh earned close to
 * retail, so exporting was fine and a battery was an optimisation. Under NEM
 * 3.0 exports are paid at avoided cost — cents — while the same kWh bought back
 * in the evening costs full retail. So for these clients:
 *
 *     self-consumption IS the return. Export is the leak.
 *
 * A battery stops being an arbitrage play and becomes the thing that makes the
 * array worth what they paid for it.
 *
 * Rendered by: src/battery/BatteryAnalysis.jsx (NEM 3.0 clients only)
 */
import React from 'react';
import { ArrowDownRight, Battery, TrendingUp, AlertTriangle } from 'lucide-react';
import { NEM3_EXPORT_MIDDAY, NEM3_EXPORT_EVENING } from './BatteryDispatch';

const money = (v) => '$' + Math.abs(Math.round(v)).toLocaleString();
const kwh = (v) => Math.round(v).toLocaleString();

const Nem3ValuePanel = ({ inputs, calculations, scenarios = null }) => {
  if (inputs.nemVersion !== 'NEM3') return null;

  const production = Number(calculations?.currentDegradedProduction) || Number(inputs.annualProduction) || 0;
  const usage = Number(inputs.currentAnnualUsage) || 0;
  if (!production || !usage) return null;

  const pos = calculations?.currentNEMImpact;
  const exportKwh = pos?.exportKwh || 0;
  const retailRate = pos?.buyRate || 0.50;

  // The haircut: what an exported kWh earns vs what the same kWh costs to buy
  // back after dark. This single ratio is the whole NEM 3.0 conversation.
  const exportRate = NEM3_EXPORT_MIDDAY;
  const haircutPct = retailRate > 0 ? (1 - exportRate / retailRate) * 100 : 0;

  // Value currently evaporating: energy sent out at avoided cost that the home
  // buys back at retail hours later.
  const leakPerKwh = Math.max(0, retailRate - exportRate);
  const annualLeak = exportKwh * leakPerKwh;

  const batteryGain = scenarios?.recommendation?.gain || 0;
  const capturePct = annualLeak > 0 ? Math.min(100, (batteryGain / annualLeak) * 100) : 0;

  return (
    <div className="mb-3 rounded-xl border border-violet-400/40 bg-gradient-to-br from-violet-900/20 to-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className="text-violet-300" />
        <h4 className="text-sm font-bold text-violet-200">You&rsquo;re on NEM 3.0 — exporting doesn&rsquo;t pay</h4>
      </div>
      <p className="text-[11.5px] text-slate-300 leading-relaxed mb-3">
        Systems energised under NEM 3.0 are credited for exported power at the utility&rsquo;s avoided cost,
        not the retail rate. Nothing is wrong with your system — this is simply the tariff it was built under.
        It changes what the array is worth, and what to do about it.
      </p>

      {/* The haircut */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">You sell at</div>
          <div className="text-2xl font-extrabold text-red-300">${exportRate.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">per exported kWh (midday)</div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">You buy back at</div>
          <div className="text-2xl font-extrabold text-amber-300">${retailRate.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">per kWh, evening retail</div>
        </div>
        <div className="rounded-lg border border-violet-400/40 bg-violet-900/25 p-3">
          <div className="text-[10px] uppercase tracking-wider text-violet-300">The haircut</div>
          <div className="text-2xl font-extrabold text-violet-200">{haircutPct.toFixed(0)}%</div>
          <div className="text-[10px] text-slate-400">less than retail</div>
        </div>
      </div>

      {/* The leak */}
      {exportKwh > 0 && (
        <div className="rounded-lg border border-red-400/30 bg-red-900/15 p-3 mb-3">
          <div className="flex items-start gap-2">
            <ArrowDownRight size={15} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold text-red-200">
                {kwh(exportKwh)} kWh/yr leaves your roof at {money(exportRate * 1000).replace('$', '$')}/1,000 kWh
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                You export it for <span className="text-red-300 font-semibold">${exportRate.toFixed(3)}</span> and buy
                power back after dark for <span className="text-amber-300 font-semibold">${retailRate.toFixed(3)}</span>.
                That spread is <span className="font-bold text-red-300">{money(annualLeak)}/yr</span> of value
                evaporating — not lost production, lost <em>timing</em>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* What storage does about it */}
      <div className="rounded-lg border border-emerald-400/35 bg-emerald-900/15 p-3">
        <div className="flex items-start gap-2">
          <Battery size={15} className="text-emerald-400 mt-0.5 shrink-0" />
          <div className="w-full">
            <div className="text-[12px] font-semibold text-emerald-200">
              Under NEM 3.0, a battery isn&rsquo;t an upgrade — it&rsquo;s what makes the array pay
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Storage keeps that midday surplus at home instead of selling it for pennies. Every stored kWh
              used at night avoids a full-retail purchase, so it&rsquo;s worth roughly{' '}
              <span className="font-semibold text-emerald-300">{(retailRate / exportRate).toFixed(0)}×</span>{' '}
              more than exporting it.
            </p>
            {batteryGain > 0 && (
              <div className="mt-2 flex items-baseline gap-2">
                <TrendingUp size={14} className="text-emerald-400" />
                <span className="text-xl font-extrabold text-emerald-300">{money(batteryGain)}/yr</span>
                <span className="text-[11px] text-slate-400">
                  recovered — about {capturePct.toFixed(0)}% of what&rsquo;s currently leaking
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
        Export credit modelled at ${NEM3_EXPORT_MIDDAY.toFixed(3)}/kWh midday and ${NEM3_EXPORT_EVENING.toFixed(2)}/kWh
        in the evening window. Actual NEM 3.0 compensation varies hour by hour with the avoided-cost schedule —
        these are representative averages, not a guaranteed rate.
      </p>
    </div>
  );
};

export default Nem3ValuePanel;
