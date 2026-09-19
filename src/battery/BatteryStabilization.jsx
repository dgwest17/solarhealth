/**
 * FILE: src/battery/BatteryStabilization.jsx
 *
 * "STABILIZE YOUR BILL WITH STORAGE" — the pricing and payment close.
 *
 * Rebuilt around one comparison: keep paying the utility for twenty years, or
 * add a battery. Everything on screen serves that single question.
 *
 * Shape of the section, top to bottom:
 *   1. $0 Down, and how it is bought (loan / cash / lease)
 *   2. Cash in Your Pocket — the storage rebate, kept or rolled into the loan
 *   3. The payment
 *   4. Twenty-year graph with a year slider, utility path first, battery on toggle
 *   5. Totals and net position at the slider year
 *   6. Breakdown — the price stack, collapsed by default
 *
 * The principal is deliberately not on screen until the Breakdown is opened.
 * The rate is never on screen at all. Both live in src/pricing/loanPricing.js.
 *
 * The horizon is pinned at 20 years whatever loan term is selected — a 12-year
 * term going quiet in year 13 while the savings keep running IS the argument,
 * and truncating the chart at the term would hide it.
 *
 * Rendered by: src/battery/BatteryAnalysis.jsx
 */
import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ShieldCheck, Home, RefreshCw, Check, Wallet, TrendingUp
} from 'lucide-react';
import { estimateBackupHours } from './BatteryModel';
import {
  priceBattery, projectTwentyYear,
  ADDERS, LOAN_TERMS_YEARS, DEFAULT_CONTRACT_VALUE,
  FED_PCT_MIN, FED_PCT_MAX, FED_PCT_DEFAULT, LOCAL_REBATE_PER_KWH
} from '../pricing/loanPricing';
import { getConnectionFeeForYear } from '../utils/rateData';

const HORIZON = 20;
const ESCALATOR_OPTIONS = [0, 0.9, 1.9, 2.9, 3.5];

const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(Number(v) || 0)).toLocaleString();
const money2 = (v) => (v < 0 ? '−$' : '$') + Math.abs(Number(v) || 0).toFixed(2);

const BatteryStabilization = ({ recoveredValuePerYear = 0, overlay, inputs = {}, annualTrueUp = 0 }) => {
  const [mode, setMode] = useState('loan'); // loan | cash | lease

  // ---- battery configuration ----
  const [kwhPerBattery, setKwhPerBattery] = useState(13.5);
  const [batteryCount, setBatteryCount] = useState(1);
  const totalKwh = (Number(kwhPerBattery) || 0) * (Number(batteryCount) || 0);

  // ---- pricing inputs ----
  const [contractValue, setContractValue] = useState(DEFAULT_CONTRACT_VALUE);
  const [termYears, setTermYears] = useState(LOAN_TERMS_YEARS[0]);
  const [fedPct, setFedPct] = useState(FED_PCT_DEFAULT);
  const [applyRebateToLoan, setApplyRebateToLoan] = useState(false);
  const [adderSel, setAdderSel] = useState({});
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ---- graph controls ----
  const [showBattery, setShowBattery] = useState(false);
  const [sliderYear, setSliderYear] = useState(HORIZON);
  const [view, setView] = useState('monthly'); // daily | monthly | yearly
  const [escalation, setEscalation] = useState(8);

  // ---- lease ----
  const [leasePayment, setLeasePayment] = useState(155);
  const [escalator, setEscalator] = useState(2.9);

  const setAdder = (id, patch) =>
    setAdderSel((p) => ({ ...p, [id]: { ...(p[id] || { on: false }), ...patch } }));

  // -------------------------------------------------------------------------
  // What the utility costs today.
  //
  // For a solar client the residual utility bill is the connection fee plus the
  // amortised true-up — that IS the bill, and it is the number a battery goes
  // after. Both are overridable because a client's paper bill is the source of
  // truth when they have it in hand.
  // -------------------------------------------------------------------------
  const nowYear = inputs.nowYear || new Date().getFullYear();
  const defaultFee = getConnectionFeeForYear(nowYear, inputs.connectionFeeMonthly);
  const [connectionFee, setConnectionFee] = useState(defaultFee);
  const derivedBill = Math.round(defaultFee + (Number(annualTrueUp) || 0) / 12);
  const [billOverride, setBillOverride] = useState(null);
  const monthlyBill = billOverride === null ? derivedBill : Number(billOverride) || 0;

  // Estimated savings: automated from the dispatch engine, overridable.
  const derivedSavings = Math.round((Number(recoveredValuePerYear) || 0) / 12);
  const [savingsOverride, setSavingsOverride] = useState(null);
  const monthlySavings = savingsOverride === null ? derivedSavings : Number(savingsOverride) || 0;

  // NEM 1.0 is the only tariff where export credits can offset the connection
  // fee. On 2.0 and 3.0 it is a hard floor the bill never drops below.
  const creditsOffsetFees = inputs.nemVersion === 'NEM1';

  // -------------------------------------------------------------------------
  const price = useMemo(() => priceBattery({
    contractValue: Number(contractValue) || 0,
    adderSelections: adderSel,
    fedPct,
    usableKwh: totalKwh,
    rebateEligible: (inputs.utility || 'SDGE') === 'SDGE',
    rebatePerKwh: LOCAL_REBATE_PER_KWH,
    termYears,
    applyRebateToLoan
  }), [contractValue, adderSel, fedPct, totalKwh, termYears, applyRebateToLoan, inputs.utility]);

  const activePayment =
    mode === 'loan'  ? price.monthlyPayment :
    mode === 'lease' ? (Number(leasePayment) || 0) : 0;
  const activeTerm = mode === 'cash' ? 0 : termYears;

  const proj = useMemo(() => projectTwentyYear({
    monthlyBillToday: monthlyBill,
    monthlyConnectionFee: connectionFee,
    monthlySavings,
    monthlyPayment: activePayment,
    termYears: activeTerm,
    escalationPct: escalation,
    horizonYears: HORIZON,
    creditsOffsetFees,
    rebateCash: mode === 'loan' && !applyRebateToLoan ? price.rebate : 0
  }), [monthlyBill, connectionFee, monthlySavings, activePayment, activeTerm, escalation, creditsOffsetFees, price.rebate, applyRebateToLoan, mode]);

  const rows = proj.rows;
  const at = rows[Math.min(rows.length, Math.max(1, sliderYear)) - 1];

  const field = view === 'daily' ? 'Daily' : view === 'yearly' ? 'Yearly' : 'Monthly';
  const utilVal = at[`utility${field}`];
  const battVal = at[`battery${field}`];
  const unit = view === 'daily' ? '/day' : view === 'yearly' ? '/yr' : '/mo';

  // Cumulative through the slider year.
  const cumUtility = at.cumUtility;
  const cumBattery = at.cumBattery;
  const rebateCash = mode === 'loan' && !applyRebateToLoan ? price.rebate : 0;
  const netPosition = cumUtility - cumBattery + rebateCash;

  // Year-1 differential, the "$X/day for a battery" line.
  const y1 = rows[0];
  const dailyDelta = (y1.batteryMonthly - y1.utilityMonthly) * 12 / 365;

  const backupHours = estimateBackupHours(totalKwh, 0.75);

  // ---- chart geometry ----
  const W = 900, H = 280, P = { l: 62, r: 16, t: 18, b: 30 };
  const series = showBattery
    ? rows.map((r) => Math.max(r[`utility${field}`], r[`battery${field}`]))
    : rows.map((r) => r[`utility${field}`]);
  const hi = Math.max(...series) * 1.08 || 1;
  const X = (i) => P.l + (i / (HORIZON - 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - v / hi) * (H - P.t - P.b);
  const path = (key) => rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(' ');
  const area = (key) =>
    `${path(key)} L${X(HORIZON - 1).toFixed(1)},${Y(0).toFixed(1)} L${X(0).toFixed(1)},${Y(0).toFixed(1)} Z`;
  const markerX = X(sliderYear - 1);

  const Money = ({ v, cls = '' }) => <span className={`font-mono ${cls}`}>{money(v)}</span>;

  return (
    <div className="space-y-5">
      {/* ================= 1. $0 DOWN + how it's bought ================= */}
      <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-900/20 to-slate-900/60 p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            {mode !== 'cash' ? (
              <>
                <div className="text-[64px] leading-[0.9] font-extrabold text-emerald-300 tracking-tight">$0 Down</div>
                <p className="text-slate-300 text-sm mt-2">
                  Fixed payment · No prepayment penalty{mode === 'lease' ? ' · Full third-party warranty coverage' : ''}
                </p>
              </>
            ) : (
              <>
                <div className="text-[52px] leading-[0.9] font-extrabold text-amber-300 tracking-tight">
                  {money(price.net)}
                </div>
                <p className="text-slate-300 text-sm mt-2">Net investment, paid up front</p>
              </>
            )}
          </div>

          <div className="flex gap-1 bg-slate-900/70 rounded-lg p-1 border border-slate-700">
            {[['loan', 'Loan'], ['cash', 'Cash'], ['lease', 'Lease']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === k ? 'bg-emerald-500 text-slate-900' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* battery config */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-700/60">
          <Field label="kWh per battery" value={kwhPerBattery} onChange={setKwhPerBattery} />
          <Field label="# of batteries" value={batteryCount} onChange={setBatteryCount} />
          <div>
            <label className="block text-xs text-slate-400 mb-1">Total storage</label>
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-emerald-400/30 text-emerald-300 font-bold">
              {totalKwh} kWh
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Essential backup</label>
            <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-600 text-slate-200 text-sm flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />~{backupHours} hrs
            </div>
          </div>
        </div>
      </div>

      {/* ================= 2. CASH IN YOUR POCKET ================= */}
      {price.rebate > 0 && mode === 'loan' && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-amber-200 flex items-center gap-2">
                <Wallet size={14} /> Cash in Your Pocket
              </div>
              <div className="text-4xl font-extrabold text-amber-300 mt-1">{money(price.rebate)}</div>
              <p className="text-xs text-slate-400 mt-1">
                {money(LOCAL_REBATE_PER_KWH)}/kWh × {totalKwh} kWh usable
                {price.rebateCapped ? ' · capped at program maximum' : ''}
              </p>
            </div>
            <div className="flex gap-1 bg-slate-900/70 rounded-lg p-1 border border-amber-400/30">
              {[[false, 'Keep the cash'], [true, 'Apply to payment']].map(([v, label]) => (
                <button
                  key={label}
                  onClick={() => setApplyRebateToLoan(v)}
                  className={`px-4 py-2 rounded-md text-[13px] font-semibold transition-colors ${
                    applyRebateToLoan === v ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >{label}</button>
              ))}
            </div>
          </div>
          <p className="text-[11.5px] text-slate-400 mt-3">
            {applyRebateToLoan
              ? `Rolled into the loan — payment drops to ${money2(price.monthlyPayment)}/mo.`
              : `Paid to you. The payment is sized before the rebate, so it stays at ${money2(price.monthlyPayment)}/mo either way.`}
          </p>
        </div>
      )}

      {price.rebateBlockedByAdder && (
        <div className="rounded-xl border border-red-400/40 bg-red-900/15 p-4 text-[13px] text-red-200">
          A non-export system is not eligible for the storage rebate. Removing that adder restores{' '}
          {money(LOCAL_REBATE_PER_KWH * totalKwh)}.
        </div>
      )}

      {/* ================= 3. THE PAYMENT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-stretch">
        <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/50 p-5">
          {mode === 'cash' ? (
            <>
              <div className="text-[11px] uppercase tracking-widest text-cyan-200">Simple payback</div>
              <div className="text-5xl font-extrabold text-cyan-300 mt-1">
                {monthlySavings > 0 ? (price.net / (monthlySavings * 12)).toFixed(1) : '—'} yrs
              </div>
              <p className="text-sm text-slate-400 mt-2">
                {money(price.net)} net ÷ {money(monthlySavings * 12)}/yr in recovered value
              </p>
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-widest text-cyan-200">Your payment</div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-5xl font-extrabold text-cyan-300">{money2(activePayment)}</span>
                <span className="text-lg text-slate-400">/mo</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                {mode === 'loan'
                  ? `${termYears}-year term · fixed · no prepayment penalty`
                  : `${termYears}-year lease · ${escalator}% escalator`}
              </p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-5 min-w-[260px]">
          <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-2">Year one, all in</div>
          <dl className="font-mono text-[13px] space-y-1">
            <Row label="Utility bill today" value={money2(y1.utilityMonthly) + '/mo'} />
            <Row label="Estimated savings" value={'− ' + money2(monthlySavings) + '/mo'} tone="emerald" />
            <Row label={creditsOffsetFees ? 'Floor (credits offset fees)' : 'Connection fee floor'}
                 value={money2(y1.residualUtility) + '/mo'} />
            {activePayment > 0 && <Row label="Battery payment" value={'+ ' + money2(activePayment) + '/mo'} />}
            <div className="flex justify-between border-t border-slate-700 mt-2 pt-2">
              <dt className="text-slate-300 font-sans text-[13px] self-center">New monthly</dt>
              <dd className="text-[19px] text-cyan-300">{money2(y1.batteryMonthly)}</dd>
            </div>
          </dl>
          <p className="text-[11.5px] text-slate-400 mt-2">
            {dailyDelta > 0
              ? <>That is <b className="text-cyan-300">{money2(dailyDelta)}/day</b> more than today — fixed, for a battery.</>
              : <>That is <b className="text-emerald-300">{money2(-dailyDelta)}/day</b> less than today, from day one.</>}
          </p>
        </div>
      </div>

      {/* ================= 4. TWENTY-YEAR GRAPH ================= */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-lg font-bold text-slate-100">Twenty years, side by side</h4>
            <p className="text-[12px] text-slate-400">
              Utility costs assume {escalation}% annual rate escalation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-slate-900/70 rounded-lg p-1 border border-slate-700">
              {[['daily', 'Daily'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-semibold ${
                    view === k ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
                >{label}</button>
              ))}
            </div>
            <button
              onClick={() => setShowBattery((v) => !v)}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold border transition-colors ${
                showBattery
                  ? 'bg-cyan-500 text-slate-900 border-cyan-400'
                  : 'bg-slate-900/70 text-cyan-300 border-cyan-400/50 hover:bg-cyan-500/10'
              }`}
            >{showBattery ? '✓ Battery added' : '+ Add battery'}</button>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (hi / 4) * i, yy = Y(v);
            return (
              <g key={i}>
                <line x1={P.l} y1={yy} x2={W - P.r} y2={yy} stroke="rgba(148,163,184,.18)" strokeWidth="1" />
                <text x={P.l - 8} y={yy + 3.5} textAnchor="end" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">
                  {money(v)}
                </text>
              </g>
            );
          })}

          <path d={area('utility' + field)} fill="rgba(239,68,68,.13)" />
          <path d={path('utility' + field)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" />

          {showBattery && (
            <>
              <path d={area('battery' + field)} fill="rgba(34,211,238,.13)" />
              <path d={path('battery' + field)} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" />
              {proj.breakEvenYear && (
                <>
                  <line
                    x1={X(proj.breakEvenYear - 1)} y1={P.t}
                    x2={X(proj.breakEvenYear - 1)} y2={H - P.b}
                    stroke="#facc15" strokeWidth="2.5" strokeDasharray="7 5"
                  />
                  <text x={X(proj.breakEvenYear - 1) + 6} y={P.t + 12}
                        fill="#facc15" fontSize="11.5" fontFamily="monospace" fontWeight="bold">
                    break even · yr {proj.breakEvenYear}
                  </text>
                </>
              )}
            </>
          )}

          {/* slider marker */}
          <line x1={markerX} y1={P.t} x2={markerX} y2={H - P.b} stroke="#e2e8f0" strokeWidth="1" opacity=".5" />
          <circle cx={markerX} cy={Y(utilVal)} r="4.5" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" />
          {showBattery && <circle cx={markerX} cy={Y(battVal)} r="4.5" fill="#22d3ee" stroke="#0f172a" strokeWidth="1.5" />}

          {rows.filter((_, i) => i % 2 === 0).map((r, k) => (
            <text key={r.year} x={X(k * 2)} y={H - 8} textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">
              {r.year}
            </text>
          ))}
        </svg>

        <input
          type="range" min={1} max={HORIZON} step={1} value={sliderYear}
          onChange={(e) => setSliderYear(Number(e.target.value))}
          className="w-full accent-cyan-400 mt-2"
        />

        {/* ---- readouts at the slider year ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700 border border-slate-700 rounded-xl overflow-hidden mt-4">
          <Stat label={`Utility, year ${at.year}`} value={money2(utilVal) + unit} sub="if nothing changes" cls="text-red-300" />
          <Stat label={`Paid to the utility`} value={money(cumUtility)} sub={`cumulative through year ${at.year}`} cls="text-red-300" />
          {showBattery ? (
            <>
              <Stat label={`With battery, year ${at.year}`}
                    value={money2(battVal) + unit}
                    sub={at.loanActive ? 'includes the payment' : 'loan paid off'} cls="text-cyan-300" />
              <Stat label="Net position"
                    value={money(netPosition)}
                    sub={netPosition >= 0 ? 'ahead by adding storage' : 'still catching up'}
                    cls={netPosition >= 0 ? 'text-emerald-300' : 'text-amber-300'} />
            </>
          ) : (
            <>
              <Stat label="Escalation" value={
                <input type="number" step={0.5} value={escalation}
                  onChange={(e) => setEscalation(Number(e.target.value) || 0)}
                  className="w-[70px] bg-transparent border-b border-slate-600 text-slate-100 font-mono text-[19px] focus:outline-none focus:border-cyan-400" />
              } sub="% per year, editable" cls="text-slate-100" />
              <Stat label="Add the battery" value="→" sub="to see the comparison" cls="text-cyan-300" />
            </>
          )}
        </div>

        {showBattery && (
          <p className="text-[12px] text-slate-400 mt-3">
            Over {HORIZON} years: <Money v={proj.totalUtility} cls="text-red-300" /> staying with the utility
            versus <Money v={proj.totalBattery} cls="text-cyan-300" /> with storage
            {rebateCash > 0 ? <> plus <Money v={rebateCash} cls="text-amber-300" /> back in your pocket</> : null}
            {' — '}a lifetime difference of <Money v={proj.lifetimeSavings} cls="text-emerald-300" />.
            {activeTerm > 0 && activeTerm < HORIZON && (
              <> The payment ends after year {activeTerm}; everything after that is savings with no payment against it.</>
            )}
          </p>
        )}
      </div>

      {/* ================= 5. ASSUMPTIONS ================= */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
        <h4 className="text-[15px] font-semibold text-slate-100 mb-1">The numbers behind the graph</h4>
        <p className="text-[11.5px] text-slate-500 mb-4">
          Savings and the bill are computed from this client&rsquo;s own system. Override either when you have
          their paper bill in hand.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Override label="Utility bill today" suffix="/mo" derived={derivedBill}
                    value={billOverride} onChange={setBillOverride} />
          <Override label="Estimated monthly savings" suffix="/mo" derived={derivedSavings}
                    value={savingsOverride} onChange={setSavingsOverride} />
          <div>
            <label className="block text-xs text-slate-400 mb-1">Connection fee</label>
            <input type="number" value={connectionFee}
              onChange={(e) => setConnectionFee(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 font-mono text-sm" />
            <p className="text-[10.5px] text-slate-500 mt-1">
              {creditsOffsetFees ? 'NEM 1.0 — credits can offset this.' : 'NEM 2.0/3.0 — never offset by credits.'}
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rate escalation</label>
            <input type="number" step={0.5} value={escalation}
              onChange={(e) => setEscalation(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 font-mono text-sm" />
            <p className="text-[10.5px] text-slate-500 mt-1">% per year</p>
          </div>
        </div>

        {mode === 'lease' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/60">
            <Field label="Monthly lease payment" value={leasePayment} onChange={setLeasePayment} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Escalator</label>
              <select value={escalator} onChange={(e) => setEscalator(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm">
                {ESCALATOR_OPTIONS.map((e) => <option key={e} value={e}>{e}%</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ================= 6. BREAKDOWN (collapsed) ================= */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 overflow-hidden">
        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
        >
          <span className="text-[15px] font-semibold text-slate-200">Breakdown</span>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
        </button>

        {showBreakdown && (
          <div className="p-5 pt-0 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* --- price stack --- */}
              <div>
                <h5 className="text-[13px] font-semibold text-slate-300 mb-2">Price stack</h5>
                <dl className="font-mono text-[13px] space-y-1">
                  <Row label="Contract value" value={money(price.base)} />
                  {price.adders.lines.map((l) => (
                    <Row key={l.id} label={l.label + (l.units ? ` (${l.units})` : '')}
                         value={l.pending ? 'price TBD' : '+ ' + money(l.cost)}
                         tone={l.pending ? 'muted' : undefined} />
                  ))}
                  {price.adders.total > 0 && (
                    <Row label="Contract with adders" value={money(price.contract)} strong />
                  )}
                  <Row label={`Federal deduction (${Math.round(price.fedPct * 100)}%)`}
                       value={'− ' + money(price.federal)} tone="emerald" />
                  <div className="flex justify-between border-t border-slate-700 mt-2 pt-2">
                    <dt className="text-slate-300 font-sans">Amount financed</dt>
                    <dd className="text-slate-100 text-[16px]">{money(price.paymentBase)}</dd>
                  </div>
                  <Row label="Storage rebate" value={price.rebate ? '− ' + money(price.rebate) : 'not eligible'}
                       tone={price.rebate ? 'amber' : 'muted'} />
                  <div className="flex justify-between border-t border-slate-700 mt-2 pt-2">
                    <dt className="text-slate-300 font-sans">Net investment</dt>
                    <dd className="text-emerald-300 text-[18px]">{money(price.net)}</dd>
                  </div>
                </dl>
                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                  The loan is written against the amount financed — the rebate arrives after funding, so it does
                  not size the payment{applyRebateToLoan ? ', unless it is rolled in, as it is here' : ''}.
                  {price.totalInterest > 0 && <> Total of payments over {termYears} years: {money(price.totalOfPayments)}.</>}
                </p>
              </div>

              {/* --- controls --- */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contract value ($)" value={contractValue} onChange={setContractValue} />
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Term</label>
                    <select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm">
                      {LOAN_TERMS_YEARS.map((t) => <option key={t} value={t}>{t} years</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Federal deduction</span>
                    <span className="font-mono text-slate-200">{Math.round(fedPct * 100)}%</span>
                  </div>
                  <input
                    type="range" min={FED_PCT_MIN * 100} max={FED_PCT_MAX * 100} step={1}
                    value={Math.round(fedPct * 100)}
                    onChange={(e) => setFedPct(Number(e.target.value) / 100)}
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div>
                  <h5 className="text-[13px] font-semibold text-slate-300 mb-2">Adders</h5>
                  <div className="space-y-2">
                    {ADDERS.map((a) => {
                      const sel = adderSel[a.id] || { on: false };
                      return (
                        <div key={a.id} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={!!sel.on}
                              onChange={(e) => setAdder(a.id, { on: e.target.checked })}
                              className="w-4 h-4 accent-cyan-400" />
                            <span className="text-[13px] text-slate-200 flex-1">{a.label}</span>
                            <span className="text-[12px] font-mono text-slate-400">
                              {a.kind === 'flat'
                                ? money(a.amount)
                                : a.amount ? `${money(a.amount)}/${a.unit}` : `—/${a.unit}`}
                            </span>
                          </label>
                          {sel.on && a.kind === 'perUnit' && (
                            <div className="flex gap-2 mt-2 pl-6">
                              <input type="number" placeholder={a.unit} value={sel.units ?? ''}
                                onChange={(e) => setAdder(a.id, { units: e.target.value })}
                                className="w-[86px] px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 font-mono text-[12px]" />
                              {a.pending && (
                                <input type="number" placeholder={`$ per ${a.unit.replace(/s$/, '')}`}
                                  value={sel.amount ?? ''}
                                  onChange={(e) => setAdder(a.id, { amount: e.target.value })}
                                  className="w-[130px] px-2 py-1 rounded bg-slate-900/70 border border-amber-500/50 text-slate-100 font-mono text-[12px]" />
                              )}
                            </div>
                          )}
                          {sel.on && a.hint && (
                            <p className={`text-[10.5px] mt-1.5 ${a.blocksRebate ? 'text-red-300' : 'text-slate-500'}`}>{a.hint}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* year table */}
            <div className="overflow-x-auto border-t border-slate-700 pt-4">
              <table className="w-full font-mono text-[12px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    {['Year', 'Utility /mo', 'With battery /mo', 'Payment', 'Difference', 'Net position'].map((h, i) => (
                      <th key={h} className={`font-sans font-medium text-[11.5px] pb-2 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year}
                        className={`border-b border-slate-800 ${r.year === proj.breakEvenYear ? 'text-amber-300' : ''}`}>
                      <td className="text-left text-slate-400 py-1">
                        {r.year}{r.year === proj.breakEvenYear ? ' · break even' : ''}
                      </td>
                      <td className="text-right text-red-300/90">{money2(r.utilityMonthly)}</td>
                      <td className="text-right text-cyan-300/90">{money2(r.batteryMonthly)}</td>
                      <td className="text-right text-slate-400">{r.loanMonthly ? money2(r.loanMonthly) : '—'}</td>
                      <td className={`text-right ${r.monthlyDelta > 0 ? 'text-amber-300/90' : 'text-emerald-300/90'}`}>
                        {money2(r.monthlyDelta)}
                      </td>
                      <td className={`text-right ${(r.netPosition + rebateCash) >= 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {money(r.netPosition)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ================= checklist ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Checkpoint icon={Home} title="Home Independence Unlocked" sub="Take back control from utility monopolies" />
        <Checkpoint icon={ShieldCheck} title="Backup Engaged" sub="Never lose essentials again" />
        <Checkpoint icon={RefreshCw} title="Recover Lost Value" sub="Unlock the full potential of home power" />
        <Checkpoint icon={TrendingUp} title="A Fixed Payment" sub="While the utility keeps escalating" />
      </div>

      <p className="text-xs text-slate-500 text-center">
        All estimated savings are based on current values and are not guaranteed. Financing subject to credit approval.
      </p>
    </div>
  );
};

/* ---------------------------------------------------------------- helpers */

const Row = ({ label, value, tone, strong }) => (
  <div className="flex justify-between">
    <dt className={`font-sans ${strong ? 'text-slate-200' : 'text-slate-400'}`}>{label}</dt>
    <dd className={
      tone === 'emerald' ? 'text-emerald-300' :
      tone === 'amber'   ? 'text-amber-300'   :
      tone === 'muted'   ? 'text-slate-500'   : 'text-slate-100'
    }>{value}</dd>
  </div>
);

const Stat = ({ label, value, sub, cls }) => (
  <div className="bg-slate-900 p-4">
    <span className="block text-[11.5px] text-slate-400 mb-1">{label}</span>
    <b className={`font-mono text-[21px] font-medium block ${cls}`}>{value}</b>
    <small className="block text-[11px] text-slate-500 mt-0.5">{sub}</small>
  </div>
);

/** A value the tool computed, with a manual override that can be cleared. */
const Override = ({ label, suffix, derived, value, onChange }) => (
  <div>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input
      type="number"
      value={value === null ? derived : value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 rounded-lg bg-slate-900/70 border text-slate-100 font-mono text-sm ${
        value === null ? 'border-slate-600' : 'border-amber-500/60'
      }`}
    />
    <p className="text-[10.5px] mt-1">
      {value === null ? (
        <span className="text-slate-500">Calculated: {money(derived)}{suffix}</span>
      ) : (
        <button onClick={() => onChange(null)} className="text-amber-400 hover:underline">
          Overridden — reset to {money(derived)}{suffix}
        </button>
      )}
    </p>
  </div>
);

const Field = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 font-mono text-sm"
    />
  </div>
);

const Checkpoint = ({ icon: Icon, title, sub }) => (
  <div className="flex items-start gap-3 bg-slate-900/40 rounded-lg p-3 border border-emerald-400/20">
    <div className="w-7 h-7 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
      <Check size={15} className="text-emerald-400" />
    </div>
    <div>
      <div className="text-slate-100 font-semibold text-sm flex items-center gap-1.5">
        <Icon size={14} className="text-amber-400" /> {title}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  </div>
);

export default BatteryStabilization;
