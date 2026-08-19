import React from 'react';

const SummaryTables = ({ calculations, inputs }) => {
  // Safety check - provide defaults if calculations is undefined
  const safeCalc = calculations || {
    yearsSinceInstall: '0',
    totalInvestment: '0',
    cumulativeCost: '0',
    cumulativeBatteryCost: '0',
    cumulativeNEMCredits: '0',
    cumulativeTrueUpCharges: '0',
    paybackYears: '0',
    roi: '0',
    cumulativeSavings: '0',
    initialUtilityRate: '0',
    currentUtilityRate: '0',
    rateIncrease: '0',
    usageGrowthRate: '0',
    offsetPercentage: '0',
    utilityBillAtInstall: '0',
    utilityBillNow: '0'
  };

  const safeInputs = inputs || {
    installedYear: 2020,
    nowYear: 2025,
    annualUsageAtInstall: 0,
    currentAnnualUsage: 0,
    hasBattery: false
  };

  const b = calculations && calculations.costBreakdown ? calculations.costBreakdown : null;
  const UTIL_LABEL = { SDGE: 'SDG&E', PGE: 'PG&E', SCE: 'SCE', SMUD: 'SMUD' };
  const utilLabel = UTIL_LABEL[safeInputs.utility] || 'your utility';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Financial Summary — absorbs the old NetPositionPanel: the utility
          counterfactual, an itemised list of what solar has actually cost, and
          the net. Structured as a bill: what you avoided, what you paid,
          what's left over. */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Financial Summary</h3>
        {b && b.yearsCovered > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            Over {b.yearsCovered} years since installation — your real usage priced at each year&rsquo;s real rate.
          </p>
        )}

        <div className="space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">System Age</span>
            <span className="font-semibold">{safeCalc.yearsSinceInstall} years</span>
          </div>

          {/* ---- The counterfactual ---- */}
          {b && b.utilityWouldHavePaid > 0 && (
            <div className="flex justify-between border-b pb-2 bg-red-50 -mx-2 px-2 rounded">
              <span className="text-gray-700 font-medium">
                What {utilLabel} would have taken
                <span className="block text-[11px] text-gray-500 font-normal">
                  with no solar · ~${b.avgMonthlyUtilityAvoided.toLocaleString()}/mo
                </span>
              </span>
              <span className="font-bold text-red-600">
                ${b.utilityWouldHavePaid.toLocaleString()}
              </span>
            </div>
          )}

          {/* ---- What solar actually cost, itemised ---- */}
          <div className="pt-1">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
              What solar has run you
            </div>
          </div>

          {b && b.upFrontPaid > 0 && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Paid up front</span>
              <span className="font-semibold">${b.upFrontPaid.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">
              Solar payments to date
              {b && b.stillPaying && (
                <span className="block text-[11px] text-gray-500">payments still ongoing</span>
              )}
            </span>
            <span className="font-semibold">
              ${parseFloat(safeCalc.cumulativeCost || 0).toLocaleString()}
            </span>
          </div>

          {safeInputs.hasBattery && parseFloat(safeCalc.cumulativeBatteryCost || 0) > 0 && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Battery payments to date</span>
              <span className="font-semibold">
                ${parseFloat(safeCalc.cumulativeBatteryCost || 0).toLocaleString()}
              </span>
            </div>
          )}

          {safeCalc.cumulativeConnectionFees && parseFloat(safeCalc.cumulativeConnectionFees) > 0 && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">
                Connection &amp; minimum charges
                <span className="block text-[11px] text-gray-500">at the rate in force each year</span>
              </span>
              <span className="font-semibold text-blue-600">
                ${parseFloat(safeCalc.cumulativeConnectionFees).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">True-Up charges</span>
            <span className="font-semibold text-orange-600">
              ${parseFloat(safeCalc.cumulativeTrueUpCharges || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">NEM credits received</span>
            <span className="font-semibold text-green-600">
              −${parseFloat(safeCalc.cumulativeNEMCredits || 0).toLocaleString()}
            </span>
          </div>

          {b && b.totalSolarOutlay > 0 && (
            <div className="flex justify-between border-b-2 border-gray-300 pb-2">
              <span className="text-gray-700 font-medium">
                Total solar outlay
                <span className="block text-[11px] text-gray-500 font-normal">
                  ~${b.avgMonthlySolarOutlay.toLocaleString()}/mo
                </span>
              </span>
              <span className="font-bold text-gray-800">${b.totalSolarOutlay.toLocaleString()}</span>
            </div>
          )}

          {/* ---- Performance ---- */}
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Payback Period</span>
            <span className="font-semibold">{safeCalc.paybackYears || '0'} years</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">ROI</span>
            <span className="font-semibold text-green-600">{safeCalc.roi || '0'}%</span>
          </div>

          {/* ---- The answer ---- */}
          {b && b.utilityWouldHavePaid > 0 ? (
            <div className={`flex justify-between items-center pt-3 mt-1 rounded-lg px-3 py-3 ${
              b.netSavings >= 0 ? 'bg-green-50' : 'bg-amber-50'
            }`}>
              <span className="text-gray-700 font-semibold">
                {b.netSavings >= 0 ? 'Net Savings' : 'Currently Behind By'}
                <span className="block text-[11px] text-gray-500 font-normal">
                  ${b.utilityWouldHavePaid.toLocaleString()} avoided − ${b.totalSolarOutlay.toLocaleString()} spent
                </span>
              </span>
              <span className={`font-bold text-2xl ${b.netSavings >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {b.netSavings >= 0 ? '' : '−'}${Math.abs(b.netSavings).toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="flex justify-between pt-2">
              <span className="text-gray-600">Net Benefit</span>
              <span className="font-bold text-green-600 text-xl">
                ${parseFloat(safeCalc.cumulativeSavings || 0).toLocaleString()}
              </span>
            </div>
          )}

          {b && b.outlayAsPctOfUtility != null && (
            <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
              Solar has cost <span className="font-semibold">{b.outlayAsPctOfUtility}%</span> of the utility
              bill it replaced
              {b.stillPaying
                ? ' — and payments are still running, so this gap widens every time rates rise.'
                : (parseFloat(safeCalc.cumulativeCost || 0) > 0
                    ? ' — with the system paid off, everything from here is upside.'
                    : '.')}
              {' '}Counts money actually spent, not the remaining balance of a loan or lease.
            </p>
          )}
        </div>
      </div>

      {/* System Metrics */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">System Metrics</h3>
        <div className="space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Initial Rate ({safeInputs.installedYear})</span>
            <span className="font-semibold">${safeCalc.initialUtilityRate || '0'}/kWh</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Rate ({safeInputs.nowYear})</span>
            <span className="font-semibold">${safeCalc.currentUtilityRate || '0'}/kWh</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Rate Increase</span>
            <span className="font-semibold text-red-600">+{safeCalc.rateIncrease || '0'}%</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Usage at Install</span>
            <span className="font-semibold">
              {(safeInputs.annualUsageAtInstall || 0).toLocaleString()} kWh/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Usage</span>
            <span className="font-semibold">
              {(safeInputs.currentAnnualUsage || 0).toLocaleString()} kWh/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Usage Growth</span>
            <span className="font-semibold text-orange-600">
              +{safeCalc.usageGrowthRate || '0'}%/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Offset</span>
            <span className="font-semibold text-green-600">
              {safeCalc.offsetPercentage || '0'}%
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Utility Bill at Install</span>
            <span className="font-semibold">
              ${safeCalc.utilityBillAtInstall || '0'}/mo
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Utility Bill if You Didn't Have Solar</span>
            <span className="font-semibold text-red-600">
              ${safeCalc.utilityBillNow || '0'}/mo
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Bill Increase</span>
            <span className="font-semibold text-red-600">
              +{safeCalc.utilityBillIncrease || '0'}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryTables;
