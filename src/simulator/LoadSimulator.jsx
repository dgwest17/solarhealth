import React, { useState, useEffect } from 'react';
import {
  Car, Thermometer, Droplets, Snowflake, Waves, Plug, Plus,
  Zap, TrendingUp, RotateCcw, Home, Sun, Moon, Bath
} from 'lucide-react';
import { TOU_RATES } from '../utils/rateData';
import {
  LOAD_TYPES, totalAddedKwh, getLoadType, blendedDaytimePct, calcExtraUsageCost,
  EV_MODELS, evAnnualKwh, HOTTUB_SIZES, hottubAnnualKwh
, calcExtraUsageCostEvTou
} from './LoadModel';

/**
 * Load Simulator tab.
 *
 * IMPORTANT ARCHITECTURE:
 *  - Baseline usage, baseline production, and the consumption profile are
 *    STATIC. The simulator never mutates them. (Green Button data will one day
 *    populate the profile; it must stay authoritative.)
 *  - The simulator adds EXTRA usage (EV, heat pump, ...) as its own variable,
 *    each with a daytime/nighttime split. Extra load only costs money once
 *    total consumption exceeds production (or immediately if already owing).
 *  - It emits an "Extra Usage True-Up" via onExtraUsageChange so the audit and
 *    battery tabs can show it as a SEPARATE line — never corrupting the real
 *    current true-up/credit.
 *
 * Props:
 *   baseUsage, production   - STATIC baselines (from the auditor inputs)
 *   utility                 - utility key for TOU rates
 *   currentNemImpact        - the real current credit/true-up (unchanged)
 *   onExtraUsageChange      - ({ addedKwh, cost, ...}) => void
 */
const ICONS = {
  car: Car, thermostat: Thermometer, water: Droplets, snow: Snowflake,
  pool: Waves, appliance: Plug, plus: Plus, hottub: Bath
};

const LoadSimulator = ({
  baseUsage = 10000,
  production = 12000,
  utility = 'SDGE',
  currentNemImpact = null,
  ratePlan = 'standard',
  onRatePlanChange = null,
  onExtraUsageChange
}) => {
  // activeLoads: { [id]: { kwh, daytimePct } }
  const [activeLoads, setActiveLoads] = useState({});
  const touRates = TOU_RATES[utility] || TOU_RATES.SCE;

  const added = totalAddedKwh(activeLoads);
  const dayPct = blendedDaytimePct(activeLoads);
  const extra = calcExtraUsageCost(activeLoads, baseUsage, production, touRates);
  const isEvTou = utility === 'SDGE' && ratePlan === 'SDGE_EVTOU5';
  const evTou = isEvTou ? calcExtraUsageCostEvTou(extra.billableKwh, 'SDGE_EVTOU5') : null;
  const effCost = evTou ? evTou.cost : extra.cost;

  const offsetBase = baseUsage > 0 ? Math.round((production / baseUsage) * 100) : 0;
  const projectedUsage = baseUsage + added;
  const offsetProjected = projectedUsage > 0 ? Math.round((production / projectedUsage) * 100) : 0;

  // Emit the extra-usage result up so audit + battery + report can use it.
  useEffect(() => {
    if (onExtraUsageChange) {
      onExtraUsageChange({
        addedKwh: added,
        billableKwh: extra.billableKwh,
        cost: effCost,
        standardCost: extra.cost,
        ratePlan: isEvTou ? 'SDGE_EVTOU5' : 'standard',
        evTouFallbackCost: evTou ? evTou.fallbackCost : null,
        daytimePct: dayPct,
        freeKwh: extra.freeKwh,
        surplusUsedKwh: surplusUsed,
        surplusLeftKwh: surplusLeft,
        creditBefore: curIsCredit ? curAmount0 : 0,
        creditReduction,
        creditAfter: newCredit,
        loads: Object.entries(activeLoads).map(([id, l]) => {
          const lt = getLoadType(id);
          let detail = '';
          if (id === 'ev') {
            const m = EV_MODELS.find((e) => e.id === l.evModel);
            detail = `${m ? m.label : 'EV'} · ${Number(l.milesPerYear || 0).toLocaleString()} mi/yr home-charged`;
          } else if (id === 'hottub') {
            const s = HOTTUB_SIZES.find((x) => x.id === l.tubSize);
            detail = `${s ? s.label.split(' (')[0] : 'Hot tub'} · ${l.hoursPerDay} hr/day`;
          }
          return { id, label: lt ? lt.label : id, kwh: Number(l.kwh) || 0, daytimePct: l.daytimePct, detail };
        })
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [added, extra.cost, extra.billableKwh, dayPct, effCost]);

  const toggle = (id) => {
    setActiveLoads((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else {
        const lt = getLoadType(id);
        if (id === 'ev') {
          const m = EV_MODELS[0];
          next[id] = { kwh: evAnnualKwh(12000, m.miPerKwh), daytimePct: lt.defaultDaytimePct, evModel: m.id, milesPerYear: 12000, miPerKwh: m.miPerKwh };
        } else if (id === 'hottub') {
          next[id] = { kwh: hottubAnnualKwh('medium', 1), daytimePct: lt.defaultDaytimePct, tubSize: 'medium', hoursPerDay: 1 };
        } else {
          next[id] = { kwh: lt.defaultKwh, daytimePct: lt.defaultDaytimePct };
        }
      }
      return next;
    });
  };
  const setKwh = (id, kwh) => setActiveLoads((p) => ({ ...p, [id]: { ...p[id], kwh } }));
  const setDay = (id, daytimePct) => setActiveLoads((p) => ({ ...p, [id]: { ...p[id], daytimePct } }));

  // EV config: recompute derived kWh whenever the model/miles/efficiency change.
  const setEv = (patch) => setActiveLoads((p) => {
    const cur = { ...p.ev, ...patch };
    if (patch.evModel) {
      const m = EV_MODELS.find((e) => e.id === patch.evModel);
      if (m && patch.evModel !== 'custom') cur.miPerKwh = m.miPerKwh;
    }
    cur.kwh = evAnnualKwh(cur.milesPerYear, cur.miPerKwh);
    return { ...p, ev: cur };
  });

  // Hot tub config: derived from size + daily hours.
  const setTub = (patch) => setActiveLoads((p) => {
    const cur = { ...p.hottub, ...patch };
    cur.kwh = hottubAnnualKwh(cur.tubSize, cur.hoursPerDay);
    return { ...p, hottub: cur };
  });

  const reset = () => setActiveLoads({});

  const money = (v) => `$${Math.round(Math.abs(v)).toLocaleString()}`;

  // Current position (static — from the real audit, never altered here)
  const curIsCredit = currentNemImpact ? currentNemImpact.type === 'credit' : true;
  const curAmount0 = currentNemImpact ? Math.round(currentNemImpact.amount) : 0;
  // Surplus mechanics: added usage first consumes surplus production (shrinking
  // the credit at the credit rate), then becomes billable true-up at TOU.
  const headroom = Math.max(0, production - baseUsage);
  const surplusUsed = Math.min(added, headroom);
  const surplusLeft = Math.max(0, headroom - added);
  const creditRate = curIsCredit && currentNemImpact ? (currentNemImpact.rate || 0) : 0;
  const creditReduction = curIsCredit ? Math.min(curAmount0, Math.round(surplusUsed * creditRate)) : 0;
  const newCredit = Math.max(0, curAmount0 - creditReduction);
  const curAmount = currentNemImpact ? Math.round(currentNemImpact.amount) : 0;

  // Projected = current position adjusted by the extra cost. If they had a
  // credit, extra cost eats into it (and can flip to owing). Shown separately.
  const projectedNet = (curIsCredit ? curAmount - creditReduction : -curAmount) - effCost;
  const projIsCredit = projectedNet >= 0;

  // Recommendation tier on the *extra* cost the added load introduces.
  const owedForRec = extra.cost;
  let recommendation = null;
  if (owedForRec > 0 && owedForRec <= 1000) recommendation = { text: 'Battery Recommended', level: 'battery' };
  else if (owedForRec > 1000) recommendation = { text: 'Battery + Solar Recommended', level: 'both' };

  return (
    <div className="bg-gradient-to-br from-[#0e1f38] to-[#0a1628] border border-cyan-400/30 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-2">
          <Home size={24} className="text-cyan-400" /> Load Simulator
        </h2>
        {added > 0 && (
          <button onClick={reset} className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 border border-slate-600 rounded-lg px-3 py-1.5">
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>
      <p className="text-slate-300 text-sm mb-5">
        Add electrification upgrades to see what the <em>extra</em> energy would cost. Your current
        numbers stay put — this shows the added cost on top, priced by when you'd use the power.
      </p>

      {/* Static baseline strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <BaseCell label="Baseline usage" value={`${baseUsage.toLocaleString()} kWh`} />
        <BaseCell label="Baseline production" value={`${production.toLocaleString()} kWh`} />
        <BaseCell
          label="Current position"
          value={`${curIsCredit ? '+' : '\u2212'}${money(curAmount)}/yr`}
          valueClass={curIsCredit ? 'text-green-400' : 'text-red-400'}
        />
      </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* The house */}
        <div className="lg:col-span-3">
          <HouseGraphic activeLoads={activeLoads} onToggle={toggle} />
        </div>

        {/* Live impact panel */}
        <div className="lg:col-span-2 space-y-3">
          {/* EXTRA USAGE TRUE-UP — the separate additive number */}
          <div className={`rounded-xl p-5 border-2 ${extra.cost > 0 ? 'bg-red-500/10 border-red-400/50' : 'bg-slate-900/50 border-slate-700/50'}`}>
            <div className="text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5 text-red-300">
              <Zap size={13} /> Extra Usage True-Up
            </div>
            <div className={`text-4xl font-extrabold ${extra.cost > 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {extra.cost > 0 ? '\u2212' : ''}{money(extra.cost)}<span className="text-base font-normal text-slate-400">/yr</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {added === 0
                ? 'Add an upgrade to see its cost.'
                : extra.cost === 0
                  ? `All ${added.toLocaleString()} kWh is covered by your surplus production — no added cost yet.`
                  : `${extra.billableKwh.toLocaleString()} of ${added.toLocaleString()} kWh exceed your production and are billed at time-of-use rates.`}
            </p>
            {isEvTou && extra.billableKwh > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-500/30 text-[11px] space-y-1">
                <div className="text-emerald-300 font-semibold">
                  EV-TOU-5: extra usage charged at super off-peak — ${effCost.toLocaleString()}/yr
                  <span className="text-slate-400 font-normal"> (vs ${extra.cost.toLocaleString()} on the standard plan)</span>
                </div>
                <div className="text-amber-300">
                  ⚠ If SDG&E removes super off-peak, your true-up would be <span className="font-bold">${evTou.fallbackCost.toLocaleString()}/yr</span> at off-peak rates.
                </div>
              </div>
            )}
            {curIsCredit && added > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/50 text-[11px] space-y-0.5">
                <div className="text-slate-300">
                  Credit shrinks: <span className="text-green-400 font-semibold">${curAmount0.toLocaleString()}</span>
                  {' → '}
                  <span className={`font-semibold ${newCredit > 0 ? 'text-green-400' : 'text-slate-400'}`}>${newCredit.toLocaleString()}</span>
                  {creditReduction > 0 && <span className="text-red-300"> (−${creditReduction.toLocaleString()})</span>}
                </div>
                <div className="text-slate-400">
                  Surplus production {surplusLeft > 0
                    ? <>remaining: <span className="text-cyan-300 font-semibold">{surplusLeft.toLocaleString()} kWh</span></>
                    : <span className="text-red-300 font-semibold">used up — past net zero, extra usage is now billed</span>}
                </div>
              </div>
            )}
            {extra.cost > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1 text-amber-200">
                  <Sun size={11} /> {extra.daytimeKwh.toLocaleString()} kWh @ off-peak
                </div>
                <div className="flex items-center gap-1 text-red-200">
                  <Moon size={11} /> {extra.nighttimeKwh.toLocaleString()} kWh @ peak
                </div>
                <div className="col-span-2 text-slate-400">
                  Effective rate ${extra.effectiveRate.toFixed(3)}/kWh · {dayPct}% daytime
                </div>
              </div>
            )}
          </div>

          {/* Projected combined position (separate from current) */}
          {added > 0 && (
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Projected year-end (current {curIsCredit ? 'credit' : 'owed'} + extra)</span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${projIsCredit ? 'text-green-400' : 'text-red-400'}`}>
                {projIsCredit ? '+' : '\u2212'}{money(projectedNet)}<span className="text-sm font-normal text-slate-400">/yr</span>
              </div>
            </div>
          )}

          {/* Flashing recommendation */}
          {recommendation && (
            <div className={`rounded-xl p-4 border-2 animate-pulse flex items-center gap-2 ${
              recommendation.level === 'both' ? 'bg-red-500/20 border-red-400/70' : 'bg-amber-500/20 border-amber-400/70'
            }`}>
              <Zap size={20} className={recommendation.level === 'both' ? 'text-red-300' : 'text-amber-300'} />
              <div>
                <div className={`font-extrabold text-lg leading-tight ${recommendation.level === 'both' ? 'text-red-200' : 'text-amber-200'}`}>
                  {recommendation.text}
                </div>
                <div className="text-[11px] text-slate-300/80">
                  {recommendation.level === 'both'
                    ? 'This added load is steep — storage plus more panels closes the gap.'
                    : 'A battery would recover most of this added cost by shifting it off peak.'}
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Solar offset</span>
              <div className="flex items-center gap-2">
                {added > 0 ? (
                  <>
                    <span className="text-slate-500 line-through">{offsetBase}%</span>
                    <span className="font-bold text-cyan-300">{offsetProjected}%</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-200">{offsetBase}%</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-slate-300">Added load</span>
              <span className="font-bold text-cyan-300">+{added.toLocaleString()} kWh/yr</span>
            </div>
          </div>

          {/* Per-load fine-tuning: kWh + day/night split */}
          {Object.keys(activeLoads).length > 0 && (
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
              <div className="text-xs text-slate-300 uppercase tracking-wider mb-3">Fine-tune each load</div>
              <div className="space-y-4">
                {Object.keys(activeLoads).map((id) => {
                  const lt = getLoadType(id);
                  const l = activeLoads[id];
                  return (
                    <div key={id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-200">{lt.label}</span>
                        <span className="text-cyan-300 font-semibold">{Number(l.kwh).toLocaleString()} kWh</span>
                      </div>

                      {id === 'ev' ? (
                        <div className="space-y-1.5 mb-1">
                          <select
                            value={l.evModel}
                            onChange={(e) => setEv({ evModel: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-600 rounded-lg bg-slate-900/70 text-slate-200"
                          >
                            {EV_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}{m.id !== 'custom' ? ` (${m.miPerKwh} mi/kWh)` : ''}</option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Home-charged miles/yr</span>
                            <span className="text-cyan-300 font-semibold">{Number(l.milesPerYear).toLocaleString()} mi</span>
                          </div>
                          <input type="range" min={1000} max={30000} step={500}
                            value={l.milesPerYear} onChange={(e) => setEv({ milesPerYear: Number(e.target.value) })}
                            className="w-full accent-cyan-400" />
                          {(l.evModel === 'custom' || l.evModel === 'phev') && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>Efficiency (mi/kWh):</span>
                              <input type="number" min={0.5} max={6} step={0.1} value={l.miPerKwh}
                                onChange={(e) => setEv({ miPerKwh: Number(e.target.value) })}
                                className="w-20 px-2 py-1 border border-slate-600 rounded bg-slate-900/70 text-cyan-300" />
                            </div>
                          )}
                        </div>
                      ) : id === 'hottub' ? (
                        <div className="space-y-1.5 mb-1">
                          <select
                            value={l.tubSize}
                            onChange={(e) => setTub({ tubSize: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-600 rounded-lg bg-slate-900/70 text-slate-200"
                          >
                            {HOTTUB_SIZES.map((s) => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Use per day</span>
                            <span className="text-cyan-300 font-semibold">{l.hoursPerDay} hr</span>
                          </div>
                          <input type="range" min={0} max={6} step={0.5}
                            value={l.hoursPerDay} onChange={(e) => setTub({ hoursPerDay: Number(e.target.value) })}
                            className="w-full accent-cyan-400" />
                        </div>
                      ) : (
                        <input type="range" min={lt.minKwh} max={lt.maxKwh} step={100}
                          value={l.kwh} onChange={(e) => setKwh(id, Number(e.target.value))}
                          className="w-full accent-cyan-400" />
                      )}

                      <div className="flex items-center justify-between text-[11px] mt-1 mb-0.5">
                        <span className="flex items-center gap-1 text-amber-200"><Sun size={11} /> Day {l.daytimePct}%</span>
                        <span className="flex items-center gap-1 text-red-200">Night {100 - l.daytimePct}% <Moon size={11} /></span>
                      </div>
                      <input type="range" min={0} max={100} step={5}
                        value={l.daytimePct} onChange={(e) => setDay(id, Number(e.target.value))}
                        className="w-full accent-amber-400" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appliance picker */}
      <div className="mt-6">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Add to the home</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {LOAD_TYPES.map((lt) => {
            const Icon = ICONS[lt.icon] || Plus;
            const on = lt.id in activeLoads;
            return (
              <button key={lt.id} onClick={() => toggle(lt.id)} title={lt.blurb}
                className={`rounded-xl p-3 border text-center transition-all ${
                  on ? 'bg-cyan-400/20 border-cyan-400/60 text-cyan-200'
                     : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200'
                }`}>
                <Icon size={22} className={`mx-auto mb-1 ${on ? 'text-cyan-300' : 'text-slate-400'}`} />
                <div className="text-[11px] font-medium leading-tight">{lt.label}</div>
                {on && <div className="text-[10px] text-cyan-300/80 mt-0.5">✓ added</div>}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-5">
        Estimates are typical California figures and vary by climate, home size, and habits. The
        "Extra Usage True-Up" is priced by time-of-use and shown separately on the Audit and Battery
        tabs — your current true-up/credit is never changed by this simulation.
      </p>
    </div>
  );
};

const BaseCell = ({ label, value, valueClass = 'text-slate-100' }) => (
  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
    <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
    <div className={`text-lg font-bold mt-0.5 ${valueClass}`}>{value}</div>
  </div>
);

/** Illustrated home — clickable hotspots that light up as loads are added. */
const HouseGraphic = ({ activeLoads, onToggle }) => {
  const on = (id) => id in activeLoads;
  const glow = (id) => (on(id) ? 1 : 0.18);
  const stroke = (id) => (on(id) ? '#22d3ee' : '#475569');

  return (
    <svg viewBox="0 0 460 360" className="w-full select-none">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e2a4a" /><stop offset="100%" stopColor="#0a1628" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" /><stop offset="100%" stopColor="#16304d" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="460" height="300" fill="url(#sky)" />
      <rect x="0" y="295" width="460" height="65" fill="#0c1f1a" />
      <circle cx="402" cy="52" r="22" fill="url(#sun)" opacity="0.9" />

      <rect x="120" y="150" width="200" height="150" rx="4" fill="#13263f" stroke="#26425f" strokeWidth="2" />
      <polygon points="110,152 220,80 330,152" fill="url(#roof)" stroke="#2b486a" strokeWidth="2" />

      <g opacity="0.95">
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
          <rect key={`p${r}${c}`} x={150 + c * 22} y={104 + r * 13} width="19" height="11"
            fill="#0e7490" stroke="#22d3ee" strokeWidth="0.6" rx="1" transform="skewX(-18)" opacity="0.85" />
        )))}
      </g>

      <rect x="205" y="235" width="30" height="65" rx="2" fill="#0e1f33" stroke="#2b486a" strokeWidth="1.5" />
      <circle cx="229" cy="268" r="2" fill="#22d3ee" />

      {/* EV */}
      <g onClick={() => onToggle('ev')} style={{ cursor: 'pointer' }}>
        <rect x="28" y="252" width="74" height="46" rx="8" fill="#0f2438" stroke={stroke('ev')} strokeWidth="2" opacity={on('ev') ? 1 : 0.5} />
        <g opacity={glow('ev')}>
          <rect x="36" y="266" width="58" height="20" rx="6" fill="#1e4d5c" />
          <rect x="46" y="258" width="34" height="14" rx="5" fill="#256b7e" />
          <circle cx="48" cy="288" r="6" fill="#0b1622" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="82" cy="288" r="6" fill="#0b1622" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M94 276 q18 0 24 -18" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="3 2" />
        </g>
        <text x="65" y="312" textAnchor="middle" fontSize="10" fill={on('ev') ? '#67e8f9' : '#64748b'}>EV</text>
      </g>

      {/* Heat pump */}
      <g onClick={() => onToggle('heatpump')} style={{ cursor: 'pointer' }}>
        <rect x="330" y="232" width="44" height="40" rx="5" fill="#0f2438" stroke={stroke('heatpump')} strokeWidth="2" opacity={on('heatpump') ? 1 : 0.5} />
        <g opacity={glow('heatpump')}>
          <circle cx="352" cy="252" r="12" fill="none" stroke="#22d3ee" strokeWidth="2" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} x1="352" y1="252" x2={352 + 10 * Math.cos((a * Math.PI) / 180)} y2={252 + 10 * Math.sin((a * Math.PI) / 180)} stroke="#22d3ee" strokeWidth="1.5" />
          ))}
        </g>
        <text x="352" y="285" textAnchor="middle" fontSize="9" fill={on('heatpump') ? '#67e8f9' : '#64748b'}>Heat Pump</text>
      </g>

      {/* A/C */}
      <g onClick={() => onToggle('ac')} style={{ cursor: 'pointer' }}>
        <rect x="384" y="250" width="34" height="30" rx="4" fill="#0f2438" stroke={stroke('ac')} strokeWidth="2" opacity={on('ac') ? 1 : 0.5} />
        <g opacity={glow('ac')}>
          {[0, 1, 2].map((i) => (<line key={i} x1="390" y1={258 + i * 6} x2="412" y2={258 + i * 6} stroke="#22d3ee" strokeWidth="1.5" />))}
        </g>
        <text x="401" y="292" textAnchor="middle" fontSize="9" fill={on('ac') ? '#67e8f9' : '#64748b'}>A/C</text>
      </g>

      {/* HPWH */}
      <g onClick={() => onToggle('hpwh')} style={{ cursor: 'pointer' }}>
        <rect x="132" y="210" width="26" height="56" rx="6" fill="#0f2438" stroke={stroke('hpwh')} strokeWidth="2" opacity={on('hpwh') ? 1 : 0.55} />
        <g opacity={glow('hpwh')}>
          <circle cx="145" cy="228" r="7" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M145 238 v18" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M141 246 q4 4 8 0" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        </g>
        <text x="145" y="278" textAnchor="middle" fontSize="8" fill={on('hpwh') ? '#67e8f9' : '#64748b'}>Water</text>
      </g>

      {/* Appliances */}
      <g onClick={() => onToggle('appliances')} style={{ cursor: 'pointer' }}>
        <rect x="258" y="200" width="50" height="40" rx="3" fill="#0f2438" stroke={stroke('appliances')} strokeWidth="2" opacity={on('appliances') ? 1 : 0.5} />
        <g opacity={glow('appliances')}>
          <rect x="266" y="208" width="14" height="24" rx="2" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="294" cy="214" r="4" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="294" cy="226" r="4" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        </g>
        <text x="283" y="254" textAnchor="middle" fontSize="8" fill={on('appliances') ? '#67e8f9' : '#64748b'}>Appliances</text>
      </g>

      {/* Hot tub — round tub with steam, left of the pool */}
      <g onClick={() => onToggle('hottub')} style={{ cursor: 'pointer' }}>
        <ellipse cx="285" cy="322" rx="24" ry="12" fill="#0f2438" stroke={stroke('hottub')} strokeWidth="2" opacity={on('hottub') ? 1 : 0.5} />
        <g opacity={glow('hottub')}>
          <ellipse cx="285" cy="320" rx="17" ry="7" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          {/* steam wisps */}
          <path d="M277 310 q2 -4 0 -8" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity="0.8" />
          <path d="M285 308 q2 -4 0 -8" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity="0.6" />
          <path d="M293 310 q2 -4 0 -8" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity="0.8" />
        </g>
        <text x="285" y="345" textAnchor="middle" fontSize="9" fill={on('hottub') ? '#67e8f9' : '#64748b'}>Hot Tub</text>
      </g>

      {/* Pool */}
      <g onClick={() => onToggle('pool')} style={{ cursor: 'pointer' }}>
        <ellipse cx="370" cy="320" rx="46" ry="16" fill="#0f2438" stroke={stroke('pool')} strokeWidth="2" opacity={on('pool') ? 1 : 0.5} />
        <g opacity={glow('pool')}>
          <path d="M340 320 q10 -6 20 0 t20 0 t20 0" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M344 326 q10 -5 20 0 t20 0" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity="0.7" />
        </g>
        <text x="370" y="346" textAnchor="middle" fontSize="9" fill={on('pool') ? '#67e8f9' : '#64748b'}>Pool</text>
      </g>

      {/* Custom */}
      <g onClick={() => onToggle('custom')} style={{ cursor: 'pointer' }}>
        <circle cx="70" cy="200" r="20" fill="#0f2438" stroke={stroke('custom')} strokeWidth="2" opacity={on('custom') ? 1 : 0.5} />
        <g opacity={glow('custom')}>
          <rect x="63" y="191" width="14" height="14" rx="3" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <line x1="66" y1="205" x2="66" y2="210" stroke="#22d3ee" strokeWidth="1.5" />
          <line x1="74" y1="205" x2="74" y2="210" stroke="#22d3ee" strokeWidth="1.5" />
        </g>
        <text x="70" y="232" textAnchor="middle" fontSize="9" fill={on('custom') ? '#67e8f9' : '#64748b'}>Custom</text>
      </g>
    </svg>
  );
};

export default LoadSimulator;
