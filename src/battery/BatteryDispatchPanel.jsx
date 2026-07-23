import React, { useMemo, useState } from 'react';
import { Battery, TrendingUp, AlertTriangle, Check } from 'lucide-react';
import { compareBatteryScenarios, RATE_PLANS } from './BatteryDispatch';

const money = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
const signed = (v) => (v >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(v)).toLocaleString();
const kwh = (v) => Math.round(v).toLocaleString();

/**
 * Hour-by-hour battery economics: what storage is actually worth for THIS
 * client, and — just as important — what it cannot do.
 */
const BatteryDispatchPanel = ({ inputs, calculations }) => {
  const [capacity, setCapacity] = useState(inputs.batteryCapacity || 13.5);
  const [units, setUnits] = useState(1);

  const production = Number(calculations?.currentDegradedProduction) || Number(inputs.annualProduction) || 0;
  const usage = Number(inputs.currentAnnualUsage) || 0;
  const totalCapacity = capacity * units;

  const result = useMemo(() => {
    if (!production || !usage) return null;
    return compareBatteryScenarios({
      annualProductionKwh: production,
      annualUsageKwh: usage,
      consumptionProfile: inputs.consumptionProfile || 'evening_heavy',
      nemVersion: inputs.nemVersion || 'NEM2',
      batteryCapacityKwh: totalCapacity,
      onCareProgram: !!inputs.onCareProgram,
      currentPlanId: 'SDGE_TOU_DR1'
    });
  }, [production, usage, inputs.consumptionProfile, inputs.nemVersion, inputs.onCareProgram, totalCapacity]);

  if (!result) {
    return (
      <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-5 text-sm text-slate-400">
        Enter annual production and current usage to model battery economics.
      </div>
    );
  }

  const { today, withBattery, withBatteryEvTou, gains, ceiling, recommendation } = result;
  const maxFill = Math.max(...withBatteryEvTou.months.map((m) => m.solarFill), 0.01);

  const scenarios = [
    { key: 'a', label: 'Today', sub: RATE_PLANS.SDGE_TOU_DR1.label + ' · no battery', pos: today.netPosition, gain: null },
    { key: 'b', label: 'Add battery', sub: 'keep current rate plan', pos: withBattery.netPosition, gain: gains.battery },
    { key: 'c', label: 'Battery + EV-TOU-5', sub: 'cheap midday · sell into 4–9pm', pos: withBatteryEvTou.netPosition, gain: gains.batteryEvTou }
  ];
  const winnerKey = gains.batteryEvTou >= gains.battery ? 'c' : 'b';

  return (
    <div className="space-y-4">
      {/* ---- header + sizing ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2">
          <Battery size={20} className="text-purple-400" /> Battery Economics — hour by hour
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Battery</span>
          <select
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-200"
          >
            <option value={13.5}>Powerwall 3 · 13.5 kWh</option>
            <option value={16}>Franklin aPower · 15 kWh</option>
            <option value={10}>Enphase 10C · 10 kWh</option>
            <option value={5}>Enphase 5P · 5 kWh</option>
          </select>
          <select
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-200"
          >
            {[1, 2, 3].map((n) => <option key={n} value={n}>×{n}</option>)}
          </select>
          <span className="text-purple-300 font-semibold">= {totalCapacity} kWh</span>
        </div>
      </div>

      {/* ---- three scenarios ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s) => {
          const isWinner = s.key === winnerKey && s.gain > 0;
          return (
            <div
              key={s.key}
              className={`rounded-xl p-4 border ${isWinner
                ? 'border-emerald-400/60 bg-emerald-900/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : 'border-slate-700 bg-slate-900/40'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-100">{s.label}</div>
                  <div className="text-[11px] text-slate-400">{s.sub}</div>
                </div>
                {isWinner && <Check size={16} className="text-emerald-400 shrink-0" />}
              </div>
              <div className={`text-2xl font-black mt-2 ${s.pos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {s.pos >= 0 ? money(s.pos) : money(s.pos)}
                <span className="text-[11px] font-normal text-slate-500 ml-1">
                  {s.pos >= 0 ? 'credit/yr' : 'true-up/yr'}
                </span>
              </div>
              {s.gain !== null && (
                <div className={`text-sm font-semibold mt-1 ${s.gain > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {signed(s.gain)}/yr vs today
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- recommendation ---- */}
      <div className={`rounded-xl p-4 border ${recommendation.worthIt
        ? 'border-emerald-400/50 bg-emerald-900/15'
        : 'border-amber-400/50 bg-amber-900/15'}`}>
        <div className="flex items-start gap-2">
          <TrendingUp size={18} className={recommendation.worthIt ? 'text-emerald-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
          <div>
            <div className="text-sm font-bold text-slate-100">
              {recommendation.worthIt
                ? `Recommended: ${recommendation.label} — ${signed(recommendation.gain)}/yr`
                : 'A battery does not pay for itself on this system today'}
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{recommendation.reason}</p>
          </div>
        </div>
      </div>

      {/* ---- the honest ceiling ---- */}
      <div className="rounded-xl p-4 border border-slate-700 bg-slate-900/40">
        <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2 mb-3">
          <AlertTriangle size={16} /> What the battery can’t do
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Energy gap today</span>
              <span className="font-semibold">{kwh(ceiling.netPurchaseBeforeKwh)} kWh/yr</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Energy gap with battery</span>
              <span className="font-semibold text-amber-300">{kwh(ceiling.netPurchaseAfterKwh)} kWh/yr</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              Storage shifts energy in time — it doesn’t create it. The gap only closes with more panels.
              What changes is the <span className="text-slate-300">price</span> of those kWh.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Peak-priced kWh bought now</span>
              <span className="font-semibold">{kwh(ceiling.peakImportBeforeKwh)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>…after the battery</span>
              <span className="font-semibold text-emerald-300">{kwh(ceiling.peakImportAfterKwh)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Stored solar sold at 4–9pm</span>
              <span className="font-semibold text-cyan-300">{kwh(ceiling.peakExportKwh)} kWh</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {ceiling.bindingConstraint === 'solar'
                ? 'Surplus solar — not battery size — is the limit here. A second battery adds little; more panels would.'
                : ceiling.bindingConstraint === 'capacity'
                  ? 'The battery fills and still spills surplus. More storage would capture more.'
                  : 'Storage and solar are well matched on this system.'}
            </p>
          </div>
        </div>
      </div>

      {/* ---- seasonal fill: the winter ceiling ---- */}
      <div className="rounded-xl p-4 border border-slate-700 bg-slate-900/40">
        <h4 className="text-sm font-bold text-cyan-300 mb-1">How full solar alone fills the battery</h4>
        <p className="text-[11px] text-slate-500 mb-3">
          Summer avg {ceiling.summerSolarFillPct.toFixed(0)}% · winter avg {ceiling.winterSolarFillPct.toFixed(0)}% of {totalCapacity} kWh.
          Dark winter evenings are exactly when peak power costs the most — and exactly when there’s least stored solar to sell.
        </p>
        <div className="flex items-end gap-1 h-28">
          {withBatteryEvTou.months.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-[9px] text-slate-400 mb-0.5">{(m.solarFill * 100).toFixed(0)}%</div>
              <div
                className={`w-full rounded-t ${m.summer ? 'bg-amber-500/70' : 'bg-cyan-500/60'}`}
                style={{ height: `${Math.max(4, (m.solarFill / maxFill) * 100)}%` }}
                title={`${m.label}: ${(m.solarToBattery / m.days).toFixed(1)} kWh/day stored`}
              />
              <div className="text-[9px] text-slate-500 mt-1">{m.label[0]}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70 mr-1" />summer season</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-cyan-500/60 mr-1" />winter season</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        Modelled hour by hour across 12 months using this client’s production, usage, and consumption
        profile. Only solar-charged energy is credited as export (grid-charged kWh serve the home).
        Rates are current SDG&amp;E schedules and move often — verify against the client’s bill.
      </p>
    </div>
  );
};

export default BatteryDispatchPanel;
