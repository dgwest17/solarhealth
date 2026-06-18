import React, { useState } from 'react';
import { Sun, Moon, AlertTriangle } from 'lucide-react';

/**
 * Section 2 — Energy Loss.
 * Side-by-side day/night 2D scene: home sells to grid by day, pulls from
 * grid at night, with the 15% distribution-loss callout and two bullets.
 * Styled to echo the reference app (house + tower + flow lines) in 2D SVG.
 */
const BatteryEnergyLoss = () => {
  const [mode, setMode] = useState('day'); // day | night

  const isDay = mode === 'day';

  return (
    <div className="bg-gradient-to-br from-[#0a1628] to-[#13243f] border border-amber-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-300">Where Your Energy Goes</h2>
          <p className="text-slate-300 text-sm mt-1">
            Without a battery, your surplus makes a round trip through the grid — and loses energy both ways.
          </p>
        </div>

        {/* Day / Night toggle */}
        <div className="bg-slate-900/60 rounded-full p-1 flex gap-1 border border-slate-700/50 w-fit">
          <button
            onClick={() => setMode('day')}
            className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
              isDay ? 'bg-amber-400 text-slate-900' : 'text-slate-300'
            }`}
          >
            <Sun size={15} /> Day
          </button>
          <button
            onClick={() => setMode('night')}
            className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
              !isDay ? 'bg-indigo-400 text-slate-900' : 'text-slate-300'
            }`}
          >
            <Moon size={15} /> Night
          </button>
        </div>
      </div>

      {/* 2D scene */}
      <div className="rounded-xl overflow-hidden border border-slate-700/50 mb-6">
        <svg viewBox="0 0 800 360" className="w-full" style={{ display: 'block' }}>
          {/* Sky gradient */}
          <defs>
            <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
            <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="flowDay" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="flowNight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="800" height="360" fill={isDay ? 'url(#skyDay)' : 'url(#skyNight)'} />

          {/* Sun or Moon */}
          {isDay ? (
            <circle cx="180" cy="80" r="38" fill="#fde047">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="3s" repeatCount="indefinite" />
            </circle>
          ) : (
            <>
              <circle cx="180" cy="80" r="32" fill="#e2e8f0" />
              <circle cx="168" cy="72" r="32" fill={isDay ? '#fde047' : '#1e293b'} />
              {[...Array(6)].map((_, i) => (
                <circle key={i} cx={300 + i * 80} cy={40 + (i % 3) * 25} r="1.6" fill="#fff" opacity="0.8" />
              ))}
            </>
          )}

          {/* Ground */}
          <rect x="0" y="300" width="800" height="60" fill={isDay ? '#4ade80' : '#1e3a2e'} />

          {/* House (simple 2D) */}
          <g>
            <rect x="120" y="210" width="170" height="90" fill={isDay ? '#f1f5f9' : '#475569'} />
            <polygon points="110,210 205,160 300,210" fill={isDay ? '#64748b' : '#334155'} />
            {/* Solar panel on roof */}
            <polygon points="175,193 240,193 250,178 185,178" fill="#1e3a8a" stroke="#facc15" strokeWidth="1.5" />
            {/* Door + windows */}
            <rect x="190" y="255" width="30" height="45" fill={isDay ? '#92400e' : '#1e293b'} />
            <rect x="140" y="235" width="28" height="28" fill={isDay ? '#7dd3fc' : '#fbbf24'} opacity="0.9" />
            <rect x="245" y="235" width="28" height="28" fill={isDay ? '#7dd3fc' : '#fbbf24'} opacity="0.9" />
          </g>

          {/* Transmission tower */}
          <g stroke={isDay ? '#94a3b8' : '#64748b'} strokeWidth="3" fill="none">
            <polygon points="640,300 660,170 680,300" fill={isDay ? '#cbd5e1' : '#475569'} stroke="none" />
            <line x1="630" y1="200" x2="690" y2="200" />
            <line x1="635" y1="230" x2="685" y2="230" />
            <line x1="640" y1="260" x2="680" y2="260" />
          </g>

          {/* Flow line between house and grid */}
          {isDay ? (
            // Day: energy flows house -> grid (export)
            <g>
              <line x1="300" y1="250" x2="640" y2="220" stroke="url(#flowDay)" strokeWidth="5" strokeDasharray="14 8">
                <animate attributeName="stroke-dashoffset" values="0;-44" dur="1s" repeatCount="indefinite" />
              </line>
              <polygon points="640,220 624,214 626,228" fill="#22c55e" />
              <text x="470" y="215" fill="#bbf7d0" fontSize="15" fontWeight="bold" textAnchor="middle">Selling to grid →</text>
            </g>
          ) : (
            // Night: energy flows grid -> house (import)
            <g>
              <line x1="640" y1="220" x2="300" y2="250" stroke="url(#flowNight)" strokeWidth="5" strokeDasharray="14 8">
                <animate attributeName="stroke-dashoffset" values="0;44" dur="1s" repeatCount="indefinite" />
              </line>
              <polygon points="300,250 316,244 314,258" fill="#ef4444" />
              <text x="470" y="215" fill="#fecaca" fontSize="15" fontWeight="bold" textAnchor="middle">← Buying from grid</text>
            </g>
          )}

          {/* 15% loss callout on the line */}
          <g>
            <rect x="412" y="250" width="116" height="34" rx="17" fill="#7f1d1d" opacity="0.92" />
            <text x="470" y="272" fill="#fecaca" fontSize="15" fontWeight="bold" textAnchor="middle">−15% lost</text>
          </g>
        </svg>
      </div>

      {/* Caption + bullets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-sm text-slate-200">
          {isDay
            ? 'During the day you produce more than you use, and the surplus is pushed onto the grid.'
            : 'At night your panels are idle, so you buy that power back — at higher rates.'}
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-400/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <span className="text-sm text-slate-200">
              <strong className="text-red-300">15% energy loss</strong> in transmission &amp; distribution on the round trip.
            </span>
          </div>
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-400/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <span className="text-sm text-slate-200">
              The grid has moved to <strong className="text-red-300">Time-of-Use rates</strong> and slashed solar buyback.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatteryEnergyLoss;
