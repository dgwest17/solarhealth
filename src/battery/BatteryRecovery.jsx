import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { BatteryCharging, ShieldCheck, TrendingUp, Sun, Moon, AlertTriangle, DollarSign, CreditCard } from 'lucide-react';
import { TOU_RATES } from '../utils/rateData';
import {
  calculateCreditsRecovered,
  calculateEnergyCredits,
  projectCreditLoss,
  NET_COMPENSATION_RATE
} from './BatteryModel';

/**
 * Section 4 — What a Battery Recovers (Energy Credits framing).
 *
 * Key reframe: exporting banks ENERGY CREDITS (valued at the midday/export
 * rate), not cash. The only real money is $0.06/kWh on NET exported kWh at
 * year-end true-up. A gross over-producer can still owe a true-up because
 * daytime credits don't cover nighttime peak imports. A battery lets them
 * "sell to themselves," recovering credits at the peak rate.
 */
const BatteryRecovery = ({ inputs, overlay }) => {
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;

  const credits = calculateEnergyCredits(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport
  );

  const recovery = calculateCreditsRecovered(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport,
    inputs.batteryCapacity,
    inputs.batteryEfficiency
  );

  const loss = projectCreditLoss(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport,
    8, // 8%/yr peak escalation
    10
  );

  const money = (v) => `$${Math.round(v).toLocaleString()}`;
  const rate = (v) => `$${v.toFixed(3)}/kWh`;

  return (
    <div className="bg-gradient-to-br from-[#102a1a] to-[#0a1628] border border-green-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <h2 className="text-2xl font-bold text-green-300 flex items-center gap-2 mb-1">
        <BatteryCharging size={24} className="text-green-400" />
        Energy Credits Recovered
      </h2>
      <p className="text-slate-300 text-sm mb-6">
        Selling to the grid doesn't pay you cash — it banks <strong className="text-green-300">energy credits</strong> at
        the low midday rate. A battery lets you "sell to yourself," recovering that energy at the high peak rate instead.
      </p>

      {/* Credits vs. real money explainer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900/50 rounded-lg p-5 border border-amber-400/30">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold mb-3">
            <CreditCard size={15} /> Energy Credits (bill credits — not cash)
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">Credits earned exporting</span>
              <span className="text-amber-300 font-semibold">{money(credits.creditsEarned)}</span>
            </div>
            <div className="text-xs text-slate-500">{overlay.annualDaytimeOverproduction.toLocaleString()} kWh × {rate(credits.exportRate)} (midday)</div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-300">Credits burned importing at night</span>
              <span className="text-red-400 font-semibold">{money(credits.importCost)}</span>
            </div>
            <div className="text-xs text-slate-500">{overlay.annualNighttimeImport.toLocaleString()} kWh × {rate(credits.importRate)} (peak)</div>
          </div>
          {credits.trueUpOwed > 0 && (
            <div className="mt-3 bg-red-900/30 border border-red-400/40 rounded p-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-sm text-red-200">
                Even while over-producing, your credits don't cover your nighttime imports — leaving a
                <strong className="text-red-300"> {money(credits.trueUpOwed)} true-up</strong> at year end.
              </span>
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold mb-3">
            <DollarSign size={15} className="text-green-400" /> Real Money (year-end true-up)
          </div>
          {recovery.isNetOverProducer ? (
            <>
              <div className="text-3xl font-bold text-green-400">{money(recovery.realMoneyNetExport)}</div>
              <div className="text-xs text-slate-500 mt-2">
                {Math.round(recovery.netKwh).toLocaleString()} net kWh exported × ${NET_COMPENSATION_RATE.toFixed(2)}/kWh
              </div>
              <p className="text-xs text-slate-400 mt-3">
                This is the only actual cash the utility pays you — regardless of how much credit value you banked.
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-orange-400">Net importer</div>
              <p className="text-xs text-slate-400 mt-3">
                You consume more than you export, so there's no net cash — and a battery can balance that excess
                consumption even without adding solar.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Credits recovered headline */}
      <div className="bg-green-400/10 border border-green-400/40 rounded-lg p-6 text-center mb-3">
        <div className="text-sm text-green-200 uppercase tracking-wider flex items-center justify-center gap-2">
          <TrendingUp size={16} /> Energy Credits Recovered Each Year
        </div>
        <div className="text-5xl font-extrabold text-green-300 mt-2">{money(recovery.creditsRecovered)}</div>
        <div className="text-xs text-slate-400 mt-2">
          By shifting {recovery.shiftedKwh.toLocaleString()} kWh from midday export ({rate(recovery.middayRate)}) to peak-rate use ({rate(recovery.peakRate)})
        </div>
      </div>
      <p className="text-xs text-slate-500 text-center mb-6">
        Raw storage figures shown. Actual delivery is ~90% of capacity after round-trip efficiency and your set reserve.
      </p>

      {/* 10-year escalating loss projection */}
      <div className="bg-slate-900/60 rounded-lg p-5 border border-red-400/30 mb-6">
        <h3 className="text-red-300 font-bold flex items-center gap-2 mb-1">
          <AlertTriangle size={18} /> The Cost of Doing Nothing
        </h3>
        <p className="text-slate-300 text-sm mb-4">
          As data centers, AI, and EVs strain the grid, utilities keep raising nighttime rates. Here's the credit
          value you stand to lose over 10 years if you stay exposed — modeled at {loss.peakEscalationPct}%/yr peak escalation.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={loss.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
            <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} width={60} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#0f1e36', border: '1px solid #ef444455', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v, n) => [`$${Number(v).toLocaleString()}`, n === 'cumulative' ? 'Cumulative lost' : 'Annual gap']}
            />
            <Area type="monotone" dataKey="cumulative" stroke="#ef4444" strokeWidth={2} fill="url(#lossGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <span className="text-sm text-slate-300">Projected 10-year credit value lost: </span>
          <span className="text-2xl font-bold text-red-400">{money(loss.totalLost)}</span>
          <div className="text-xs text-slate-500 mt-1">
            Nighttime rate rising from {rate(touRates.peak)} to ~{rate(loss.finalYearRate)} by {loss.rows[loss.rows.length-1].year}
          </div>
        </div>
      </div>

      {/* Backup value */}
      <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 flex items-start gap-3">
        <ShieldCheck size={22} className="text-green-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-slate-100 font-semibold text-sm">Plus: backup power when the grid goes down</div>
          <p className="text-slate-300 text-sm mt-1">
            Beyond credits, stored energy keeps your essentials running through outages — value that doesn't show up
            on a utility bill but matters most exactly when the grid fails.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        All estimated savings are based on current values and not guaranteed.
      </p>
    </div>
  );
};

export default BatteryRecovery;
