import React from 'react';
import { TOU_RATES, TOU_WINDOWS } from '../utils/rateData';

/**
 * 24-hour time-of-use chart: colored bands show when power is cheap vs
 * expensive, with the utility's actual rates. Red = peak, amber = off-peak,
 * green = super off-peak.
 */
const COLORS = { peak: '#ef4444', offPeak: '#f59e0b', superOffPeak: '#10b981' };

const TouChart = ({ utility = 'SDGE' }) => {
  const rates = TOU_RATES[utility] || TOU_RATES.SCE;
  const win = TOU_WINDOWS[utility] || TOU_WINDOWS.SDGE;
  const bandFor = (h) => {
    if (h >= win.peak[0] && h < win.peak[1]) return 'peak';
    if (h >= win.superOffPeak[0] && h < win.superOffPeak[1]) return 'superOffPeak';
    return 'offPeak';
  };
  const W = 720, H = 96, barY = 30, barH = 30;
  const x = (h) => (h / 24) * W;

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
      <div className="text-xs text-slate-300 uppercase tracking-wider mb-2">
        When power is expensive — {utility} time-of-use
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        {Array.from({ length: 24 }, (_, h) => (
          <rect key={h} x={x(h)} y={barY} width={W / 24} height={barH}
            fill={COLORS[bandFor(h)]} opacity={bandFor(h) === 'peak' ? 0.95 : 0.75} />
        ))}
        {/* hour ticks */}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <g key={h}>
            <line x1={x(h)} y1={barY + barH} x2={x(h)} y2={barY + barH + 4} stroke="#64748b" />
            <text x={x(h)} y={barY + barH + 15} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
            </text>
          </g>
        ))}
        {/* sun span hint */}
        <text x={x(12.5)} y={barY - 8} fontSize="10" fill="#fbbf24" textAnchor="middle">☀ solar producing</text>
        <line x1={x(7)} y1={barY - 4} x2={x(18)} y2={barY - 4} stroke="#fbbf24" strokeDasharray="3 3" opacity="0.7" />
      </svg>
      <div className="flex flex-wrap gap-4 mt-1 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.peak }} /> Peak ${rates.peak}/kWh</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.offPeak }} /> Off-peak ${rates.offPeak}/kWh</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.superOffPeak }} /> Super off-peak ${rates.superOffPeak}/kWh</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5">
        Solar earns credits midday (cheap hours) — the home buys back in the red zone. A battery moves your solar into the red.
      </p>
    </div>
  );
};

export default TouChart;
