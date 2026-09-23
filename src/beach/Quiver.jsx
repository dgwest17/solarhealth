/**
 * FILE: src/beach/Quiver.jsx
 *
 * QUIVER — the rep's training rack.
 *
 * A quiver is the set of boards you pick from depending on conditions, which
 * is the right shape for training: not a course you finish once, but a rack
 * you come back to when you hit something you can't handle.
 *
 * Progress is PER REP and stored per rep, because "have I done this" is a
 * personal question. It lives in the same Supabase client_data pattern as
 * everything else, keyed on the rep's email rather than a contact id.
 *
 * The catalogue itself is admin-editable, so Dave can move the material from
 * yourenergybest.com/become in without a deploy. It ships empty rather than
 * with invented placeholder courses — a training centre listing modules that
 * do not exist teaches reps to ignore it.
 *
 * Rendered by: src/beach/TheBeach.jsx
 */
import React, { useState, useEffect, useMemo } from 'react';
import { SURF, GRADIENTS, FACET_TEXTURE } from '../surf/theme';
import { Quiver as QuiverIcon, Barrel } from '../surf/SurfIcons';
import { useSettings } from '../admin/SettingsContext';
import { apiFetch } from '../lib/supabaseClient';

/**
 * Sections a resource can sit in. Fixed, because an open taxonomy turns into
 * forty categories with one item each.
 */
export const QUIVER_SECTIONS = [
  { id: 'fundamentals', label: 'Fundamentals', blurb: 'How the money actually works' },
  { id: 'objections',   label: 'Objections',   blurb: 'What they say, and what is behind it' },
  { id: 'product',      label: 'Product',      blurb: 'Hardware, warranties, programs' },
  { id: 'process',      label: 'Process',      blurb: 'From knock to permission to operate' },
  { id: 'tools',        label: 'The Tools',    blurb: 'Getting the most out of this platform' }
];

const QuiverPanel = ({ userEmail = '', role = 'rep' }) => {
  const { settings } = useSettings();
  const resources = (settings && settings.quiver) || [];

  const [done, setDone] = useState({});
  const [section, setSection] = useState('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch(`/api/quiver-progress?rep=${encodeURIComponent(userEmail)}`);
        if (!cancelled && r && r.progress) setDone(r.progress);
      } catch { /* no progress yet is the normal first-run case */ }
    })();
    return () => { cancelled = true; };
  }, [userEmail]);

  const toggle = async (id) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    if (!userEmail) return;
    setSaving(true);
    try {
      await apiFetch('/api/quiver-progress', {
        method: 'POST',
        body: JSON.stringify({ rep: userEmail, progress: next })
      });
    } catch {
      // Ticking a box is not worth interrupting anyone over; the local state
      // stands and the next toggle retries the write.
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(
    () => (section === 'all' ? resources : resources.filter((r) => r.section === section)),
    [resources, section]
  );

  const completed = resources.filter((r) => done[r.id]).length;
  const pct = resources.length ? Math.round((completed / resources.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-7 relative overflow-hidden"
           style={{ background: GRADIENTS.barrelSoft, border: `1px solid ${SURF.lineStrong}` }}>
        <div className="absolute inset-0" style={{ backgroundImage: FACET_TEXTURE, opacity: .7 }} />
        <div className="relative flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
                 style={{ color: 'rgba(255,255,255,.8)' }}>
              <QuiverIcon size={16} style={{ color: SURF.sunGlow }} /> Your rack
            </div>
            <div className="text-[52px] leading-none font-extrabold mt-2" style={{ color: '#fff' }}>
              {completed}<span className="text-2xl" style={{ color: 'rgba(255,255,255,.6)' }}>/{resources.length}</span>
            </div>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,.8)' }}>
              {resources.length === 0
                ? 'Nothing racked yet.'
                : pct === 100 ? 'Everything ridden. Nice.' : `${pct}% of the rack`}
            </p>
          </div>
          {resources.length > 0 && (
            <div className="w-full sm:w-64">
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.35)' }}>
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${pct}%`, background: SURF.sunGlow }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
          <Barrel size={38} style={{ color: SURF.textFaint }} className="mx-auto mb-4" />
          <p className="text-[14px] max-w-[46ch] mx-auto" style={{ color: SURF.textMuted }}>
            The rack is empty. {role === 'admin'
              ? 'Add trainings in Admin → Platform Defaults → Quiver, and they appear here for every rep.'
              : 'Dave is still moving the training material across.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {[{ id: 'all', label: 'Everything' }, ...QUIVER_SECTIONS].map((sct) => (
              <button
                key={sct.id} onClick={() => setSection(sct.id)}
                className="px-4 py-2 rounded-lg text-[12.5px] font-semibold"
                style={section === sct.id
                  ? { background: SURF.sun, color: SURF.abyss }
                  : { background: SURF.deep, color: SURF.textMuted, border: `1px solid ${SURF.line}` }}
              >{sct.label}</button>
            ))}
          </div>

          <div className="space-y-2">
            {visible.map((r) => {
              const isDone = !!done[r.id];
              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 flex items-start gap-4"
                  style={{
                    background: isDone ? 'rgba(79,191,155,.10)' : SURF.deep,
                    border: `1px solid ${isDone ? 'rgba(79,191,155,.35)' : SURF.line}`
                  }}
                >
                  <button
                    onClick={() => toggle(r.id)}
                    className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center font-bold text-sm mt-0.5"
                    style={{
                      background: isDone ? SURF.good : 'transparent',
                      border: `1.5px solid ${isDone ? SURF.good : SURF.lineStrong}`,
                      color: SURF.abyss
                    }}
                    aria-label={isDone ? 'Mark not done' : 'Mark done'}
                  >{isDone ? '✓' : ''}</button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: SURF.textBright }}>{r.title}</span>
                      {r.duration && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{ background: SURF.surface, color: SURF.textMuted }}>{r.duration}</span>
                      )}
                      {r.required && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(232,163,61,.18)', color: SURF.sun }}>Required</span>
                      )}
                    </div>
                    {r.blurb && (
                      <p className="text-[12.5px] mt-1" style={{ color: SURF.textMuted }}>{r.blurb}</p>
                    )}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                         className="inline-block mt-2 text-[12.5px] font-semibold"
                         style={{ color: SURF.seaBright }}>
                        Open →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {saving && <p className="text-[11px] text-center" style={{ color: SURF.textFaint }}>Saving…</p>}
        </>
      )}
    </div>
  );
};

export default QuiverPanel;
