/**
 * FILE: src/battery/SolarAddOnSummary.jsx
 *
 * WHAT A SOLAR ADD-ON PUTS ON THE ROOF — the two figures and the one decision.
 *
 * Added kW and added annual kWh are what a customer checks the proposal against
 * (their own bill, a neighbour's system, a competing quote), and the non-export
 * question decides whether a grandfathered client keeps the tariff that is
 * usually worth more than the panels. All three travel with the saved proposal,
 * so none of them depends on the rep remembering to say it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN FILE
 *
 * It was written inline in BatteryStabilization, inside Deep Seas, which is
 * nested inside the Breakdown accordion — both closed by default. The render
 * check therefore could not reach it: the whole screen rendered to byte-identical
 * output with this code present and absent, which is indistinguishable from the
 * code being broken. A component with explicit props can be rendered on its own
 * and actually checked.
 *
 * Rendered by: src/battery/BatteryStabilization.jsx (Deep Seas, solar deals)
 * Tested by:   scripts/render-check.mjs
 */
import React from 'react';
import { estimateAddedProduction } from '../proposal/proposalModel';

/** The tariffs where a new exporting array costs the client their grandfathering. */
const GRANDFATHERED = new Set(['NEM1', 'NEM2']);
const NEM_LABEL = { NEM1: 'NEM 1.0', NEM2: 'NEM 2.0' };

const SolarAddOnSummary = ({
  panels = 0,
  panelWatts = 440,
  /** Audit inputs — the existing system, used to derive this roof's own yield. */
  inputs = {},
  nonExport = false,
  onNonExportChange = null
}) => {
  const addedKw = ((Number(panels) || 0) * (Number(panelWatts) || 0)) / 1000;

  const existingKw = Number(inputs.systemSize) || 0;
  const existingAnnualKwh = Number(inputs.annualProduction) || 0;
  const measuredYield = existingKw > 0 && existingAnnualKwh > 0;

  const addedKwh = estimateAddedProduction({ addedKw, existingKw, existingAnnualKwh });

  const nem = inputs.nemVersion;
  const grandfathered = GRANDFATHERED.has(nem);
  const nemLabel = NEM_LABEL[nem] || nem;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-2.5 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11.5px]">
        <span className="text-slate-400">
          Adding <b className="text-slate-100 font-mono">{addedKw.toFixed(2)} kW</b>
        </span>
        <span className="text-slate-400">
          ≈ <b className="text-amber-300 font-mono">{addedKwh.toLocaleString()} kWh</b> / yr
        </span>
        {/* Where the estimate came from. A rep who cannot tell a figure derived
            from this roof from a state average cannot defend it when the
            customer's neighbour got a different number. */}
        <span className="text-slate-600">
          {measuredYield
            ? `from this roof — ${Math.round(existingAnnualKwh / existingKw).toLocaleString()} kWh per kW`
            : 'state average — no existing system on file'}
        </span>
      </div>

      <label className="flex items-start gap-1.5 text-[12px] text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={!!nonExport}
          onChange={(e) => onNonExportChange && onNonExportChange(e.target.checked)}
          className="w-3.5 h-3.5 mt-0.5 accent-violet-400 shrink-0"
        />
        <span>
          Non-export design
          {grandfathered && <b className="text-emerald-300"> — keeps their {nemLabel}</b>}
        </span>
      </label>

      {grandfathered && !nonExport && (
        <p className="text-[11px] text-rose-300/90 leading-snug">
          An exporting array restarts their {nemLabel} grandfathering and moves them to today&rsquo;s
          export rates, which is usually worth more than the extra production. The proposal will
          say so.
        </p>
      )}
    </div>
  );
};

export default SolarAddOnSummary;
