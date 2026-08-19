/**
 * FILE: src/components/NetPositionPanel.jsx
 *
 * "What you'd have paid the utility" vs "what solar has actually run you."
 *
 * This is the comparison that matters most to a client who is STILL MAKING
 * PAYMENTS. Every other savings figure in the tool implicitly answers "was
 * solar a good idea?" — this one answers "is my money better off right now?",
 * which is the question someone with a loan payment actually has.
 *
 * The left column is the counterfactual: their real usage curve priced against
 * each year's real retail rate, with no solar at all. The right column is every
 * dollar solar has taken — up-front, payments made to date, connection charges
 * at the rate in force each year, and any true-up. The difference is the net.
 *
 * Deliberately does NOT count the remaining balance of a loan or PPA. Money not
 * yet spent isn't a cost incurred, and counting it would make every financed
 * client look underwater on day one.
 *
 * Data: calculations.costBreakdown (src/utils/calculations.js)
 * Rendered by: src/SolarCalculator.jsx (Audit tab)
 */
import React from 'react';
import { TrendingUp, TrendingDown, Receipt, Zap } from 'lucide-react';

const money = (v) => '$' + Math.abs(Math.round(Number(v) || 0)).toLocaleString();

const Line = ({ label, value, sub = null, muted = false, positive = false }) => {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={`text-[11.5px] ${muted ? 'text-slate-500' : 'text-slate-300'}`}>
        {label}
        {sub && <span className="block text-[10px] text-slate-500">{sub}</span>}
      </span>
      <span className={`text-[13px] font-semibold shrink-0 ${positive ? 'text-emerald-300' : 'text-slate-200'}`}>
        {positive ? '−' : ''}{money(value)}
      </span>
    </div>
  );
};

const NetPositionPanel = ({ calculations, inputs }) => {
  const b = calculations?.costBreakdown;
  if (!b || !b.utilityWouldHavePaid) return null;

  const ahead = b.netSavings >= 0;

  return (
    <div className="bg-slate-800/50 border border-cyan-500/25 rounded-xl p-5 mb-6">
      <h3 className="text-base font-bold text-cyan-300 mb-1">
        Where You Actually Stand
      </h3>
      <p className="text-[11px] text-slate-500 mb-4">
        Everything below covers the {b.yearsCovered} years since your system turned on — your real usage,
        priced against each year&rsquo;s real utility rate.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: the counterfactual */}
        <div className="rounded-lg border border-red-400/30 bg-red-900/12 p-4">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-red-300 mb-1">
            <Zap size={13} /> Without solar
          </div>
          <div className="text-[12px] text-slate-300 mb-2">
            What {inputs.utility === 'SDGE' ? 'SDG&E' : inputs.utility === 'PGE' ? 'PG&E' : inputs.utility || 'your utility'} would have taken
          </div>
          <div className="text-4xl font-extrabold text-red-300">{money(b.utilityWouldHavePaid)}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            about {money(b.avgMonthlyUtilityAvoided)}/month
          </div>
        </div>

        {/* RIGHT: itemised solar cost */}
        <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-300 mb-2">
            <Receipt size={13} /> What solar has run you
          </div>
          <div className="divide-y divide-slate-700/60">
            <Line label="Paid up front" value={b.upFrontPaid} />
            <Line
              label="Solar payments to date"
              sub={b.stillPaying ? 'payments still ongoing' : null}
              value={b.solarPaymentsToDate}
            />
            <Line label="Battery payments to date" value={b.batteryPaymentsToDate} />
            <Line
              label="Connection &amp; minimum charges"
              sub="at the rate in force each year"
              value={b.connectionFeesPaid}
            />
            <Line label="True-up billed" value={b.trueUpPaid} />
            <Line label="Credits received" value={b.creditsReceived} positive />
          </div>
          <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t-2 border-slate-600">
            <span className="text-[12px] font-bold text-slate-200">Total</span>
            <span className="text-2xl font-extrabold text-slate-100">{money(b.totalSolarOutlay)}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 text-right">
            about {money(b.avgMonthlySolarOutlay)}/month
          </div>
        </div>
      </div>

      {/* THE ANSWER */}
      <div className={`mt-4 rounded-lg p-4 border-2 ${
        ahead ? 'border-emerald-400/50 bg-emerald-900/18' : 'border-amber-400/50 bg-amber-900/15'
      }`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {ahead
              ? <TrendingUp size={20} className="text-emerald-400" />
              : <TrendingDown size={20} className="text-amber-400" />}
            <div>
              <div className={`text-[12px] font-bold ${ahead ? 'text-emerald-200' : 'text-amber-200'}`}>
                {ahead ? 'You are ahead by' : 'You are behind by'}
              </div>
              <div className="text-[10.5px] text-slate-400">
                {money(b.utilityWouldHavePaid)} avoided − {money(b.totalSolarOutlay)} spent
              </div>
            </div>
          </div>
          <div className={`text-4xl font-extrabold ${ahead ? 'text-emerald-300' : 'text-amber-300'}`}>
            {ahead ? '+' : '−'}{money(b.netSavings)}
          </div>
        </div>

        {b.outlayAsPctOfUtility != null && (
          <p className="text-[11px] text-slate-300 mt-2.5 leading-relaxed">
            Solar has cost <span className="font-semibold">{b.outlayAsPctOfUtility}%</span> of the utility bill
            it replaced
            {b.stillPaying && (
              <> — and your payments are still running, so this gap keeps widening every month the utility raises rates.</>
            )}
            {!b.stillPaying && b.solarPaymentsToDate > 0 && (
              <> — with the system now paid off, everything from here is upside.</>
            )}
          </p>
        )}
      </div>

      <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
        Counts money actually spent to date — not the remaining balance of a loan or lease. Connection and
        minimum charges are applied at the rate in force in each year (these rose from $0 to $12, and to $24
        at the end of 2025), not today&rsquo;s rate applied backwards.
      </p>
    </div>
  );
};

export default NetPositionPanel;
