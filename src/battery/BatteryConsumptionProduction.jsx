import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea
} from 'recharts';
import { Sun, Zap, ArrowDown } from 'lucide-react';
import { CONSUMPTION_PROFILES, buildDailyOverlay } from './BatteryModel';

/**
 * Section 1 — Production / Consumption overlay.
 * 24-hour (12am–12am) average-day model. Production = yellow,
 * consumption = orange, with daytime overproduction highlighted.
 */
const BatteryConsumptionProduction = ({ inputs, profileKey, setProfileKey }) => {
  const overlay = buildDailyOverlay(
    profileKey,
    inputs.currentAnnualUsage,
    inputs.annualProduction
  );

  // Find the daytime overproduction window (first/last hour with surplus)
  const surplusHours = overlay.data.filter((d) => d.surplus > 0).map((d) => d.hour);
  const surplusStart = surplusHours.length ? Math.min(...surplusHours) : null;
  const surplusEnd = surplusHours.length ? Math.max(...surplusHours) : null;

  return (
    <div className="bg-gradient-to-br from-[#0a1628] to-[#13243f] border border-amber-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-300 flex items-center gap-2">
            <Sun size={24} className="text-amber-400" />
            Production / Consumption
          </h2>
          <p className="text-slate-300 text-sm mt-1">
            The balance between what your system makes and what your home uses, across an average day.
          </p>
        </div>

        {/* Consumption profile selector */}
        <div className="md:text-right">
          <label className="block text-xs text-amber-200/80 mb-1 uppercase tracking-wider">
            Consumption Profile
          </label>
          <select
            value={profileKey}
            onChange={(e) => setProfileKey(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-amber-400/40 rounded-lg bg-slate-900/70 text-slate-100"
          >
            {Object.entries(CONSUMPTION_PROFILES).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend chips */}
      <div className="flex gap-5 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ background: '#facc15' }} />
          <span className="text-sm text-slate-300">Production</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ background: '#f97316' }} />
          <span className="text-sm text-slate-300">Consumption</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={overlay.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#facc15" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#facc15" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="consGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
          <XAxis dataKey="hourLabel" stroke="#94a3b8" fontSize={11} interval={2} />
          <YAxis stroke="#94a3b8" fontSize={11} unit=" kWh" width={60} />
          <Tooltip
            contentStyle={{ background: '#0f1e36', border: '1px solid #facc1555', borderRadius: 8, color: '#e2e8f0' }}
            formatter={(value, name) => [`${value} kWh`, name === 'production' ? 'Production' : 'Consumption']}
            labelFormatter={(l) => `Hour: ${l}`}
          />
          {/* Highlight daytime overproduction window */}
          {surplusStart !== null && (
            <ReferenceArea
              x1={overlay.data[surplusStart].hourLabel}
              x2={overlay.data[surplusEnd].hourLabel}
              fill="#facc15"
              fillOpacity={0.08}
              strokeOpacity={0}
            />
          )}
          <Area type="monotone" dataKey="production" stroke="#facc15" strokeWidth={2} fill="url(#prodGrad)" />
          <Area type="monotone" dataKey="consumption" stroke="#f97316" strokeWidth={2} fill="url(#consGrad)" />
        </AreaChart>
      </ResponsiveContainer>

      {/* Verdict + pointer to Section 2 */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Your Balance</div>
          <div className={`text-xl font-bold mt-1 ${overlay.isOverProducer ? 'text-amber-300' : 'text-orange-400'}`}>
            {overlay.isOverProducer ? 'Over-Producer' : 'Over-Consumer'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {overlay.isOverProducer
              ? 'You make more than you use — much of it leaves your home.'
              : 'You use more than you make on this profile.'}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sun size={12} className="text-amber-400" /> Daytime Surplus Exported
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {overlay.annualDaytimeOverproduction.toLocaleString()} kWh/yr
          </div>
          <div className="text-xs text-slate-400 mt-1">Sent to the grid during the day</div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Zap size={12} className="text-orange-400" /> Nighttime Imported
          </div>
          <div className="text-xl font-bold text-orange-400 mt-1">
            {overlay.annualNighttimeImport.toLocaleString()} kWh/yr
          </div>
          <div className="text-xs text-slate-400 mt-1">Pulled back from the grid at night</div>
        </div>
      </div>

      {overlay.isOverProducer && (
        <div className="mt-5 flex items-center justify-center gap-2 text-amber-300/90 text-sm font-medium">
          <ArrowDown size={16} className="animate-bounce" />
          That daytime surplus is where the energy loss begins — see below
          <ArrowDown size={16} className="animate-bounce" />
        </div>
      )}
    </div>
  );
};

export default BatteryConsumptionProduction;
