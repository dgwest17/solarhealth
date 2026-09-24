/**
 * FILE: src/beach/TheBeach.jsx
 *
 * THE BEACH — where a rep sees their own book.
 *
 * Three tides, left to right, matching how a deal actually moves:
 *
 *   MET        a proposal exists, nothing signed
 *   PROJECT    the actionable steps are done, it's being built
 *   INSTALLED  it's on, the money is real
 *
 * And three buttons that answer the three questions a rep actually has:
 *
 *   TREASURE   what am I owed, and what have I banked
 *   SWELL      am I getting better, and where do I leak deals
 *   QUIVER     how do I get better
 *
 * A note on where commission comes from. Recruits carries `Level` and nothing
 * else — no rate table, no per-deal figure. Rather than invent one, Treasure
 * reads the commission already stored on each saved proposal, which is the
 * number the rep actually configured in Deep Seas. That makes it correct by
 * construction, and it means the pipeline total is the sum of real quotes
 * rather than an estimate from a rate card nobody has written yet.
 *
 * Rendered by: src/App.jsx (view === 'beach')
 */
import React, { useState, useMemo, useEffect } from 'react';
import { SURF, GRADIENTS, FACET_TEXTURE } from '../surf/theme';
import { Beach as BeachIcon, Treasure as TreasureIcon, Swell as SwellIcon, Quiver as QuiverIcon, Buoy as BuoyIcon } from '../surf/SurfIcons';
import { apiFetch } from '../lib/supabaseClient';
import TreasurePanel from './Treasure';
import SwellPanel from './Swell';
import QuiverPanel from './Quiver';
import Pipeline from './Pipeline';
import Forecast from './Forecast';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();

/** The three tides, in the order a deal crosses them. */
export const TIDES = [
  { id: 'met',       label: 'Met',       blurb: 'Priced, not signed',  tone: SURF.caution },
  { id: 'project',   label: 'Project',   blurb: 'Signed, in build',    tone: SURF.seaBright },
  { id: 'installed', label: 'Installed', blurb: 'On and earning',      tone: SURF.good }
];

const PANELS = [
  { id: 'pipeline', label: 'Pipeline', Icon: BuoyIcon,     blurb: 'Every deal, and who needs a call' },
  { id: 'forecast', label: 'Forecast', Icon: SwellIcon,    blurb: 'Doors per day to hit a number' },
  { id: 'treasure', label: 'Treasure', Icon: TreasureIcon, blurb: 'What you are owed' },
  { id: 'swell',    label: 'Swell',    Icon: SwellIcon,    blurb: 'How you are trending' },
  { id: 'quiver',   label: 'Quiver',   Icon: QuiverIcon,   blurb: 'Sharpen your tools' }
];

const TheBeach = ({ role = 'rep', userEmail = '', onOpenClient = null }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tide, setTide] = useState('met');
  const [panel, setPanel] = useState(null);
  // Admins can look at any rep's beach; a rep only ever sees their own.
  const [repFilter, setRepFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const q = repFilter ? `?rep=${encodeURIComponent(repFilter)}` : '';
        const r = await apiFetch(`/api/beach${q}`);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [repFilter]);

  const deals = (data && data.deals) || [];
  const byTide = useMemo(() => ({
    met:       deals.filter((d) => d.tide === 'met'),
    project:   deals.filter((d) => d.tide === 'project'),
    installed: deals.filter((d) => d.tide === 'installed')
  }), [deals]);

  const active = byTide[tide] || [];

  return (
    <div style={{ background: SURF.abyss, minHeight: '100vh', color: SURF.text }}>
      {/* ---------------------------- the shore ---------------------------- */}
      <header className="relative overflow-hidden" style={{ background: GRADIENTS.barrel }}>
        <div className="absolute inset-0" style={{ backgroundImage: FACET_TEXTURE, opacity: .85 }} />
        <div className="relative max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3"
                  style={{ color: '#fff' }}>
                <BeachIcon size={34} style={{ color: SURF.sunGlow }} /> The Beach
              </h1>
              <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,.75)' }}>
                {repFilter || userEmail || 'Your book'} · {deals.length} deal{deals.length === 1 ? '' : 's'}
              </p>
            </div>

            {role === 'admin' && data && data.reps && data.reps.length > 0 && (
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>
                  Viewing
                </label>
                <select
                  value={repFilter} onChange={(e) => setRepFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(0,0,0,.3)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}
                >
                  <option value="">Everyone</option>
                  {data.reps.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* the three buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7">
            {PANELS.map(({ id, label, Icon, blurb }) => (
              <button
                key={id}
                onClick={() => setPanel(panel === id ? null : id)}
                className="rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
                style={{
                  background: panel === id ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.26)',
                  border: `1px solid ${panel === id ? SURF.sunGlow : 'rgba(255,255,255,.18)'}`
                }}
              >
                <Icon size={24} style={{ color: panel === id ? SURF.sunGlow : '#fff' }} />
                <div className="font-bold mt-2" style={{ color: '#fff' }}>{label}</div>
                <div className="text-[11.5px]" style={{ color: 'rgba(255,255,255,.7)' }}>{blurb}</div>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-xl p-4 text-[13px]"
               style={{ background: 'rgba(209,88,74,.15)', border: `1px solid ${SURF.danger}55`, color: '#f6c9c3' }}>
            {error}
          </div>
        )}
        {loading && (
          <div className="text-center py-10" style={{ color: SURF.textMuted }}>Reading the water…</div>
        )}

        {/* the open panel */}
        {!loading && panel === 'pipeline' && <Pipeline deals={deals} onOpenClient={onOpenClient} />}
        {panel === 'forecast' && <Forecast role={role} />}
        {!loading && panel === 'treasure' && <TreasurePanel deals={deals} byTide={byTide} />}
        {!loading && panel === 'swell'    && <SwellPanel deals={deals} byTide={byTide} />}
        {!loading && panel === 'quiver'   && <QuiverPanel userEmail={userEmail} role={role} />}

        {/* ---------------------------- the tides ---------------------------- */}
        {!loading && !panel && (
          <>
            <div className="grid grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ background: SURF.line }}>
              {TIDES.map((t) => {
                const list = byTide[t.id] || [];
                const on = tide === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTide(t.id)}
                    className="p-5 text-left transition-colors"
                    style={{ background: on ? SURF.surface : SURF.deep }}
                  >
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>
                      {t.label}
                    </div>
                    <div className="text-3xl font-bold mt-1" style={{ color: on ? t.tone : SURF.textBright }}>
                      {list.length}
                    </div>
                    <div className="text-[11.5px]" style={{ color: SURF.textFaint }}>{t.blurb}</div>
                  </button>
                );
              })}
            </div>

            {active.length === 0 ? (
              <div className="rounded-2xl p-12 text-center"
                   style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
                <BeachIcon size={36} style={{ color: SURF.textFaint }} className="mx-auto mb-3" />
                <p style={{ color: SURF.textMuted }}>
                  {tide === 'met'
                    ? 'Nothing priced yet. Save a proposal from Deep Seas and it lands here.'
                    : `Nothing at ${tide} yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {active.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onOpenClient && d.contactId && onOpenClient(d.contactId)}
                    className="w-full rounded-xl p-4 text-left flex items-center justify-between gap-4 transition-colors hover:brightness-125"
                    style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate" style={{ color: SURF.textBright }}>
                        {d.name || 'Unnamed'}
                      </div>
                      <div className="text-[12px] font-mono truncate" style={{ color: SURF.textMuted }}>
                        {d.summary || '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {d.commission > 0 && (
                        <div className="font-mono font-bold" style={{ color: SURF.sun }}>{money(d.commission)}</div>
                      )}
                      {d.proposalDate && (
                        <div className="text-[11px]" style={{ color: SURF.textFaint }}>
                          {new Date(d.proposalDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TheBeach;
