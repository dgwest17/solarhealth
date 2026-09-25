/**
 * FILE: src/beach/Treasure.jsx
 *
 * TREASURE — what a rep is owed, what they have banked, and job by job.
 *
 * Two very different totals, kept visually apart on purpose:
 *
 *   IN THE WATER   commission on deals that have not been installed. Real
 *                  work, but not money yet, and some of it will never land.
 *   ON THE SAND    commission on installed jobs. Banked.
 *
 * Conflating them is how a pipeline number becomes a mortgage payment. The
 * pipeline figure carries its own conversion caveat rather than reading as a
 * total a rep can spend against.
 *
 * ---------------------------------------------------------------------------
 * AND THEN THE JOBS THEMSELVES
 *
 * The totals answer "how much". They do not answer "which jobs", which is the
 * question anybody actually has when a figure looks wrong — and a total nobody
 * can reconcile is a total nobody trusts. So every sold and installed job is
 * listed underneath, and the rows add up to the headline.
 *
 * Only SOLD and INSTALLED appear in the list. A deal at Met is a quote; putting
 * it in a table of jobs invites reading it as work in hand.
 *
 * ---------------------------------------------------------------------------
 * WHO SEES WHAT
 *
 *   A REP   their own share, per job, and nothing else. They do not see the
 *           pool, the Captain's cut or the Recruiter's. The server sends null
 *           and zero for those rather than trusting this file to hide them —
 *           hiding in the UI is a rendering decision, not a control.
 *
 *   AN ADMIN  the pool on each job and who is owed what out of it: self-gen or
 *             closer, setter, Captain, Recruiter. Plus month-to-date totals for
 *             the two override seats, which is how a manager forecasts what the
 *             overrides will cost before the month closes.
 *
 * THE SNAPSHOT IS THE POINT. Percentages are read off each saved proposal, never
 * recomputed from today's rate card, because a comp change would otherwise
 * rewrite what every past deal paid. A rep whose banked total moves overnight
 * stops believing the number, and they would be right to.
 *
 * A BUILDER SEES THEIR HALF HERE TOO. They do not own the contact — the closer
 * does — so the API scopes them in separately by the builder email stored on
 * the deal. Without that, a builder's own Beach would show none of the deals
 * they set, which is exactly the money they most want to see.
 *
 * Rendered by: src/beach/TheBeach.jsx
 */
import React, { useMemo, useState } from 'react';
import { SURF, GRADIENTS, FACET_TEXTURE } from '../surf/theme';
import { Treasure as TreasureIcon } from '../surf/SurfIcons';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
const sum = (list, key) => list.reduce((a, d) => a + (Number(d[key]) || 0), 0);

const seatAmount = (deal, key) =>
  Number((deal.commissionRows || []).find((r) => r.key === key)?.amount || 0);

const fmtDate = (d) => {
  if (!d) return null;
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Is this date inside the current calendar month?
 *
 * Calendar month, not a rolling 30 days, because commission is paid on a
 * calendar cycle and a manager forecasting "this month" means the one the
 * payroll run covers.
 */
const isThisMonth = (d) => {
  if (!d) return false;
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return false;
  const when = new Date(t);
  const now = new Date();
  return when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth();
};

/**
 * Which date decides whether a job counts toward this month.
 *
 * An installed job counts from when it went in; a signed-but-unbuilt job counts
 * from when it was sold. Using one date for both would either drop every
 * installed job whose sale was last quarter, or count a job twice.
 */
const monthDateFor = (d) => (d.tide === 'installed' ? (d.installDate || d.soldDate) : d.soldDate);

const TreasurePanel = ({ deals = [], byTide = {}, role = 'rep', scopedToRep = false, onOpenClient = null }) => {
  const isManager = role === 'admin';
  const met = byTide.met || [];
  const project = byTide.project || [];
  const installed = byTide.installed || [];

  /** Which job list is showing. Installed first — banked money is the anchor. */
  const [listTab, setListTab] = useState('installed');

  const t = useMemo(() => {
    const pipeline = [...met, ...project];
    const pipelineCommission = sum(pipeline, 'commission');
    const installedCommission = sum(installed, 'commission');

    // Override buckets, across every deal: an override is earned on production
    // regardless of which tide it sits in.
    const captain = deals.reduce((a, d) => a + seatAmount(d, 'captain'), 0);
    const recruiter = deals.reduce((a, d) => a + seatAmount(d, 'recruiter'), 0);
    const pool = deals.reduce((a, d) => a + (Number(d.commissionTotal) || 0), 0);

    // MONTH TO DATE. The forecasting numbers — what this month has produced so
    // far, split the way it will actually be paid.
    const mtd = deals.filter((d) => d.tide !== 'met' && isThisMonth(monthDateFor(d)));
    const mtdInstalled = mtd.filter((d) => d.tide === 'installed');

    return {
      metCommission: sum(met, 'commission'),
      projectCommission: sum(project, 'commission'),
      pipelineCommission,
      pipelineRevenue: sum(pipeline, 'contractValue'),
      installedCommission,
      installedRevenue: sum(installed, 'contractValue'),
      avgInstalled: installed.length ? installedCommission / installed.length : 0,
      avgPipeline: pipeline.length ? pipelineCommission / pipeline.length : 0,
      count: { met: met.length, project: project.length, installed: installed.length },
      captain, recruiter, pool,
      selfGenCount: deals.filter((d) => d.selfGen).length,
      mtd: {
        jobs: mtd.length,
        installed: mtdInstalled.length,
        revenue: sum(mtd, 'contractValue'),
        mine: sum(mtd, 'commission'),
        pool: mtd.reduce((a, d) => a + (Number(d.commissionTotal) || 0), 0),
        captain: mtd.reduce((a, d) => a + seatAmount(d, 'captain'), 0),
        recruiter: mtd.reduce((a, d) => a + seatAmount(d, 'recruiter'), 0),
        // Banked this month — the subset a payroll run would actually cover.
        paidOut: mtdInstalled.reduce((a, d) => a + (Number(d.commissionTotal) || 0), 0),
        paidOutMine: sum(mtdInstalled, 'commission')
      }
    };
  }, [met, project, installed, deals]);

  const jobs = listTab === 'installed' ? installed : project;

  return (
    <div className="space-y-5">
      {/* ------------------------- banked ------------------------- */}
      <div className="rounded-3xl p-7 relative overflow-hidden"
           style={{ background: GRADIENTS.barrelSoft, border: `1px solid ${SURF.lineStrong}` }}>
        <div className="absolute inset-0" style={{ backgroundImage: FACET_TEXTURE, opacity: .7 }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
               style={{ color: 'rgba(255,255,255,.8)' }}>
            <TreasureIcon size={16} style={{ color: SURF.sunGlow }} /> On the sand
          </div>
          <div className="text-[64px] leading-none font-extrabold mt-2" style={{ color: '#fff' }}>
            {money(t.installedCommission)}
          </div>
          <p className="text-[14px] mt-2" style={{ color: 'rgba(255,255,255,.85)' }}>
            Earned across {t.count.installed} installed job{t.count.installed === 1 ? '' : 's'}
            {t.installedRevenue > 0 && <> · {money(t.installedRevenue)} in contract value</>}
          </p>
        </div>
      </div>

      {/* --------------------------- month to date ---------------------------
          What this month has produced so far. Its own block rather than a line
          on the banked card, because "all time" and "this month" are the two
          numbers people mix up when they are working out what is coming. */}
      <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: SURF.textMuted }}>
            {new Date().toLocaleDateString('en-US', { month: 'long' })} so far
          </div>
          <div className="text-[11.5px]" style={{ color: SURF.textFaint }}>
            {t.mtd.jobs} job{t.mtd.jobs === 1 ? '' : 's'} · {t.mtd.installed} installed
          </div>
        </div>
        <div className={`grid grid-cols-2 ${isManager ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-px rounded-xl overflow-hidden`}
             style={{ background: SURF.line }}>
          <Split label={isManager ? 'Commission produced' : 'Your commission'}
                 value={money(isManager ? t.mtd.pool : t.mtd.mine)}
                 count={t.mtd.jobs} tone={SURF.sun} />
          <Split label="Installed — banked"
                 value={money(isManager ? t.mtd.paidOut : t.mtd.paidOutMine)}
                 count={t.mtd.installed} tone={SURF.good} />
          <Split label="Contract value" value={money(t.mtd.revenue)} count={t.mtd.jobs}
                 tone={SURF.textBright} />
          {/* THE FORECASTING PAIR. A manager needs to know what the override
              seats will cost this month before the month closes, which is the
              one figure neither the pool nor a rep's share contains. */}
          {isManager && (
            <div className="p-4" style={{ background: SURF.surface }}>
              <div className="text-[11px]" style={{ color: SURF.textMuted }}>Overrides this month</div>
              <div className="flex justify-between gap-2 text-[12.5px] mt-1.5">
                <span style={{ color: SURF.textMuted }}>Captain</span>
                <span className="font-mono font-bold" style={{ color: SURF.seaBright }}>
                  {money(t.mtd.captain)}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-[12.5px]">
                <span style={{ color: SURF.textMuted }}>Recruiter</span>
                <span className="font-mono font-bold" style={{ color: SURF.sun }}>
                  {money(t.mtd.recruiter)}
                </span>
              </div>
            </div>
          )}
        </div>
        <p className="text-[11px] mt-3 max-w-[72ch]" style={{ color: SURF.textFaint }}>
          Calendar month, not a rolling thirty days, because that is the cycle commission is paid on. An
          installed job counts from its install date; a signed job counts from when it sold.
        </p>
      </div>

      {/* ------------------------ in the water ------------------------ */}
      <div className="rounded-2xl p-6" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: SURF.textMuted }}>
              In the water
            </div>
            <div className="text-5xl font-extrabold mt-1" style={{ color: SURF.sun }}>
              {money(t.pipelineCommission)}
            </div>
          </div>
          <div className="text-right text-[12px]" style={{ color: SURF.textMuted }}>
            <div>{money(t.pipelineRevenue)} contract value</div>
            <div>{t.count.met + t.count.project} open deal{t.count.met + t.count.project === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px mt-5 rounded-xl overflow-hidden" style={{ background: SURF.line }}>
          <Split label="Met — priced, not signed" value={money(t.metCommission)}
                 count={t.count.met} tone={SURF.caution} />
          <Split label="Project — signed, in build" value={money(t.projectCommission)}
                 count={t.count.project} tone={SURF.seaBright} />
        </div>

        <p className="text-[11.5px] mt-4 max-w-[62ch]" style={{ color: SURF.textFaint }}>
          Deals at <b style={{ color: SURF.textMuted }}>Met</b> have a price but no signature — some of this
          will not land. Deals at <b style={{ color: SURF.textMuted }}>Project</b> are signed and being built.
          They are kept apart here rather than blended, because a pipeline total spent in advance is how reps
          get hurt.
        </p>
      </div>

      {/* --------------------------- job by job ---------------------------
          The reconciliation. Every row is a job, and the rows add up to the
          headline above — which is what makes the headline checkable. */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${SURF.line}` }}>
        <div className="flex items-center gap-1 px-3 pt-3 pb-2" style={{ background: SURF.deep }}>
          {[['installed', 'Installed', installed.length], ['project', 'Sold, in build', project.length]]
            .map(([id, label, n]) => (
              <button
                key={id}
                onClick={() => setListTab(id)}
                className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold"
                style={listTab === id
                  ? { background: SURF.surface, color: SURF.sun, border: `1px solid ${SURF.line}` }
                  : { background: 'transparent', color: SURF.textMuted, border: '1px solid transparent' }}
              >
                {label} <span style={{ color: SURF.textFaint }}>{n}</span>
              </button>
            ))}
          <span className="ml-auto text-[11px]" style={{ color: SURF.textFaint }}>
            {isManager ? 'Pool and who is owed what' : 'Your share per job'}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px]"
               style={{ background: SURF.surface, color: SURF.textMuted }}>
            {listTab === 'installed' ? 'Nothing installed yet.' : 'Nothing signed and waiting on a build.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: isManager ? 760 : 460 }}>
              <thead>
                <tr style={{ background: SURF.deep }}>
                  <Th>Job</Th>
                  <Th>{listTab === 'installed' ? 'Installed' : 'Sold'}</Th>
                  <Th align="right">Contract</Th>
                  <Th align="right">Yours</Th>
                  {isManager && <Th align="right">Total</Th>}
                  {isManager && <Th>Owed to</Th>}
                  {isManager && <Th align="right">Captain</Th>}
                  {isManager && <Th align="right">Recruiter</Th>}
                </tr>
              </thead>
              <tbody>
                {jobs.map((d) => {
                  const closerSeat = d.selfGen ? 'self' : 'engineer';
                  const closer = seatAmount(d, closerSeat);
                  const builder = seatAmount(d, 'builder');
                  return (
                    <tr key={d.id}
                        onClick={() => onOpenClient && d.contactId && onOpenClient(d.contactId)}
                        className={onOpenClient ? 'cursor-pointer' : ''}
                        style={{ borderTop: `1px solid ${SURF.line}`, background: SURF.surface }}>
                      <td className="px-3 py-2.5">
                        <div className="text-[13px] font-semibold" style={{ color: SURF.textBright }}>
                          {d.name || 'Unnamed'}
                        </div>
                        <div className="text-[10.5px] font-mono" style={{ color: SURF.textFaint }}>
                          {d.battery || d.summary || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono" style={{ color: SURF.textMuted }}>
                        {fmtDate(listTab === 'installed' ? (d.installDate || d.soldDate) : d.soldDate) || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] font-mono text-right"
                          style={{ color: SURF.textMuted }}>
                        {d.contractValue ? money(d.contractValue) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-mono font-bold text-right"
                          style={{ color: SURF.sun }}>
                        {money(d.commission)}
                      </td>
                      {isManager && (
                        <td className="px-3 py-2.5 text-[13px] font-mono text-right"
                            style={{ color: SURF.textBright }}>
                          {money(d.commissionTotal)}
                        </td>
                      )}
                      {/* WHO IS OWED WHAT. Self-gen is one person taking the
                          combined share, so it is named as that rather than
                          shown as a closer with a missing setter. */}
                      {isManager && (
                        <td className="px-3 py-2.5 text-[11.5px]" style={{ color: SURF.textMuted }}>
                          {d.selfGen ? (
                            <div>
                              <span style={{ color: SURF.good }}>Self-gen</span>{' '}
                              <span className="font-mono">{money(closer)}</span>
                              <div style={{ color: SURF.textFaint }}>
                                {d.rep ? String(d.rep).split('@')[0] : '—'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div>
                                Closer <span className="font-mono"
                                             style={{ color: SURF.textBright }}>{money(closer)}</span>
                                <span style={{ color: SURF.textFaint }}>
                                  {' '}{d.rep ? String(d.rep).split('@')[0] : ''}
                                </span>
                              </div>
                              <div>
                                Builder <span className="font-mono"
                                              style={{ color: SURF.textBright }}>{money(builder)}</span>
                                <span style={{ color: SURF.textFaint }}>
                                  {' '}{d.builderName || ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                      {isManager && (
                        <td className="px-3 py-2.5 text-[12px] font-mono text-right"
                            style={{ color: SURF.seaBright }}>
                          {money(seatAmount(d, 'captain'))}
                        </td>
                      )}
                      {isManager && (
                        <td className="px-3 py-2.5 text-[12px] font-mono text-right"
                            style={{ color: SURF.sun }}>
                          {money(seatAmount(d, 'recruiter'))}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------ override buckets ------------------------
          ADMIN ONLY, across the whole book. A rep has no business seeing what
          their captain or the recruiter earned off their production — it is not
          their money, and showing it invites a conversation nobody asked for.
          The server withholds these figures from a rep as well, so this check is
          a courtesy rather than the control. */}
      {isManager && (
        <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
          <div className="text-[11px] uppercase tracking-[0.18em] mb-3" style={{ color: SURF.textMuted }}>
            Override income {scopedToRep ? '· this rep' : '· whole book'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl overflow-hidden"
               style={{ background: SURF.line }}>
            <Split label="Captain — 12% of the book" value={money(t.captain)}
                   count={deals.length} tone={SURF.seaBright} />
            <Split label="Recruiter — 4% of the book" value={money(t.recruiter)}
                   count={deals.length} tone={SURF.sun} />
            <Split label="Total commission paid out" value={money(t.pool)}
                   count={deals.length} tone={SURF.textBright} />
          </div>
          <p className="text-[11.5px] mt-3 max-w-[70ch]" style={{ color: SURF.textFaint }}>
            Percentages come from each deal&rsquo;s own saved split, not today&rsquo;s rate card — so changing the
            comp plan does not rewrite what past deals paid.
            {t.selfGenCount > 0 && <> {t.selfGenCount} of these were self-gen, where one rep took the combined share.</>}
          </p>
        </div>
      )}

      {/* --------------------------- averages --------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-2xl overflow-hidden"
           style={{ background: SURF.line }}>
        <Stat label="Average, installed" value={money(t.avgInstalled)} sub="per job you finished" />
        <Stat label="Average, open" value={money(t.avgPipeline)} sub="per deal in the water" />
      </div>

      {deals.length === 0 && (
        <p className="text-center py-8 text-[13px]" style={{ color: SURF.textMuted }}>
          Nothing to count yet. Commission appears here once you save a proposal in Deep Seas.
        </p>
      )}
    </div>
  );
};

const Th = ({ children, align = 'left' }) => (
  <th className="px-3 py-2 text-[10.5px] uppercase tracking-wider whitespace-nowrap"
      style={{ color: SURF.textMuted, textAlign: align }}>
    {children}
  </th>
);

const Split = ({ label, value, count, tone }) => (
  <div className="p-4" style={{ background: SURF.surface }}>
    <div className="text-[11px]" style={{ color: SURF.textMuted }}>{label}</div>
    <div className="text-2xl font-bold font-mono mt-1" style={{ color: tone }}>{value}</div>
    <div className="text-[11px]" style={{ color: SURF.textFaint }}>{count} deal{count === 1 ? '' : 's'}</div>
  </div>
);

const Stat = ({ label, value, sub }) => (
  <div className="p-5" style={{ background: SURF.deep }}>
    <div className="text-[11.5px]" style={{ color: SURF.textMuted }}>{label}</div>
    <div className="text-2xl font-bold font-mono mt-1" style={{ color: SURF.textBright }}>{value}</div>
    <div className="text-[11px] mt-0.5" style={{ color: SURF.textFaint }}>{sub}</div>
  </div>
);

export default TreasurePanel;
