import TouChart from './TouChart';
import React from 'react';
import { TrendingDown, Server, Zap, AlertCircle } from 'lucide-react';
import { TOU_RATES, UTILITY_OPTIONS } from '../utils/rateData';
import { calculateExportEconomics, calculateEnergyCredits, NET_COMPENSATION_RATE } from './BatteryModel';

/**
 * Section 3 — Export Inefficiencies.
 * Left column: annual export/import kWh (auto from overlay, or manual).
 * Right column: $ sold daytime, $ bought night, net annual compensation.
 * Below: "Grid Demand is Worsening" persuasion block.
 */
const BatteryExportInefficiencies = ({
  inputs, overlay,
  manualMode, setManualMode,
  exportKwh: exportKwhProp, setExportKwh,
  importKwh: importKwhProp, setImportKwh,
  effExport, effImport,
  annualTrueUp = 0, annualCheck = 0, owesUtility = false,
  extraUsage = null
}) => {
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  const utilName = (() => {
    const o = UTILITY_OPTIONS.find((x) => x.value === inputs.utility);
    if (!o) return inputs.utility || 'your utility';
    const m = /\(([^)]+)\)/.exec(o.label);
    return m ? m[1] : o.label;
  })();

  // Shared (lifted) state drives both this section and §4.
  const manual = manualMode;
  const setManual = setManualMode;
  const manualExport = exportKwhProp;
  const manualImport = importKwhProp;

  const exportKwh = effExport != null ? effExport : overlay.annualDaytimeOverproduction;
  const importKwh = effImport != null ? effImport : overlay.annualNighttimeImport;

  const econ = calculateExportEconomics(touRates, exportKwh, importKwh, inputs.utility);
  const credits = calculateEnergyCredits(touRates, exportKwh, importKwh, inputs.utility);
  const money = (v) => `$${Math.round(v).toLocaleString()}`;
  const rate = (v) => `$${v.toFixed(3)}/kWh`;

  return (
    <div className="bg-gradient-to-br from-[#0a1628] to-[#13243f] border border-amber-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <div className="mb-4"><TouChart utility={inputs.utility} /></div>
      <h2 className="text-2xl font-bold text-amber-300 mb-1">Export Inefficiencies</h2>
      <p className="text-slate-300 text-sm mb-6">
        What you send to the grid by day, buy back by night, and what the grid actually pays you for the difference.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: energy quantities */}
        <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-amber-300/90 text-sm font-semibold uppercase tracking-wider">Your Energy Flows</h3>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={manual}
                onChange={(e) => setManual(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
              Manual Input
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Exported to grid (daytime surplus)</div>
              {manual ? (
                <input
                  type="number"
                  value={manualExport}
                  onChange={(e) => setExportKwh(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-400/40 rounded-lg bg-slate-900/70 text-amber-200 text-xl font-bold"
                />
              ) : (
                <div className="text-3xl font-bold text-amber-300">{exportKwh.toLocaleString()} <span className="text-base font-normal text-slate-400">kWh/yr</span></div>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Imported from grid (nighttime)</div>
              {manual ? (
                <input
                  type="number"
                  value={manualImport}
                  onChange={(e) => setImportKwh(e.target.value)}
                  className="w-full px-3 py-2 border border-orange-400/40 rounded-lg bg-slate-900/70 text-orange-300 text-xl font-bold"
                />
              ) : (
                <div className="text-3xl font-bold text-orange-400">{importKwh.toLocaleString()} <span className="text-base font-normal text-slate-400">kWh/yr</span></div>
              )}
            </div>

            <p className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
              {manual
                ? 'Using your manual values.'
                : 'Estimated from your system production and the selected consumption profile.'}
            </p>
          </div>
        </div>

        {/* RIGHT: dollar values */}
        <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
          <h3 className="text-amber-300/90 text-sm font-semibold uppercase tracking-wider mb-4">What It's Worth</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
              <div>
                <div className="text-slate-200 text-sm">Energy sold to grid</div>
                <div className="text-xs text-slate-500">at off-peak rate {rate(econ.daytimeSellRate)}</div>
              </div>
              <div className="text-xl font-bold text-green-400">{money(econ.valueSold)}</div>
            </div>

            <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
              <div>
                <div className="text-slate-200 text-sm">Energy bought at night</div>
                <div className="text-xs text-slate-500">at peak rate {rate(econ.nightBuyRate)}</div>
              </div>
              <div className="text-xl font-bold text-red-400">{money(econ.valueBought)}</div>
            </div>

            <div className="flex justify-between items-center pt-1">
              {!owesUtility ? (
                <>
                  <div>
                    <div className="text-slate-200 text-sm font-semibold">{utilName} pays you</div>
                    <div className="text-xs text-slate-500">annual check for your net surplus</div>
                  </div>
                  <div className="text-2xl font-bold text-amber-300">
                    {money(annualCheck)}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-slate-200 text-sm font-semibold">You pay {utilName} — annual true-up</div>
                    <div className="text-xs text-slate-500">from your full usage vs production at real rates</div>
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    {money(annualTrueUp)}
                  </div>
                </>
              )}
            </div>
          </div>

          {extraUsage && extraUsage.cost > 0 && (
            <div className="mt-4 bg-red-500/10 border-2 border-red-400/40 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-red-300 mb-1">
                    ⚡ Extra Usage True-Up (from Load Simulator)
                  </div>
                  <div className="text-sm text-slate-300">
                    {extraUsage.addedKwh.toLocaleString()} kWh added · {extraUsage.billableKwh.toLocaleString()} kWh over production, billed at time-of-use
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    A battery shifts this load off peak — recovering most of this added cost.
                  </div>
                </div>
                <div className="text-2xl font-bold text-red-400 whitespace-nowrap">
                  −{money(extraUsage.cost)}<span className="text-xs font-normal text-slate-400">/yr</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 bg-amber-400/10 border border-amber-400/30 rounded-lg p-3 text-sm text-amber-100">
            You sell at the <strong>day rate to your neighbors</strong>, then import back at <strong>peak rates</strong>. The spread is the grid's profit — not yours.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatteryExportInefficiencies;
