import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  BatteryCharging, ShieldCheck, TrendingUp, AlertTriangle, DollarSign, CreditCard,
  Server, Cpu, Car, Zap, TrendingDown
} from 'lucide-react';
import { TOU_RATES, UTILITY_OPTIONS } from '../utils/rateData';
import {
  calculateCreditsRecovered,
  calculateEnergyCredits,
  projectCreditLoss,
  NET_COMPENSATION_RATE
} from './BatteryModel';

/**
 * Section 4 — Grid pressure, the cost of doing nothing, and what a battery
 * recovers (Energy Credits framing).
 *
 * Order (per latest design):
 *   1. Energy-credit reality + true-up (real for over-consumers; potential as NEM ends)
 *   2. "The Grid Is Getting Worse" — large, with a graphic
 *   3. "The Cost of Doing Nothing" — 10-yr escalating-loss chart
 *   4. "Energy Credits Recovered" — what a battery wins back
 */
const BatteryRecovery = ({ inputs, overlay }) => {
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  const u = inputs.utility;

  const credits = calculateEnergyCredits(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport,
    u
  );

  const recovery = calculateCreditsRecovered(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport,
    inputs.batteryCapacity,
    inputs.batteryEfficiency,
    u
  );

  const loss = projectCreditLoss(
    touRates,
    overlay.annualDaytimeOverproduction,
    overlay.annualNighttimeImport,
    8, // 8%/yr peak escalation
    10,
    u
  );

  const money = (v) => `$${Math.round(v).toLocaleString()}`;
  const rate = (v) => `$${v.toFixed(3)}/kWh`;

  // Short utility name for emotional copy: prefer the parenthetical short form
  // in the label (e.g. "San Diego Gas & Electric (SDG&E)" -> "SDG&E"),
  // else the full label, else the raw key.
  const utilOpt = UTILITY_OPTIONS.find((o) => o.value === inputs.utility);
  const utilName = (() => {
    if (!utilOpt) return inputs.utility || 'your utility';
    const m = /\(([^)]+)\)/.exec(utilOpt.label);
    return m ? m[1] : utilOpt.label;
  })();

  return (
    <div className="bg-gradient-to-br from-[#102a1a] to-[#0a1628] border border-green-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <h2 className="text-2xl font-bold text-green-300 flex items-center gap-2 mb-1">
        <BatteryCharging size={24} className="text-green-400" />
        Your Energy, Your Credits
      </h2>
      <p className="text-slate-300 text-sm mb-6">
        Selling to the grid doesn't pay you cash — it banks <strong className="text-green-300">energy credits</strong> at
        the low export rate. The real money is only ${NET_COMPENSATION_RATE.toFixed(2)}/kWh on your net export at year end.
      </p>

      {/* 1. Credits vs. real money + true-up reality */}
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
            <div className="text-xs text-slate-500">{overlay.annualDaytimeOverproduction.toLocaleString()} kWh × {rate(credits.exportRate)} (export rate)</div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-300">Cost of importing at night</span>
              <span className="text-red-400 font-semibold">{money(credits.importCost)}</span>
            </div>
            <div className="text-xs text-slate-500">{overlay.annualNighttimeImport.toLocaleString()} kWh × {rate(credits.importRate)} (peak)</div>
          </div>
        </div>

        {/* True-up: emotional framing — owe vs paid, plus post-NEM risk */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg p-4 border ${credits.isNetOverProducer ? 'bg-green-900/20 border-green-400/40' : 'bg-red-900/30 border-red-400/50'}`}>
            {credits.isNetOverProducer ? (
              <>
                <div className="text-xs text-green-200 mb-1 font-semibold uppercase tracking-wide">{utilName} Pays You</div>
                <div className="text-3xl font-extrabold text-green-400">{money(credits.realMoney)}<span className="text-base font-normal text-slate-400">/yr</span></div>
                <p className="text-[11px] text-green-200/80 mt-2">
                  {utilName} pays you for that surplus energy every year. Real money in your pocket.
                </p>
              </>
            ) : (
              <>
                <div className="text-xs text-red-200 mb-1 font-semibold uppercase tracking-wide">You Owe {utilName}</div>
                <div className="text-3xl font-extrabold text-red-400">{money(credits.trueUpOwed)}<span className="text-base font-normal text-slate-400">/yr</span></div>
                <p className="text-[11px] text-red-200/80 mt-2">
                  You burn more than you bank — so {utilName} sends you a true-up bill for the {Math.round(credits.shortfallKwh).toLocaleString()} kWh shortfall, at peak rates.
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg p-4 border bg-orange-900/20 border-orange-400/40">
            <div className="text-xs text-orange-200 mb-1 flex items-center gap-1 font-semibold uppercase tracking-wide">
              <AlertTriangle size={12} /> When NEM Ends
            </div>
            <div className="text-3xl font-extrabold text-orange-400">{money(credits.potentialTrueUp)}<span className="text-base font-normal text-slate-400">/yr</span></div>
            <p className="text-[11px] text-orange-200/70 mt-2">
              {credits.isNetOverProducer
                ? `When net metering ends, even over-producing won't save you — this is what you'd owe ${utilName}.`
                : `As net metering shrinks, your bill to ${utilName} climbs to this.`}
            </p>
          </div>
        </div>
      </div>

      {/* Emotional summary line */}
      <div className={`rounded-lg p-4 border mb-8 flex items-center justify-between ${credits.isNetOverProducer ? 'bg-slate-900/50 border-slate-700/50' : 'bg-red-900/20 border-red-400/40'}`}>
        <div className="flex items-center gap-2">
          <DollarSign size={16} className={credits.isNetOverProducer ? 'text-green-400' : 'text-red-400'} />
          <span className="text-sm text-slate-200">
            {credits.isNetOverProducer
              ? `What ${utilName} actually pays you for your energy each year`
              : `What you hand ${utilName} every year at true-up`}
          </span>
        </div>
        <span className={`text-xl font-bold ${credits.isNetOverProducer ? 'text-green-400' : 'text-red-400'}`}>
          {credits.isNetOverProducer ? `${money(credits.realMoney)}/yr` : `${money(credits.trueUpOwed)}/yr`}
        </span>
      </div>

      {/* 2. THE GRID IS GETTING WORSE — large feature block with graphic */}
      <div className="bg-gradient-to-br from-[#2a1410] to-[#0a1628] border-2 border-red-500/40 rounded-2xl p-6 md:p-8 mb-6">
        <h3 className="text-2xl md:text-3xl font-extrabold text-red-300 flex items-center gap-2 mb-2">
          <TrendingDown size={28} className="text-red-400" /> The Grid Is Getting Worse
        </h3>
        <p className="text-slate-300 text-sm md:text-base mb-6 max-w-3xl">
          California's grid is under unprecedented strain. Soaring demand and an aging system mean
          nighttime rates — the rates you pay most — climb relentlessly. The pressure is structural, and it's accelerating.
        </p>

        {/* Graphic: demand drivers feeding a rising-load grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center mb-6">
          <div className="lg:col-span-3 grid grid-cols-3 gap-3">
            <DemandDriver icon={Server} label="Data Centers" stat="+160%" sub="load by 2030" />
            <DemandDriver icon={Cpu} label="AI Compute" stat="3–4×" sub="power per query" />
            <DemandDriver icon={Car} label="EV Charging" stat="+300%" sub="evening demand" />
          </div>
          <div className="lg:col-span-2">
            <svg viewBox="0 0 240 140" className="w-full">
              <defs>
                <linearGradient id="gridRise" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              {/* axes */}
              <line x1="30" y1="115" x2="225" y2="115" stroke="#475569" strokeWidth="1.5" />
              <line x1="30" y1="15" x2="30" y2="115" stroke="#475569" strokeWidth="1.5" />
              {/* rising demand curve */}
              <path d="M30 105 Q90 100 130 75 T225 20" fill="none" stroke="url(#gridRise)" strokeWidth="3.5" />
              {/* pylons */}
              {[70, 120, 170].map((x, i) => (
                <g key={i} stroke="#64748b" strokeWidth="1.4" fill="none">
                  <line x1={x} y1="115" x2={x} y2="92" />
                  <line x1={x - 9} y1="98" x2={x + 9} y2="98" />
                  <line x1={x - 7} y1="103" x2={x + 7} y2="103" />
                </g>
              ))}
              <circle cx="225" cy="20" r="5" fill="#ef4444">
                <animate attributeName="r" values="4;7;4" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <text x="34" y="28" fill="#94a3b8" fontSize="9">Rate $</text>
              <text x="150" y="135" fill="#94a3b8" fontSize="9">Time →</text>
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GridPoint icon={Zap} title="Aging Infrastructure" body="Decades-old transmission strains under load it was never built for, driving costly upgrades onto your bill." />
          <GridPoint icon={TrendingUp} title="TOU Rates Climbing" body="Evening peak windows get pricier as utilities push you to pay the most exactly when solar can't help." />
          <GridPoint icon={TrendingDown} title="Net Metering Shrinking" body="Each NEM revision pays you less for export — your banked credits are worth less every year." />
        </div>
      </div>

      {/* 3. THE COST OF DOING NOTHING — 10-yr escalating loss (now under grid) */}
      <div className="bg-slate-900/60 rounded-lg p-5 border border-red-400/30 mb-8">
        <h3 className="text-red-300 font-bold flex items-center gap-2 mb-1">
          <AlertTriangle size={18} /> The Cost of Doing Nothing
        </h3>
        <p className="text-slate-300 text-sm mb-4">
          Hold today's setup steady while peak rates escalate {loss.peakEscalationPct}%/yr, and here's the credit
          value you stand to lose over the next 10 years.
        </p>
        <ResponsiveContainer width="100%" height={220}>
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
          <span className="text-sm text-slate-300">Projected 10-year value lost: </span>
          <span className="text-2xl font-bold text-red-400">{money(loss.totalLost)}</span>
          <div className="text-xs text-slate-500 mt-1">
            Nighttime rate rising from {rate(touRates.peak)} to ~{rate(loss.finalYearRate)} by {loss.rows[loss.rows.length-1].year}
          </div>
        </div>
      </div>

      {/* 4. ENERGY CREDITS RECOVERED — what a battery wins back */}
      <div className="bg-green-400/10 border border-green-400/40 rounded-lg p-6 text-center mb-3">
        <div className="text-sm text-green-200 uppercase tracking-wider flex items-center justify-center gap-2">
          <TrendingUp size={16} /> Energy Credits Recovered Each Year
        </div>
        <div className="text-5xl font-extrabold text-green-300 mt-2">{money(recovery.creditsRecovered)}</div>
        <div className="text-xs text-slate-400 mt-2">
          By shifting {recovery.shiftedKwh.toLocaleString()} kWh from low-rate export ({rate(recovery.middayRate)}) to peak-rate use ({rate(recovery.peakRate)})
        </div>
      </div>
      <p className="text-xs text-slate-500 text-center mb-6">
        A battery lets you "sell to yourself" — recovering energy at the peak rate you'd otherwise pay. Raw storage
        figures shown; actual delivery is ~90% of capacity after round-trip efficiency and your set reserve.
      </p>

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

const DemandDriver = ({ icon: Icon, label, stat, sub }) => (
  <div className="bg-slate-900/50 rounded-xl p-4 border border-red-400/20 text-center">
    <Icon size={22} className="text-red-400 mx-auto mb-2" />
    <div className="text-2xl font-extrabold text-red-300">{stat}</div>
    <div className="text-xs text-slate-200 font-semibold mt-1">{label}</div>
    <div className="text-[10px] text-slate-500">{sub}</div>
  </div>
);

const GridPoint = ({ icon: Icon, title, body }) => (
  <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/50">
    <div className="flex items-center gap-2 text-red-200 font-semibold text-sm mb-1">
      <Icon size={15} className="text-red-400" /> {title}
    </div>
    <p className="text-xs text-slate-400">{body}</p>
  </div>
);

export default BatteryRecovery;
