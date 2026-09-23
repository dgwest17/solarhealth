/**
 * FILE: src/proposal/CustomerProposal.jsx
 *
 * THE CUSTOMER'S PROPOSAL — what they keep after the rep leaves.
 *
 * This is the artifact that has to do the selling when nobody is in the room.
 * A homeowner reads it at the kitchen table three days later, possibly to a
 * spouse who was never at the appointment. That reader has no context, no
 * rep, and no patience, so the page is built around one question answered in
 * order:
 *
 *   What does it cost me a month?  →  What does it do for me?  →  What now?
 *
 * Design follows the surf tokens: the barrel gradient cold-to-warm, the warm
 * light reserved for the single number that matters, faceted surfaces rather
 * than flat cards. Explicitly NOT a grid of equal-weight cards — the failure
 * mode there is that nothing is emphasised, so the reader has to do the
 * prioritising the page should have done for them.
 *
 * NOTHING REP-FACING RENDERS HERE. `proposal.internal` carries the commission
 * and the floor; this component never reads it. That is enforced by never
 * destructuring it, and by the print styles, since a proposal gets printed
 * and handed over.
 *
 * Rendered by: the rep, from Deep Seas, and served to the customer by link.
 */
import React, { useState } from 'react';
import { GRADIENTS, SURF, FACET_TEXTURE } from '../surf/theme';
import { Heading, Buoy, Beach, Swell, Barrel } from '../surf/SurfIcons';
import BatteryGraphic from '../surf/BatteryGraphic';
import {
  stepsFor, STEP_STATUS, STEP_LINKS, SALES_STAGE, makeParty
} from './proposalModel';

const money = (v) => '$' + Math.round(Math.abs(Number(v) || 0)).toLocaleString();
const money2 = (v) => '$' + Math.abs(Number(v) || 0).toFixed(2);

const CustomerProposal = ({
  proposal,
  onStepChange = null,
  interactive = false
}) => {
  // Graph controls. A customer gets the slider and the unit toggle; the
  // rep-only controls from the Battery Analysis version stay behind.
  const [sliderYear, setSliderYear] = useState(1);
  const [view, setView] = useState('monthly');

  if (!proposal) {
    return (
      <div className="p-10 text-center" style={{ color: SURF.textMuted }}>
        No proposal saved yet.
      </div>
    );
  }

  const f = proposal.financing || {};
  const p = proposal.pricing || {};
  const s = proposal.savings || {};
  const sys = proposal.system || {};
  const ctx = proposal.context || {};
  const steps = stepsFor(f.purchaseType);
  const solar = proposal.solar || null;

  // Whose names go on the page. Never a hard-coded company — an unnamed
  // seller renders as a neutral placeholder rather than somebody else's brand.
  const parties = proposal.parties || {};
  const seller = makeParty(parties.seller);
  const contractor = makeParty(parties.contractor);
  const sellerName = seller.name || 'Your energy advisor';

  // The SAME rows the rep saw — carried on the proposal, not re-projected,
  // so the customer's graph cannot disagree with the appointment.
  const rows = (ctx.projectionRows && ctx.projectionRows.length) ? ctx.projectionRows : [];
  const horizon = rows.length;
  const at = horizon ? rows[Math.min(horizon, Math.max(1, sliderYear)) - 1] : null;
  const scale = (monthly) =>
    view === 'daily' ? (monthly * 12) / 365 : view === 'yearly' ? monthly * 12 : monthly;
  const unit = view === 'daily' ? '/day' : view === 'yearly' ? '/yr' : '/mo';

  const isFinanced = f.purchaseType !== 'cash';
  const headlineNumber = isFinanced ? f.monthlyPayment : p.netInvestment;
  const headlineUnit = isFinanced ? '/month' : 'total';

  const created = proposal.createdAt ? new Date(proposal.createdAt) : new Date();
  const validUntil = new Date(created.getTime() + 30 * 24 * 3600 * 1000);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="min-h-screen"
      style={{ background: SURF.abyss, color: SURF.text, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ============================ THE BARREL ============================ */}
      <header
        className="relative overflow-hidden"
        style={{ background: GRADIENTS.barrel }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: FACET_TEXTURE, opacity: 0.9 }} />
        {/* The light at the end of the tunnel — small, warm, far away. */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 320, height: 320, right: '8%', top: '18%',
            background: `radial-gradient(circle, ${SURF.sunGlow}55 0%, transparent 70%)`
          }}
        />

        <div className="relative max-w-4xl mx-auto px-6 pt-8 pb-14">
          {/* who is on this proposal */}
          <div className="flex items-start justify-between gap-4 mb-12 flex-wrap">
            <div className="flex items-center gap-3">
              {seller.logoUrl ? (
                <img src={seller.logoUrl} alt={sellerName} className="h-10 w-auto" />
              ) : (
                <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                     style={{ background: 'rgba(255,255,255,.14)' }}>
                  <Beach size={22} style={{ color: SURF.sunGlow }} />
                </div>
              )}
              <div>
                <div className="font-semibold tracking-tight" style={{ color: '#fff' }}>{sellerName}</div>
                {seller.tagline && (
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,.65)' }}>{seller.tagline}</div>
                )}
              </div>
            </div>
            <div className="text-right text-[11px]" style={{ color: 'rgba(255,255,255,.7)' }}>
              <div>Prepared {fmt(created)}</div>
              <div>Good through {fmt(validUntil)}</div>
              {contractor.name && (
                <div className="mt-1.5 flex items-center gap-2 justify-end">
                  <span>Installed by {contractor.name}</span>
                  {contractor.logoUrl && (
                    <img src={contractor.logoUrl} alt={contractor.name} className="h-5 w-auto opacity-90" />
                  )}
                </div>
              )}
              {contractor.license && (
                <div style={{ color: 'rgba(255,255,255,.55)' }}>Lic. {contractor.license}</div>
              )}
            </div>
          </div>

          {/* the one number */}
          <p className="text-[13px] uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(255,255,255,.75)' }}>
            {proposal.client && proposal.client.name ? `${proposal.client.name}, your` : 'Your'}{' '}
            {solar ? 'solar + battery system' : 'home battery'}
          </p>
          <div className="flex items-end gap-4 flex-wrap">
            <span
              className="font-extrabold tracking-tight leading-[0.85]"
              style={{ fontSize: 'clamp(64px, 12vw, 132px)', color: '#fff', textShadow: '0 4px 40px rgba(0,0,0,.35)' }}
            >
              {isFinanced ? money2(headlineNumber) : money(headlineNumber)}
            </span>
            <span className="text-2xl mb-3" style={{ color: 'rgba(255,255,255,.85)' }}>{headlineUnit}</span>
          </div>

          {isFinanced && (
            <p className="mt-4 text-lg max-w-[46ch]" style={{ color: 'rgba(255,255,255,.92)' }}>
              <b>$0 down.</b> Fixed for {f.termYears} years
              {!f.prepaymentPenalty && ', with no penalty for paying it off early'}.
              {f.dailyEquivalent > 0 && <> That is about {money2(f.dailyEquivalent)} a day.</>}
            </p>
          )}
          {!isFinanced && (
            <p className="mt-4 text-lg max-w-[46ch]" style={{ color: 'rgba(255,255,255,.92)' }}>
              Paid up front, after the federal credit
              {p.storageRebate > 0 && ' and your storage rebate'}.
            </p>
          )}
        </div>
      </header>

      {/* ========================= WHAT IT DOES ========================= */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <SectionTitle icon={Swell} label="What this changes" />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 items-start">
          <div
            className="rounded-2xl p-6"
            style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}
          >
            <Line label="Your utility bill today" value={money2(s.monthlyBillToday) + '/mo'} />
            <Line label="What the battery saves you" value={'− ' + money2(s.estMonthlySavings) + '/mo'} tone="good" />
            <Line
              label="What's left — your connection charge"
              value={money2(Math.max(s.connectionFee, s.monthlyBillToday - s.estMonthlySavings)) + '/mo'}
            />
            {isFinanced && <Line label="Your battery payment" value={'+ ' + money2(f.monthlyPayment) + '/mo'} />}
            <div
              className="flex justify-between items-baseline mt-4 pt-4"
              style={{ borderTop: `1px solid ${SURF.lineStrong}` }}
            >
              <span style={{ color: SURF.textBright }}>Your new monthly</span>
              <span className="text-3xl font-bold" style={{ color: SURF.sun }}>
                {money2(s.newMonthlyAllIn != null ? s.newMonthlyAllIn : f.monthlyPayment)}
              </span>
            </div>
            <p className="text-[12px] mt-3" style={{ color: SURF.textMuted }}>
              Your utility bill keeps climbing — we've assumed {s.rateEscalationPct}% a year, which is
              roughly what it has done. Your battery payment does not move.
            </p>
          </div>

          <div className="space-y-3">
            {s.twentyYearUtility != null && (
              <Stat
                label="If you stay as you are"
                value={money(s.twentyYearUtility)}
                sub="paid to the utility over 20 years"
                tone="danger"
              />
            )}
            {s.lifetimeDifference != null && s.lifetimeDifference > 0 && (
              <Stat
                label="You keep"
                value={money(s.lifetimeDifference)}
                sub="over the same 20 years"
                tone="sun"
              />
            )}
            {s.breakEvenYear && (
              <Stat label="Break even" value={`Year ${s.breakEvenYear}`} sub="everything after is yours" tone="good" />
            )}
          </div>
        </div>
      </section>

      {/* ===================== THE TWENTY YEARS ===================== */}
      {horizon > 1 && at && (
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
            <SectionTitle icon={Barrel} label={`The next ${horizon} years`} />
            <div className="flex gap-1 rounded-lg p-1" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
              {[['daily', 'Daily'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([k, lbl]) => (
                <button
                  key={k} onClick={() => setView(k)}
                  className="px-3 py-1.5 rounded-md text-[12px] font-semibold"
                  style={view === k
                    ? { background: SURF.sun, color: SURF.abyss }
                    : { background: 'transparent', color: SURF.textMuted }}
                >{lbl}</button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
            <ProposalChart rows={rows} at={at} scale={scale} unit={unit} sliderYear={sliderYear} />

            <input
              type="range" min={1} max={horizon} step={1} value={sliderYear}
              onChange={(e) => setSliderYear(Number(e.target.value))}
              className="w-full mt-2"
              style={{ accentColor: SURF.sun }}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-4 rounded-xl overflow-hidden"
                 style={{ background: SURF.line }}>
              <Cell label={`Utility, year ${at.year}`} value={money2(scale(at.utilityMonthly)) + unit}
                    sub="if nothing changes" tone="danger" />
              <Cell label={`With your system`} value={money2(scale(at.batteryMonthly)) + unit}
                    sub={at.loanMonthly > 0 ? 'payment included' : 'paid off'} tone="sea" />
              <Cell label="Paid to the utility" value={money(at.cumUtility)}
                    sub={`through year ${at.year}`} tone="danger" />
              <Cell label="You're ahead by" value={money(at.netPosition)}
                    sub={at.netPosition >= 0 ? 'and climbing' : 'still catching up'}
                    tone={at.netPosition >= 0 ? 'good' : 'muted'} />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[11px]">
              <Key colour="#64748b" label="Connection fee" />
              <Key colour={SURF.caution} label="Utility energy" />
              <Key colour={SURF.seaBright} label="Your payment" />
              <Key colour={SURF.danger} label="Staying with the utility" dashed />
            </div>
          </div>
        </section>
      )}

      {/* ========================== THE SOLAR ========================== */}
      {solar && (
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <SectionTitle icon={Swell} label="The solar you're adding" />
          <div className="mt-6 rounded-2xl p-6" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>New panels</div>
                <div className="text-3xl font-bold" style={{ color: SURF.textBright }}>{solar.panels}</div>
                {solar.addedKw > 0 && (
                  <div className="text-[11.5px]" style={{ color: SURF.textFaint }}>{solar.addedKw} kW added</div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>New production</div>
                <div className="text-3xl font-bold" style={{ color: SURF.sun }}>
                  {solar.annualProductionKwh ? solar.annualProductionKwh.toLocaleString() : '—'}
                </div>
                <div className="text-[11.5px]" style={{ color: SURF.textFaint }}>kWh per year</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>Total production</div>
                <div className="text-3xl font-bold" style={{ color: SURF.textBright }}>
                  {ctx.annualProduction
                    ? (ctx.annualProduction + (solar.annualProductionKwh || 0)).toLocaleString()
                    : '—'}
                </div>
                <div className="text-[11.5px]" style={{ color: SURF.textFaint }}>kWh per year, after</div>
              </div>
            </div>

            {/* The consequential bit: does this keep their grandfathered tariff? */}
            <div
              className="mt-6 rounded-xl p-4"
              style={{
                background: solar.keepsNemStatus ? 'rgba(79,191,155,.12)' : 'rgba(209,88,74,.12)',
                border: `1px solid ${solar.keepsNemStatus ? 'rgba(79,191,155,.4)' : 'rgba(209,88,74,.45)'}`
              }}
            >
              <div className="font-semibold text-[14px]"
                   style={{ color: solar.keepsNemStatus ? SURF.good : SURF.danger }}>
                {solar.keepsNemStatus
                  ? `Your ${solar.nemVersion || 'net metering'} status is protected.`
                  : `This would restart your ${solar.nemVersion || 'net metering'} clock.`}
              </div>
              <p className="text-[12.5px] mt-1.5 max-w-[62ch]" style={{ color: SURF.text }}>
                {solar.nonExport ? (
                  <>The new panels are designed <b>non-export</b> — everything they make is used or stored at
                  home, never sold back. Because nothing new goes onto the grid, your existing agreement and
                  its rates carry on untouched.</>
                ) : solar.nemAtRisk ? (
                  <>Adding an exporting array to a grandfathered {solar.nemVersion} agreement moves you onto
                  today's tariff, where exported power earns roughly a quarter of what yours earns now. That
                  is usually worth more than the extra production. Ask about a non-export design.</>
                ) : (
                  <>You are already on the current tariff, so adding panels does not change your agreement.</>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ========================= WHAT YOU GET ========================= */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <SectionTitle icon={Beach} label="What you're getting" />

        <div className="mt-6 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-8"
             style={{ background: GRADIENTS.depth, border: `1px solid ${SURF.line}` }}>
          <BatteryGraphic
            count={1 + (sys.units || []).reduce((a, u) => a + (Number(u.qty) || 0), 0)}
            charge={0.84}
            size={230}
            label={sys.baseKwh ? `${sys.baseKwh} kWh` : ''}
          />
          <div className="flex-1">
            {/* The equipment by name. A customer who is going to spend twenty
                thousand dollars will look it up, and a proposal that names only
                a kWh figure reads as if it is avoiding the question. */}
            {(sys.make || sys.model) && (
              <div className="text-[12px] uppercase tracking-[0.16em] mb-1" style={{ color: SURF.sun }}>
                {[sys.make, sys.model].filter(Boolean).join(' ')}
              </div>
            )}
            <div className="text-2xl font-bold" style={{ color: SURF.textBright }}>
              {sys.usableKwh} kWh of usable storage
            </div>
            {(sys.units || []).length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {sys.units.map((u, i) => (
                  <li key={i} className="text-[13px]" style={{ color: SURF.text }}>
                    + {u.qty > 1 ? `${u.qty} × ` : ''}{u.label}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[13.5px] mt-2 max-w-[46ch]" style={{ color: SURF.text }}>
              {(sys.units || []).length
                ? 'The packs work as one system.'
                : 'A single unit, wired into your main panel.'}{' '}
              It fills from your own sun during the day and runs your house through the evening — when
              power costs the most and, in an outage, when you need it.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden"
             style={{ background: SURF.line }}>
          <Cell
            label="Storage"
            value={`${sys.usableKwh} kWh`}
            sub={[sys.make, sys.model].filter(Boolean).join(' ') || 'usable'}
          />
          <Cell label="Backup" value={`~${Math.round((sys.usableKwh || 0) / 0.75)} hrs`} sub="essential loads" />
          <Cell label="Your system" value={ctx.systemSizeKw ? `${ctx.systemSizeKw} kW` : '—'} sub={ctx.utility || ''} />
          <Cell label="Your plan" value={ctx.nemVersion || '—'} sub="net metering" />
        </div>

      </section>

      {/* =========================== NEXT STEPS =========================== */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{ background: GRADIENTS.barrelSoft, border: `1px solid ${SURF.lineStrong}` }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: FACET_TEXTURE, opacity: .7 }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Heading size={20} style={{ color: SURF.sunGlow }} />
              <h3 className="text-2xl font-bold" style={{ color: '#fff' }}>Ready when you are</h3>
            </div>
            <p className="text-[14px] mb-2 max-w-[56ch]" style={{ color: 'rgba(255,255,255,.85)' }}>
              We handle everything. Nothing commits you until the paperwork, and only two steps need you
              at home.
            </p>
            <p className="text-[12px] mb-7" style={{ color: 'rgba(255,255,255,.6)' }}>
              ★ needs you there · typical start to switch-on, 6–10 weeks
            </p>

            <ol className="space-y-3">
              {steps.map((step, i) => {
                const status = (proposal.steps || {})[step.id] || STEP_STATUS.NOT_STARTED;
                const done = status === STEP_STATUS.COMPLETED;
                const href = STEP_LINKS[step.id];
                return (
                  <li
                    key={step.id}
                    className="rounded-2xl p-4 flex items-start gap-4"
                    style={{
                      background: done ? 'rgba(79,191,155,.14)' : 'rgba(0,0,0,.24)',
                      border: `1px solid ${done ? 'rgba(79,191,155,.45)' : 'rgba(255,255,255,.14)'}`
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                      style={{
                        background: done ? SURF.good : 'rgba(255,255,255,.12)',
                        color: done ? SURF.abyss : '#fff'
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" style={{ color: '#fff' }}>{step.label}</span>
                        {step.customerPresent && (
                          <span title="You need to be home" style={{ color: SURF.sun }}>★</span>
                        )}
                        {step.duration && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(255,255,255,.10)', color: 'rgba(255,255,255,.72)' }}>
                            {step.duration}
                          </span>
                        )}
                        {done && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(79,191,155,.25)', color: SURF.good }}>
                            Complete
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] mt-1" style={{ color: 'rgba(255,255,255,.78)' }}>{step.blurb}</p>

                      {!done && href && (
                        <a
                          href={href} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-[13px] font-bold"
                          style={{ background: SURF.sun, color: SURF.abyss }}
                        >
                          <Buoy size={14} /> Start {step.label}
                        </a>
                      )}
                      {!done && !href && step.actionable && (
                        <span className="inline-block mt-3 text-[12px]" style={{ color: 'rgba(255,255,255,.6)' }}>
                          {sellerName} will send this through.
                        </span>
                      )}
                    </div>

                    {/* Only the steps somebody can actually do get a tickbox —
                        nobody marks Permitting complete from a proposal page. */}
                    {interactive && onStepChange && step.actionable && (
                      <label className="flex items-center gap-2 cursor-pointer shrink-0 text-[12px]"
                             style={{ color: 'rgba(255,255,255,.8)' }}>
                        <input
                          type="checkbox" checked={done}
                          onChange={(e) => onStepChange(step.id,
                            e.target.checked ? STEP_STATUS.COMPLETED : STEP_STATUS.NOT_STARTED)}
                          className="w-4 h-4"
                        />
                        Done
                      </label>
                    )}
                  </li>
                );
              })}
            </ol>

            {proposal.stage === SALES_STAGE.CONVERTED && (
              <p className="mt-6 text-[14px] font-semibold" style={{ color: SURF.sunGlow }}>
                Your project is underway.
              </p>
            )}
          </div>
        </div>

        {/* price stack — shown because a proposal that hides its arithmetic
            invites the reader to assume the worst about it */}
        <div className="mt-6 rounded-2xl p-6" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
          <h4 className="text-[13px] uppercase tracking-widest mb-4" style={{ color: SURF.textMuted }}>
            How the price works
          </h4>
          {/* ONE installed price, with everything in it.
              The adders are listed below as inclusions rather than as priced
              line items: a customer reading "+ $4,000 main panel upgrade"
              starts negotiating the line rather than reading the total, and
              the line is not separable anyway — the job needs it or it does
              not happen. The arithmetic still reconciles, because this figure
              is the contract WITH adders. */}
          <Line label="Installed price" value={money(p.contractWithAdders ?? p.contractValue)} />
          <Line label={`Federal tax credit (${Math.round((p.federalPct || 0) * 100)}%)`}
                value={'− ' + money(p.federalAmount)} tone="good" />
          {p.storageRebate > 0 && (
            <Line label="Storage rebate, paid to you" value={'− ' + money(p.storageRebate)} tone="sun" />
          )}
          {(p.adders || []).length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${SURF.line}` }}>
              <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: SURF.textMuted }}>
                Included in that price
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {p.adders.map((a) => (
                  <li key={a.id} className="text-[13px] flex items-baseline gap-2" style={{ color: SURF.text }}>
                    <span style={{ color: SURF.seaBright }}>·</span>
                    <span>
                      {a.units > 1 ? `${a.units} × ` : ''}{a.label}
                      {a.addedKwh ? <span style={{ color: SURF.textFaint }}> ({a.addedKwh} kWh)</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between items-baseline mt-4 pt-4" style={{ borderTop: `1px solid ${SURF.lineStrong}` }}>
            <span style={{ color: SURF.textBright }}>Your net investment</span>
            <span className="text-2xl font-bold" style={{ color: SURF.seaBright }}>{money(p.netInvestment)}</span>
          </div>
          {isFinanced && (
            <div className="mt-4 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
                 style={{ borderTop: `1px solid ${SURF.line}` }}>
              <Term label="Purchase type"
                    value={f.purchaseType === 'loan' ? 'Loan' : f.purchaseType === 'lease' ? 'Lease' : 'Cash'} />
              <Term label="Term" value={f.termYears ? `${f.termYears} years` : '—'} />
              <Term label={f.purchaseType === 'lease' ? 'Annual escalator' : 'Interest rate'}
                    value={f.purchaseType === 'lease'
                      ? `${(f.escalatorPct ?? 0).toFixed(1)}%`
                      : (f.apr != null ? `${(f.apr * 100).toFixed(2)}% fixed` : '—')} />
              <Term label="Total of payments"
                    value={p.totalOfPayments ? money(p.totalOfPayments) : '—'} />
            </div>
          )}
          {isFinanced && (
            <p className="text-[12px] mt-3" style={{ color: SURF.textMuted }}>
              Your {f.termYears}-year payment of {money2(f.monthlyPayment)} is calculated on {money(p.amountFinanced)}
              {p.storageRebate > 0 && !p.rebateAppliedToLoan && (
                <> — the {money(p.storageRebate)} rebate comes to you separately and is yours to keep</>
              )}.
            </p>
          )}
        </div>

        <p className="text-[11px] mt-6 text-center max-w-[60ch] mx-auto" style={{ color: SURF.textFaint }}>
          Savings figures are estimates based on your system, your utility's current rates, and the
          assumptions shown above. They are not guaranteed. Financing is subject to credit approval.
          This proposal is good through {fmt(validUntil)}.
        </p>
      </section>
    </div>
  );
};

/* ---------------------------------------------------------------- pieces */

const SectionTitle = ({ icon: I, label }) => (
  <div className="flex items-center gap-2">
    <I size={18} style={{ color: SURF.seaBright }} />
    <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold" style={{ color: SURF.textMuted }}>
      {label}
    </h2>
  </div>
);

const Line = ({ label, value, tone }) => (
  <div className="flex justify-between items-baseline py-1.5">
    <span className="text-[14px]" style={{ color: SURF.text }}>{label}</span>
    <span
      className="font-mono text-[15px]"
      style={{ color: tone === 'good' ? SURF.good : tone === 'sun' ? SURF.sun : SURF.textBright }}
    >{value}</span>
  </div>
);

const Stat = ({ label, value, sub, tone }) => (
  <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
    <div className="text-[11.5px] mb-1" style={{ color: SURF.textMuted }}>{label}</div>
    <div
      className="text-3xl font-bold"
      style={{ color: tone === 'danger' ? SURF.danger : tone === 'sun' ? SURF.sun : tone === 'good' ? SURF.good : SURF.textBright }}
    >{value}</div>
    <div className="text-[11.5px] mt-1" style={{ color: SURF.textFaint }}>{sub}</div>
  </div>
);

const Cell = ({ label, value, sub, tone }) => (
  <div className="p-5" style={{ background: SURF.deep }}>
    <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: SURF.textMuted }}>{label}</div>
    <div
      className="text-xl font-bold font-mono"
      style={{
        color: tone === 'danger' ? SURF.danger : tone === 'good' ? SURF.good
          : tone === 'sea' ? SURF.seaBright : tone === 'muted' ? SURF.textMuted : SURF.textBright
      }}
    >{value}</div>
    {sub && <div className="text-[11px] mt-0.5" style={{ color: SURF.textFaint }}>{sub}</div>}
  </div>
);

const Term = ({ label, value }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>{label}</div>
    <div className="text-[15px] font-semibold mt-0.5" style={{ color: SURF.textBright }}>{value}</div>
  </div>
);

const Key = ({ colour, label, dashed }) => (
  <span className="flex items-center gap-1.5" style={{ color: SURF.textMuted }}>
    {dashed
      ? <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: colour }} />
      : <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour, opacity: .65 }} />}
    {label}
  </span>
);

/**
 * THE TWENTY-YEAR CHART, customer edition.
 *
 * Same stacked shape as the rep's Battery Analysis graph — connection fee,
 * utility energy, payment — because the whole value of the stack is showing
 * WHICH kind of money is moving. The dashed red line is the alternative.
 * Rep-only controls (Sea Level Rise, escalation editing) stay behind.
 */
const ProposalChart = ({ rows, at, scale, unit, sliderYear }) => {
  const W = 900, H = 260, P = { l: 58, r: 96, t: 16, b: 26 };
  const n = rows.length;
  const peak = Math.max(...rows.map((r) => Math.max(scale(r.utilityMonthly), scale(r.batteryMonthly)))) * 1.1 || 1;
  const X = (i) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - v / peak) * (H - P.t - P.b);

  const band = (lo, hi) => {
    const up = rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(hi(r)).toFixed(1)}`).join(' ');
    const down = rows.slice().reverse()
      .map((r, k) => `L${X(n - 1 - k).toFixed(1)},${Y(lo(r)).toFixed(1)}`).join(' ');
    return `${up} ${down} Z`;
  };
  const fee = (r) => scale(r.connectionFeeMonthly);
  const feeEnergy = (r) => scale(r.connectionFeeMonthly + r.energyMonthly);
  const total = (r) => scale(r.batteryMonthly);
  const markerX = X(Math.min(n, Math.max(1, sliderYear)) - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
      {[0, 1, 2, 3].map((i) => {
        const v = (peak / 3) * i, y = Y(v);
        return (
          <g key={i}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke={SURF.line} strokeWidth="1" />
            <text x={P.l - 8} y={y + 3.5} textAnchor="end" fill={SURF.textMuted}
                  fontSize="10.5" fontFamily="monospace">
              ${Math.round(v).toLocaleString()}
            </text>
          </g>
        );
      })}

      <path d={band(() => 0, fee)} fill="#64748b" fillOpacity=".42" stroke="#64748b" strokeOpacity=".6" strokeWidth="1" />
      <path d={band(fee, feeEnergy)} fill={SURF.caution} fillOpacity=".34" stroke={SURF.caution} strokeOpacity=".55" strokeWidth="1" />
      <path d={band(feeEnergy, total)} fill={SURF.seaBright} fillOpacity=".40" stroke={SURF.seaBright} strokeOpacity=".6" strokeWidth="1" />

      <path
        d={rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(scale(r.utilityMonthly)).toFixed(1)}`).join(' ')}
        fill="none" stroke={SURF.danger} strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round"
      />

      <line x1={markerX} y1={P.t} x2={markerX} y2={H - P.b} stroke={SURF.textBright} strokeWidth="1" opacity=".5" />
      <circle cx={markerX} cy={Y(scale(at.utilityMonthly))} r="4" fill={SURF.danger} stroke={SURF.abyss} strokeWidth="1.5" />
      <circle cx={markerX} cy={Y(total(at))} r="4" fill={SURF.seaBright} stroke={SURF.abyss} strokeWidth="1.5" />
      <text x={markerX + 8} y={Y(scale(at.utilityMonthly)) - 7} fill={SURF.danger} fontSize="10.5" fontFamily="monospace">
        ${Math.abs(scale(at.utilityMonthly)).toFixed(2)}{unit}
      </text>
      <text x={markerX + 8} y={Y(total(at)) + 14} fill={SURF.seaBright} fontSize="10.5" fontFamily="monospace">
        ${Math.abs(total(at)).toFixed(2)}{unit}
      </text>

      {rows.filter((_, i) => i % 3 === 0).map((r, k) => (
        <text key={r.year} x={X(k * 3)} y={H - 6} textAnchor="middle" fill={SURF.textMuted}
              fontSize="10.5" fontFamily="monospace">{r.year}</text>
      ))}
    </svg>
  );
};

export default CustomerProposal;
