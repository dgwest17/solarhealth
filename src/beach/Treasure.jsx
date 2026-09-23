/**
 * FILE: src/beach/Treasure.jsx
 *
 * TREASURE — what a rep is owed, and what they have banked.
 *
 * Two very different numbers, kept visually apart on purpose:
 *
 *   IN THE WATER   commission on deals that have not been installed. Real
 *                  work, but not money yet, and some of it will never land.
 *   ON THE SAND    commission on installed jobs. Banked.
 *
 * Conflating them is how a pipeline number becomes a mortgage payment. The
 * pipeline figure is shown with its own conversion caveat rather than as a
 * total a rep can spend against.
 *
 * WHERE THE NUMBERS COME FROM: each deal's commission is the figure the rep
 * configured in Deep Seas and saved with the proposal — contract value above
 * the floor. Nothing here re-derives it from a rate card, because no rate card
 * exists yet in Recruits. When one does, this panel reads it instead and the
 * arithmetic below stays exactly the same.
 *
 * Rendered by: src/beach/TheBeach.jsx
 */
import React, { useMemo } from 'react';
import { SURF, GRADIENTS, FACET_TEXTURE } from '../surf/theme';
import { Treasure as TreasureIcon } from '../surf/SurfIcons';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();

const sum = (list, key) => list.reduce((a, d) => a + (Number(d[key]) || 0), 0);

const TreasurePanel = ({ deals = [], byTide = {} }) => {
  const met = byTide.met || [];
  const project = byTide.project || [];
  const installed = byTide.installed || [];

  const t = useMemo(() => {
    const pipeline = [...met, ...project];
    const pipelineCommission = sum(pipeline, 'commission');
    const installedCommission = sum(installed, 'commission');
    const installedRevenue = sum(installed, 'contractValue');
    const pipelineRevenue = sum(pipeline, 'contractValue');

    // A deal at Project has signed; one at Met has not. Weighting them the
    // same would flatter the pipeline, so they are reported separately and
    // the blended figure is left to the rep rather than asserted here.
    return {
      metCommission: sum(met, 'commission'),
      projectCommission: sum(project, 'commission'),
      pipelineCommission,
      pipelineRevenue,
      installedCommission,
      installedRevenue,
      avgInstalled: installed.length ? installedCommission / installed.length : 0,
      avgPipeline: pipeline.length ? pipelineCommission / pipeline.length : 0,
      count: { met: met.length, project: project.length, installed: installed.length }
    };
  }, [met, project, installed]);

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
