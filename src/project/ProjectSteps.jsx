/**
 * FILE: src/project/ProjectSteps.jsx
 *
 * GETTING STARTED — the page a customer lands on when they say yes.
 *
 * The proposal answers "should I". This answers "how do I begin", and it is a
 * different job: fewer words, one obvious next action, and visible progress so
 * a half-finished signup does not feel abandoned.
 *
 * Three things someone can actually do — Qualification, Paperwork, Site
 * Inspection — and five more that happen to them afterwards, shown so they
 * know what they bought. Completing the three moves the deal to Converted to
 * Project. That gate lives in proposalModel.allStepsComplete, not here, so the
 * rule is stated once.
 *
 * DESIGNED FOR SOMEONE ON A PHONE, ALONE. Every step is independently startable
 * — nothing is blocked on the step before it, because a customer who can't do
 * Paperwork until a technician has visited will simply do nothing. Order is a
 * recommendation, not a lock.
 *
 * Rendered by: src/App.jsx (view === 'project'), and linked from the proposal.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { SURF, GRADIENTS, FACET_TEXTURE } from '../surf/theme';
import { Buoy, Heading, Beach } from '../surf/SurfIcons';
import {
  stepsFor, actionableStepsFor, allStepsComplete,
  STEP_STATUS, STEP_LINKS, SALES_STAGE, makeParty
} from '../proposal/proposalModel';
import IntakeForm from './IntakeForm';
import { apiFetch } from '../lib/supabaseClient';

const ProjectSteps = ({
  proposal,
  contact = null,
  contactId = null,
  projectId = null,
  repName = '',
  onProposalChange = null,
  canEdit = true
}) => {
  const [steps, setSteps] = useState((proposal && proposal.steps) || {});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [openIntake, setOpenIntake] = useState(false);
  const [justConverted, setJustConverted] = useState(false);

  useEffect(() => { setSteps((proposal && proposal.steps) || {}); }, [proposal]);

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10"
           style={{ background: SURF.abyss, color: SURF.textMuted }}>
        No proposal to start from yet.
      </div>
    );
  }

  const mode = (proposal.financing && proposal.financing.purchaseType) || 'loan';
  const all = stepsFor(mode);
  const actionable = actionableStepsFor(mode);
  const seller = makeParty((proposal.parties || {}).seller);
  const sellerName = seller.name || 'your advisor';

  const doneCount = actionable.filter((s) => steps[s.id] === STEP_STATUS.COMPLETED).length;
  const complete = allStepsComplete(mode, steps);
  const pct = actionable.length ? Math.round((doneCount / actionable.length) * 100) : 0;

  /**
   * Mark a step and persist. The local state moves first so the tick is
   * instant; a failed write surfaces an error but does not snap the checkbox
   * back, because the customer did the thing either way and re-ticking it is
   * confusing.
   */
  const setStep = async (stepId, status) => {
    if (!canEdit) return;
    const next = { ...steps, [stepId]: status };
    setSteps(next);
    setError('');
    setBusy(stepId);

    const nowComplete = allStepsComplete(mode, next);
    const updated = {
      ...proposal,
      steps: next,
      stage: nowComplete ? SALES_STAGE.CONVERTED : SALES_STAGE.MET
    };
    if (nowComplete && !complete) setJustConverted(true);

    try {
      await apiFetch('/api/project-steps', {
        method: 'POST',
        body: JSON.stringify({ contactId, projectId, stepId, status, steps: next })
      });
      if (onProposalChange) onProposalChange(updated);
    } catch (e) {
      setError(`Saved on this device, but couldn't reach the server: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ background: SURF.abyss, minHeight: '100vh', color: SURF.text }}>
      {/* ------------------------------ header ------------------------------ */}
      <header className="relative overflow-hidden" style={{ background: GRADIENTS.barrel }}>
        <div className="absolute inset-0" style={{ backgroundImage: FACET_TEXTURE, opacity: .85 }} />
        <div className="relative max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] mb-3"
               style={{ color: 'rgba(255,255,255,.78)' }}>
            <Heading size={15} style={{ color: SURF.sunGlow }} /> Getting started
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: '#fff' }}>
            {complete
              ? 'You’re all set.'
              : proposal.client && proposal.client.name
                ? `Let’s get going, ${String(proposal.client.name).split(' ')[0]}.`
                : 'Let’s get going.'}
          </h1>
          <p className="text-[15px] mt-3 max-w-[48ch]" style={{ color: 'rgba(255,255,255,.88)' }}>
            {complete
              ? 'Everything we need from you is done. From here it is our job — we will keep you posted at each step below.'
              : `Three things to do, in any order. ${sellerName} handles the rest.`}
          </p>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.32)' }}>
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${pct}%`, background: complete ? SURF.good : SURF.sunGlow }} />
            </div>
            <span className="text-[13px] font-mono font-bold" style={{ color: '#fff' }}>
              {doneCount}/{actionable.length}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {justConverted && (
          <div className="rounded-2xl p-5 text-center"
               style={{ background: 'rgba(79,191,155,.14)', border: `1px solid ${SURF.good}66` }}>
            <div className="text-lg font-bold" style={{ color: SURF.good }}>That&rsquo;s everything on your side.</div>
            <p className="text-[13px] mt-1" style={{ color: SURF.text }}>
              Your project is officially underway. {sellerName} will be in touch about scheduling.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 text-[12.5px]"
               style={{ background: 'rgba(232,163,61,.14)', border: `1px solid ${SURF.caution}55`, color: '#f7dcae' }}>
            {error}
          </div>
        )}

        {/* --------------------------- your three --------------------------- */}
        <section>
          <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold mb-4"
              style={{ color: SURF.textMuted }}>
            What we need from you
          </h2>
          <div className="space-y-3">
            {actionable.map((step, i) => {
              const status = steps[step.id] || STEP_STATUS.NOT_STARTED;
              const done = status === STEP_STATUS.COMPLETED;
              const href = STEP_LINKS[step.id];
              const isIntake = step.id === 'intake';

              return (
                <div
                  key={step.id}
                  className="rounded-2xl p-5"
                  style={{
                    background: done ? 'rgba(79,191,155,.10)' : SURF.deep,
                    border: `1px solid ${done ? 'rgba(79,191,155,.42)' : SURF.line}`
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold"
                      style={{
                        background: done ? SURF.good : SURF.surface,
                        color: done ? SURF.abyss : SURF.textBright
                      }}
                    >{done ? '✓' : i + 1}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[17px] font-bold" style={{ color: SURF.textBright }}>
                          {step.label}
                        </span>
                        {step.customerPresent && (
                          <span title="You need to be home" style={{ color: SURF.sun }}>★</span>
                        )}
                        {step.duration && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full"
                                style={{ background: SURF.surface, color: SURF.textMuted }}>
                            {step.duration}
                          </span>
                        )}
                      </div>
                      <p className="text-[13.5px] mt-1.5 max-w-[52ch]" style={{ color: SURF.text }}>
                        {step.blurb}
                      </p>

                      {!done && (
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                          {href && (
                            <a
                              href={href} target="_blank" rel="noopener noreferrer"
                              onClick={() => setStep(step.id, STEP_STATUS.IN_PROGRESS)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold"
                              style={{ background: SURF.sun, color: SURF.abyss }}
                            >
                              <Buoy size={15} /> Start
                            </a>
                          )}
                          {isIntake && (
                            <button
                              onClick={() => setOpenIntake(true)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold"
                              style={{ background: SURF.sun, color: SURF.abyss }}
                            >
                              <Buoy size={15} /> Fill in the details
                            </button>
                          )}
                          {step.kind === 'sign' && (
                            <span className="text-[12.5px]" style={{ color: SURF.textMuted }}>
                              {sellerName} sends this to you for signature.
                            </span>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => setStep(step.id, STEP_STATUS.COMPLETED)}
                              disabled={busy === step.id}
                              className="text-[12.5px] font-semibold underline"
                              style={{ color: SURF.seaBright }}
                            >
                              {busy === step.id ? 'Saving…' : 'Mark done'}
                            </button>
                          )}
                        </div>
                      )}

                      {done && canEdit && (
                        <button
                          onClick={() => setStep(step.id, STEP_STATUS.NOT_STARTED)}
                          className="text-[11.5px] mt-3 underline"
                          style={{ color: SURF.textFaint }}
                        >Undo</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------- what happens next ------------------------- */}
        <section>
          <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold mb-4"
              style={{ color: SURF.textMuted }}>
            Then we take it from here
          </h2>
          <ol className="relative pl-7">
            {/* the spine */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ background: SURF.line }} />
            {all.filter((s) => !s.actionable).map((step) => (
              <li key={step.id} className="relative pb-5 last:pb-0">
                <div className="absolute -left-7 top-1 w-[18px] h-[18px] rounded-full border-2"
                     style={{ borderColor: SURF.lineStrong, background: SURF.abyss }} />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: SURF.textBright }}>{step.label}</span>
                  {step.customerPresent && <span title="You need to be home" style={{ color: SURF.sun }}>★</span>}
                  {step.duration && (
                    <span className="text-[11px]" style={{ color: SURF.textFaint }}>{step.duration}</span>
                  )}
                </div>
                <p className="text-[12.5px] mt-0.5 max-w-[52ch]" style={{ color: SURF.textMuted }}>
                  {step.blurb}
                </p>
              </li>
            ))}
          </ol>
          <p className="text-[11.5px] mt-5" style={{ color: SURF.textFaint }}>
            ★ needs you there · typical start to switch-on, 6–10 weeks
          </p>
        </section>

        {/* contact */}
        {(seller.phone || seller.email) && (
          <div className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
               style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
            <Beach size={22} style={{ color: SURF.seaBright }} />
            <div className="flex-1">
              <div className="font-semibold" style={{ color: SURF.textBright }}>Questions at any point?</div>
              <div className="text-[13px]" style={{ color: SURF.textMuted }}>
                {seller.phone && <span>{seller.phone}</span>}
                {seller.phone && seller.email && <span> · </span>}
                {seller.email && <span>{seller.email}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {openIntake && (
        <IntakeForm
          proposal={proposal}
          contact={contact}
          contactId={contactId}
          projectId={projectId}
          repName={repName}
          onClose={() => setOpenIntake(false)}
          // Completes INTAKE, not the site inspection. Submitting a handoff
          // packet is not a technician standing on the roof, and marking the
          // visit done would tell the customer somebody had been.
          onSubmitted={() => { setOpenIntake(false); setStep('intake', STEP_STATUS.COMPLETED); }}
        />
      )}
    </div>
  );
};

export default ProjectSteps;
