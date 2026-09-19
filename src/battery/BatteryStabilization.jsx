/**
 * FILE: src/battery/BatteryStabilization.jsx
 *
 * "STABILIZE YOUR BILL WITH STORAGE" — the pricing and payment close.
 *
 * One comparison: keep paying the utility for twenty years, or add a battery.
 *
 * Shape of the section, top to bottom:
 *   1. $0 Down, and how it is bought (loan / cash / lease)
 *   2. Cash in Your Pocket — the storage rebate, kept or rolled into the loan
 *   3. The twenty-year graph, with the year slider starting at year one
 *   4. The payment and the year-one arithmetic, read underneath the graph
 *   5. Assumptions
 *   6. Breakdown — the price stack, collapsed by default
 *
 * The graph leads because the graph is the argument. The payment sits below it
 * so the customer meets the twenty-year picture before the monthly number,
 * rather than anchoring on the payment and reading the chart as justification.
 *
 * With the battery shown, the cost is stacked rather than drawn as one line —
 * connection fee, residual energy, and the battery payment are three different
 * kinds of money and a single line hides which one is moving. The values ride
 * over their own band in small type and follow the slider.
 *
 * "Sea Level Rise" marks the end of NEM grandfathering: a step change on a
 * known date that the escalation curve would otherwise smooth away.
 *
 * The principal is not on screen until Breakdown is opened. The lending rate
 * is never on screen. Both live in src/pricing/loanPricing.js; the defaults
 * behind every figure are editable in Admin → Platform Defaults.
 *
 * Rendered by: src/battery/BatteryAnalysis.jsx
 */
import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ShieldCheck, Home, RefreshCw, Check, Wallet, TrendingUp, Waves
} from 'lucide-react';
import { estimateBackupHours } from './BatteryModel';
import { priceBattery, projectTwentyYear } from '../pricing/loanPricing';
import { getConnectionFeeForYear } from '../utils/rateData';
import { NEM3_EXPORT_MIDDAY } from './BatteryDispatch';
import { useSettings } from '../admin/SettingsContext';

const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(Number(v) || 0)).toLocaleString();
const money2 = (v) => (v < 0 ? '−$' : '$') + Math.abs(Number(v) || 0).toFixed(2);

const BatteryStabilization = ({
  recoveredValuePerYear = 0,
  overlay,
  inputs = {},
  annualTrueUp = 0,
  calculations = null,
  annualExportKwh = 0
}) => {
  const { settings } = useSettings();
  const A = settings.assumptions;
  const HORIZON = Math.max(5, Math.round(A.horizonYears) || 20);

  const [mode, setMode] = useState('loan'); // loan | cash | lease

  // ---- battery configuration ----
  const [kwhPerBattery, setKwhPerBattery] = useState(13.5);
  const [batteryCount, setBatteryCount] = useState(1);
  const totalKwh = (Number(kwhPerBattery) || 0) * (Number(batteryCount) || 0);

  // ---- lender & terms, from the editable rate cards ----
  const lenders = settings.lenders && settings.lenders.length ? settings.lenders : [];
  const [lenderId, setLenderId] = useState(lenders[0] ? lenders[0].id : null);
  const lender = lenders.find((l) => l.id === lenderId) || lenders[0] || null;
  const termOptions = (lender && lender.terms && lender.terms.length)
    ? lender.terms.slice().sort((a, b) => b.years - a.years)
    : [{ years: 20, apr: 0.0549 }];
  const [termYears, setTermYears] = useState(
    (lender && lender.defaultTermYears) || termOptions[0].years
  );
  const activeTermCard = termOptions.find((t) => t.years === termYears) || termOptions[0];

  // ---- pricing inputs ----
  const [contractValue, setContractValue] = useState(A.contractValue);
  const [fedPct, setFedPct] = useState(A.fedPctDefault);
  const [applyRebateToLoan, setApplyRebateToLoan] = useState(false);
  const [adderSel, setAdderSel] = useState({});
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ---- graph controls ----
  const [showBattery, setShowBattery] = useState(false);
  // Starts at the beginning of the timescale — the customer should walk the
  // curve forward, not start at the end and scrub backwards.
  const [sliderYear, setSliderYear] = useState(1);
  const [view, setView] = useState('monthly'); // daily | monthly | yearly
  const [escalation, setEscalation] = useState(A.rateEscalationPct);
  const [seaLevel, setSeaLevel] = useState(false);

  // ---- lease ----
  const [leasePayment, setLeasePayment] = useState(155);
  const [escalator, setEscalator] = useState(2.9);

  const setAdder = (id, patch) =>
    setAdderSel((p) => ({ ...p, [id]: { ...(p[id] || { on: false }), ...patch } }));

  // -------------------------------------------------------------------------
  // What the utility costs today. For a solar client the residual bill is the
  // connection fee plus the amortised true-up — that IS the bill a battery
  // goes after. Overridable, because their paper bill wins when they have it.
  // -------------------------------------------------------------------------
  const nowYear = inputs.nowYear || new Date().getFullYear();
  const defaultFee = getConnectionFeeForYear(nowYear, inputs.connectionFeeMonthly);
  const [connectionFee, setConnectionFee] = useState(defaultFee);
  const derivedBill = Math.round(defaultFee + (Number(annualTrueUp) || 0) / 12);
  const [billOverride, setBillOverride] = useState(null);
  const monthlyBill = billOverride === null ? derivedBill : Number(billOverride) || 0;

  // Estimated savings — see the note below the graph for where this comes from.
  const derivedSavings = Math.round((Number(recoveredValuePerYear) || 0) / 12);
  const [savingsOverride, setSavingsOverride] = useState(null);
  const monthlySavings = savingsOverride === null ? derivedSavings : Number(savingsOverride) || 0;

  const creditsOffsetFees = inputs.nemVersion === 'NEM1';

  // -------------------------------------------------------------------------
  // THE NEM CLIFF. Grandfathering ends on a known date; on that date exports
  // reprice from retail-ish to avoided cost. The step is the export volume
  // times the lost credit rate.
  // -------------------------------------------------------------------------
  const nemExpiry = calculations && calculations.nemExpiry;
  const cliff = useMemo(() => {
    if (!nemExpiry || nemExpiry.expired) return null;
    const yearsLeft = Number(nemExpiry.yearsLeftExact);
    if (!Number.isFinite(yearsLeft) || yearsLeft <= 0 || yearsLeft > HORIZON) return null;

    const exportKwh = Number(annualExportKwh) || 0;
    const currentCredit = inputs.nemVersion === 'NEM1'
      ? Number(inputs.exportRate) || 0.30
      : Number(inputs.exportRate) || 0.06;
    const successorCredit = NEM3_EXPORT_MIDDAY;
    const lostPerYear = Math.max(0, exportKwh * (currentCredit - successorCredit));

    return {
      year: Math.max(1, Math.ceil(yearsLeft)),
      calendarYear: nemExpiry.endYear,
      monthlyAdder: lostPerYear / 12,
      annual: lostPerYear,
      exportKwh,
      currentCredit,
      successorCredit,
      anchor: nemExpiry.anchor
    };
  }, [nemExpiry, annualExportKwh, inputs.exportRate, inputs.nemVersion, HORIZON]);

  // -------------------------------------------------------------------------
  const price = useMemo(() => priceBattery({
    contractValue: Number(contractValue) || 0,
    adderSelections: adderSel,
    adderCatalog: settings.adders,
    fedPct,
    usableKwh: totalKwh,
    rebateEligible: (inputs.utility || 'SDGE') === 'SDGE',
    rebatePerKwh: A.localRebatePerKwh,
    termYears,
    apr: activeTermCard.apr,
    applyRebateToLoan
  }), [contractValue, adderSel, settings.adders, fedPct, totalKwh, termYears,
       activeTermCard.apr, applyRebateToLoan, inputs.utility, A.localRebatePerKwh]);

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
    rebateCash: mode === 'loan' && !applyRebateToLoan ? price.rebate : 0,
    nemCliffYear: seaLevel && cliff ? cliff.year : null,
    nemCliffMonthlyAdder: cliff ? cliff.monthlyAdder : 0
  }), [monthlyBill, connectionFee, monthlySavings, activePayment, activeTerm, escalation,
       HORIZON, creditsOffsetFees, price.rebate, applyRebateToLoan, mode, seaLevel, cliff]);

  const rows = proj.rows;
  const at = rows[Math.min(rows.length, Math.max(1, sliderYear)) - 1];

  const field = view === 'daily' ? 'Daily' : view === 'yearly' ? 'Yearly' : 'Monthly';
  const unit = view === 'daily' ? '/day' : view === 'yearly' ? '/yr' : '/mo';
  // Monthly figures are the model's native unit; the other views are scaled
  // from them so a band and its total can never round apart.
  const toView = (monthlyValue) =>
    view === 'daily' ? (monthlyValue * 12) / 365 : view === 'yearly' ? monthlyValue * 12 : monthlyValue;

  const utilVal = at[`utility${field}`];
  const battVal = at[`battery${field}`];

  const rebateCash = mode === 'loan' && !applyRebateToLoan ? price.rebate : 0;
  const netPosition = at.cumUtility - at.cumBattery + rebateCash;

  const y1 = rows[0];
  const dailyDelta = (y1.batteryMonthly - y1.utilityMonthly) * 12 / 365;
  const backupHours = estimateBackupHours(totalKwh, 0.75);

  // ---- chart geometry ----
  const W = 940, H = 300, P = { l: 64, r: 118, t: 22, b: 30 };
  const peak = Math.max(
    ...rows.map((r) => Math.max(r[`utility${field}`], showBattery ? r[`battery${field}`] : 0))
  ) * 1.1 || 1;
  const X = (i) => P.l + (i / (HORIZON - 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - v / peak) * (H - P.t - P.b);
  const markerX = X(sliderYear - 1);

  const lineFor = (fn) => rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(fn(r)).toFixed(1)}`).join(' ');
  /** Filled band between two running totals. */
  const bandFor = (lower, upper) => {
    const up = rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(upper(r)).toFixed(1)}`).join(' ');
    const down = rows.slice().reverse()
      .map((r, k) => `L${X(HORIZON - 1 - k).toFixed(1)},${Y(lower(r)).toFixed(1)}`).join(' ');
    return `${up} ${down} Z`;
  };

  // The three kinds of money, bottom to top.
  const bFee = (r) => toView(r.connectionFeeMonthly);
  const bFeeEnergy = (r) => toView(r.connectionFeeMonthly + r.energyMonthly);
  const bTotal = (r) => toView(r.batteryMonthly);

  const BANDS = [
    { key: 'fee',   label: 'Connection fee', color: '#64748b', lo: () => 0, hi: bFee,
      valueAt: (r) => toView(r.connectionFeeMonthly) },
    { key: 'energy', label: 'Utility energy', color: '#f59e0b', lo: bFee, hi: bFeeEnergy,
      valueAt: (r) => toView(r.energyMonthly) },
    { key: 'loan',  label: 'Battery payment', color: '#22d3ee', lo: bFeeEnergy, hi: bTotal,
      valueAt: (r) => toView(r.loanMonthly) }
  ];

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
                  Fixed payment
                  {lender && !lender.prepaymentPenalty ? ' · No prepayment penalty' : ''}
                  {mode === 'lease' ? ' · Full third-party warranty coverage' : ''}
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
              <button key={k} onClick={() => setMode(k)}
                className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === k ? 'bg-emerald-500 text-slate-900' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

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
                {money(A.localRebatePerKwh)}/kWh × {totalKwh} kWh usable
                {price.rebateCapped ? ' · capped at program maximum' : ''}
              </p>
            </div>
            <div className="flex gap-1 bg-slate-900/70 rounded-lg p-1 border border-amber-400/30">
              {[[false, 'Keep the cash'], [true, 'Apply to payment']].map(([v, label]) => (
                <button key={label} onClick={() => setApplyRebateToLoan(v)}
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
          {money(A.localRebatePerKwh * totalKwh)}.
        </div>
      )}

      {/* ================= 3. THE GRAPH ================= */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-lg font-bold text-slate-100">{HORIZON} years, side by side</h4>
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
            {cliff && (
              <button
                onClick={() => setSeaLevel((v) => !v)}
                title={`NEM ${inputs.nemVersion === 'NEM1' ? '1.0' : '2.0'} grandfathering ends ${cliff.calendarYear}`}
                className={`px-3 py-2 rounded-lg text-[12.5px] font-bold border transition-colors flex items-center gap-1.5 ${
                  seaLevel
                    ? 'bg-sky-500 text-slate-900 border-sky-400'
                    : 'bg-slate-900/70 text-sky-300 border-sky-400/50 hover:bg-sky-500/10'
                }`}
              ><Waves size={14} /> Sea Level Rise</button>
            )}
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
            const v = (peak / 4) * i, yy = Y(v);
            return (
              <g key={i}>
                <line x1={P.l} y1={yy} x2={W - P.r} y2={yy} stroke="rgba(148,163,184,.16)" strokeWidth="1" />
                <text x={P.l - 8} y={yy + 3.5} textAnchor="end" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">
                  {money(v)}
                </text>
              </g>
            );
          })}

          {/* ---- Sea Level Rise: the NEM cliff ---- */}
          {seaLevel && cliff && (
            <g>
              <rect
                x={X(cliff.year - 1)} y={P.t}
                width={Math.max(0, X(HORIZON - 1) - X(cliff.year - 1))} height={H - P.t - P.b}
                fill="rgba(56,189,248,.10)"
              />
              <line x1={X(cliff.year - 1)} y1={P.t} x2={X(cliff.year - 1)} y2={H - P.b}
                    stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
              <text x={X(cliff.year - 1) + 6} y={P.t + 11} fill="#38bdf8" fontSize="10.5"
                    fontFamily="monospace" fontWeight="bold">
                NEM ends {cliff.calendarYear}
              </text>
            </g>
          )}

          {showBattery ? (
            <>
              {/* stacked cost of the battery path */}
              {BANDS.map((b) => (
                <path key={b.key} d={bandFor(b.lo, b.hi)} fill={b.color} fillOpacity=".38" stroke={b.color}
                      strokeWidth="1" strokeOpacity=".6" />
              ))}
              {/* the alternative, for comparison */}
              <path d={lineFor((r) => r[`utility${field}`])} fill="none" stroke="#ef4444"
                    strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />
              {proj.breakEvenYear && (
                <>
                  <line x1={X(proj.breakEvenYear - 1)} y1={P.t} x2={X(proj.breakEvenYear - 1)} y2={H - P.b}
                        stroke="#facc15" strokeWidth="2.5" strokeDasharray="7 5" />
                  <text x={X(proj.breakEvenYear - 1) + 6} y={H - P.b - 6} fill="#facc15" fontSize="11"
                        fontFamily="monospace" fontWeight="bold">
                    break even · yr {proj.breakEvenYear}
                  </text>
                </>
              )}
            </>
          ) : (
            <>
              <path d={bandFor(() => 0, (r) => toView(r.utilityFeeMonthly))}
                    fill="#64748b" fillOpacity=".38" stroke="#64748b" strokeWidth="1" strokeOpacity=".6" />
              <path d={bandFor((r) => toView(r.utilityFeeMonthly), (r) => r[`utility${field}`])}
                    fill="#ef4444" fillOpacity=".24" stroke="#ef4444" strokeWidth="1" strokeOpacity=".5" />
              <path d={lineFor((r) => r[`utility${field}`])} fill="none" stroke="#ef4444"
                    strokeWidth="2.5" strokeLinejoin="round" />
            </>
          )}

          {/* ---- slider marker + the small band readouts ---- */}
          <line x1={markerX} y1={P.t} x2={markerX} y2={H - P.b} stroke="#e2e8f0" strokeWidth="1" opacity=".55" />

          {showBattery ? (
            <>
              {BANDS.map((b) => {
                const lo = b.lo(at), hi2 = b.hi(at);
                const v = b.valueAt(at);
                if (v <= 0) return null;
                const midY = (Y(lo) + Y(hi2)) / 2;
                return (
                  <g key={b.key}>
                    <circle cx={markerX} cy={Y(hi2)} r="3" fill={b.color} stroke="#0f172a" strokeWidth="1" />
                    <text x={markerX + 7} y={midY + 3} fill={b.color} fontSize="9.5" fontFamily="monospace">
                      {money2(v)}{unit}
                    </text>
                  </g>
                );
              })}
              <circle cx={markerX} cy={Y(utilVal)} r="3.5" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" />
              <text x={markerX + 7} y={Y(utilVal) - 6} fill="#ef4444" fontSize="9.5" fontFamily="monospace">
                {money2(utilVal)}{unit} without
              </text>
            </>
          ) : (
            <>
              <circle cx={markerX} cy={Y(toView(at.utilityFeeMonthly))} r="3" fill="#64748b"
                      stroke="#0f172a" strokeWidth="1" />
              <text x={markerX + 7} y={(Y(0) + Y(toView(at.utilityFeeMonthly))) / 2 + 3}
                    fill="#94a3b8" fontSize="9.5" fontFamily="monospace">
                {money2(toView(at.utilityFeeMonthly))}{unit}
              </text>
              <circle cx={markerX} cy={Y(utilVal)} r="3.5" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" />
              <text x={markerX + 7} y={(Y(toView(at.utilityFeeMonthly)) + Y(utilVal)) / 2 + 3}
                    fill="#fca5a5" fontSize="9.5" fontFamily="monospace">
                {money2(toView(at.utilityEnergyMonthly))}{unit}
              </text>
            </>
          )}

          {rows.filter((_, i) => i % 2 === 0).map((r, k) => (
            <text key={r.year} x={X(k * 2)} y={H - 8} textAnchor="middle" fill="#94a3b8"
                  fontSize="10.5" fontFamily="monospace">{r.year}</text>
          ))}
        </svg>

        <input
          type="range" min={1} max={HORIZON} step={1} value={sliderYear}
          onChange={(e) => setSliderYear(Number(e.target.value))}
          className="w-full accent-cyan-400 mt-2"
        />

        {/* legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px]">
          {(showBattery ? BANDS : [
            { key: 'fee', label: 'Connection fee', color: '#64748b' },
            { key: 'energy', label: 'Utility energy', color: '#ef4444' }
          ]).map((b) => (
            <span key={b.key} className="flex items-center gap-1.5 text-slate-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: b.color, opacity: 0.6 }} />
              {b.label}
            </span>
          ))}
          {showBattery && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#ef4444' }} />
              Staying with the utility
            </span>
          )}
        </div>

        {/* ---- readouts at the slider year ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700 border border-slate-700 rounded-xl overflow-hidden mt-4">
          <Stat label={`Utility, year ${at.year}`} value={money2(utilVal) + unit} sub="if nothing changes" cls="text-red-300" />
          <Stat label="Paid to the utility" value={money(at.cumUtility)} sub={`cumulative through year ${at.year}`} cls="text-red-300" />
          {showBattery ? (
            <>
              <Stat label={`With battery, year ${at.year}`} value={money2(battVal) + unit}
                    sub={at.loanActive ? 'includes the payment' : 'loan paid off'} cls="text-cyan-300" />
              <Stat label="Net position" value={money(netPosition)}
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

        {seaLevel && cliff && (
          <p className="text-[12px] text-sky-200/90 mt-3 bg-sky-500/10 border border-sky-400/30 rounded-lg p-3">
            <b>When the tide comes in.</b> NEM {inputs.nemVersion === 'NEM1' ? '1.0' : '2.0'} grandfathering runs out
            in {cliff.calendarYear} (year {cliff.year}){cliff.anchor === 'install' ? ', estimated from the install date' : ''}.
            After that, the {cliff.exportKwh.toLocaleString()} kWh a year currently exported reprices from{' '}
            {money2(cliff.currentCredit)}/kWh to about {money2(cliff.successorCredit)}/kWh — roughly{' '}
            <b className="text-sky-100">{money(cliff.annual)} a year</b>, or {money2(cliff.monthlyAdder)} a month,
            that appears on the bill and never comes off it. A battery does not stop the tariff change; it removes
            the exposure, because stored energy gets used at home instead of sold at avoided cost.
          </p>
        )}

        {showBattery && (
          <p className="text-[12px] text-slate-400 mt-3">
            Over {HORIZON} years: <span className="font-mono text-red-300">{money(proj.totalUtility)}</span> staying
            with the utility versus <span className="font-mono text-cyan-300">{money(proj.totalBattery)}</span> with
            storage{rebateCash > 0 ? <> plus <span className="font-mono text-amber-300">{money(rebateCash)}</span> back in your pocket</> : null}
            {' — '}a lifetime difference of <span className="font-mono text-emerald-300">{money(proj.lifetimeSavings)}</span>.
            {activeTerm > 0 && activeTerm < HORIZON && (
              <> The payment ends after year {activeTerm}; everything after that is savings with no payment against it.</>
            )}
          </p>
        )}
      </div>

      {/* ================= 4. THE PAYMENT (below the graph) ================= */}
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
                  ? `${termYears}-year term · fixed${lender && !lender.prepaymentPenalty ? ' · no prepayment penalty' : ''}`
                  : `${termYears}-year lease · ${escalator}% escalator`}
              </p>

              {mode === 'loan' && (
                <div className="flex flex-wrap gap-3 mt-4">
                  {lenders.length > 1 && (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Lender</label>
                      <select value={lenderId || ''}
                        onChange={(e) => {
                          const next = lenders.find((l) => l.id === e.target.value);
                          setLenderId(e.target.value);
                          if (next && next.defaultTermYears) setTermYears(next.defaultTermYears);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm">
                        {lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Term</label>
                    <select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm">
                      {termOptions.map((t) => <option key={t.years} value={t.years}>{t.years} years</option>)}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-5 min-w-[280px]">
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

      {/* ================= 5. ASSUMPTIONS ================= */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
        <h4 className="text-[15px] font-semibold text-slate-100 mb-1">The numbers behind the graph</h4>
        <p className="text-[11.5px] text-slate-500 mb-4">
          Estimated savings come from the hour-by-hour dispatch model on this tab — the rate arbitrage a battery
          recovers, plus the share of true-up it avoids. Override it when you have their paper bill in hand.
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
                {(A.leaseEscalatorOptions || [0]).map((e) => <option key={e} value={e}>{e}%</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ================= 6. BREAKDOWN ================= */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 overflow-hidden">
        <button onClick={() => setShowBreakdown((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
          <span className="text-[15px] font-semibold text-slate-200">Breakdown</span>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
        </button>

        {showBreakdown && (
          <div className="p-5 pt-0 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h5 className="text-[13px] font-semibold text-slate-300 mb-2">Price stack</h5>
                <dl className="font-mono text-[13px] space-y-1">
                  <Row label="Contract value" value={money(price.base)} />
                  {price.adders.lines.map((l) => (
                    <Row key={l.id} label={l.label + (l.units ? ` (${l.units})` : '')}
                         value={l.pending ? 'price TBD' : '+ ' + money(l.cost)}
                         tone={l.pending ? 'muted' : undefined} />
                  ))}
                  {price.adders.total > 0 && <Row label="Contract with adders" value={money(price.contract)} strong />}
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

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contract value ($)" value={contractValue} onChange={setContractValue} />
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Term</label>
                    <select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-600 text-slate-100 text-sm">
                      {termOptions.map((t) => <option key={t.years} value={t.years}>{t.years} years</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Federal deduction</span>
                    <span className="font-mono text-slate-200">{Math.round(fedPct * 100)}%</span>
                  </div>
                  <input type="range" min={A.fedPctMin * 100} max={A.fedPctMax * 100} step={1}
                    value={Math.round(fedPct * 100)}
                    onChange={(e) => setFedPct(Number(e.target.value) / 100)}
                    className="w-full accent-emerald-400" />
                </div>

                <div>
                  <h5 className="text-[13px] font-semibold text-slate-300 mb-2">Adders</h5>
                  <div className="space-y-2">
                    {settings.adders.map((a) => {
                      const sel = adderSel[a.id] || { on: false };
                      const panelPriced = a.id === 'solar_add' && settings.panels.some((p) => p.active !== false && p.pricePerPanel > 0);
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
                            <div className="flex flex-wrap gap-2 mt-2 pl-6">
                              {a.id === 'solar_add' && panelPriced && (
                                <select value={sel.panelId || ''}
                                  onChange={(e) => {
                                    const p = settings.panels.find((x) => x.id === e.target.value);
                                    setAdder(a.id, { panelId: e.target.value, amount: p ? p.pricePerPanel : undefined });
                                  }}
                                  className="px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12px]">
                                  <option value="">Choose panel…</option>
                                  {settings.panels.filter((p) => p.active !== false).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.make} {p.model} · {money(p.pricePerPanel)}/panel
                                    </option>
                                  ))}
                                </select>
                              )}
                              <input type="number" placeholder={a.unit} value={sel.units ?? ''}
                                onChange={(e) => setAdder(a.id, { units: e.target.value })}
                                className="w-[86px] px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 font-mono text-[12px]" />
                              {!a.amount && !panelPriced && (
                                <input type="number" placeholder={`$ per ${String(a.unit || 'unit').replace(/s$/, '')}`}
                                  value={sel.amount ?? ''}
                                  onChange={(e) => setAdder(a.id, { amount: e.target.value })}
                                  className="w-[150px] px-2 py-1 rounded bg-slate-900/70 border border-amber-500/50 text-slate-100 font-mono text-[12px]" />
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
                  <p className="text-[10.5px] text-slate-500 mt-2">
                    Adder prices, lenders and panel pricing are editable in Admin → Platform Defaults.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border-t border-slate-700 pt-4">
              <table className="w-full font-mono text-[12px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    {['Year', 'Fee', 'Utility energy', 'Payment', 'With battery', 'Without', 'Net position'].map((h, i) => (
                      <th key={h} className={`font-sans font-medium text-[11.5px] pb-2 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year}
                        className={`border-b border-slate-800 ${r.year === proj.breakEvenYear ? 'text-amber-300' : ''}`}>
                      <td className="text-left text-slate-400 py-1">
                        {r.year}
                        {r.year === proj.breakEvenYear ? ' · break even' : ''}
                        {seaLevel && cliff && r.year === cliff.year ? ' · NEM ends' : ''}
                      </td>
                      <td className="text-right text-slate-400">{money2(r.connectionFeeMonthly)}</td>
                      <td className="text-right text-amber-300/80">{money2(r.energyMonthly)}</td>
                      <td className="text-right text-slate-400">{r.loanMonthly ? money2(r.loanMonthly) : '—'}</td>
                      <td className="text-right text-cyan-300/90">{money2(r.batteryMonthly)}</td>
                      <td className="text-right text-red-300/90">{money2(r.utilityMonthly)}</td>
                      <td className={`text-right ${r.netPosition >= 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
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

const Override = ({ label, suffix, derived, value, onChange }) => (
  <div>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input type="number" value={value === null ? derived : value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 rounded-lg bg-slate-900/70 border text-slate-100 font-mono text-sm ${
        value === null ? 'border-slate-600' : 'border-amber-500/60'
      }`} />
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
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 font-mono text-sm" />
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
