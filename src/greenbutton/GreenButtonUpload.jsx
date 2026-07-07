import React, { useState, useRef } from 'react';
import { Upload, FileCheck2, AlertCircle, Zap, Sun, Moon, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { parseGreenButton, deriveAnnualUsage } from './GreenButtonParser';

/**
 * Green Button upload card.
 *
 * Parses a utility interval CSV in the browser (nothing leaves the page),
 * shows what was measured (imports / exports / hourly shape / TOU split), and
 * on "Apply" hands the profile to the parent:
 *   onApply(profile, derivedUsage | null)
 * The parent decides what to do with it (set usage, seed battery import/export).
 */
const GreenButtonUpload = ({ utility = 'SDGE', annualProduction = 0, onApply, applied = false }) => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setError('');
    setProfile(null);
    try {
      const text = await file.text();
      const p = parseGreenButton(text, utility);
      if (!p.ok) setError(p.error);
      else setProfile(p);
    } catch (e) {
      setError(`Could not read file: ${e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const derivedUsage = profile ? deriveAnnualUsage(profile, annualProduction) : null;

  const chartData = profile
    ? profile.hourlyImport.map((v, h) => ({
        hour: `${h}`,
        Imports: v,
        Exports: profile.hourlyExport[h]
      }))
    : [];

  const pct = (v) => `${Math.round(v * 100)}%`;

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-emerald-500/30 rounded-xl shadow-2xl p-5 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-emerald-300 flex items-center gap-2">
          <Zap size={18} className="text-emerald-400" /> Green Button Data
        </h3>
        {profile && (
          <button onClick={() => { setProfile(null); if (fileRef.current) fileRef.current.value = ''; }}
            className="text-slate-400 hover:text-emerald-300" title="Clear">
            <X size={16} />
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Upload the client's utility interval export (SDG&E 15-minute CSV) to replace estimates with
        measured grid data. Parsed in your browser — the file isn't uploaded anywhere.
      </p>

      {!profile && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/40 rounded-xl p-6 cursor-pointer hover:border-emerald-400/70 hover:bg-emerald-500/5 transition-colors">
          <Upload size={26} className="text-emerald-400 mb-2" />
          <span className="text-sm text-emerald-200 font-medium">
            {parsing ? 'Parsing…' : 'Click to choose the Green Button CSV'}
          </span>
          <span className="text-[11px] text-slate-500 mt-1">SDG&E "Electric 15 Minute" export · other utilities coming</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => handleFile(e.target.files && e.target.files[0])} />
        </label>
      )}

      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-400/40 rounded-lg p-3 flex items-start gap-2 text-sm text-red-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {profile && (
        <div>
          {/* What we measured */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <FileCheck2 size={14} className="text-emerald-400" />
            {profile.meta.name && <span>{profile.meta.name} · </span>}
            {profile.days} days · meter {profile.meta.meter} · {profile.meta.readingStart} → {profile.meta.readingEnd}
          </div>

          {profile.warning && (
            <div className="mb-3 bg-amber-500/10 border border-amber-400/40 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {profile.warning}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <Cell label="Grid imports (annualized)" value={`${profile.annualImportKwh.toLocaleString()} kWh`} accent="text-red-300" />
            <Cell label="Solar exports (annualized)" value={profile.hasGeneration ? `${profile.annualExportKwh.toLocaleString()} kWh` : '— none in file'} accent="text-emerald-300" />
            <Cell label="Net grid usage" value={`${profile.annualNetKwh.toLocaleString()} kWh`} accent="text-cyan-300" />
          </div>

          {/* Hourly shape */}
          <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">Hourly profile (measured, kWh over range)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barGap={0}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} width={34} />
                <Tooltip contentStyle={{ background: '#0f1e36', border: '1px solid #334155', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Imports" fill="#f87171" />
                {profile.hasGeneration && <Bar dataKey="Exports" fill="#34d399" />}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* TOU split of purchases */}
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <Cell label="Bought at peak" value={pct(profile.touImportShare.peak)} accent="text-red-300" icon={<Moon size={12} />} />
            <Cell label="Bought off-peak" value={pct(profile.touImportShare.offPeak)} accent="text-amber-300" />
            <Cell label="Bought super-off-peak" value={pct(profile.touImportShare.superOffPeak)} accent="text-emerald-300" icon={<Sun size={12} />} />
          </div>

          {derivedUsage != null ? (
            <p className="text-xs text-slate-400 mb-3">
              With production of {Number(annualProduction).toLocaleString()} kWh/yr, total house consumption works out to
              <span className="text-cyan-300 font-semibold"> {derivedUsage.toLocaleString()} kWh/yr</span> (production − exports + imports).
            </p>
          ) : (
            <p className="text-xs text-amber-300/80 mb-3">
              This file shows grid flows only. Enter the system's annual production to derive total house consumption.
            </p>
          )}

          <button
            onClick={() => onApply && onApply(profile, derivedUsage)}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all bg-emerald-500 hover:bg-emerald-400 text-slate-900"
          >
            {applied ? '↻ Re-apply measured data (e.g. after entering production)' : 'Apply measured data to audit & battery'}
          </button>
        </div>
      )}
    </div>
  );
};

const Cell = ({ label, value, accent = 'text-slate-100', icon = null }) => (
  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center">
    <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">{icon}{label}</div>
    <div className={`text-base font-bold mt-0.5 ${accent}`}>{value}</div>
  </div>
);

export default GreenButtonUpload;
