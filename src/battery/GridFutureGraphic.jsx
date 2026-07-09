import React from 'react';

/**
 * Sci-fi "the night is getting hungrier" graphic: nighttime demand climbing
 * year over year while dispatchable supply shrinks — the gap is the danger
 * zone a battery steps into. Pure SVG, glows, no dependencies.
 */
const GridFutureGraphic = () => {
  const W = 640, H = 300;
  // demand curve rises, supply curve falls, crossing mid-chart
  const demand = 'M40,220 C160,205 280,175 400,130 S 580,60 600,48';
  const supply = 'M40,120 C180,128 300,150 420,185 S 570,225 600,232';
  return (
    <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#060b18] p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        <defs>
          <linearGradient id="gfDemand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="gfSupply" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          <radialGradient id="gfDanger" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gfBattGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <filter id="gfGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* starfield night backdrop */}
        {[[70,30],[140,55],[220,25],[300,48],[380,22],[470,40],[540,28],[600,58],[110,80],[500,70]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.6 : 1} fill="#7dd3fc" opacity="0.7" />
        ))}
        <text x="40" y="30" fontSize="11" fill="#94a3b8" letterSpacing="2">THE NIGHT GRID · 2026 → 2035</text>

        {/* danger zone where demand exceeds supply */}
        <ellipse cx="500" cy="140" rx="150" ry="95" fill="url(#gfDanger)" />

        {/* supply falling */}
        <path d={supply} fill="none" stroke="url(#gfSupply)" strokeWidth="3.5" filter="url(#gfGlow)" />
        <text x="46" y="108" fontSize="11" fill="#67e8f9" fontWeight="700">DISPATCHABLE SUPPLY ▼</text>
        <text x="46" y="121" fontSize="8.5" fill="#7d8aa0">plants retiring · aging lines · wildfire derating</text>

        {/* demand rising */}
        <path d={demand} fill="none" stroke="url(#gfDemand)" strokeWidth="4" filter="url(#gfGlow)" />
        <text x="410" y="102" fontSize="11" fill="#fca5a5" fontWeight="700">NIGHT DEMAND ▲</text>
        <text x="404" y="115" fontSize="8.5" fill="#c9a08a">EVs charging · AC evenings · data centers 24/7</text>

        {/* crossing flare */}
        <circle cx="452" cy="163" r="7" fill="#ef4444" filter="url(#gfGlow)" />
        <text x="452" y="188" fontSize="9" fill="#fecaca" textAnchor="middle">the squeeze — prices spike here</text>

        {/* battery savior */}
        <circle cx="577" cy="235" r="40" fill="url(#gfBattGlow)" />
        <rect x="561" y="212" width="32" height="48" rx="6" fill="#07130c" stroke="#10b981" strokeWidth="2.5" filter="url(#gfGlow)" />
        <rect x="567" y="220" width="20" height="7" rx="2" fill="#10b981" />
        <rect x="567" y="230" width="20" height="7" rx="2" fill="#10b981" opacity="0.75" />
        <rect x="567" y="240" width="20" height="7" rx="2" fill="#10b981" opacity="0.5" />
        <text x="577" y="277" fontSize="9.5" fill="#6ee7b7" textAnchor="middle" fontWeight="700">YOUR BATTERY</text>

        {/* battery bridging arrow into the gap */}
        <path d="M566,214 C540,195 505,180 470,168" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 4" opacity="0.9" />

        {/* axis */}
        <line x1="40" y1="252" x2="600" y2="252" stroke="#1e3050" strokeWidth="1" />
        {['2026','2029','2032','2035'].map((yr, i) => (
          <text key={yr} x={40 + i * 186} y="266" fontSize="9" fill="#64748b">{yr}</text>
        ))}
      </svg>
      <p className="text-xs text-slate-300 mt-2 leading-relaxed">
        <span className="text-red-300 font-semibold">Night demand climbs while dispatchable supply shrinks</span> — and the gap
        is priced into every evening kWh you buy. <span className="text-emerald-300 font-semibold">A battery steps directly into
        that gap</span>: it stores your midday solar and discharges into the most expensive hours, recovering the value the grid
        squeeze takes — and the worse the squeeze gets, the more your battery is worth.
      </p>
    </div>
  );
};

export default GridFutureGraphic;
