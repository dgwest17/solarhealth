import React from 'react';

const SummaryTables = ({ calculations, inputs }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Financial Summary */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Financial Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">System Age</span>
            <span className="font-semibold">{calculations.yearsSinceInstall} years</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Total Investment</span>
            <span className="font-semibold">
              ${parseFloat(calculations.totalInvestment).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Solar Cost Paid</span>
            <span className="font-semibold">
              ${parseFloat(calculations.cumulativeCost).toLocaleString()}
            </span>
          </div>
          {inputs.hasBattery && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Battery Cost Paid</span>
              <span className="font-semibold">
                ${parseFloat(calculations.cumulativeBatteryCost).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">NEM Credits Received</span>
            <span className="font-semibold text-green-600">
              ${parseFloat(calculations.cumulativeNEMCredits).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">True-Up Charges</span>
            <span className="font-semibold text-orange-600">
              ${parseFloat(calculations.cumulativeTrueUpCharges).toLocaleString()}
            </span>
          </div>
          {inputs.nemVersion === 'NEM2' && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">NEM 2.0 Connection Fees</span>
              <span className="font-semibold text-red-600">
                ${parseFloat(calculations.cumulativeNEM2Fees).toLocaleString()}
              </span>
            </div>
          )}
          {inputs.program === 'PPA' && inputs.ppaPaidOff && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">PPA Buyout Amount</span>
              <span className="font-semibold text-purple-600">
                ${parseFloat(calculations.ppaBuyoutAmount).toLocaleString()}
              </span>
            </div>
          )}
          {inputs.program === 'Loan' && inputs.loanPaidOff && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Remaining Principal at Payoff</span>
              <span className="font-semibold text-blue-600">
                ${parseFloat(calculations.loanPrincipalAtPayoff).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Payback Period</span>
            <span className="font-semibold">
              {(calculations.paybackMonths / 12).toFixed(1)} years
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">ROI</span>
            <span className="font-semibold text-green-600">{calculations.roi}%</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-gray-600">Net Benefit</span>
            <span className="font-bold text-green-600 text-xl">
              ${parseFloat(calculations.cumulativeSavings).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">System Metrics</h3>
        <div className="space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Initial Rate ({inputs.installedYear})</span>
            <span className="font-semibold">${calculations.initialUtilityRate}/kWh</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Rate ({inputs.nowYear})</span>
            <span className="font-semibold">${calculations.currentUtilityRate}/kWh</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Rate Increase</span>
            <span className="font-semibold text-red-600">+{calculations.rateIncrease}%</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Usage at Install</span>
            <span className="font-semibold">
              {inputs.annualUsageAtInstall.toLocaleString()} kWh/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Usage</span>
            <span className="font-semibold">
              {inputs.currentAnnualUsage.toLocaleString()} kWh/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Usage Growth</span>
            <span className="font-semibold text-orange-600">
              +{calculations.usageGrowthRate}%/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Initial Production</span>
            <span className="font-semibold">
              {inputs.annualProduction.toLocaleString()} kWh/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Production (degraded)</span>
            <span className="font-semibold text-yellow-600">
              {calculations.currentDegradedProduction} kWh/yr
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Current Offset</span>
            <span className="font-semibold text-green-600">
              {calculations.offsetPercentage}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Performance Ratio</span>
            <span className={`font-semibold ${
              calculations.systemHealth.performanceRatio >= 95 ? 'text-green-600' :
              calculations.systemHealth.performanceRatio >= 85 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {calculations.systemHealth.performanceRatio.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryTables;