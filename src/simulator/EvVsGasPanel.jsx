import React from 'react';
import { GAS_CARS, GAS_PRICE_DEFAULT, gasAnnualCost, evChargeAnnualCost } from './LoadModel';

/**
 * Pop-out EV vs GAS comparison — appears below the load grid only while the
 * Electric Vehicle load is active. All choices live on the persisted `ev`
 * load entry, so they stay with the client.
 */
const EvVsGasPanel = ({ ev, chargeRate, isEvTou, onPatch }) => {
  if (!ev) return null;
  const mpg = ev.gasMpg || 25;
  const price = ev.gasPrice ?? GAS_PRICE_DEFAULT;
  const gasYr = gasAnnualCost(ev.milesPerYear, mpg, price);
  const evYr = evChargeAnnualCost(ev.kwh, chargeRate);
  const save = gasYr - evYr;
  const maxCost = Math.max(gasYr, evYr, 1);
  const gasH = Math.max(14, (gasYr / maxCost) * 92);
  const evH = Math.max(14, (evYr / maxCost) * 92);

  return (
    <div className="mt-4 rounded-2xl border border-cyan-500/40 bg-[#060b18] p-4 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-sm font-bold text-cyan-300 tracking-wide">⚡ EV vs ⛽ GAS — same miles, two very different bills</div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
          <select
            value={ev.gasCar || 'camry'}
            onChange={(e) => {
              const g = GAS_CARS.find((c) => c.id === e.target.value);
              onPatch({ gasCar: e.target.value, ...(g && e.target.value !== 'custom' ? { gasMpg: g.mpg } : {}) });
            }}
            className="px-2 py-1.5 text-xs border border-slate-600 rounded-lg bg-slate-900/70 text-slate-200"
          >
            {GAS_CARS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}{c.id !== 'custom' ? ` (${c.mpg} MPG)` : ''}</option>
            ))}
          </select>
          <span className="flex items-center gap-1">MPG
            <input type="number" min={8} max={60} value={mpg}
              onChange={(e) => onPatch({ gasMpg: Number(e.target.value) })}
              className="w-14 px-1.5 py-1 border border-slate-600 rounded bg-slate-900/70 text-amber-300" />
          </span>
          <span className="flex items-center gap-1">Gas $/gal
            <input type="number" min={2} max={9} step={0.05} value={price}
              onChange={(e) => onPatch({ gasPrice: Number(e.target.value) })}
              className="w-16 px-1.5 py-1 border border-slate-600 rounded bg-slate-900/70 text-amber-300" />
          </span>
        </div>
      </div>

      <svg viewBox="0 0 640 190" className="w-full select-none">
        <defs>
          <linearGradient id="evgGas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="evgEv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="evgGlow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* GAS side */}
        <g>
          <rect x="30" y="70" width="76" height="26" rx="8" fill="#1c130a" stroke="#f59e0b" strokeWidth="2" />
          <rect x="44" y="58" width="42" height="16" rx="6" fill="#1c130a" stroke="#f59e0b" strokeWidth="2" />
          <circle cx="50" cy="98" r="8" fill="#0a0a0a" stroke="#f59e0b" strokeWidth="2" />
          <circle cx="88" cy="98" r="8" fill="#0a0a0a" stroke="#f59e0b" strokeWidth="2" />
          {/* exhaust puffs */}
          <circle cx="115" cy="82" r="4" fill="#78716c" opacity="0.8" />
          <circle cx="124" cy="77" r="5.5" fill="#78716c" opacity="0.55" />
          <circle cx="135" cy="71" r="7" fill="#78716c" opacity="0.3" />
          <text x="68" y="122" fontSize="10" fill="#fbbf24" textAnchor="middle" fontWeight="700">{(GAS_CARS.find((c) => c.id === (ev.gasCar || 'camry')) || {}).label || 'Gas car'}</text>
          {/* cost bar */}
          <rect x="160" y={150 - gasH} width="40" height={gasH} rx="4" fill="url(#evgGas)" filter="url(#evgGlow)" />
          <text x="180" y={142 - gasH} fontSize="12" fill="#fca5a5" textAnchor="middle" fontWeight="800">${Math.round(gasYr / 12)}/mo</text>
          <text x="180" y="166" fontSize="9" fill="#94a3b8" textAnchor="middle">${Math.round(gasYr).toLocaleString()}/yr at the pump</text>
        </g>

        {/* VS bolt */}
        <text x="320" y="105" fontSize="26" fill="#e2f4ff" textAnchor="middle" fontWeight="900" filter="url(#evgGlow)">VS</text>

        {/* EV side */}
        <g>
          <rect x="440" y={150 - evH} width="40" height={evH} rx="4" fill="url(#evgEv)" filter="url(#evgGlow)" />
          <text x="460" y={142 - evH} fontSize="12" fill="#67e8f9" textAnchor="middle" fontWeight="800">${Math.round(evYr / 12)}/mo</text>
          <text x="460" y="166" fontSize="9" fill="#94a3b8" textAnchor="middle">${Math.round(evYr).toLocaleString()}/yr home charging{isEvTou ? ' · EV-TOU' : ''}</text>
          <rect x="520" y="70" width="76" height="26" rx="8" fill="#04131a" stroke="#22d3ee" strokeWidth="2" filter="url(#evgGlow)" />
          <rect x="534" y="58" width="42" height="16" rx="6" fill="#04131a" stroke="#22d3ee" strokeWidth="2" />
          <circle cx="540" cy="98" r="8" fill="#0a0a0a" stroke="#22d3ee" strokeWidth="2" />
          <circle cx="578" cy="98" r="8" fill="#0a0a0a" stroke="#22d3ee" strokeWidth="2" />
          {/* charge bolt */}
          <path d="M562 40 L554 54 L560 54 L552 68 L566 52 L559 52 Z" fill="#facc15" filter="url(#evgGlow)" />
          <text x="558" y="122" fontSize="10" fill="#67e8f9" textAnchor="middle" fontWeight="700">Your EV</text>
        </g>

        {/* savings banner */}
        <rect x="215" y="120" width="210" height="30" rx="10" fill={save >= 0 ? '#052e1e' : '#2e0505'} stroke={save >= 0 ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
        <text x="320" y="139" fontSize="13" fill={save >= 0 ? '#6ee7b7' : '#fca5a5'} textAnchor="middle" fontWeight="800">
          {save >= 0 ? `EV SAVES $${Math.abs(Math.round(save / 12))}/mo · $${Math.abs(Math.round(save)).toLocaleString()}/yr` : `EV costs $${Math.abs(Math.round(save / 12))}/mo more`}
        </text>
      </svg>
      <p className="text-[10.5px] text-slate-500 mt-1">Same {Number(ev.milesPerYear).toLocaleString()} miles/yr · gas price editable to your local pump · charging priced at {isEvTou ? 'EV-TOU super off-peak' : 'off-peak'} rates.</p>
    </div>
  );
};

export default EvVsGasPanel;
