import GridFutureGraphic from './GridFutureGraphic';
import Accordion from './Accordion';
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
const BatteryRecovery = ({
  inputs, overlay, effExport, effImport,
  annualTrueUp = 0, annualCheck = 0, owesUtility = false,
  avoidedTrueUp = 0, arbitrageRecovered = null, totalRecoveredPerYear = null
}) => {
  const expKwh = effExport != null ? effExport : overlay.annualDaytimeOverproduction;
  const impKwh = effImport != null ? effImport : overlay.annualNighttimeImport;
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  const u = inputs.utility;

  const credits = calculateEnergyCredits(
    touRates,
    expKwh,
    impKwh,
    u
  );

  const recovery = calculateCreditsRecovered(
    touRates,
    expKwh,
    impKwh,
    inputs.batteryCapacity,
    inputs.batteryEfficiency,
    u
  );

  const loss = projectCreditLoss(
    touRates,
    expKwh,
    impKwh,
    8, // 8%/yr peak escalation
    10,
    u
  );

  const money = (v) => `$${Math.round(v).toLocaleString()}`;
  const rate = (v) => `$${v.toFixed(3)}/kWh`;

  // Short utility name for emotional copy.
  const utilOpt = UTILITY_OPTIONS.find((o) => o.value === inputs.utility);
  const utilName = (() => {
    if (!utilOpt) return inputs.utility || 'your utility';
    const m = /\(([^)]+)\)/.exec(utilOpt.label);
    return m ? m[1] : utilOpt.label;
  })();

  // Total recovered per year = arbitrage spread + avoided true-up (capped upstream)
  const arbRecovered = arbitrageRecovered != null ? arbitrageRecovered : recovery.creditsRecovered;
  const totalRecovered = totalRecoveredPerYear != null ? totalRecoveredPerYear : arbRecovered;

  return (
    <div className="bg-gradient-to-br from-[#102a1a] to-[#0a1628] border border-green-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <p className="text-slate-300 text-sm mb-6">
        With the utility, your solar energy earns <strong className="text-amber-300">credits — monopoly money</strong> you
        can only spend in their system. You bank credits selling power by <strong className="text-amber-300">day</strong>, then
        spend them buying it back at <strong className="text-red-300">night</strong>. The gap is real cash out of your pocket.
      </p>

      {/* 1. The monopoly-money credit story — sold by day, bought by night */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900/50 rounded-lg p-5 border border-amber-400/30">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold mb-3">
            <CreditCard size={15} /> Energy Credits — "Monopoly Money"
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">☀️ Credits earned selling by day</span>
              <span className="text-amber-300 font-semibold">{money(credits.creditsEarned)}</span>
            </div>
            <div className="text-xs text-slate-500">{expKwh.toLocaleString()} kWh exported × {rate(credits.exportRate)}</div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-300">🌙 Credits spent buying at night</span>
              <span className="text-red-400 font-semibold">{money(credits.importCost)}</span>
            </div>
            <div className="text-xs text-slate-500">{impKwh.toLocaleString()} kWh imported × {rate(credits.importRate)}</div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-amber-200/80">
            You sell low and buy high — in their currency. That spread is the grid's profit, not yours.
          </div>
        </div>

        {/* True-up: authoritative (from full annual usage vs production at real rate) */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg p-4 border ${!owesUtility ? 'bg-green-900/20 border-green-400/40' : 'bg-red-900/30 border-red-400/50'}`}>
            {!owesUtility ? (
              <>
                <div className="text-xs text-green-200 mb-1 font-semibold uppercase tracking-wide">{utilName} Pays You</div>
                <div className="text-3xl font-extrabold text-green-400">{money(annualCheck)}<span className="text-base font-normal text-slate-400">/yr</span></div>
                <p className="text-[11px] text-green-200/80 mt-2">
                  You produce more than you use, so {utilName} cuts you a check each year for the surplus.
                </p>
              </>
            ) : (
              <>
                <div className="text-xs text-red-200 mb-1 font-semibold uppercase tracking-wide">You Pay {utilName}</div>
                <div className="text-3xl font-extrabold text-red-400">{money(annualTrueUp)}<span className="text-base font-normal text-slate-400">/yr</span></div>
                <p className="text-[11px] text-red-200/80 mt-2">
                  {utilName} does not pay you — you owe them this true-up every single year, and it only grows.
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg p-4 border bg-orange-900/20 border-orange-400/40">
            <div className="text-xs text-orange-200 mb-1 flex items-center gap-1 font-semibold uppercase tracking-wide">
              <AlertTriangle size={12} /> When NEM Ends
            </div>
            <div className="text-3xl font-extrabold text-orange-400">{money(Math.max(0, credits.potentialTrueUp))}<span className="text-base font-normal text-slate-400">/yr</span></div>
            <p className="text-[11px] text-orange-200/70 mt-2">
              {!owesUtility
                ? `When net metering ends, even over-producing won't save you — this is what you'd owe ${utilName}.`
                : `As net metering shrinks, your bill to ${utilName} climbs even higher — to this.`}
            </p>
          </div>
        </div>
      </div>

      {/* Authoritative bottom line — matches the audit tool exactly */}
      <div className={`rounded-lg p-4 border mb-8 flex items-center justify-between ${!owesUtility ? 'bg-slate-900/50 border-slate-700/50' : 'bg-red-900/20 border-red-400/40'}`}>
        <div className="flex items-center gap-2">
          <DollarSign size={16} className={!owesUtility ? 'text-green-400' : 'text-red-400'} />
          <span className="text-sm text-slate-200">
            {!owesUtility
              ? `What ${utilName} pays you for your energy each year`
              : `What you pay ${utilName} every year — with no battery`}
          </span>
        </div>
        <span className={`text-xl font-bold ${!owesUtility ? 'text-green-400' : 'text-red-400'}`}>
          {!owesUtility ? `${money(annualCheck)}/yr` : `${money(annualTrueUp)}/yr`}
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

        <div className="mb-6"><GridFutureGraphic /></div>

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

      {/* 4. VALUE RECOVERED — arbitrage spread + avoided true-up */}
      <div className="bg-green-400/10 border border-green-400/40 rounded-lg p-6 text-center mb-3">
        <div className="text-sm text-green-200 uppercase tracking-wider flex items-center justify-center gap-2">
          <TrendingUp size={16} /> Value Recovered Each Year With a Battery
        </div>
        <div className="text-5xl font-extrabold text-green-300 mt-2">{money(totalRecovered)}</div>
      </div>

      {/* Mini-accordion: the breakdown behind that number */}
      <Accordion title="How this value is recovered" accent="emerald" dense defaultOpen={false}>
        <div className="text-xs text-slate-400 space-y-1">
          <div>
            <span className="text-green-300 font-semibold">{money(arbRecovered)}</span> recovered by shifting {recovery.shiftedKwh.toLocaleString()} kWh from low export ({rate(recovery.middayRate)}) to peak use ({rate(recovery.peakRate)})
          </div>
          {avoidedTrueUp > 0 && (
            <div>
              <span className="text-green-300 font-semibold">+ {money(avoidedTrueUp)}</span> of the true-up you pay {utilName} today, erased by self-consuming instead of owing
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          A battery lets you "sell to yourself" — recovering energy at the peak rate you'd otherwise pay, and cutting the
          true-up you currently owe. Raw storage figures shown; actual delivery is ~90% of capacity after round-trip
          efficiency and your set reserve.
        </p>
      </Accordion>

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
