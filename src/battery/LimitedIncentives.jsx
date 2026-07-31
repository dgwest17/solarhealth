import React, { useState } from 'react';
import { Clock, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * "Limited Incentives" — a simple scarcity + qualification timeline shown right
 * above Battery Economics. Programs like SDCP's upfront rebate have capped
 * funding and enrollment windows; this frames the urgency honestly (you have
 * to qualify) and lays out the steps, in the spirit of Kinobi's timeline.
 *
 * Steps are editable — adjust copy/timing to match the live program.
 */
const STEPS = [
  {
    label: 'Check eligibility',
    detail: 'Confirm your utility, rate plan, and battery qualify for the program. Not every home does — SDCP, SMUD, and similar programs have specific requirements.',
    timing: 'Day 1'
  },
  {
    label: 'Reserve your funds',
    detail: 'Programs are first-come, first-served against a capped budget. Reserving early holds your incentive before the allocation runs out.',
    timing: 'Days 1–3'
  },
  {
    label: 'Enroll & install',
    detail: 'Complete enrollment (SDCP requires a multi-year commitment) and schedule installation. Your upfront rebate is tied to finishing this step.',
    timing: 'Weeks 2–6'
  },
  {
    label: 'Start earning',
    detail: 'Once live, you collect the upfront rebate plus the ongoing per-kWh dispatch incentive on every qualifying event.',
    timing: 'After install'
  }
];

const LimitedIncentives = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-emerald-400/40 bg-gradient-to-br from-emerald-900/25 to-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-sm text-emerald-200">⏳ Limited Incentives — reserve before they run out</span>
            <span className="block text-[11px] text-emerald-300/70 truncate">Capped funding · you have to qualify · first-come, first-served</span>
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-emerald-300/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-amber-900/20 border border-amber-400/30 px-3 py-2 mb-4 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-amber-200/90 leading-relaxed">
              These programs are funded from a fixed pool that shrinks as homes enroll. Qualification isn’t
              guaranteed, and once the budget is committed the incentive closes — sometimes mid-cycle.
            </p>
          </div>

          {/* Timeline */}
          <ol className="relative border-l border-emerald-400/25 ml-1.5 space-y-4">
            {STEPS.map((s, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-[7px] flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/50">
                  <CheckCircle2 size={10} className="text-emerald-300" />
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-100">{s.label}</span>
                  <span className="text-[10px] text-emerald-300/70 font-medium shrink-0 flex items-center gap-1">
                    <Clock size={10} /> {s.timing}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-400 leading-relaxed mt-0.5">{s.detail}</p>
              </li>
            ))}
          </ol>

          <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
            Program terms, funding levels, and eligibility change frequently — confirm current availability
            for this client’s utility before promising an incentive.
          </p>
        </div>
      )}
    </div>
  );
};

export default LimitedIncentives;
