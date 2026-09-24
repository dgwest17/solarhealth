/**
 * FILE: src/beach/Forecast.jsx
 *
 * FORECAST — how many doors is that goal, actually.
 *
 * A rep says they want $50,000 by Christmas. This turns that into the only
 * number that can be acted on tomorrow morning: doors per day. Everything
 * between the two — installs, closes, appointments, decision makers — is shown
 * because a rep who can see where the funnel leaks can argue with it, and the
 * arguing is the point. A single "knock 43 doors a day" with no working is a
 * number to be dismissed.
 *
 * ---------------------------------------------------------------------------
 * TWO HALVES, DELIBERATELY IN THIS ORDER
 *
 *   WHAT A DEAL PAYS   the commission calculator. What one install is worth to
 *                      THIS rep in THIS seat — which is not the deal's total,
 *                      and the gap between those two is where most commission
 *                      confusion lives.
 *
 *   WHAT THE GOAL COSTS  the funnel, run backwards, and then the goal run
 *                      forward into take-home.
 *
 * The calculator comes first because the funnel is meaningless without it: the
 * whole plan scales on commission-per-install, so getting that wrong by a
 * factor of two halves or doubles every door count below it.
 *
 * INSTALLS, NOT CLOSES. 15% of signed deals never reach installation. Planning
 * on closes overstates income by that much and understates the doors needed —
 * the two errors compound in the same direction, which is the worst kind.
 *
 * GROSS IS NOT TAKE-HOME, and a plan that stops at gross is a plan that
 * disappoints in April. Expenses, tax and investment are sliders because the
 * right values are personal, and the default 28% tax is a placeholder for a
 * conversation with an accountant rather than advice.
 *
 * Rendered by: src/beach/TheBeach.jsx
 */
import React, { useMemo, useState } from 'react';
import { SURF } from '../surf/theme';
import { Swell as SwellIcon, Treasure as TreasureIcon } from '../surf/SurfIcons';
import { useSettings } from '../admin/SettingsContext';
import {
  COMMISSION_ROLES, SELF_GEN_PCT, BATTERY_REDLINE, DEALER_FEE_PCT,
  calcBatteryCommission, shareFor, planFunnel, netIncome,
  FUNNEL_DEFAULTS, NET_DEFAULTS
} from '../pricing/commission';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
const money2 = (v) => '$' + (Number(v) || 0).toFixed(2);
const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

/**
 * What this rep's OWN book says about the two rates it can actually see.
 *
 * A priced deal is an appointment that happened, so met -> project is a real
 * close rate and project -> installed is a real install rate. Doors and
 * decision-makers are not in the CRM at all — nobody logs a knock — so those
 * two stay as the rep's own estimate and this function does not pretend
 * otherwise. Returning null rather than a plausible default is the point:
 * an invented conversion rate propagates into every door count below it.
 */
const measuredRates = (deals) => {
  const met = deals.filter((d) => d.tide === 'met').length;
  const project = deals.filter((d) => d.tide === 'project').length;
  const installed = deals.filter((d) => d.tide === 'installed').length;

  const priced = met + project + installed;     // every deal that got a price
  const signed = project + installed;           // every deal that then signed
  const reachedInstall = installed;

  return {
    priced, signed, installed: reachedInstall,
    // Appointments per close, measured. Needs a signed deal to divide by.
    apptsPerClose: signed > 0 ? priced / signed : null,
    closeRatePct: priced > 0 ? Math.round((signed / priced) * 100) : null,
    // Install rate only means anything once something has actually installed.
    installRate: signed > 0 ? reachedInstall / signed : null,
    installRatePct: signed > 0 ? Math.round((reachedInstall / signed) * 100) : null,
    // Too few deals to read anything into. Three is arbitrary but a rate off
    // one deal is either 0% or 100% and both are lies.
    thin: priced < 3
  };
};

const Forecast = ({ role = 'rep', deals = [] }) => {
  const { settings } = useSettings();
  const C = settings.commission || {};

  const roles = (C.roles && C.roles.length) ? C.roles : COMMISSION_ROLES;
  const selfGenPct = C.selfGenPct != null ? C.selfGenPct : SELF_GEN_PCT;
  const redline = C.batteryRedline != null ? C.batteryRedline : BATTERY_REDLINE;
  const feePct = C.dealerFeePct != null ? C.dealerFeePct : DEALER_FEE_PCT;

  // --- the deal ---
  const [seat, setSeat] = useState('engineer');
  const [selfGen, setSelfGen] = useState(false);
  const [mode, setMode] = useState('loan');
  const [netSale, setNetSale] = useState(20000);
  const [batteryCount, setBatteryCount] = useState(1);

  // --- the goal ---
  const [goal, setGoal] = useState(50000);
  const [months, setMonths] = useState(3);

  // --- what comes out of it ---
  const [expensesPct, setExpensesPct] = useState(NET_DEFAULTS.expensesPct);
  const [taxPct, setTaxPct] = useState(NET_DEFAULTS.taxPct);
  const [investPct, setInvestPct] = useState(NET_DEFAULTS.investPct);

  // --- the funnel, overridable ---
  const baseFunnel = { ...FUNNEL_DEFAULTS, ...(settings.funnel || {}) };
  const [funnel, setFunnel] = useState(baseFunnel);
  const [showFunnel, setShowFunnel] = useState(false);
  const setF = (k) => (v) => setFunnel((f) => ({ ...f, [k]: v }));
  const measured = useMemo(() => measuredRates(deals), [deals]);
  const funnelEdited = Object.keys(baseFunnel).some((k) => funnel[k] !== baseFunnel[k]);

  const deal = useMemo(() => calcBatteryCommission({
    netSale, batteryCount, redlinePerUnit: redline, mode,
    dealerFeePct: feePct, selfGen, roles, selfGenPct
  }), [netSale, batteryCount, redline, mode, feePct, selfGen, roles, selfGenPct]);

  const mine = shareFor(seat, { total: deal.total, selfGen, roles, selfGenPct });

  const plan = useMemo(() => planFunnel({
    goal, months, commissionPerInstall: mine.amount, funnel
  }), [goal, months, mine.amount, funnel]);

  const net = useMemo(
    () => netIncome({ gross: goal, expensesPct, investPct, taxPct }),
    [goal, expensesPct, investPct, taxPct]
  );

  const seatOptions = selfGen
    ? [{ key: 'engineer', label: `Self-gen rep (${selfGenPct}%)` },
       ...roles.filter((r) => r.key === 'captain' || r.key === 'recruiter')]
    : roles;

  return (
    <div className="space-y-5">
      {/* ===================== WHAT A DEAL PAYS ===================== */}
      <section className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] mb-4"
             style={{ color: SURF.sun }}>
          <TreasureIcon size={15} /> What a deal pays
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <Chips
              label="Your seat"
              value={selfGen && (seat === 'builder' || seat === 'engineer') ? 'engineer' : seat}
              onChange={setSeat}
              options={seatOptions.map((r) => [r.key, r.label])}
            />
            <Chips
              label="How it was sourced"
              value={selfGen ? 'self' : 'team'}
              onChange={(v) => setSelfGen(v === 'self')}
              options={[['team', 'Team deal'], ['self', `Self-gen (${selfGenPct}%)`]]}
            />
            <Chips
              label="Paid how"
              value={mode}
              onChange={setMode}
              options={[['loan', 'Loan'], ['cash', 'Cash']]}
            />
            <Num label="Batteries" value={batteryCount} onChange={setBatteryCount} min={1} max={4} />
            <div>
              <Label>Net sale price — what you write it at</Label>
              <input
                type="range"
                min={redline} max={redline + 20000} step={250}
                value={Math.max(redline, Math.min(redline + 20000, netSale))}
                onChange={(e) => setNetSale(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="number"
                  value={netSale}
                  onChange={(e) => setNetSale(Number(e.target.value) || 0)}
                  className="w-32 px-2.5 py-1.5 rounded-lg font-mono text-[13px] focus:outline-none"
                  style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textBright }}
                />
                <span className="text-[11.5px]" style={{ color: SURF.textFaint }}>
                  redline {money(deal.redline)}
                  {deal.batteryCount > 1 ? ` (${deal.batteryCount} × ${money(deal.redlinePerUnit)})` : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl p-4" style={{ background: SURF.surface, border: `1px solid ${SURF.line}` }}>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>
                You make, per install
              </div>
              <div className="text-5xl font-extrabold mt-1" style={{ color: SURF.sun }}>
                {money(mine.amount)}
              </div>
              <div className="text-[12px] mt-1" style={{ color: SURF.textMuted }}>
                {mine.pct}% of {money(deal.total)} total commission
              </div>
              {deal.belowRedline && (
                <div className="text-[12px] mt-2" style={{ color: SURF.danger }}>
                  {money(deal.shortfall)} below the redline — this deal pays nobody.
                </div>
              )}
            </div>

            {/* The customer's side. A rep quoting a loan needs to know the
                contract is bigger than the price they have in their head. */}
            <div className="rounded-xl p-4" style={{ background: SURF.surface, border: `1px solid ${SURF.line}` }}>
              <Row label="Net sale (your price)" value={money(deal.netSale)} />
              {deal.feePct > 0 && (
                <>
                  <Row label={`Dealer fee (${Math.round(deal.feePct * 100)}%)`} value={'+ ' + money(deal.dealerFee)} tone={SURF.caution} />
                  <Row label="Customer contract" value={money(deal.customerContract)} strong />
                </>
              )}
              {deal.feePct === 0 && <Row label="Customer contract" value={money(deal.customerContract)} strong />}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${SURF.line}` }}>
              {deal.rows.map((r) => (
                <div key={r.key} className="flex items-center justify-between px-4 py-2"
                     style={{
                       background: r.key === seat || (selfGen && r.key === 'self' && (seat === 'engineer' || seat === 'builder'))
                         ? 'rgba(242,181,94,.10)' : SURF.surface,
                       borderTop: `1px solid ${SURF.line}`
                     }}>
                  <span className="text-[12.5px]" style={{ color: SURF.text }}>{r.label}</span>
                  <span className="text-[12.5px] font-mono" style={{ color: SURF.textMuted }}>{r.pct}%</span>
                  <span className="text-[13px] font-mono font-semibold" style={{ color: SURF.textBright }}>
                    {money(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== WHAT THE GOAL COSTS ===================== */}
      <section className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] mb-4"
             style={{ color: SURF.sun }}>
          <SwellIcon size={15} /> What the goal costs
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <Label>Goal</Label>
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value) || 0)}
              className="w-full px-3 py-2.5 rounded-lg font-mono text-xl font-bold focus:outline-none"
              style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.sun }}
            />
          </div>
          <div>
            <Label>Over {months} month{months === 1 ? '' : 's'}</Label>
            <input
              type="range" min={1} max={12} step={1}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-full accent-amber-400 mt-2"
            />
            <div className="flex justify-between text-[10.5px] mt-0.5" style={{ color: SURF.textFaint }}>
              <span>1 mo</span><span>12 mo</span>
            </div>
          </div>
        </div>

        {mine.amount <= 0 ? (
          <div className="rounded-xl p-5 text-center text-[13px]"
               style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textMuted }}>
            Set a sale price above the redline to see what the goal takes.
          </div>
        ) : (
          <>
            {/* the answer */}
            <div className="rounded-2xl p-6 mb-4"
                 style={{ background: 'rgba(242,181,94,.10)', border: `1px solid ${SURF.sun}55` }}>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>
                Doors per day, every working day
              </div>
              <div className="text-[64px] leading-none font-extrabold mt-1" style={{ color: SURF.sun }}>
                {round1(plan.doorsPerDay)}
              </div>
              <p className="text-[13px] mt-2" style={{ color: SURF.text }}>
                {Math.round(plan.doors).toLocaleString()} doors over {months} month{months === 1 ? '' : 's'} —
                about {round1(plan.doorsPerWeek)} a week. Each knock is worth {money2(plan.dollarsPerDoor)} on average.
              </p>
            </div>

            {/* the funnel, so the number can be argued with */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-px rounded-2xl overflow-hidden mb-3"
                 style={{ background: SURF.line }}>
              <Stage label="Doors" value={Math.round(plan.doors).toLocaleString()} sub="knocked" />
              <Stage label="Decision makers" value={Math.round(plan.decisionMakers).toLocaleString()}
                     sub={`1 in ${plan.funnel.doorsPerDecisionMaker}`} />
              <Stage label="Appointments" value={round1(plan.appts)}
                     sub={`1 in ${plan.funnel.decisionMakersPerAppt}`} />
              <Stage label="Closes" value={round1(plan.closes)}
                     sub={`1 in ${plan.funnel.apptsPerClose}`} />
              <Stage label="Installs" value={round1(plan.installs)}
                     sub={`${Math.round(plan.funnel.installRate * 100)}% of closes`} tone={SURF.sun} />
            </div>

            <p className="text-[11.5px] mb-5" style={{ color: SURF.textFaint }}>
              Installs, not closes — {Math.round((1 - plan.funnel.installRate) * 100)}% of signed deals never reach
              installation, and a plan built on signatures comes up short by exactly that much.
              {' '}{Math.round(plan.doorsPerInstall)} doors per install at these rates.
            </p>

            {/* ---- the rates behind those numbers, and what the book says ---- */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: SURF.surface, border: `1px solid ${SURF.line}` }}>
              <button
                onClick={() => setShowFunnel((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>
                  Your conversion rates{funnelEdited ? ' · edited' : ''}
                </span>
                <span className="text-[12px]" style={{ color: SURF.sun }}>
                  {showFunnel ? 'Hide' : 'Change these'}
                </span>
              </button>

              {/* What their own book actually shows. Two of the five rates are
                  measurable from deals; the others nobody logs, and inventing
                  them would corrupt every door count above. */}
              {!measured.thin && (
                <div className="mt-3 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
                     style={{ borderTop: `1px solid ${SURF.line}` }}>
                  <Measured
                    label="Your close rate"
                    measured={measured.closeRatePct != null ? `${measured.closeRatePct}%` : null}
                    using={`1 in ${round1(funnel.apptsPerClose)}`}
                    detail={`${measured.signed} of ${measured.priced} priced deals signed`}
                    onUse={measured.apptsPerClose ? () => setF('apptsPerClose')(round1(measured.apptsPerClose)) : null}
                  />
                  <Measured
                    label="Your install rate"
                    measured={measured.installRatePct != null ? `${measured.installRatePct}%` : null}
                    using={`${Math.round(funnel.installRate * 100)}%`}
                    detail={`${measured.installed} of ${measured.signed} signed deals installed`}
                    onUse={measured.installRate ? () => setF('installRate')(Math.round(measured.installRate * 100) / 100) : null}
                  />
                </div>
              )}
              {measured.thin && (
                <p className="text-[11.5px] mt-2" style={{ color: SURF.textFaint }}>
                  Not enough saved deals yet to read your own rates from — a close rate off one deal is either
                  0% or 100%, and both are lies. These are the team assumptions until your book fills up.
                </p>
              )}

              {showFunnel && (
                <div className="mt-4 pt-3 space-y-3" style={{ borderTop: `1px solid ${SURF.line}` }}>
                  <Ratio label="Doors per decision maker" value={funnel.doorsPerDecisionMaker}
                         onChange={setF('doorsPerDecisionMaker')} min={1} max={20}
                         sub="nobody logs knocks, so this one is yours to know" />
                  <Ratio label="Decision makers per appointment" value={funnel.decisionMakersPerAppt}
                         onChange={setF('decisionMakersPerAppt')} min={1} max={40}
                         sub="also not in the CRM" />
                  <Ratio label="Appointments per close" value={funnel.apptsPerClose}
                         onChange={setF('apptsPerClose')} min={1} max={15}
                         sub="measurable — your book says what it says" />
                  <div>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span style={{ color: SURF.textMuted }}>
                        Closes that reach installation
                        <span style={{ color: SURF.textFaint }}> · measurable</span>
                      </span>
                      <span className="font-mono" style={{ color: SURF.textBright }}>
                        {Math.round(funnel.installRate * 100)}%
                      </span>
                    </div>
                    <input type="range" min={30} max={100} step={1}
                           value={Math.round(funnel.installRate * 100)}
                           onChange={(e) => setF('installRate')(Number(e.target.value) / 100)}
                           className="w-full accent-amber-400" />
                  </div>
                  <Ratio label="Working days per month" value={funnel.workingDaysPerMonth}
                         onChange={setF('workingDaysPerMonth')} min={10} max={31}
                         sub="how many days you actually knock" />
                  {funnelEdited && (
                    <button
                      onClick={() => setFunnel(baseFunnel)}
                      className="text-[12px] underline" style={{ color: SURF.textFaint }}
                    >
                      Back to the team assumptions
                    </button>
                  )}
                  <p className="text-[11px]" style={{ color: SURF.textFaint }}>
                    {Math.round(plan.doorsPerInstall)} doors per install at these rates. Changes are yours only —
                    they are not saved to anyone else&rsquo;s Forecast.
                  </p>
                </div>
              )}
            </div>

            {/* what actually reaches the account */}
            <div className="rounded-2xl p-5" style={{ background: SURF.surface, border: `1px solid ${SURF.line}` }}>
              <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: SURF.textMuted }}>
                What reaches your account
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <Slide label="Business expenses" value={expensesPct} onChange={setExpensesPct} max={40} />
                  <Slide label="Tax set-aside" value={taxPct} onChange={setTaxPct} max={50} />
                  <Slide label="Invested" value={investPct} onChange={setInvestPct} max={50} sub="out of post-tax" />
                </div>
                <div>
                  <Row label="Gross commission" value={money(net.gross)} />
                  <Row label="Less expenses" value={'− ' + money(net.expenses)} tone={SURF.caution} />
                  <Row label="Taxable profit" value={money(net.profit)} />
                  <Row label="Less tax" value={'− ' + money(net.tax)} tone={SURF.caution} />
                  <Row label="Invested" value={'− ' + money(net.invested)} tone={SURF.seaBright} />
                  <div className="flex items-baseline justify-between mt-3 pt-3"
                       style={{ borderTop: `1px solid ${SURF.lineStrong}` }}>
                    <span className="text-[13px]" style={{ color: SURF.textBright }}>Take home</span>
                    <span className="text-2xl font-bold font-mono" style={{ color: SURF.good }}>
                      {money(net.takeHome)}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1 text-right" style={{ color: SURF.textFaint }}>
                    {Math.round(net.takeHome / months).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} a month
                  </div>
                </div>
              </div>
              <p className="text-[11px] mt-4" style={{ color: SURF.textFaint }}>
                Tax is taken on profit after expenses, not on the gross. The default rate is a placeholder for a
                conversation with an accountant, not advice — 1099 income, so nothing is withheld for you.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

/* ------------------------------ small parts ------------------------------ */

const Label = ({ children }) => (
  <span className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: SURF.textMuted }}>
    {children}
  </span>
);

const Chips = ({ label, value, onChange, options }) => (
  <div>
    <Label>{label}</Label>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold"
          style={{
            background: value === v ? SURF.sun : 'transparent',
            color: value === v ? '#06202c' : SURF.textMuted,
            border: `1px solid ${value === v ? SURF.sun : SURF.line}`
          }}
        >{l}</button>
      ))}
    </div>
  </div>
);

const Num = ({ label, value, onChange, min = 1, max = 4 }) => (
  <div>
    <Label>{label}</Label>
    <div className="flex gap-1">
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="w-9 h-9 rounded-lg text-[13px] font-semibold"
          style={{
            background: value === n ? SURF.sun : 'transparent',
            color: value === n ? '#06202c' : SURF.textMuted,
            border: `1px solid ${value === n ? SURF.sun : SURF.line}`
          }}
        >{n}</button>
      ))}
    </div>
  </div>
);

const Slide = ({ label, value, onChange, max = 50, sub = '' }) => (
  <div>
    <div className="flex justify-between text-[12px] mb-1">
      <span style={{ color: SURF.textMuted }}>{label}{sub && <span style={{ color: SURF.textFaint }}> · {sub}</span>}</span>
      <span className="font-mono" style={{ color: SURF.textBright }}>{value}%</span>
    </div>
    <input type="range" min={0} max={max} step={1} value={value}
           onChange={(e) => onChange(Number(e.target.value))}
           className="w-full accent-amber-400" />
  </div>
);

/** A measured rate next to the one being planned on, with a one-click adopt. */
const Measured = ({ label, measured, using, detail, onUse }) => (
  <div className="rounded-xl p-3" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
    <div className="text-[11px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>{label}</div>
    <div className="flex items-baseline gap-2 mt-1">
      <span className="text-xl font-bold font-mono" style={{ color: SURF.sun }}>{measured || '—'}</span>
      <span className="text-[11.5px]" style={{ color: SURF.textFaint }}>planning on {using}</span>
    </div>
    <div className="text-[11px] mt-0.5" style={{ color: SURF.textFaint }}>{detail}</div>
    {onUse && (
      <button onClick={onUse} className="text-[11.5px] underline mt-1" style={{ color: SURF.seaBright }}>
        Use my actual rate
      </button>
    )}
  </div>
);

const Ratio = ({ label, value, onChange, min, max, sub }) => (
  <div>
    <div className="flex justify-between text-[12px] mb-1">
      <span style={{ color: SURF.textMuted }}>
        {label}{sub && <span style={{ color: SURF.textFaint }}> · {sub}</span>}
      </span>
      <span className="font-mono" style={{ color: SURF.textBright }}>1 in {value}</span>
    </div>
    <input type="range" min={min} max={max} step={1} value={value}
           onChange={(e) => onChange(Number(e.target.value))}
           className="w-full accent-amber-400" />
  </div>
);

const Row = ({ label, value, tone, strong }) => (
  <div className="flex items-baseline justify-between py-1.5">
    <span className="text-[12.5px]" style={{ color: SURF.textMuted }}>{label}</span>
    <span className={`font-mono ${strong ? 'text-[15px] font-bold' : 'text-[13px]'}`}
          style={{ color: tone || SURF.textBright }}>{value}</span>
  </div>
);

const Stage = ({ label, value, sub, tone }) => (
  <div className="p-3" style={{ background: SURF.surface }}>
    <div className="text-[10.5px] uppercase tracking-wider" style={{ color: SURF.textMuted }}>{label}</div>
    <div className="text-xl font-bold font-mono mt-0.5" style={{ color: tone || SURF.textBright }}>{value}</div>
    <div className="text-[10.5px]" style={{ color: SURF.textFaint }}>{sub}</div>
  </div>
);

export default Forecast;
