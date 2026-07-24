import React, { useMemo, useState } from 'react';
import { Battery, TrendingUp, AlertTriangle, Check, SlidersHorizontal, RotateCcw, Gift, ExternalLink, Zap } from 'lucide-react';
import { compareBatteryScenarios, compareHardwareOptions, BATTERY_CATALOG, RATE_PLANS, EXPORT_REBATE_PROGRAMS } from './BatteryDispatch';

const money = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
const signed = (v) => (v >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(v)).toLocaleString();
const kwh = (v) => Math.round(v).toLocaleString();

/**
 * Hour-by-hour battery economics: what storage is actually worth for THIS
 * client, and — just as important — what it cannot do.
 */
const EMPTY_OV = () => ({
  current: { summer: {}, winter: {}, sellSummer: {}, sellWinter: {} },
  battery: { summer: {}, winter: {}, sellSummer: {}, sellWinter: {} }
});

const BatteryDispatchPanel = ({ inputs, calculations, extraUsage = null, rateOverride = null, onRateOverrideChange = null }) => {
  const [batteryId, setBatteryId] = useState('pw3');
  const [units, setUnits] = useState(1);
  const [showCompare, setShowCompare] = useState(false);
  const [overrideOn, setOverrideOn] = useState(!!(rateOverride && rateOverride.enabled));
  const [ov, setOv] = useState(() => (rateOverride && rateOverride.rates) || EMPTY_OV());

  const pushOverride = (nextOn, nextRates) => {
    if (onRateOverrideChange) onRateOverrideChange({ enabled: nextOn, rates: nextRates });
  };
  const setRate = (planKey, group, period, value) => {
    const next = {
      ...ov,
      [planKey]: { ...ov[planKey], [group]: { ...ov[planKey][group], [period]: value } }
    };
    setOv(next);
    pushOverride(overrideOn, next);
  };
  const hw = BATTERY_CATALOG[batteryId] || BATTERY_CATALOG.pw3;
  const [rebateId, setRebateId] = useState('none');
  const [customBonus, setCustomBonus] = useState('');
  const rebate = EXPORT_REBATE_PROGRAMS[rebateId] || EXPORT_REBATE_PROGRAMS.none;
  const exportBonus = rebateId === 'custom' ? (parseFloat(customBonus) || 0) : rebate.bonusPerKwh;

  const production = Number(calculations?.currentDegradedProduction) || Number(inputs.annualProduction) || 0;
  // Fold in anything modeled in the Load Simulator (planned EV, hot tub, etc.)
  // so the battery is sized against the home's FUTURE load, not just today's.
  const addedKwh = Number(extraUsage?.addedKwh) || 0;
  const baseUsage = Number(inputs.currentAnnualUsage) || 0;
  const usage = baseUsage + addedKwh;
  const totalCapacity = hw.usableKwh * units;

  const result = useMemo(() => {
    if (!production || !usage) return null;
    return compareBatteryScenarios({
      annualProductionKwh: production,
      annualUsageKwh: usage,
      consumptionProfile: inputs.consumptionProfile || 'evening_heavy',
      nemVersion: inputs.nemVersion || 'NEM2',
      batteryCapacityKwh: totalCapacity,
      roundTripEfficiency: hw.rte,
      maxPowerKw: hw.continuousKw * units,
      onCareProgram: !!inputs.onCareProgram,
      currentPlanId: 'SDGE_TOU_DR1',
      rateOverride: overrideOn ? ov : null,
      exportBonus
    });
  }, [production, usage, inputs.consumptionProfile, inputs.nemVersion, inputs.onCareProgram, totalCapacity, hw, units, overrideOn, ov, exportBonus]);

  // Hardware ladder — only computed when the comparison is open.
  const hardware = useMemo(() => {
    if (!showCompare || !production || !usage) return null;
    return compareHardwareOptions({
      annualProductionKwh: production,
      annualUsageKwh: usage,
      consumptionProfile: inputs.consumptionProfile || 'evening_heavy',
      nemVersion: inputs.nemVersion || 'NEM2',
      onCareProgram: !!inputs.onCareProgram,
      currentPlanId: 'SDGE_TOU_DR1',
      rateOverride: overrideOn ? ov : null,
      exportBonus,
      maxUnits: 3
    });
  }, [showCompare, production, usage, inputs.consumptionProfile, inputs.nemVersion, inputs.onCareProgram, overrideOn, ov, exportBonus]);

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
        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          <select
            value={batteryId}
            onChange={(e) => setBatteryId(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-200"
          >
            {Object.values(BATTERY_CATALOG).map((b) => (
              <option key={b.id} value={b.id}>{b.brand} {b.model} · {b.usableKwh} kWh</option>
            ))}
          </select>
          <select
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-200"
          >
            {Array.from({ length: hw.maxUnits }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>×{n}</option>
            ))}
          </select>
          <span className="text-purple-300 font-semibold">= {totalCapacity.toFixed(1)} kWh</span>
          <span className="text-slate-500">· {(hw.continuousKw * units).toFixed(1)} kW · {(hw.rte * 100).toFixed(0)}% RTE · {hw.coupling}</span>
          <button
            type="button"
            onClick={() => setShowCompare((v) => !v)}
            className="px-2.5 py-1 rounded-lg border border-purple-400/50 text-purple-300 hover:bg-purple-900/30"
          >
            {showCompare ? 'Hide comparison' : 'Compare batteries'}
          </button>
          <button
            type="button"
            onClick={() => { const n = !overrideOn; setOverrideOn(n); pushOverride(n, ov); }}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${overrideOn
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-slate-600 text-slate-400 hover:text-amber-300'}`}
            title="Enter the client's exact buy and sell rates from their bill"
          >
            <SlidersHorizontal size={12} /> {overrideOn ? 'Using your rates' : 'Override rates'}
          </button>
          <span className="flex items-center gap-1 text-slate-500"><Gift size={12} className="text-emerald-400" />
            <select
              value={rebateId}
              onChange={(e) => setRebateId(e.target.value)}
              className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-200"
              title="Community-program export adder (SDCP, SMUD)"
            >
              {Object.values(EXPORT_REBATE_PROGRAMS).map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {rebateId === 'custom' && (
              <input type="number" step="0.01" value={customBonus} onChange={(e) => setCustomBonus(e.target.value)}
                placeholder="$/kWh" className="w-16 px-1.5 py-1 rounded border border-slate-600 bg-slate-900/70 text-emerald-300" />
            )}
          </span>
        </div>
      </div>

      {addedKwh > 0 && (
        <div className="rounded-lg px-3 py-2 border border-cyan-500/30 bg-cyan-900/15 text-[11px] text-cyan-200 flex items-center gap-2">
          <Zap size={13} className="text-cyan-400" />
          Modeling {Math.round(baseUsage).toLocaleString()} + <span className="font-semibold">{Math.round(addedKwh).toLocaleString()} kWh</span> of planned new load from the Load Simulator = {Math.round(usage).toLocaleString()} kWh/yr. The battery is sized against this future usage.
        </div>
      )}
      {exportBonus > 0 && (
        <div className="rounded-lg px-3 py-2 border border-emerald-500/30 bg-emerald-900/15 text-[11px] text-emerald-200 flex items-center gap-2">
          <Gift size={13} className="text-emerald-400" />
          {rebate.id === 'custom' ? 'Custom' : rebate.label.split(' —')[0]} export adder of <span className="font-semibold">+${exportBonus.toFixed(2)}/kWh</span> applied to every exported kWh — this stacks on top of their NEM credits.
        </div>
      )}

      {/* ---- manual rate override ---- */}
      {overrideOn && (() => {
        const PERIODS = [['peak', 'On-peak 4–9pm'], ['offPeak', 'Off-peak'], ['superOffPeak', 'Super off-peak']];
        const planCols = [
          { key: 'current', label: `Current plan — ${RATE_PLANS.SDGE_TOU_DR1.label}`, base: RATE_PLANS.SDGE_TOU_DR1 },
          { key: 'battery', label: 'Battery plan — EV-TOU-5', base: RATE_PLANS.SDGE_EVTOU5 }
        ];
        const cell = (planKey, group, period, base) => (
          <input
            type="number"
            step="0.001"
            value={ov[planKey][group][period] ?? ''}
            onChange={(e) => setRate(planKey, group, period, e.target.value)}
            placeholder={base.toFixed(3)}
            className="w-16 px-1.5 py-1 text-[11px] rounded border border-slate-600 bg-slate-900/70 text-amber-200 text-right"
          />
        );
        return (
          <div className="rounded-xl p-4 border border-amber-400/40 bg-amber-900/10">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-amber-300">Your rates ($/kWh)</h4>
              <button
                type="button"
                onClick={() => { const e = EMPTY_OV(); setOv(e); pushOverride(overrideOn, e); }}
                className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1"
              >
                <RotateCcw size={11} /> Clear all
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Blank fields use the published schedule (shown greyed as the placeholder). Fill in only what
              you know from the client’s bill. <span className="text-amber-200">Sell</span> is the export
              credit they actually receive — for NEM 1.0 that’s usually the same as buy; for NEM 2.0 it’s
              a few cents lower.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {planCols.map((col) => (
                <div key={col.key} className="rounded-lg border border-slate-700 p-3">
                  <div className="text-[11px] font-semibold text-slate-200 mb-2">{col.label}</div>
                  <table className="w-full text-[10.5px]">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="text-left font-medium" />
                        <th className="font-medium">Buy S</th>
                        <th className="font-medium">Buy W</th>
                        <th className="font-medium text-amber-300/80">Sell S</th>
                        <th className="font-medium text-amber-300/80">Sell W</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(([pk, plabel]) => (
                        <tr key={pk}>
                          <td className="text-slate-400 py-1 pr-2 whitespace-nowrap">{plabel}</td>
                          <td className="py-1 text-center">{cell(col.key, 'summer', pk, col.base.summer[pk])}</td>
                          <td className="py-1 text-center">{cell(col.key, 'winter', pk, col.base.winter[pk])}</td>
                          <td className="py-1 text-center">{cell(col.key, 'sellSummer', pk, col.base.summer[pk])}</td>
                          <td className="py-1 text-center">{cell(col.key, 'sellWinter', pk, col.base.winter[pk])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              S = summer (Jun–Oct) · W = winter (Nov–May). Every figure below recalculates as you type.
            </p>
          </div>
        );
      })()}

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

      {/* ---- hardware comparison ladder ---- */}
      {hardware && (
        <div className="rounded-xl p-4 border border-slate-700 bg-slate-900/40 overflow-x-auto">
          <h4 className="text-sm font-bold text-purple-300 mb-1">Hardware comparison</h4>
          <p className="text-[11px] text-slate-500 mb-3">
            Same client, same rates — only the battery changes. <span className="text-amber-300">Marginal</span> is
            what each <em>additional</em> unit adds; when it collapses toward zero the system has run out of
            surplus solar and evening load to work with, and more storage stops paying.
          </p>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-1.5 pr-2 font-semibold">Battery</th>
                <th className="text-right px-2 font-semibold">Units</th>
                <th className="text-right px-2 font-semibold">kWh</th>
                <th className="text-right px-2 font-semibold">Gain/yr</th>
                <th className="text-right px-2 font-semibold">Marginal</th>
                <th className="text-right px-2 font-semibold">Solar fill</th>
                <th className="text-left pl-2 font-semibold">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {hardware.options.map((o) =>
                o.ladder.map((l, i) => {
                  const saturated = l.units > 1 && l.marginalGain < 75;
                  return (
                    <tr key={o.battery.id + l.units} className={`border-b border-slate-800/70 ${i === 0 ? 'bg-slate-800/20' : ''}`}>
                      <td className="py-1.5 pr-2 text-slate-200">
                        {i === 0 ? <span className="font-semibold">{o.battery.brand} {o.battery.model}</span> : <span className="text-slate-600">↳</span>}
                      </td>
                      <td className="text-right px-2 text-slate-300">×{l.units}</td>
                      <td className="text-right px-2 text-slate-400">{l.capacityKwh.toFixed(1)}</td>
                      <td className="text-right px-2 font-semibold text-emerald-300">{signed(l.gain)}</td>
                      <td className={`text-right px-2 font-semibold ${l.units === 1 ? 'text-slate-600' : saturated ? 'text-red-400' : 'text-amber-300'}`}>
                        {l.units === 1 ? '—' : signed(l.marginalGain)}
                      </td>
                      <td className="text-right px-2 text-cyan-300/80">{l.solarFillPct.toFixed(0)}%</td>
                      <td className="pl-2 text-slate-500">
                        {saturated ? 'saturated — adds nothing' : l.units === 1 ? (l.bindingConstraint === 'solar' ? 'solar-limited' : 'capacity-limited') : 'still earning'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <p className="text-[10.5px] text-amber-300/80 mt-2 leading-relaxed">
            ⚠ Every option above plateaus at roughly the same annual figure. That plateau is set by this
            home’s surplus solar and evening load — not by the badge on the battery. Once you hit it,
            the next unit buys backup runtime, not savings.
          </p>
        </div>
      )}

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
        {overrideOn ? 'Running on the rates you entered above.' : 'Rates are current SDG&E schedules and move often — use Override rates to enter the client\u2019s actual figures.'}
      </p>
      <a href="https://battery.gokinobi.com/" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-purple-300 hover:text-purple-200 underline underline-offset-2">
        Explore battery options & financing at Kinobi <ExternalLink size={12} />
      </a>
    </div>
  );
};

export default BatteryDispatchPanel;
