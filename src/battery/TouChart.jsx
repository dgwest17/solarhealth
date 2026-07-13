import React, { useState } from 'react';
import { TOU_RATES, TOU_WINDOWS } from '../utils/rateData';

/**
 * 24-hour time-of-use chart: colored bands show when power is cheap vs
 * expensive, with the utility's actual rates. Red = peak, amber = off-peak,
 * green = super off-peak.
 */
const COLORS = { peak: '#ef4444', offPeak: '#f59e0b', superOffPeak: '#10b981' };

const TouChart = ({ utility = 'SDGE' }) => {
  const [middaySop, setMiddaySop] = useState(false);
  const rates = TOU_RATES[utility] || TOU_RATES.SCE;
  const win = TOU_WINDOWS[utility] || TOU_WINDOWS.SDGE;
  const bandFor = (h) => {
    if (h >= win.peak[0] && h < win.peak[1]) return 'peak';
    if (h >= win.superOffPeak[0] && h < win.superOffPeak[1]) return 'superOffPeak';
    if (middaySop && h >= 10 && h < 14) return 'superOffPeak';
    return 'offPeak';
  };
  const W = 720, H = 120, baseY = 92, maxBarH = 62;
  const x = (h) => (h / 24) * W;
  const maxRate = Math.max(rates.peak, rates.offPeak, rates.superOffPeak);
  const barH = (band) => Math.max(10, (rates[band] / maxRate) * maxBarH);

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
      <div className="text-xs text-slate-300 uppercase tracking-wider mb-2">
        When power is expensive — {utility} time-of-use <span className="text-slate-500 normal-case">(taller bar = higher price)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        {Array.from({ length: 24 }, (_, h) => (
          <rect key={h} x={x(h)} y={baseY - barH(bandFor(h))} width={W / 24 - 1} height={barH(bandFor(h))} rx="1.5"
            fill={COLORS[bandFor(h)]} opacity={bandFor(h) === 'peak' ? 0.95 : 0.75} />
        ))}
        {/* hour ticks */}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <g key={h}>
            <line x1={x(h)} y1={baseY} x2={x(h)} y2={baseY + 4} stroke="#64748b" />
            <text x={x(h)} y={baseY + 15} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
            </text>
          </g>
        ))}
        {/* sun span hint */}
        <text x={x(12.5)} y={14} fontSize="10" fill="#fbbf24" textAnchor="middle">☀ solar producing</text>
        <line x1={x(7)} y1={19} x2={x(18)} y2={19} stroke="#fbbf24" strokeDasharray="3 3" opacity="0.7" />
      </svg>
      <div className="flex flex-wrap gap-4 mt-1 text-[11px] text-slate-200">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.peak }} /> Peak ${rates.peak}/kWh</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.offPeak }} /> Off-peak ${rates.offPeak}/kWh</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.superOffPeak }} /> Super off-peak ${rates.superOffPeak}/kWh</span>
      </div>
      <label className="flex items-center gap-2 mt-2 cursor-pointer">
        <input type="checkbox" checked={middaySop} onChange={(e) => setMiddaySop(e.target.checked)} className="w-3.5 h-3.5 accent-emerald-400" />
        <span className="text-[11px] text-slate-300">Show utility shifting super off-peak to 10am–2pm</span>
      </label>
      {middaySop && (
        <p className="text-[11px] text-amber-300 mt-1">
          ⚠ The utility now credits the LEAST exactly when solar produces the MOST — midday exports earn super off-peak value while your evening buy-back stays peak-priced.
        </p>
      )}
      <p className="text-[11px] text-slate-400 mt-1.5">
        Solar earns credits midday (cheap hours) — the home buys back in the red zone. A battery moves your solar into the red.
      </p>
    </div>
  );
};

export default TouChart;
