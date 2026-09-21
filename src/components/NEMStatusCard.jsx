import React from 'react';
import { DollarSign, AlertCircle, Clock } from 'lucide-react';

const NEMStatusCard = ({ currentNEMImpact, nemVersion, nemExpiry = null, cumulativeNEMCredits,
  cumulativeTrueUpCharges, plannedLoadImpact = null }) => {
  if (!currentNEMImpact) return null;

  // TWO DIFFERENT QUESTIONS, TWO DIFFERENT ANSWERS.
  //
  // `type` is the DOLLAR position at true-up — it includes connection fees and
  // the export/import rate spread. The kWh figure beside it is the ENERGY
  // position: did the array out-produce the house or not.
  //
  // They disagree constantly, and they are supposed to. A NEM 2.0 house making
  // 11,500 kWh against 10,500 is 1,000 kWh in SURPLUS while still writing the
  // utility a cheque, because non-bypassable connection charges do not care
  // how much sun you made. Keying the energy line off the dollar position made
  // that house read "Energy Shortage: 0 kWh/yr" — the shortage field really is
  // zero, it was simply the wrong field to be reading.
  const isCredit = currentNEMImpact.type === 'credit';

  const netProductionKwh = Number.isFinite(Number(currentNEMImpact.netProduction))
    ? Number(currentNEMImpact.netProduction)
    : (Number(currentNEMImpact.surplus) || 0) - (Number(currentNEMImpact.shortage) || 0);
  const hasSurplus = netProductionKwh > 0;
  const energyBalanceKwh = Math.abs(netProductionKwh);
  
  return (
    <div className={`rounded-xl shadow-lg p-6 mb-6 ${
      isCredit 
        ? 'bg-green-50 border-2 border-green-300' 
        : 'bg-orange-50 border-2 border-orange-300'
    }`}>
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        {isCredit ? (
          <>
            <DollarSign className="text-green-600" size={24} />
            Net Metering Credit (Over-producing)
          </>
        ) : (
          <>
            <AlertCircle className="text-orange-600" size={24} />
            Annual True-Up Balance (Under-producing)
          </>
        )}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-sm text-gray-600">
            {energyBalanceKwh === 0 ? 'Energy Balance' : hasSurplus ? 'Energy Surplus' : 'Energy Shortage'}
          </div>
          <div className={`text-2xl font-bold ${
            energyBalanceKwh === 0 ? 'text-gray-800' : hasSurplus ? 'text-green-600' : 'text-red-600'
          }`}>
            {energyBalanceKwh === 0
              ? 'Net zero'
              : <>{hasSurplus ? '+' : '\u2212'}{energyBalanceKwh.toLocaleString()} kWh/yr</>}
          </div>
          {/* Spelling out the disagreement rather than hiding it — this is the
              single most confusing thing on the card when the two diverge. */}
          {hasSurplus && !isCredit && (
            <div className="text-[11px] text-gray-600 mt-0.5">
              Producing more than you use, and still billed — connection charges
              {nemVersion === 'NEM1' ? '' : ' are non-bypassable'}.
            </div>
          )}
          {!hasSurplus && isCredit && energyBalanceKwh > 0 && (
            <div className="text-[11px] text-gray-600 mt-0.5">
              Using more than you produce, but ahead on dollars at true-up.
            </div>
          )}
          {/* Planned load from the Load Simulator. Shown as its own line so the
              headline stays the measured system and the addition is visibly a
              projection, not a silent rewrite of their real numbers. */}
          {plannedLoadImpact && plannedLoadImpact.addedKwh > 0 && (
            <div className="text-[11px] text-blue-700 mt-1 border-t border-gray-300/70 pt-1">
              Includes {plannedLoadImpact.addedKwh.toLocaleString()} kWh planned load
              {plannedLoadImpact.absorbedBySurplusKwh > 0 && (
                <> · <span className="text-green-700">{plannedLoadImpact.absorbedBySurplusKwh.toLocaleString()} kWh absorbed by surplus</span></>
              )}
              {plannedLoadImpact.billableKwh > 0 && (
                <> · <span className="text-red-700">{plannedLoadImpact.billableKwh.toLocaleString()} kWh billable</span></>
              )}
            </div>
          )}
        </div>
        
        <div>
          <div className="text-sm text-gray-600">
            {isCredit ? 'Compensation Rate' : 'True-Up Rate'}
          </div>
          <div className="text-2xl font-bold text-gray-800">
            ${currentNEMImpact.rate.toFixed(3)}/kWh
          </div>
        </div>
        
        <div>
          <div className="text-sm text-gray-600">
            {isCredit ? 'Annual Credit Check' : 'Annual True-Up Bill'}
          </div>
          <div className={`text-2xl font-bold ${
            isCredit ? 'text-green-600' : 'text-orange-600'
          }`}>
            ${currentNEMImpact.amount.toLocaleString()}
          </div>
          {/* Split the bill into its two very different halves. Energy cost
              responds to usage and storage; connection charges generally do
              not — and whether credits can offset them depends on NEM version
              and utility. Lumping them hides which lever actually moves. */}
          {!isCredit && currentNEMImpact.connectionFeesAnnual > 0 && (
            <div className="mt-1.5 text-[11px] text-gray-600 space-y-0.5">
              <div className="flex justify-between gap-3">
                <span>Energy cost from usage</span>
                <span className="font-semibold">${(currentNEMImpact.energyCostAnnual || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>
                  Connection / minimum charges
                  {currentNEMImpact.connectionFeeIsOverride && (
                    <span className="text-blue-600 ml-1" title="Manually entered for this utility">·  manual</span>
                  )}
                </span>
                <span className="font-semibold">${currentNEMImpact.connectionFeesAnnual.toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-gray-500 pt-0.5">
                {nemVersion === 'NEM1'
                  ? 'Under NEM 1.0 export credits can offset these charges — they only apply when you end the year owing.'
                  : 'These are non-bypassable under NEM ' + (nemVersion === 'NEM3' ? '3.0' : '2.0') + ' — credits cannot erase them.'}
              </div>
            </div>
          )}
          {plannedLoadImpact && plannedLoadImpact.addedKwh > 0 && plannedLoadImpact.annualCostDelta !== 0 && (
            <div className="mt-1.5 text-[11px] border-t border-gray-300/70 pt-1">
              <div className="flex justify-between gap-3 text-blue-700">
                <span>Of which planned load</span>
                <span className="font-semibold">
                  {plannedLoadImpact.annualCostDelta > 0 ? '+' : '\u2212'}$
                  {Math.abs(plannedLoadImpact.annualCostDelta).toLocaleString()}/yr
                </span>
              </div>
              {plannedLoadImpact.flipsToTrueUp && (
                <div className="text-[10px] text-red-700 pt-0.5">
                  This load is what moves you from a credit to owing at true-up.
                </div>
              )}
            </div>
          )}
          {isCredit && currentNEMImpact.connectionFeesAnnual === 0 && nemVersion === 'NEM1' && (
            <div className="mt-1.5 text-[10px] text-green-700">
              Your credits fully cover connection charges this year — a NEM 1.0 advantage.
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-3 text-sm text-gray-600">
        {isCredit ? (
          <p>
            Under {nemVersion === 'NEM1' ? 'NEM 1.0' : nemVersion === 'NEM2' ? 'NEM 2.0' : 'NEM 3.0'}, 
            your excess production is compensated at <span className="font-semibold">
            ${currentNEMImpact.rate.toFixed(3)}/kWh</span>
            {nemVersion === 'NEM1' && ' (retail rate)'}
            {nemVersion === 'NEM2' && ' (wholesale rate)'}
            {nemVersion === 'NEM3' && ' (significantly reduced rate)'}.
          </p>
        ) : (
          <p>
            {hasSurplus
              ? <>You produce {energyBalanceKwh.toLocaleString()} kWh more than you use each year, but still owe
                  roughly ${currentNEMImpact.amount.toLocaleString()} at true-up — connection and minimum charges
                  that production cannot offset.</>
              : <>You are under-producing by {energyBalanceKwh.toLocaleString()} kWh annually.
                  Your true-up bill will be approximately ${currentNEMImpact.amount.toLocaleString()} per year.</>}
          </p>
        )}
      </div>
      
      {nemExpiry && !nemExpiry.expired && (
        <div className="mt-4 rounded-lg bg-white/70 border border-gray-300 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Clock size={16} className="text-blue-600" />
            When your {nemVersion === 'NEM1' ? 'NEM 1.0' : 'NEM 2.0'} protection ends
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-blue-700">{nemExpiry.yearsLeft}</span>
            <span className="text-gray-700 font-medium">
              year{nemExpiry.yearsLeft === 1 ? '' : 's'}
              {nemExpiry.monthsRemainder > 0 && `, ${nemExpiry.monthsRemainder} month${nemExpiry.monthsRemainder === 1 ? '' : 's'}`} left
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            Your rate is locked in through <span className="font-semibold">{nemExpiry.endYear}</span> — a 20-year term
            {nemExpiry.anchor === 'pto' ? ' from your Permission-to-Operate date' : ' estimated from your install date (confirm the exact PTO date for precision)'}.
            When it ends, your account moves to the current billing plan: exported power earns roughly 75% less,
            while evening purchases stay at full retail. Your panels don’t change — only what the utility pays you does.
          </p>
          <p className="text-[11px] text-gray-500 mt-1.5">
            Good to know: adding a battery does <span className="font-semibold">not</span> shorten this term — so storage keeps its full value for all {nemExpiry.yearsLeft} remaining years.
          </p>
        </div>
      )}
      {nemExpiry && nemExpiry.expired && (
        <div className="mt-4 rounded-lg bg-orange-50 border border-orange-300 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
            <Clock size={16} className="text-orange-600" />
            Your {nemVersion === 'NEM1' ? 'NEM 1.0' : 'NEM 2.0'} protection has ended
          </div>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            The 20-year grandfathering term (ending {nemExpiry.endYear}) has passed, so this account has moved
            to the successor net billing tariff — exports now earn avoided-cost rates. A battery is especially
            valuable here, since self-consumption avoids buying back power at full retail.
          </p>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        Cumulative NEM Credits: ${parseFloat(cumulativeNEMCredits).toLocaleString()} | 
        Cumulative True-Up Charges: ${parseFloat(cumulativeTrueUpCharges).toLocaleString()}
      </div>
    </div>
  );
};

export default NEMStatusCard;
