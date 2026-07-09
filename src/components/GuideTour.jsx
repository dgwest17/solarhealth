import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Compass } from 'lucide-react';

/**
 * First-visit walkthrough for reps/homeowners: what to gather and where
 * it goes. Auto-opens once (localStorage flag), re-openable via the
 * floating "Guide" button. Edit step text freely below.
 */
const STEPS = [
  { title: 'Welcome — 5 things make a great audit', body: 'You\u2019ll need: when the system turned on, the utility & NEM version, system size & production, how the home uses power, and how the system was paid for. Orange \u24d8 icons next to every field explain where to find each answer.' },
  { title: '1 · Install date', body: 'Closest guess to when the system was TURNED ON. The annual true-up statement arrives on the turn-on month — if they know their true-up month, that\u2019s it, and we can estimate the year together.' },
  { title: '2 · Utility & NEM version', body: 'Utility is on the electric bill. NEM version follows the turn-on date: before mid-2016 \u2192 NEM 1.0, mid-2016 to April 2023 \u2192 NEM 2.0, after \u2192 NEM 3.0.' },
  { title: '3 · System size & production', body: 'Size (kW) is on the contract or permit. Production (kWh/yr) is best pulled from the monitoring app — Enphase, SolarEdge, or Tesla — using the last 12 months.' },
  { title: '4 · Usage', body: 'Two numbers: usage BEFORE solar (from the original proposal) and usage NOW. Best practice: upload a Green Button file from the utility website — it sets current usage automatically with real meter data.' },
  { title: '5 · Financing', body: 'Cash, Loan, or PPA/Lease. For loans: amount, rate, term from the agreement. For PPAs: if they only know their current monthly payment, use "I know the current payment" and the contract rate back-calculates.' },
  { title: 'Generate the report', body: 'Fill equipment manufacturers for the warranty schedule, try the Load Simulator for planned EVs or hot tubs, then hit Consultation Report — that\u2019s the leave-behind. Reopen this guide anytime from the Guide button.' }
];

const GuideTour = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem('sh_guide_seen')) setOpen(true);
    } catch (e) { /* private mode */ }
  }, []);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem('sh_guide_seen', '1'); } catch (e) {}
  };

  return (
    <>
      <button
        onClick={() => { setStep(0); setOpen(true); }}
        className="print:hidden fixed bottom-5 right-5 z-40 bg-orange-500 hover:bg-orange-400 text-white rounded-full shadow-2xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2"
        title="Open the audit walkthrough"
      >
        <Compass size={16} /> Guide
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div className="bg-[#0f1e36] border border-orange-400/50 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-widest text-orange-400 font-bold">Audit walkthrough · {step + 1}/{STEPS.length}</span>
              <button onClick={close} className="text-slate-400 hover:text-orange-300"><X size={18} /></button>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">{STEPS[step].title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-5">{STEPS[step].body}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-orange-400' : 'bg-slate-600'}`} />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <button onClick={() => setStep(step - 1)} className="px-3 py-2 rounded-lg text-sm text-slate-300 border border-slate-600 flex items-center gap-1"><ChevronLeft size={14} /> Back</button>
                )}
                {step < STEPS.length - 1 ? (
                  <button onClick={() => setStep(step + 1)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-400 text-white flex items-center gap-1">Next <ChevronRight size={14} /></button>
                ) : (
                  <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-[#0a1628]">Start the audit</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuideTour;
