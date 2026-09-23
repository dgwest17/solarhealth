/**
 * FILE: src/beach/Swell.jsx
 *
 * SWELL — is the set building, and where are deals leaking out.
 *
 * Two questions, and they need different shapes:
 *
 *   TRAJECTORY    deals and commission by month. A bar per month, because a
 *                 rep is comparing discrete periods, not reading a continuum.
 *   CONVERSION    Met → Project → Installed as a funnel, with the drop
 *                 between each pair named. The drop is the finding; the
 *                 absolute counts are context.
 *
 * Conversion is computed on the CURRENT population, which is worth being
 * honest about: a deal signed last week is still at Project, so a young book
 * always looks like it converts worse than it does. The panel says so rather
 * than quietly reporting a number that flatters or damns unfairly.
 *
 * Rendered by: src/beach/TheBeach.jsx
 */
import React, { useMemo } from 'react';
import { SURF } from '../surf/theme';
import { Swell as SwellIcon } from '../surf/SurfIcons';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SwellPanel = ({ deals = [], byTide = {} }) => {
  const met = (byTide.met || []).length;
  const project = (byTide.project || []).length;
  const installed = (byTide.installed || []).length;

  // Funnel counts are CUMULATIVE — a deal at Installed also passed Met.
  const reachedMet = met + project + installed;
  const reachedProject = project + installed;
  const reachedInstalled = installed;

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

  const trail = useMemo(() => {
    // Last 6 months, oldest first.
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: MONTHS[d.getMonth()],
        year: d.getFullYear(),
        count: 0,
        commission: 0
      });
    }
    const index = Object.fromEntries(buckets.map((b) => [b.key, b]));
    for (const deal of deals) {
      if (!deal.proposalDate) continue;
      const d = new Date(deal.proposalDate);
      if (Number.isNaN(d.getTime())) continue;
      const b = index[`${d.getFullYear()}-${d.getMonth()}`];
      if (!b) continue;
      b.count += 1;
      b.commission += Number(deal.commission) || 0;
    }
    return buckets;
  }, [deals]);

  const peak = Math.max(1, ...trail.map((b) => b.count));
  const recent = trail.slice(-3).reduce((a, b) => a + b.count, 0);
  const prior = trail.slice(0, 3).reduce((a, b) => a + b.count, 0);
  const direction = recent > prior ? 'building' : recent < prior ? 'easing off' : 'holding';

  return (
    <div className="space-y-5">
      {/* --------------------------- trajectory --------------------------- */}
      <div className="rounded-2xl p-6" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex items-center gap-2 mb-1">
          <SwellIcon size={18} style={{ color: SURF.seaBright }} />
          <h3 className="text-[13px] uppercase tracking-[0.18em] font-semibold" style={{ color: SURF.textMuted }}>
            Your last six months
          </h3>
        </div>
        <p className="text-[13px] mb-5" style={{ color: SURF.text }}>
          The set is <b style={{ color: direction === 'building' ? SURF.good : direction === 'easing off' ? SURF.caution : SURF.textBright }}>
            {direction}
          </b> — {recent} proposal{recent === 1 ? '' : 's'} in the last three months against {prior} in the three before.
        </p>

        <div className="flex items-end gap-2 h-40">
          {trail.map((b) => (
            <div key={b.key} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
              {b.commission > 0 && (
                <span className="text-[10px] font-mono" style={{ color: SURF.sun }}>{money(b.commission)}</span>
              )}
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(3, (b.count / peak) * 100)}%`,
                  background: b.count > 0
                    ? `linear-gradient(180deg, ${SURF.seaBright}, ${SURF.sea})`
                    : SURF.surface
                }}
                title={`${b.count} proposal${b.count === 1 ? '' : 's'}`}
              />
              <span className="text-[11px] font-semibold" style={{ color: SURF.textBright }}>{b.count}</span>
              <span className="text-[10.5px]" style={{ color: SURF.textFaint }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------- conversion --------------------------- */}
      <div className="rounded-2xl p-6" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <h3 className="text-[13px] uppercase tracking-[0.18em] font-semibold mb-5" style={{ color: SURF.textMuted }}>
          Where deals go
        </h3>

        <Funnel label="Met" count={reachedMet} width={100} tone={SURF.caution}
                sub="you priced them" />
        <Drop from="Met" to="Project" value={pct(reachedProject, reachedMet)} />
        <Funnel label="Project" count={reachedProject}
                width={reachedMet ? (reachedProject / reachedMet) * 100 : 0} tone={SURF.seaBright}
                sub="they signed" />
        <Drop from="Project" to="Installed" value={pct(reachedInstalled, reachedProject)} />
        <Funnel label="Installed" count={reachedInstalled}
                width={reachedMet ? (reachedInstalled / reachedMet) * 100 : 0} tone={SURF.good}
                sub="it's on" />

        <div className="mt-6 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4"
             style={{ borderTop: `1px solid ${SURF.line}` }}>
          <Ratio label="Close rate" value={pct(reachedProject, reachedMet)} sub="of priced deals sign" />
          <Ratio label="Completion" value={pct(reachedInstalled, reachedProject)} sub="of signed deals installed" />
          <Ratio label="End to end" value={pct(reachedInstalled, reachedMet)} sub="priced to powered on" />
        </div>

        <p className="text-[11.5px] mt-4 max-w-[64ch]" style={{ color: SURF.textFaint }}>
          These count where your deals sit <b style={{ color: SURF.textMuted }}>today</b>, not cohorts. A deal
          signed last week is still at Project, so a young book always reads as converting worse than it does.
          Compare the trend to itself rather than to a target.
        </p>
      </div>
    </div>
  );
};

const Funnel = ({ label, count, width, tone, sub }) => (
  <div className="mb-1">
    <div className="flex items-center justify-between text-[12px] mb-1">
      <span style={{ color: SURF.textBright }}>{label} <span style={{ color: SURF.textFaint }}>· {sub}</span></span>
      <span className="font-mono font-bold" style={{ color: tone }}>{count}</span>
    </div>
    <div className="h-8 rounded-lg overflow-hidden" style={{ background: SURF.surface }}>
      <div className="h-full rounded-lg transition-all"
           style={{ width: `${Math.max(2, width)}%`, background: tone, opacity: .55 }} />
    </div>
  </div>
);

const Drop = ({ from, to, value }) => (
  <div className="flex items-center gap-2 py-1.5 pl-3 text-[11.5px]" style={{ color: SURF.textFaint }}>
    <span>↓</span>
    <span>
      {value === null ? 'no data yet' : (
        <>
          <b style={{ color: value >= 50 ? SURF.good : SURF.caution }}>{value}%</b> of {from} reach {to}
          {value < 100 && <> · {100 - value}% stall here</>}
        </>
      )}
    </span>
  </div>
);

const Ratio = ({ label, value, sub }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>{label}</div>
    <div className="text-2xl font-bold font-mono mt-0.5" style={{ color: SURF.textBright }}>
      {value === null ? '—' : `${value}%`}
    </div>
    <div className="text-[10.5px]" style={{ color: SURF.textFaint }}>{sub}</div>
  </div>
);

export default SwellPanel;
