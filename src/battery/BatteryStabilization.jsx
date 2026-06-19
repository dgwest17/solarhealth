import React, { useState } from 'react';
import {
  ChevronDown, Zap, ShieldCheck, Home, RefreshCw, Sparkles, Check
} from 'lucide-react';
import { estimateBackupHours, calculateStabilization } from './BatteryModel';

/**
 * Section 5 — Battery Stabilization (accordion).
 * Customer-facing closing section. Purchase-option dropdown drives the
 * left-side inputs; a glowing animated battery sits on the right and fills
 * to the configured capacity. VPP toggle unlocks yearly rebates. The bottom
 * "magic" block computes the per-option value story.
 */

const ESCALATOR_OPTIONS = [0, 0.9, 1.9, 2.9, 3.5];

const BatteryStabilization = ({ recoveredValuePerYear, overlay, inputs }) => {
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState('upfront'); // upfront | finance | lease

  // Battery config
  const [kwhPerBattery, setKwhPerBattery] = useState(13.5);
  const [batteryCount, setBatteryCount] = useState(1);

  // Purchase-option inputs
  const [batteryValue, setBatteryValue] = useState(20000);
  const [federalIncentive, setFederalIncentive] = useState(6000);
  const [localRebate, setLocalRebate] = useState(0);
  const [term, setTerm] = useState(144);
  const [monthlyPayment, setMonthlyPayment] = useState(120);
  const [escalator, setEscalator] = useState(2.9);

  // VPP
  const [vppEnabled, setVppEnabled] = useState(false);
  const [vppPerBattery, setVppPerBattery] = useState(250);

  const totalKwh = (Number(kwhPerBattery) || 0) * (Number(batteryCount) || 0);
  const essentialLoadKw = 0.75;
  const backupHours = estimateBackupHours(totalKwh, essentialLoadKw);

  const stab = calculateStabilization(
    option,
    { batteryValue, federalIncentive, localRebate, monthlyPayment },
    recoveredValuePerYear,
    Number(batteryCount) || 1,
    vppEnabled,
    Number(vppPerBattery) || 250
  );

  const money = (v) => `$${Math.round(v).toLocaleString()}`;

  // Battery fill level for the glowing graphic (visual only, caps at 100%)
  const fillPct = Math.min(100, (totalKwh / 40) * 100);

  return (
    <div className="bg-gradient-to-br from-[#0a1628] to-[#13243f] border border-amber-400/40 rounded-xl shadow-2xl mb-6 overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles size={24} className="text-amber-400" />
          <div>
            <h2 className="text-2xl font-bold text-amber-300">Battery Stabilization</h2>
            <p className="text-slate-400 text-sm">Configure a system and see the value unlock</p>
          </div>
        </div>
        <ChevronDown size={24} className={`text-amber-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-6 pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* LEFT: option selector + inputs */}
            <div>
              <label className="block text-xs text-amber-200/80 mb-1 uppercase tracking-wider">Purchase Option</label>
              <select
                value={option}
                onChange={(e) => setOption(e.target.value)}
                className="w-full px-3 py-2.5 border border-amber-400/40 rounded-lg bg-slate-900/70 text-slate-100 mb-4"
              >
                <option value="upfront">Upfront Purchase</option>
                <option value="finance">Finance</option>
                <option value="lease">Lease</option>
              </select>

              {option === 'upfront' && (
                <div className="space-y-3">
                  <Field label="Total Battery Value ($)" value={batteryValue} onChange={setBatteryValue} />
                  <Field label="Available Federal Incentive ($)" value={federalIncentive} onChange={setFederalIncentive} />
                  <Field label="Available Local Rebate ($)" value={localRebate} onChange={setLocalRebate} />
                  <div className="flex justify-between items-center bg-slate-900/50 rounded-lg p-3 border border-amber-400/30">
                    <span className="text-sm text-slate-300">Net Investment</span>
                    <span className="text-xl font-bold text-amber-300">{money(stab.netInvestment)}</span>
                  </div>
                </div>
              )}

              {option === 'finance' && (
                <div className="space-y-3">
                  <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-3 text-sm text-green-200">
                    $0 Down · No Prepayment Penalty
                  </div>
                  <Field label="Term (months)" value={term} onChange={setTerm} />
                  <Field label="Fixed Monthly Payment ($)" value={monthlyPayment} onChange={setMonthlyPayment} />
                </div>
              )}

              {option === 'lease' && (
                <div className="space-y-3">
                  <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-3 text-sm text-green-200">
                    $0 Down · Complete 3rd-Party Warranty Coverage
                  </div>
                  <Field label="Term (months)" value={term} onChange={setTerm} />
                  <Field label="Monthly Payment ($)" value={monthlyPayment} onChange={setMonthlyPayment} />
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Escalator</label>
                    <select
                      value={escalator}
                      onChange={(e) => setEscalator(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100"
                    >
                      {ESCALATOR_OPTIONS.map((e) => <option key={e} value={e}>{e}%</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: glowing battery */}
            <div className="flex flex-col items-center justify-center">
              <svg viewBox="0 0 200 280" className="w-40 h-56">
                <defs>
                  <linearGradient id="battFill" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#86efac" />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* Terminal */}
                <rect x="80" y="10" width="40" height="16" rx="4" fill="#facc15" />
                {/* Body */}
                <rect x="45" y="26" width="110" height="240" rx="14" fill="#0f1e36" stroke="#facc15" strokeWidth="3" filter="url(#glow)" />
                {/* Fill */}
                <rect
                  x="52" y={259 - (226 * fillPct / 100)}
                  width="96" height={226 * fillPct / 100}
                  rx="8" fill="url(#battFill)" filter="url(#glow)"
                >
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="2.5s" repeatCount="indefinite" />
                </rect>
                {/* Bolt */}
                <path d="M105 90 L88 150 L102 150 L95 200 L120 135 L106 135 Z" fill="#0a1628" opacity="0.85" />
                <text x="100" y="250" textAnchor="middle" fill="#0a1628" fontSize="16" fontWeight="bold">{totalKwh}</text>
              </svg>

              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                <Field label="kWh per battery" value={kwhPerBattery} onChange={setKwhPerBattery} small />
                <Field label="# of batteries" value={batteryCount} onChange={setBatteryCount} small />
              </div>

              <div className="w-full mt-3 bg-slate-900/50 rounded-lg p-4 border border-green-400/30 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Total Storage</div>
                <div className="text-2xl font-bold text-green-300">{totalKwh} kWh</div>
                {totalKwh > 0 && (
                  <>
                    <div className="text-sm text-slate-300 mt-2 flex items-center justify-center gap-1">
                      <ShieldCheck size={14} className="text-green-400" />
                      ~{backupHours} hrs essential backup
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Raw estimate at {essentialLoadKw} kW essential load. Real runtime ~90% after round-trip efficiency &amp; reserve.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* VPP toggle */}
          <label className="flex items-center gap-3 cursor-pointer bg-slate-900/50 rounded-lg p-4 border border-amber-400/30 mb-6">
            <input type="checkbox" checked={vppEnabled} onChange={(e) => setVppEnabled(e.target.checked)} className="w-5 h-5 accent-amber-400" />
            <div className="flex-1">
              <div className="text-amber-200 font-semibold text-sm flex items-center gap-2">
                <Zap size={15} /> Enroll in Virtual Power Plant (VPP)
              </div>
              <div className="text-xs text-slate-400">Unlocks a yearly rebate per battery</div>
            </div>
            {vppEnabled && (
              <div className="text-right">
                <input
                  type="range" min="100" max="450" step="10"
                  value={vppPerBattery}
                  onChange={(e) => setVppPerBattery(Number(e.target.value))}
                  className="accent-amber-400"
                />
                <div className="text-amber-300 font-bold text-sm">{money(vppPerBattery)}/battery/yr</div>
                <div className="text-[10px] text-slate-500">*depends on events enrolled</div>
              </div>
            )}
          </label>

          {/* THE MAGIC BLOCK */}
          <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-amber-400 via-green-400 to-amber-400 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-[#0a1628] to-[#102a1a] p-6">
              {/* ARS */}
              <div className="text-center mb-5">
                <div className="text-xs text-amber-200 uppercase tracking-widest flex items-center justify-center gap-2">
                  <Sparkles size={14} /> Annual Recovered Savings
                </div>
                <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-green-300 mt-1">
                  {money(stab.ars)}/yr
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {money(stab.recoveredValuePerYear)} recovered value{stab.vppPerYear > 0 ? ` + ${money(stab.vppPerYear)} VPP` : ''}
                </div>
              </div>

              {/* Per-option payoff */}
              {option === 'upfront' && (
                <div className="text-center bg-green-400/10 border border-green-400/40 rounded-xl p-5">
                  <div className="text-sm text-green-200 uppercase tracking-wider">Return on Investment</div>
                  <div className="text-5xl font-extrabold text-green-300 mt-1">
                    {stab.roiYears ? `${stab.roiYears.toFixed(1)} yrs` : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {money(stab.netInvestment)} net investment ÷ {money(stab.ars)}/yr
                  </div>
                </div>
              )}

              {(option === 'finance' || option === 'lease') && (
                <div className="text-center bg-green-400/10 border border-green-400/40 rounded-xl p-5">
                  {stab.isNetWin ? (
                    <>
                      <div className="text-lg font-bold text-green-300">
                        Your home qualifies for a huge backup addition at a net win to you — for no upfront investment.
                      </div>
                      <div className="text-4xl font-extrabold text-green-300 mt-3">
                        +{money(stab.annualNetWin)}/yr
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        net annual gain ({money(Math.abs(stab.monthlyInvestment))}/mo × 12)
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-extrabold text-amber-300">
                        Only {money(stab.monthlyInvestment)}/month
                      </div>
                      <div className="text-sm text-slate-200 mt-2">
                        to get backup power and fully own your power again.
                      </div>
                      <div className="text-xs text-slate-400 mt-2">
                        {money(stab.monthlyPayment)}/mo payment − {money(stab.mrs)}/mo recovered savings
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Massive checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                <Checkpoint icon={Home} title="Home Independence Unlocked" sub="Take back control from utility monopolies" />
                <Checkpoint icon={ShieldCheck} title="Backup Engaged" sub="Never lose essentials again" />
                <Checkpoint icon={RefreshCw} title="Recover Lost Value" sub="Unlock the full potential of home power" />
                <Checkpoint icon={Zap} title="Reclaim Lost Efficiency" sub="Stabilize the neighborhood grid" />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">
            All estimated savings are based on current values and not guaranteed.
          </p>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, small }) => (
  <div>
    <label className={`block text-xs text-slate-300 mb-1 ${small ? '' : ''}`}>{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100"
    />
  </div>
);

const Checkpoint = ({ icon: Icon, title, sub }) => (
  <div className="flex items-start gap-3 bg-slate-900/40 rounded-lg p-3 border border-green-400/20">
    <div className="w-7 h-7 rounded-full bg-green-400/20 flex items-center justify-center shrink-0">
      <Check size={15} className="text-green-400" />
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
