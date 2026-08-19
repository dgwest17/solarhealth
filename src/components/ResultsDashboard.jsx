import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const ResultsDashboard = ({ calculations }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Total Cumulative Savings */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <DollarSign className="w-8 h-8" />
          <Calendar className="w-6 h-6 opacity-70" />
        </div>
        <div className="text-3xl font-bold mb-1">
          ${parseFloat(calculations.cumulativeSavings).toLocaleString()}
        </div>
        <div className="text-sm opacity-90">Total Cumulative Savings</div>
        <div className="text-xs opacity-75 mt-2">
          {calculations.yearsSinceInstall} years
        </div>
      </div>

      {/* Average Monthly Savings */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <TrendingUp className="w-8 h-8" />
        </div>
        <div className="text-3xl font-bold mb-1">
          ${calculations.avgMonthlySavings}
        </div>
        <div className="text-sm opacity-90">Avg Monthly Savings</div>
        <div className="text-xs opacity-75 mt-2">vs utility rates</div>
      </div>

      {/* Net Savings — utility avoided MINUS everything solar has actually cost.
          Sits beside avg monthly because it answers the same question at the
          lifetime scale: am I actually ahead? Only shown once the breakdown
          exists (needs an install date + usage to compute). */}
      {calculations.costBreakdown && calculations.costBreakdown.utilityWouldHavePaid > 0 && (() => {
        const b = calculations.costBreakdown;
        const ahead = b.netSavings >= 0;
        return (
          <div className={`rounded-xl shadow-lg p-6 text-white bg-gradient-to-br ${
            ahead ? 'from-emerald-500 to-emerald-700' : 'from-amber-500 to-amber-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8" />
              {ahead
                ? <TrendingUp className="w-6 h-6 opacity-70" />
                : <TrendingDown className="w-6 h-6 opacity-70" />}
            </div>
            <div className="text-3xl font-bold mb-1">
              {ahead ? '' : '−'}${Math.abs(b.netSavings).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Net Savings</div>
            <div className="text-xs opacity-75 mt-2">
              after everything solar has cost
            </div>
          </div>
        );
      })()}

      {/* Utility Rate Increase */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <TrendingUp className="w-8 h-8" />
        </div>
        <div className="text-3xl font-bold mb-1">
          {calculations.rateIncrease}%
        </div>
        <div className="text-sm opacity-90">Utility Rate Increase</div>
        <div className="text-xs opacity-75 mt-2">Since installation</div>
      </div>

      {/* Payback Period - UPDATED to show years */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <Calendar className="w-8 h-8" />
        </div>
        <div className="text-3xl font-bold mb-1">
          {calculations.paybackYears} yrs
        </div>
        <div className="text-sm opacity-90">Payback Period</div>
        <div className="text-xs opacity-75 mt-2">
          ROI: {calculations.roi}%
        </div>
      </div>
    </div>
  );
};

export default ResultsDashboard;
