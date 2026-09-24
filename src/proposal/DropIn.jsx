/**
 * FILE: src/proposal/DropIn.jsx
 *
 * DROP IN — pay cash, or keep the cash and finance.
 *
 * The comparison a thoughtful customer makes on their own, done properly. They
 * have the money. Should they spend it on the battery, or put $0 down, keep the
 * money invested, and pay the monthly?
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS HONEST AND NOT A TRICK
 *
 * The answer genuinely depends on the return they can get, and the return is
 * THEIRS to assert — which is why it is a slider and not a constant. At 8% the
 * financed path usually wins; at 3% it usually does not. A tool that hard-codes
 * a flattering rate is selling, and a customer who later works out the
 * assumption stops believing everything else on the page.
 *
 * So the slider spans 0-15%, it starts at 8%, and the losing case is shown as
 * plainly as the winning one. If cash wins, the page says cash wins.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ACTUALLY BEING COMPARED
 *
 * Both paths end with the same battery on the wall and the same energy savings,
 * so the savings cancel and are left out. What differs is only this:
 *
 *   CASH      the money leaves. It earns nothing after that.
 *   FINANCED  the money stays invested and compounds. The payment comes out of
 *             pocket every month for the term.
 *
 * THE PAYMENT IS MODELLED AS A DRAWDOWN, not as an expense ignored by the
 * investment. A comparison that compounds the whole lump while quietly not
 * paying the loan is the single most common way this argument is faked — it
 * shows a $40,000 win that does not exist. Here each month's payment is
 * withdrawn from the invested balance, so the end balance is what the customer
 * would really have left.
 *
 * Federal credit and rebate are the same on both paths and both received in
 * cash, so they are shown once and netted out of the cash-path outlay.
 *
 * Rendered by: src/proposal/BigWave.jsx
 */
import React, { useMemo, useState } from 'react';
import { SURF } from '../surf/theme';
import { Treasure as TreasureIcon, Swell as SwellIcon } from '../surf/SurfIcons';

const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(Number(v) || 0)).toLocaleString();

/**
 * Compound a lump sum while drawing the loan payment out of it each month.
 *
 * Monthly compounding at rate/12. The balance can go negative — that is not an
 * error, it is the case where the payments outrun the growth, and hiding it
 * would hide the answer.
 */
export function investWhilePaying({ lump = 0, annualReturn = 0.08, monthlyPayment = 0, months = 240 }) {
  const r = (Number(annualReturn) || 0) / 12;
  const pay = Math.max(0, Number(monthlyPayment) || 0);
  let balance = Math.max(0, Number(lump) || 0);
  let contributed = 0;
  const trail = [];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) - pay;
    contributed += pay;
    if (m % 12 === 0) trail.push({ year: m / 12, balance });
  }
  return { endBalance: balance, paidOut: contributed, trail };
}

const DropIn = ({ proposal }) => {
  const [ret, setRet] = useState(8);

  const f = (proposal && proposal.financing) || {};
  const p = (proposal && proposal.pricing) || {};

  const termYears = Number(f.termYears) || 20;
  const monthlyPayment = Number(f.monthlyPayment) || 0;
  // What paying cash actually costs them, after the credit and rebate they get
  // either way.
  const cashOutlay = Number(p.netInvestment) || 0;

  const financed = useMemo(
    () => investWhilePaying({
      lump: cashOutlay,
      annualReturn: ret / 100,
      monthlyPayment,
      months: termYears * 12
    }),
    [cashOutlay, ret, monthlyPayment, termYears]
  );

  // Cash path: the money is gone, so there is nothing to compound.
  const cashEnd = 0;
  const advantage = financed.endBalance - cashEnd;
  const financedWins = advantage > 0;

  if (!proposal || f.purchaseType === 'cash' || !monthlyPayment || !cashOutlay) {
    return (
      <div className="rounded-2xl p-8 text-center text-[13px]"
           style={{ background: SURF.deep, border: `1px solid ${SURF.line}`, color: SURF.textMuted }}>
        Drop In compares paying cash against financing and keeping the cash invested.
        It needs a financed proposal with a monthly payment — save one in Deep Seas first.
      </div>
    );
  }

  const peak = Math.max(...financed.trail.map((t) => Math.abs(t.balance)), 1);

  return (
    <div className="space-y-5">
      {/* ------------------------------ the answer ------------------------------ */}
      <div className="rounded-2xl p-6" style={{
        background: financedWins ? 'rgba(79,191,155,.10)' : 'rgba(242,181,94,.10)',
        border: `1px solid ${financedWins ? SURF.good : SURF.sun}55`
      }}>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
             style={{ color: SURF.textMuted }}>
          <TreasureIcon size={15} /> After {termYears} years
        </div>
        <div className="text-[52px] leading-none font-extrabold mt-1"
             style={{ color: financedWins ? SURF.good : SURF.sun }}>
          {money(Math.abs(advantage))}
        </div>
        <p className="text-[14px] mt-2 max-w-[56ch]" style={{ color: SURF.text }}>
          {financedWins
            ? <>more in your pocket by keeping the {money(cashOutlay)} invested at {ret}% and paying
                {' '}{money(monthlyPayment)} a month instead.</>
            : <>more in your pocket by paying cash. At {ret}% the investment does not outrun the
                {' '}{money(monthlyPayment)} monthly payment — financing costs you this much over the term.</>}
        </p>
        <p className="text-[12px] mt-3" style={{ color: SURF.textMuted }}>
          Same battery either way, and the same energy savings — those cancel out, so they are left
          out of both columns.
        </p>
      </div>

      {/* ------------------------------ the dial ------------------------------ */}
      <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex justify-between text-[13px] mb-1">
          <span style={{ color: SURF.textBright }}>What the money earns invested</span>
          <span className="font-mono text-lg font-bold" style={{ color: SURF.sun }}>{ret}%</span>
        </div>
        <input
          type="range" min={0} max={15} step={0.5} value={ret}
          onChange={(e) => setRet(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
        <div className="flex justify-between text-[10.5px]" style={{ color: SURF.textFaint }}>
          <span>0%</span><span>8% · long-run stock market</span><span>15%</span>
        </div>
        <p className="text-[11.5px] mt-3 max-w-[70ch]" style={{ color: SURF.textFaint }}>
          This number decides the whole comparison, which is why it is yours to set rather than ours
          to assume. Move it and watch the answer change — somewhere between 3% and 6% it usually
          flips. Nothing here is investment advice, and past market returns are not a promise.
        </p>
      </div>

      {/* ---------------------------- side by side ---------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-2xl overflow-hidden"
           style={{ background: SURF.line }}>
        <div className="p-5" style={{ background: SURF.surface }}>
          <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: SURF.textMuted }}>
            Pay cash
          </div>
          <Row label="You hand over" value={money(cashOutlay)} />
          <Row label="Monthly payment" value="$0" />
          <Row label={`Invested after ${termYears} yrs`} value={money(0)} />
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${SURF.line}` }}>
            <div className="text-[11px]" style={{ color: SURF.textMuted }}>Left with</div>
            <div className="text-2xl font-bold font-mono" style={{ color: SURF.textBright }}>{money(0)}</div>
          </div>
        </div>

        <div className="p-5" style={{ background: SURF.surface }}>
          <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: SURF.textMuted }}>
            $0 down, keep the cash
          </div>
          <Row label="You keep and invest" value={money(cashOutlay)} />
          <Row label="Monthly payment" value={money(monthlyPayment)} />
          <Row label={`Paid out over ${termYears} yrs`} value={money(financed.paidOut)} tone={SURF.caution} />
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${SURF.line}` }}>
            <div className="text-[11px]" style={{ color: SURF.textMuted }}>Left with</div>
            <div className="text-2xl font-bold font-mono"
                 style={{ color: financed.endBalance >= 0 ? SURF.good : SURF.danger }}>
              {money(financed.endBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------ the curve ------------------------------ */}
      <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] mb-3"
             style={{ color: SURF.textMuted }}>
          <SwellIcon size={15} /> The invested balance, year by year
        </div>
        <div className="flex items-end gap-1" style={{ height: 130 }}>
          {financed.trail.map((t) => {
            const h = Math.max(2, (Math.abs(t.balance) / peak) * 100);
            return (
              <div key={t.year} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}
                   title={`Year ${t.year}: ${money(t.balance)}`}>
                <div style={{
                  height: `${h}%`,
                  borderRadius: '3px 3px 0 0',
                  background: t.balance >= 0 ? SURF.good : SURF.danger,
                  opacity: 0.55 + 0.45 * (t.year / financed.trail.length)
                }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10.5px] mt-1" style={{ color: SURF.textFaint }}>
          <span>Year 1</span><span>Year {termYears}</span>
        </div>
        <p className="text-[11.5px] mt-3 max-w-[70ch]" style={{ color: SURF.textFaint }}>
          Each month&rsquo;s payment is withdrawn from the invested balance, which is why the bars can
          shrink. A comparison that compounds the whole lump while quietly not paying the loan is how
          this argument gets faked — it shows a win that is not there.
        </p>
      </div>
    </div>
  );
};

const Row = ({ label, value, tone }) => (
  <div className="flex items-baseline justify-between py-1">
    <span className="text-[12.5px]" style={{ color: SURF.textMuted }}>{label}</span>
    <span className="text-[13px] font-mono" style={{ color: tone || SURF.textBright }}>{value}</span>
  </div>
);

export default DropIn;
