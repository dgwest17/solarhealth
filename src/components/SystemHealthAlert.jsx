import React from 'react';
import { AlertCircle, TrendingUp, Award, CheckCircle } from 'lucide-react';

const SystemHealthAlert = ({ systemScore }) => {
  if (!systemScore) return null;

  const getScoreColor = (score) => {
    switch (score) {
      case 'S':
        return {
          bg: 'bg-gradient-to-r from-yellow-50 to-orange-50',
          border: 'border-yellow-400',
          icon: 'text-yellow-600',
          text: 'text-yellow-900',
          badge: 'bg-yellow-500 text-white'
        };
      case 'A':
        return {
          bg: 'bg-green-50',
          border: 'border-green-400',
          icon: 'text-green-600',
          text: 'text-green-900',
          badge: 'bg-green-500 text-white'
        };
      case 'B':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-400',
          icon: 'text-blue-600',
          text: 'text-blue-900',
          badge: 'bg-blue-500 text-white'
        };
      case 'C':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-400',
          icon: 'text-yellow-600',
          text: 'text-yellow-900',
          badge: 'bg-yellow-500 text-white'
        };
      case 'D':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-400',
          icon: 'text-orange-600',
          text: 'text-orange-900',
          badge: 'bg-orange-500 text-white'
        };
      case 'F':
        return {
          bg: 'bg-red-50',
          border: 'border-red-400',
          icon: 'text-red-600',
          text: 'text-red-900',
          badge: 'bg-red-500 text-white'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-400',
          icon: 'text-gray-600',
          text: 'text-gray-900',
          badge: 'bg-gray-500 text-white'
        };
    }
  };

  const getIcon = (score) => {
    if (score === 'S' || score === 'A') return <Award className="mt-1" size={28} />;
    if (score === 'B') return <CheckCircle className="mt-1" size={28} />;
    if (score === 'C') return <TrendingUp className="mt-1" size={28} />;
    return <AlertCircle className="mt-1" size={28} />;
  };

  const colors = getScoreColor(systemScore.score);

  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-xl shadow-lg p-6 mb-6`}>
      <div className="flex items-start gap-4">
        {/* Score Badge */}
        <div className="flex flex-col items-center">
          <div className={`${colors.badge} rounded-full w-16 h-16 flex items-center justify-center text-3xl font-bold shadow-lg`}>
            {systemScore.score}
          </div>
          <div className="text-xs font-semibold mt-1 text-gray-600">System Score</div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className={colors.icon}>
              {getIcon(systemScore.score)}
            </div>
            <div className="flex-1">
              <h3 className={`font-bold text-xl mb-1 ${colors.text}`}>
                {systemScore.message}
              </h3>
              <p className="text-gray-700 mb-3 leading-relaxed">
                {systemScore.recommendation}
              </p>

              {/* Metrics Display */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                <div className="bg-white/50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1">Cumulative Savings</div>
                  <div className="text-lg font-bold text-gray-800">
                    ${systemScore.metrics.cumulativeSavings.toLocaleString()}
                  </div>
                </div>
                
                {systemScore.metrics.annualTrueUp > 0 && (
                  <div className="bg-white/50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Annual True-Up</div>
                    <div className="text-lg font-bold text-orange-600">
                      ${systemScore.metrics.annualTrueUp.toLocaleString()}
                    </div>
                  </div>
                )}
                
                {systemScore.metrics.annualCredit > 0 && (
                  <div className="bg-white/50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Annual Credit</div>
                    <div className="text-lg font-bold text-green-600">
                      ${systemScore.metrics.annualCredit.toLocaleString()}
                    </div>
                  </div>
                )}
                
                <div className="bg-white/50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1">Savings Trend</div>
                  <div className={`text-lg font-bold ${systemScore.metrics.savingsTrendingPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {systemScore.metrics.savingsTrendingPositive ? '↗ Positive' : '↘ Declining'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthAlert;
