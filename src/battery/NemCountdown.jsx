/**
 * FILE: src/battery/NemCountdown.jsx
 *
 * NEM grandfathering countdown, styled for the Battery Analysis tab (dark theme).
 * The Audit tab shows the full NEM position card (src/components/NEMStatusCard.jsx);
 * this is the storage-relevant slice of it: how long the client's favorable export
 * rate has left, and why that clock argues for a battery.
 *
 * Data comes from calculations.nemExpiry (see src/utils/calculations.js →
 * calculateNEMExpiry). NEM 3.0 returns null — no countdown to show.
 *
 * Rendered by: src/battery/BatteryAnalysis.jsx
 */
import React from 'react';
import { Clock, ShieldCheck, AlertTriangle } from 'lucide-react';

const NemCountdown = ({ nemExpiry, nemVersion }) => {
  if (!nemExpiry) return null;

  const label = nemVersion === 'NEM1' ? 'NEM 1.0' : 'NEM 2.0';

  if (nemExpiry.expired) {
    return (
      <div className="mb-3 rounded-xl border border-orange-400/40 bg-orange-900/15 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-orange-200">
          <AlertTriangle size={16} className="text-orange-400" />
          Your Grandfather Expiration — {label} ended in {nemExpiry.endYear}
        </div>
        <p className="text-[11.5px] text-slate-300 mt-1.5 leading-relaxed">
          Exports now earn avoided-cost rates instead of near-retail credit, while evening power still
          costs full price. That gap is exactly what storage closes — every kWh self-consumed at peak
          is a kWh you don’t buy back at retail.
        </p>
      </div>
    );
  }

  // Urgency scales as the window closes.
  const urgent = nemExpiry.yearsLeft <= 5;

  return (
    <div className={`mb-3 rounded-xl border p-4 ${urgent
      ? 'border-amber-400/45 bg-amber-900/15'
      : 'border-cyan-400/35 bg-cyan-900/12'}`}>
      <div className={`flex items-center gap-2 text-sm font-bold ${urgent ? 'text-amber-200' : 'text-cyan-200'}`}>
        <Clock size={16} className={urgent ? 'text-amber-400' : 'text-cyan-400'} />
        Your Grandfather Expiration
      </div>

      <div className="flex items-baseline gap-2 mt-1.5">
        <span className={`text-4xl font-extrabold ${urgent ? 'text-amber-300' : 'text-cyan-300'}`}>
          {nemExpiry.yearsLeft}
        </span>
        <span className="text-slate-200 text-sm font-medium">
          more year{nemExpiry.yearsLeft === 1 ? '' : 's'}
          {nemExpiry.monthsRemainder > 0 && `, ${nemExpiry.monthsRemainder} month${nemExpiry.monthsRemainder === 1 ? '' : 's'}`}
        </span>
        <span className="text-[11px] text-slate-400 ml-1">through {nemExpiry.endYear}</span>
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5">Your {label} rate is protected until then.</div>

      <p className="text-[11.5px] text-slate-300 mt-2 leading-relaxed">
        {nemExpiry.anchor === 'pto'
          ? `A 20-year term from your Permission-to-Operate date.`
          : `A 20-year term, estimated from your install date — confirm the exact PTO date for precision.`}
        {' '}When it ends, exported power earns roughly 75% less while evening purchases stay at full
        retail. Your panels don’t change; only what the utility pays you does.
      </p>

      <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-slate-900/50 border border-slate-700/60 px-3 py-2">
        <ShieldCheck size={14} className="text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Adding a battery does <span className="font-semibold text-emerald-300">not</span> shorten this term.
          Storage installed now keeps its full value for all {nemExpiry.yearsLeft} remaining years — and
          softens the drop when the term ends.
        </p>
      </div>
    </div>
  );
};

export default NemCountdown;
