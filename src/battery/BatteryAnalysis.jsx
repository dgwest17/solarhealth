/**
 * FILE: src/battery/BatteryAnalysis.jsx
 *
 * STORAGE — the battery story, told in order.
 *
 * Owns the shared math for every section below and presents them as a
 * sequence rather than a stack.
 *
 * ---------------------------------------------------------------------------
 * WHY A SEQUENCE AND NOT ACCORDIONS
 *
 * This screen is used in front of a customer. As a stack of eight accordions
 * it had two failure modes, and the second is the expensive one:
 *
 *   The rep hunted. Opening and closing sections mid-appointment, scrolling
 *   past the part they already covered to find the part they had not.
 *
 *   The order was invisible. An accordion stack says "here are eight topics";
 *   it does not say "this one follows from that one". The argument these
 *   sections make only works in order — you cannot explain why time-of-use
 *   matters before establishing that the house exports at noon and imports at
 *   seven. A customer who reads them in the wrong order gets facts and no case.
 *
 * So: tabs across the top, one panel at a time, numbered, with Back/Next at
 * the bottom. The numbering is the point — it is the difference between a
 * reference screen and a presentation.
 *
 * NOTHING ABOUT THE CONTENT CHANGED. Every section renders the same component
 * with the same props it had as an accordion. The only content that moved is
 * the NEM grandfathering countdown, which now sits under Net Metering where
 * the customer is already thinking about net metering, instead of floating
 * between two unrelated sections.
 *
 * ---------------------------------------------------------------------------
 * WHAT STAYS OUTSIDE THE TABS
 *
 * The measured-data banner. It governs `exportKwh` / `importKwh`, which three
 * different slides read, so hiding it inside one of them would mean a rep
 * changing the basis of slides 3, 4 and 5 from inside slide 1 with no sign of
 * it anywhere else.
 *
 * Rendered by: src/SolarCalculator.jsx (activeTab === 'battery')
 */
import React, { useState, useEffect, useRef } from 'react';
import { Battery, ChevronLeft, ChevronRight } from 'lucide-react';
import { buildOverlayWithAddedLoad, calculateTotalRecoveredValue } from './BatteryModel';
import { TOU_RATES } from '../utils/rateData';
import { calculateNEMImpact, getUtilityRate } from '../utils/calculations';
import BatteryConsumptionProduction from './BatteryConsumptionProduction';
import BatteryEnergyLoss from './BatteryEnergyLoss';
import BatteryExportInefficiencies from './BatteryExportInefficiencies';
import BatteryRecovery from './BatteryRecovery';
import BatteryStabilization from './BatteryStabilization';
import BatteryDispatchPanel from './BatteryDispatchPanel';
import LimitedIncentives from './LimitedIncentives';
import NemCountdown from './NemCountdown';
import Nem3ValuePanel from './Nem3ValuePanel';

/**
 * The story, in the order it has to be told.
 *
 * `accent` keeps each slide's heading the colour its accordion had, so a rep
 * who knew the old screen still recognises the section.
 */
const SLIDES = [
  { id: 'usage',     label: 'Consumption vs Production',
    title: 'Consumption vs Production',
    subtitle: 'Your energy through a typical day', accent: 'amber' },
  { id: 'nem',       label: 'Net Metering',
    title: 'Net Metering — where the energy is lost',
    subtitle: 'How NEM credits your exports, and how long yours lasts', accent: 'amber' },
  { id: 'tou',       label: 'Time of Use Changes',
    title: 'Time of Use is changing (not for the better)',
    subtitle: 'What you give up exporting instead of storing', accent: 'amber' },
  { id: 'spiral',    label: 'Utility Death Spiral',
    title: 'The Utility Death Spiral',
    subtitle: 'Why the grid squeeze costs you more every year', accent: 'emerald' },
  { id: 'economics', label: 'Economics',
    title: 'The economics of a battery',
    subtitle: 'Hour-by-hour dispatch, hardware and rate comparison', accent: 'purple' },
  { id: 'timeline',  label: 'Timeline',
    title: 'Timeline — the money on the table',
    subtitle: 'Funding runs out; the incentives do not wait', accent: 'amber' },
  { id: 'home',      label: 'Your Home',
    title: 'Your home',
    subtitle: 'What this looks like on your roof, and on your bill', accent: 'cyan' }
];

const ACCENT_TEXT = {
  amber: 'text-amber-300', cyan: 'text-cyan-300',
  emerald: 'text-emerald-300', purple: 'text-purple-300'
};
const ACCENT_RING = {
  amber: 'border-amber-400/25', cyan: 'border-cyan-400/25',
  emerald: 'border-emerald-400/25', purple: 'border-purple-400/25'
};
const ACCENT_BG = {
  amber: 'bg-amber-400', cyan: 'bg-cyan-400',
  emerald: 'bg-emerald-400', purple: 'bg-purple-400'
};

/**
 * One panel of the presentation.
 *
 * Always open. It is the only thing on screen, so a collapse control would do
 * nothing but let a rep hide the slide they just navigated to.
 */
const Slide = ({ title, subtitle, accent = 'amber', index, total, children }) => (
  <div className={`rounded-xl border ${ACCENT_RING[accent] || ACCENT_RING.amber} bg-slate-900/30 overflow-hidden`}>
    <div className="px-4 py-3 border-b border-slate-700/50 flex items-baseline gap-2.5">
      <span className="text-[11px] font-mono text-slate-500 shrink-0">
        {index + 1}/{total}
      </span>
      <span className="min-w-0">
        <span className={`block font-bold text-sm ${ACCENT_TEXT[accent] || ACCENT_TEXT.amber}`}>
          {title}
        </span>
        {subtitle && <span className="block text-[11px] text-slate-400">{subtitle}</span>}
      </span>
    </div>
    <div className="px-4 pb-4 pt-4">{children}</div>
  </div>
);

const BatteryAnalysis = ({
  /** Verdict from the Eligibility tab; drives the rebate Auto in Stabilize. */
  eligibility = null,
  /**
   * Which slide the deck opens on, by index.
   *
   * A prop rather than internal-only state for one reason: a deck whose
   * position can only be reached by clicking cannot be tested. Rendering slide
   * one and calling the whole deck checked is how a broken panel ships — and it
   * nearly did here. The first version of the render harness reached slide 7 by
   * stubbing React.useState, which this file's destructured `useState` import
   * ignores, so all seven cases silently rendered slide one and all seven
   * passed with byte-identical output.
   *
   * Nothing in the app passes it today; scripts/render-check.mjs does.
   */
  initialSlide = 0,
inputs, nemImpact: nemImpactProp = null, extraUsage = null, measured = null , consumptionProfile = null, onConsumptionProfileChange = null, calculations = null, rateOverride = null, onRateOverrideChange = null, clientContext = null, clientLabel = '' }) => {
  const [profileKeyInternal, setProfileKeyInternal] = useState('evening_heavy');
  const profileKey = consumptionProfile || profileKeyInternal;
  const setProfileKey = (k) => { setProfileKeyInternal(k); if (onConsumptionProfileChange) onConsumptionProfileChange(k); };

  /**
   * Which slide is showing.
   *
   * Local, not lifted. A rep's position in the presentation is not a fact
   * about the client, and persisting it would mean reopening a client onto
   * whatever slide somebody happened to leave it on.
   */
  const [slide, setSlide] = useState(
    Math.max(0, Math.min(SLIDES.length - 1, Number(initialSlide) || 0))
  );
  const topRef = useRef(null);
  const current = SLIDES[slide] || SLIDES[0];

  /**
   * Scroll to the top of the deck on every move.
   *
   * Without this, moving from a long slide to a short one leaves the viewport
   * halfway down a panel that has already ended — in front of a customer it
   * looks like the tool broke. Skipped on first render so opening the tab does
   * not yank the page.
   */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (topRef.current && topRef.current.scrollIntoView) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [slide]);

  // AUTHORITATIVE true-up / annual-check — from full annual usage vs production
  // at the real utility rate. Prefer the value computed by the audit tool
  // (passed in) so both tools ALWAYS agree; fall back to computing it here
  // (e.g. sandbox mode) using the same function the audit uses.
  const nemImpact = nemImpactProp || calculateNEMImpact(
    inputs.annualProduction,
    inputs.currentAnnualUsage,
    getUtilityRate(inputs.nowYear || new Date().getFullYear(), inputs.utility, inputs.onCareProgram),
    inputs.nemVersion,
    inputs.exportRate
  );
  // Normalized: positive owe = true-up, positive credit = utility pays them.
  const annualTrueUp = nemImpact.type === 'trueup' ? nemImpact.amount : 0;
  const annualCheck = nemImpact.type === 'credit' ? nemImpact.amount : 0;
  const owesUtility = nemImpact.type === 'trueup';

  // The overlay carries the planned load from the Load Simulator as a second
  // series. The client's real curve is never rewritten — the projection sits
  // over it, so every section below can show base and added separately.
  const addedKwh = (extraUsage && Number(extraUsage.addedKwh)) || 0;
  const addedDaytimePct = (extraUsage && Number(extraUsage.daytimePct)) || 40;
  const overlay = buildOverlayWithAddedLoad(
    profileKey,
    inputs.currentAnnualUsage,
    inputs.annualProduction,
    addedKwh,
    addedDaytimePct
  );

  // Shared export/import figures — lifted here so Time of Use Changes and the
  // Utility Death Spiral always compute from the SAME numbers. Default to the
  // overlay; the manual toggle updates these for both slides.
  const [manualMode, setManualMode] = useState(false);
  const [exportKwh, setExportKwh] = useState(overlay.annualDaytimeOverproduction);
  const [importKwh, setImportKwh] = useState(overlay.annualNighttimeImport);

  // When the profile changes (and not in manual mode), follow the overlay.
  useEffect(() => {
    if (!manualMode) {
      setExportKwh(overlay.annualDaytimeOverproduction);
      setImportKwh(overlay.annualNighttimeImport);
    }
  }, [overlay.annualDaytimeOverproduction, overlay.annualNighttimeImport, manualMode]);

  // MEASURED DATA: when a Green Button profile has been applied, its real
  // annual import/export replace the overlay estimates. Manual mode is
  // switched on so both slides run off the measured numbers.
  const [useMeasured, setUseMeasured] = useState(false);
  useEffect(() => {
    if (measured && measured.ok) {
      setUseMeasured(true);
      setManualMode(true);
      setExportKwh(measured.annualExportKwh);
      setImportKwh(measured.annualImportKwh);
    } else {
      setUseMeasured(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  const toggleMeasured = (checked) => {
    setUseMeasured(checked);
    if (checked && measured && measured.ok) {
      setManualMode(true);
      setExportKwh(measured.annualExportKwh);
      setImportKwh(measured.annualImportKwh);
    } else {
      // Hand control back to the consumption-profile overlay / manual sliders.
      setManualMode(false);
    }
  };

  const effExport = manualMode ? (Number(exportKwh) || 0) : overlay.annualDaytimeOverproduction;
  const effImport = manualMode ? (Number(importKwh) || 0) : overlay.annualNighttimeImport;

  // THE SAME TWO FIGURES, WITH THE PLANNED LOAD ON TOP.
  //
  // Derived as a DELTA rather than read from the overlay's own with-added
  // fields, because those are only right in overlay mode. In manual mode the
  // rep has typed the figures, and with a Green Button upload they are
  // measured — in both cases they describe the house as it is TODAY, so a
  // planned EV still has to be layered onto them. The delta (surplus the load
  // eats, import it adds) is a property of the load's shape and applies to
  // whichever baseline is in force.
  //
  // Computed once here and passed down, because the previous attempt let each
  // section work it out for itself and one of them silently got the base
  // figures back — the cost-of-doing-nothing delta came out as exactly zero
  // on every client.
  const addedImportKwh = overlay.importAddedByLoad || 0;
  const addedSurplusLostKwh = overlay.surplusLostToAddedLoad || 0;
  const effExportWithAdded = Math.max(0, effExport - addedSurplusLostKwh);
  const effImportWithAdded = effImport + addedImportKwh;

  // Energy Credits Recovered / year — the overlay-driven time-shift value (the
  // rate-arbitrage spread a battery claws back). Kept exactly as designed.
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  // Single source of truth — the consultation report calls this same function,
  // so the two can't drift apart (they did: the report was omitting the
  // avoided-true-up half entirely).
  const recovery = calculateTotalRecoveredValue(
    touRates,
    effExport,
    effImport,
    inputs.batteryCapacity,
    inputs.batteryEfficiency,
    inputs.utility,
    annualTrueUp
  );
  const arbitrageRecovered = recovery.arbitrageRecovered;
  const avoidedTrueUp = recovery.avoidedTrueUp;
  const totalRecoveredPerYear = recovery.totalRecoveredPerYear;

  const go = (n) => setSlide(Math.max(0, Math.min(SLIDES.length - 1, n)));

  return (
    <div ref={topRef}>
      {measured && measured.ok && (
        <div className={`mb-4 rounded-xl border-2 p-4 flex items-start justify-between gap-3 ${
          useMeasured ? 'bg-emerald-500/10 border-emerald-400/50' : 'bg-slate-800/60 border-slate-600/60'
        }`}>
          <div>
            <div className={`font-semibold text-sm flex items-center gap-2 ${useMeasured ? 'text-emerald-300' : 'text-slate-300'}`}>
              📊 {useMeasured ? 'Consumption Profile Overridden by Data Upload' : 'Measured data available (not applied)'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {useMeasured
                ? `Import/export figures use the client's measured Green Button data (${measured.annualImportKwh.toLocaleString()} kWh in · ${measured.annualExportKwh.toLocaleString()} kWh out, annualized from ${measured.days} days). Uncheck to adjust the consumption/production profile manually.`
                : 'Check to use the uploaded Green Button figures instead of the modeled profile.'}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={useMeasured}
              onChange={(e) => toggleMeasured(e.target.checked)}
              className="w-4 h-4 accent-emerald-400"
            />
            <span className="text-xs text-slate-300">Use measured data</span>
          </label>
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 flex items-center gap-2">
          <Battery size={30} className="text-amber-400" />
          Storage
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          See how your system behaves over a day — and what a battery would recover.
        </p>
      </div>

      {/* ------------------------------- the tabs -------------------------------
          Horizontally scrollable rather than wrapped. Seven labels wrap to
          three ragged rows on a laptop, and a rep cannot tell at a glance
          where they are in a shape that keeps changing height. */}
      <div className="mb-1 overflow-x-auto rounded-2xl p-1.5 bg-slate-950/60 border border-aqua-400/15 backdrop-blur-md">
        <div className="flex gap-1 min-w-max">
          {SLIDES.map((s, i) => {
            const active = i === slide;
            return (
              <button
                key={s.id}
                onClick={() => go(i)}
                className={`px-3 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-slate-800 text-white border border-slate-600'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className={`text-[10px] font-mono ${active ? 'text-amber-400' : 'text-slate-600'}`}>
                  {i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* How far through the story we are. One bar beats seven dots: it reads
          as progress rather than as another set of controls to click. */}
      <div className="h-[3px] rounded-full bg-slate-800 mb-5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${ACCENT_BG[current.accent] || ACCENT_BG.amber}`}
          style={{ width: `${((slide + 1) / SLIDES.length) * 100}%` }}
        />
      </div>

      {/* ------------------------------- the deck ------------------------------ */}
      <Slide {...current} index={slide} total={SLIDES.length}>
        {current.id === 'usage' && (
          <BatteryConsumptionProduction
            inputs={inputs}
            profileKey={profileKey}
            setProfileKey={setProfileKey}
            overlay={overlay}
            extraUsage={extraUsage}
          />
        )}

        {/* NET METERING — how exports get credited, and how long this client's
            version of that deal has left to run. The countdown lived between
            two unrelated sections before; it belongs to this subject. */}
        {current.id === 'nem' && (
          <>
            <BatteryEnergyLoss />
            {/* NEM 1.0/2.0 get the grandfathering countdown. NEM 3.0 clients
                have nothing to count down — they are already on the successor
                tariff — so they get the forward-looking value story instead. */}
            <div className="mt-5">
              <NemCountdown nemExpiry={calculations && calculations.nemExpiry} nemVersion={inputs.nemVersion} />
              <Nem3ValuePanel inputs={inputs} calculations={calculations} />
            </div>
          </>
        )}

        {current.id === 'tou' && (
          <BatteryExportInefficiencies
            inputs={inputs}
            overlay={overlay}
            manualMode={manualMode}
            setManualMode={setManualMode}
            exportKwh={exportKwh}
            setExportKwh={setExportKwh}
            importKwh={importKwh}
            setImportKwh={setImportKwh}
            effExport={effExport}
            effImport={effImport}
            annualTrueUp={annualTrueUp}
            annualCheck={annualCheck}
            owesUtility={owesUtility}
            extraUsage={extraUsage}
          />
        )}

        {current.id === 'spiral' && (
          <BatteryRecovery
            inputs={inputs}
            overlay={overlay}
            effExport={effExport}
            effImport={effImport}
            effExportWithAdded={effExportWithAdded}
            effImportWithAdded={effImportWithAdded}
            annualTrueUp={annualTrueUp}
            annualCheck={annualCheck}
            owesUtility={owesUtility}
            avoidedTrueUp={avoidedTrueUp}
            arbitrageRecovered={arbitrageRecovered}
            totalRecoveredPerYear={totalRecoveredPerYear}
            extraUsage={extraUsage}
          />
        )}

        {current.id === 'economics' && (
          <BatteryDispatchPanel
            inputs={inputs}
            calculations={calculations}
            extraUsage={extraUsage}
            rateOverride={rateOverride}
            onRateOverrideChange={onRateOverrideChange}
          />
        )}

        {current.id === 'timeline' && <LimitedIncentives />}

        {current.id === 'home' && (
          <BatteryStabilization
            eligibility={eligibility}
            recoveredValuePerYear={totalRecoveredPerYear}
            overlay={overlay}
            inputs={inputs}
            annualTrueUp={annualTrueUp}
            calculations={calculations}
            annualExportKwh={effExport}
            clientContext={clientContext}
            clientLabel={clientLabel}
          />
        )}
      </Slide>

      {/* ------------------------------ back / next -----------------------------
          The presentation control. Named rather than arrows alone, because the
          next slide's title is the sentence the rep is about to say. */}
      <div className="flex items-stretch justify-between gap-3 mt-4">
        <button
          onClick={() => go(slide - 1)}
          disabled={slide === 0}
          className="px-4 py-2.5 rounded-lg border border-slate-700 text-left text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:hover:border-slate-700 flex items-center gap-2 min-w-0"
        >
          <ChevronLeft size={16} className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">Back</span>
            <span className="block text-[12.5px] font-semibold truncate">
              {slide > 0 ? SLIDES[slide - 1].label : '—'}
            </span>
          </span>
        </button>
        <button
          onClick={() => go(slide + 1)}
          disabled={slide === SLIDES.length - 1}
          className="px-4 py-2.5 rounded-lg border border-amber-400/40 text-right text-amber-200 hover:border-amber-400 disabled:opacity-30 disabled:hover:border-amber-400/40 flex items-center gap-2 min-w-0"
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">Next</span>
            <span className="block text-[12.5px] font-semibold truncate">
              {slide < SLIDES.length - 1 ? SLIDES[slide + 1].label : '—'}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0" />
        </button>
      </div>
    </div>
  );
};

export default BatteryAnalysis;
