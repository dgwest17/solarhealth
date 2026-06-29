import React, { useState, useEffect } from 'react';
import {
  Car, Thermometer, Droplets, Snowflake, Waves, Plug, Plus,
  Zap, TrendingUp, RotateCcw, Home
} from 'lucide-react';
import { LOAD_TYPES, totalAddedKwh, getLoadType } from './LoadModel';

/**
 * Load Simulator tab.
 *
 * An illustrated home where the user clicks electrification upgrades (EV, heat
 * pump, etc.) to add them. Each addition lights up on the house and raises
 * annual usage, which flows back to the audit engine via onUsageChange so the
 * audit + battery tabs recalculate live.
 *
 * Props:
 *   baseUsage      - the client's usage before any added load (kWh/yr)
 *   production     - annual solar production (kWh/yr), for the offset readout
 *   onUsageChange  - (newAnnualUsage) => void : pushes usage up to the parent
 */
const ICONS = {
  car: Car, thermostat: Thermometer, water: Droplets, snow: Snowflake,
  pool: Waves, appliance: Plug, plus: Plus
};

const LoadSimulator = ({ baseUsage = 10000, production = 12000, onUsageChange, nemImpact = null }) => {
  // activeLoads: { [id]: kWh }. Absent = not added.
  const [activeLoads, setActiveLoads] = useState({});

  const added = totalAddedKwh(activeLoads);
  const newUsage = Math.round(baseUsage + added);
  const offsetBefore = baseUsage > 0 ? Math.round((production / baseUsage) * 100) : 0;
  const offsetAfter = newUsage > 0 ? Math.round((production / newUsage) * 100) : 0;

  // Push usage changes up so the audit + battery tabs follow.
  useEffect(() => {
    if (onUsageChange) onUsageChange(newUsage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newUsage]);

  const toggle = (id) => {
    setActiveLoads((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = getLoadType(id).defaultKwh;
      }
      return next;
    });
  };

  const setKwh = (id, kwh) => {
    setActiveLoads((prev) => ({ ...prev, [id]: kwh }));
  };

  const reset = () => setActiveLoads({});

  const money = (v) => `$${Math.round(v).toLocaleString()}`;

  // Live year-end position, from the SAME authoritative calc the audit uses.
  // nemImpact recalculates upstream as added load raises usage, so this
  // reflects the simulated scenario in real time.
  //   type 'credit'  -> utility pays them (green)
  //   type 'trueup'  -> they owe (red)
  const isCredit = nemImpact ? nemImpact.type === 'credit' : true;
  const trueUpAmount = nemImpact ? Math.round(nemImpact.amount) : 0;
  const owed = !isCredit ? trueUpAmount : 0;

  // Recommendation tiers, driven by the amount OWED (a credit recommends nothing):
  //   owe $1..$1000     -> "Battery Recommended"
  //   owe > $1000       -> "Battery + Solar Recommended"
  let recommendation = null;
  if (owed > 0 && owed <= 1000) {
    recommendation = { text: 'Battery Recommended', level: 'battery' };
  } else if (owed > 1000) {
    recommendation = { text: 'Battery + Solar Recommended', level: 'both' };
  }

  return (
    <div className="bg-gradient-to-br from-[#0e1f38] to-[#0a1628] border border-cyan-400/30 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-2">
          <Home size={24} className="text-cyan-400" /> Load Simulator
        </h2>
        {added > 0 && (
          <button
            onClick={reset}
            className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 border border-slate-600 rounded-lg px-3 py-1.5"
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>
      <p className="text-slate-300 text-sm mb-6">
        Click an upgrade to add it to the home and watch your numbers change. See what
        happens to your usage, your solar offset, and your bill as you electrify.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* The house */}
        <div className="lg:col-span-3">
          <HouseGraphic activeLoads={activeLoads} onToggle={toggle} />
        </div>

        {/* Live impact panel */}
        <div className="lg:col-span-2 space-y-3">
          {/* Year-end position — green credit / red owed, recalculates live */}
          <div className={`rounded-xl p-5 border-2 transition-colors ${
            isCredit
              ? 'bg-green-500/10 border-green-400/50'
              : 'bg-red-500/10 border-red-400/50'
          }`}>
            <div className="text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"
              style={{ color: isCredit ? '#86efac' : '#fca5a5' }}>
              {isCredit ? <TrendingUp size={13} /> : <Zap size={13} />}
              {isCredit ? 'Year-End Credit' : 'Year-End True-Up'}
            </div>
            <div className={`text-4xl font-extrabold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
              {isCredit ? '+' : '\u2212'}{money(trueUpAmount)}<span className="text-base font-normal text-slate-400">/yr</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isCredit
                ? 'Your system over-produces — the utility pays you.'
                : 'You owe the utility this at year-end true-up.'}
            </p>
          </div>

          {/* Flashing recommendation banner */}
          {recommendation && (
            <div className={`rounded-xl p-4 border-2 animate-pulse flex items-center gap-2 ${
              recommendation.level === 'both'
                ? 'bg-red-500/20 border-red-400/70'
                : 'bg-amber-500/20 border-amber-400/70'
            }`}>
              <Zap size={20} className={recommendation.level === 'both' ? 'text-red-300' : 'text-amber-300'} />
              <div>
                <div className={`font-extrabold text-lg leading-tight ${
                  recommendation.level === 'both' ? 'text-red-200' : 'text-amber-200'
                }`}>
                  {recommendation.text}
                </div>
                <div className="text-[11px] text-slate-300/80">
                  {recommendation.level === 'both'
                    ? 'Your true-up is steep — storage plus more panels closes the gap.'
                    : 'A battery would recover most of this annual cost.'}
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-900/60 rounded-xl p-5 border border-cyan-400/20">
            <div className="text-xs text-cyan-200 uppercase tracking-wider mb-3">Live Impact</div>

            <div className="space-y-3">
              <Stat label="Annual usage" before={`${baseUsage.toLocaleString()} kWh`} after={`${newUsage.toLocaleString()} kWh`} changed={added > 0} />
              <Stat label="Solar offset" before={`${offsetBefore}%`} after={`${offsetAfter}%`} changed={added > 0} worse={offsetAfter < offsetBefore} />
              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Added load</span>
                  <span className="text-xl font-bold text-cyan-300">+{added.toLocaleString()} kWh/yr</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-load fine-tuning */}
          {Object.keys(activeLoads).length > 0 && (
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
              <div className="text-xs text-slate-300 uppercase tracking-wider mb-3">Fine-tune added loads</div>
              <div className="space-y-3">
                {Object.keys(activeLoads).map((id) => {
                  const lt = getLoadType(id);
                  return (
                    <div key={id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-200">{lt.label}</span>
                        <span className="text-cyan-300 font-semibold">{Number(activeLoads[id]).toLocaleString()} kWh</span>
                      </div>
                      <input
                        type="range"
                        min={lt.minKwh}
                        max={lt.maxKwh}
                        step={100}
                        value={activeLoads[id]}
                        onChange={(e) => setKwh(id, Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <p className="text-[11px] text-slate-500 mt-0.5">{lt.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appliance picker row */}
      <div className="mt-6">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Add to the home</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {LOAD_TYPES.map((lt) => {
            const Icon = ICONS[lt.icon] || Plus;
            const on = lt.id in activeLoads;
            return (
              <button
                key={lt.id}
                onClick={() => toggle(lt.id)}
                title={lt.blurb}
                className={`rounded-xl p-3 border text-center transition-all ${
                  on
                    ? 'bg-cyan-400/20 border-cyan-400/60 text-cyan-200'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200'
                }`}
              >
                <Icon size={22} className={`mx-auto mb-1 ${on ? 'text-cyan-300' : 'text-slate-400'}`} />
                <div className="text-[11px] font-medium leading-tight">{lt.label}</div>
                {on && <div className="text-[10px] text-cyan-300/80 mt-0.5">✓ added</div>}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-5">
        Estimates are typical California figures and vary by climate, home size, and habits.
        Changes here flow into the Financial Audit and Battery tabs automatically.
      </p>
    </div>
  );
};

/** A small before/after stat row. */
const Stat = ({ label, before, after, changed, worse }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      {changed ? (
        <>
          <span className="text-sm text-slate-500 line-through">{before}</span>
          <span className={`text-sm font-bold ${worse ? 'text-amber-300' : 'text-cyan-300'}`}>{after}</span>
        </>
      ) : (
        <span className="text-sm font-semibold text-slate-200">{before}</span>
      )}
    </div>
  </div>
);

/**
 * The illustrated home. SVG with clickable hotspots that light up as loads
 * are added. Pure SVG so it scales crisply and themes with the app.
 */
const HouseGraphic = ({ activeLoads, onToggle }) => {
  const on = (id) => id in activeLoads;
  const glow = (id) => (on(id) ? 1 : 0.18);
  const stroke = (id) => (on(id) ? '#22d3ee' : '#475569');

  return (
    <svg viewBox="0 0 460 360" className="w-full select-none">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e2a4a" />
          <stop offset="100%" stopColor="#0a1628" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#16304d" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>

      {/* sky + ground */}
      <rect x="0" y="0" width="460" height="300" fill="url(#sky)" />
      <rect x="0" y="295" width="460" height="65" fill="#0c1f1a" />

      {/* sun */}
      <circle cx="402" cy="52" r="22" fill="url(#sun)" opacity="0.9" />

      {/* ---- House body ---- */}
      <rect x="120" y="150" width="200" height="150" rx="4" fill="#13263f" stroke="#26425f" strokeWidth="2" />
      {/* roof */}
      <polygon points="110,152 220,80 330,152" fill="url(#roof)" stroke="#2b486a" strokeWidth="2" />

      {/* ---- Solar panels on roof (always on) ---- */}
      <g opacity="0.95">
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => (
            <rect key={`p${r}${c}`} x={150 + c * 22} y={104 + r * 13} width="19" height="11"
              fill="#0e7490" stroke="#22d3ee" strokeWidth="0.6" rx="1"
              transform={`skewX(-18)`} opacity="0.85" />
          ))
        )}
      </g>

      {/* door + windows */}
      <rect x="205" y="235" width="30" height="65" rx="2" fill="#0e1f33" stroke="#2b486a" strokeWidth="1.5" />
      <circle cx="229" cy="268" r="2" fill="#22d3ee" />

      {/* ================= LOAD HOTSPOTS ================= */}

      {/* EV — driveway, left of house */}
      <g onClick={() => onToggle('ev')} style={{ cursor: 'pointer' }}>
        <rect x="28" y="252" width="74" height="46" rx="8" fill="#0f2438" stroke={stroke('ev')} strokeWidth="2" opacity={on('ev') ? 1 : 0.5} />
        {/* car body */}
        <g opacity={glow('ev')}>
          <rect x="36" y="266" width="58" height="20" rx="6" fill="#1e4d5c" />
          <rect x="46" y="258" width="34" height="14" rx="5" fill="#256b7e" />
          <circle cx="48" cy="288" r="6" fill="#0b1622" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="82" cy="288" r="6" fill="#0b1622" stroke="#22d3ee" strokeWidth="1.5" />
          {/* charge cable to house */}
          <path d="M94 276 q18 0 24 -18" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="3 2" />
        </g>
        <text x="65" y="312" textAnchor="middle" fontSize="10" fill={on('ev') ? '#67e8f9' : '#64748b'}>EV</text>
      </g>

      {/* Heat pump / HVAC — right side of house */}
      <g onClick={() => onToggle('heatpump')} style={{ cursor: 'pointer' }}>
        <rect x="330" y="232" width="44" height="40" rx="5" fill="#0f2438" stroke={stroke('heatpump')} strokeWidth="2" opacity={on('heatpump') ? 1 : 0.5} />
        <g opacity={glow('heatpump')}>
          <circle cx="352" cy="252" r="12" fill="none" stroke="#22d3ee" strokeWidth="2" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} x1="352" y1="252"
              x2={352 + 10 * Math.cos((a * Math.PI) / 180)}
              y2={252 + 10 * Math.sin((a * Math.PI) / 180)}
              stroke="#22d3ee" strokeWidth="1.5" />
          ))}
        </g>
        <text x="352" y="285" textAnchor="middle" fontSize="9" fill={on('heatpump') ? '#67e8f9' : '#64748b'}>Heat Pump</text>
      </g>

      {/* A/C — small unit, far right */}
      <g onClick={() => onToggle('ac')} style={{ cursor: 'pointer' }}>
        <rect x="384" y="250" width="34" height="30" rx="4" fill="#0f2438" stroke={stroke('ac')} strokeWidth="2" opacity={on('ac') ? 1 : 0.5} />
        <g opacity={glow('ac')}>
          {[0, 1, 2].map((i) => (
            <line key={i} x1="390" y1={258 + i * 6} x2="412" y2={258 + i * 6} stroke="#22d3ee" strokeWidth="1.5" />
          ))}
        </g>
        <text x="401" y="292" textAnchor="middle" fontSize="9" fill={on('ac') ? '#67e8f9' : '#64748b'}>A/C</text>
      </g>

      {/* HPWH — water heater, inside-left wall */}
      <g onClick={() => onToggle('hpwh')} style={{ cursor: 'pointer' }}>
        <rect x="132" y="210" width="26" height="56" rx="6" fill="#0f2438" stroke={stroke('hpwh')} strokeWidth="2" opacity={on('hpwh') ? 1 : 0.55} />
        <g opacity={glow('hpwh')}>
          <circle cx="145" cy="228" r="7" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M145 238 v18" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M141 246 q4 4 8 0" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        </g>
        <text x="145" y="278" textAnchor="middle" fontSize="8" fill={on('hpwh') ? '#67e8f9' : '#64748b'}>Water</text>
      </g>

      {/* Electric appliances — kitchen window glow */}
      <g onClick={() => onToggle('appliances')} style={{ cursor: 'pointer' }}>
        <rect x="258" y="200" width="50" height="40" rx="3" fill="#0f2438" stroke={stroke('appliances')} strokeWidth="2" opacity={on('appliances') ? 1 : 0.5} />
        <g opacity={glow('appliances')}>
          <rect x="266" y="208" width="14" height="24" rx="2" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="294" cy="214" r="4" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="294" cy="226" r="4" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        </g>
        <text x="283" y="254" textAnchor="middle" fontSize="8" fill={on('appliances') ? '#67e8f9' : '#64748b'}>Appliances</text>
      </g>

      {/* Pool — bottom right yard */}
      <g onClick={() => onToggle('pool')} style={{ cursor: 'pointer' }}>
        <ellipse cx="370" cy="320" rx="46" ry="16" fill="#0f2438" stroke={stroke('pool')} strokeWidth="2" opacity={on('pool') ? 1 : 0.5} />
        <g opacity={glow('pool')}>
          <path d="M340 320 q10 -6 20 0 t20 0 t20 0" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <path d="M344 326 q10 -5 20 0 t20 0" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity="0.7" />
        </g>
        <text x="370" y="346" textAnchor="middle" fontSize="9" fill={on('pool') ? '#67e8f9' : '#64748b'}>Pool</text>
      </g>

      {/* Custom — generic plug bottom-left yard */}
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
