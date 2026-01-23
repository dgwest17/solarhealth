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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Financial Summary */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Financial Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">System Age</span>
            <span className="font-semibold">{safeCalc.yearsSinceInstall} years</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Total Investment</span>
            <span className="font-semibold">
              ${parseFloat(safeCalc.totalInvestment || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Solar Cost Paid</span>
            <span className="font-semibold">
              ${parseFloat(safeCalc.cumulativeCost || 0).toLocaleString()}
            </span>
          </div>
          {safeInputs.hasBattery && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Battery Cost Paid</span>
              <span className="font-semibold">
                ${parseFloat(safeCalc.cumulativeBatteryCost || 0).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">NEM Credits Received</span>
            <span className="font-semibold text-green-600">
              ${parseFloat(safeCalc.cumulativeNEMCredits || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">True-Up Charges</span>
            <span className="font-semibold text-orange-600">
              ${parseFloat(safeCalc.cumulativeTrueUpCharges || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Payback Period</span>
            <span className="font-semibold">
              {safeCalc.paybackYears || '0'} years
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">ROI</span>
            <span className="font-semibold text-green-600">{safeCalc.roi || '0'}%</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-gray-600">Net Benefit</span>
            <span className="font-bold text-green-600 text-xl">
              ${parseFloat(safeCalc.cumulativeSavings || 0).toLocaleString()}
            </span>
          </div>
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
            <span className="text-gray-600">Utility Bill Now</span>
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
