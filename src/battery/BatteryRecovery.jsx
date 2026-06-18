import React from 'react';
import { BatteryCharging, ShieldCheck, TrendingUp, Sun, Moon } from 'lucide-react';
import { TOU_RATES } from '../utils/rateData';
import { calculateBatteryRecovery } from './BatteryModel';

/**
 * Section 4 — Battery Recovery.
 * Shows the value recovered by storing daytime surplus on-site and using it
 * at peak instead of dumping it midday. Plus backup value framing.
 */
const BatteryRecovery = ({ inputs, overlay }) => {
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;

  const recovery = calculateBatteryRecovery(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport,
    inputs.batteryCapacity,
    inputs.batteryEfficiency
  );

  const money = (v) => `$${Math.round(v).toLocaleString()}`;
  const rate = (v) => `$${v.toFixed(3)}/kWh`;

  return (
    <div className="bg-gradient-to-br from-[#102a1a] to-[#0a1628] border border-green-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <h2 className="text-2xl font-bold text-green-300 flex items-center gap-2 mb-1">
        <BatteryCharging size={24} className="text-green-400" />
        What a Battery Recovers
      </h2>
      <p className="text-slate-300 text-sm mb-6">
        Store your daytime surplus on-site instead of selling it cheap — then use it at peak rates after sunset.
      </p>

      {/* Before / after comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900/50 rounded-lg p-5 border border-red-400/30">
          <div className="flex items-center gap-2 text-red-300 text-sm font-semibold mb-3">
            <Sun size={15} /> Today — without a battery
          </div>
          <div className="text-xs text-slate-400">Surplus dumped to grid at midday rate</div>
          <div className="text-3xl font-bold text-red-400 mt-1">{money(recovery.withoutBatteryValue)}</div>
          <div className="text-xs text-slate-500 mt-2">
            {recovery.shiftedKwh.toLocaleString()} kWh × {rate(recovery.middayRate)}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-5 border border-green-400/40">
          <div className="flex items-center gap-2 text-green-300 text-sm font-semibold mb-3">
            <Moon size={15} /> With a battery — used at peak
          </div>
          <div className="text-xs text-slate-400">Same energy offsets peak-rate imports</div>
          <div className="text-3xl font-bold text-green-400 mt-1">{money(recovery.withBatteryValue)}</div>
          <div className="text-xs text-slate-500 mt-2">
            {recovery.shiftedKwh.toLocaleString()} kWh × {rate(recovery.peakRate)}
          </div>
        </div>
      </div>

      {/* Headline recovered value */}
      <div className="bg-green-400/10 border border-green-400/40 rounded-lg p-6 text-center mb-6">
        <div className="text-sm text-green-200 uppercase tracking-wider flex items-center justify-center gap-2">
          <TrendingUp size={16} /> Value Recovered Each Year
        </div>
        <div className="text-5xl font-extrabold text-green-300 mt-2">{money(recovery.annualRecovered)}</div>
        <div className="text-xs text-slate-400 mt-2">
          By shifting {recovery.shiftedKwh.toLocaleString()} kWh from midday export to peak-rate use
        </div>
      </div>

      {/* Backup value */}
      <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 flex items-start gap-3">
        <ShieldCheck size={22} className="text-green-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-slate-100 font-semibold text-sm">Plus: backup power when the grid goes down</div>
          <p className="text-slate-300 text-sm mt-1">
            Beyond the dollars, stored energy keeps your lights, fridge, and essentials running through outages —
            value that doesn't show up on a utility bill but matters most exactly when the grid fails.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Estimate based on a {inputs.batteryCapacity || 13.5} kWh battery at {inputs.batteryEfficiency || 90}% efficiency,
        {' '}{inputs.utility} time-of-use rates, and one cycle per day. Actual results vary with usage and weather.
      </p>
    </div>
  );
};

export default BatteryRecovery;
