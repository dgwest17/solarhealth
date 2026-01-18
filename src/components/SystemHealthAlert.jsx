import React from 'react';
import { AlertCircle } from 'lucide-react';

const SystemHealthAlert = ({ systemHealth, annualProduction }) => {
  // Don't show alert if system is performing excellently
  if (systemHealth.status === 'excellent') {
    return null;
  }

  const getAlertColor = (status) => {
    switch (status) {
      case 'poor':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          icon: 'text-red-600',
          text: 'text-red-600'
        };
      case 'fair':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-300',
          icon: 'text-orange-600',
          text: 'text-orange-600'
        };
      case 'good':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-300',
          icon: 'text-yellow-600',
          text: 'text-yellow-600'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-300',
          icon: 'text-gray-600',
          text: 'text-gray-600'
        };
    }
  };

  const colors = getAlertColor(systemHealth.status);

  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-xl shadow-lg p-6 mb-6`}>
      <div className="flex items-start gap-3">
        <AlertCircle className={`${colors.icon} mt-1`} size={24} />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 mb-1">System Performance Alert</h3>
          <p className="text-gray-700 mb-2">{systemHealth.message}</p>
          <div className="text-sm text-gray-600">
            <span className="font-medium">
              Performance Ratio: {systemHealth.performanceRatio.toFixed(1)}%
            </span>
            <span className="mx-2">•</span>
            <span>Expected: {systemHealth.expectedProduction.toLocaleString()} kWh/yr</span>
            <span className="mx-2">•</span>
            <span>Actual: {annualProduction.toLocaleString()} kWh/yr</span>
          </div>
          
          {systemHealth.status === 'poor' && (
            <div className="mt-3 bg-white rounded-lg p-3 border border-red-200">
              <h4 className="font-semibold text-gray-800 text-sm mb-1">Recommended Actions:</h4>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>Schedule a professional system inspection immediately</li>
                <li>Check for shading issues or debris on panels</li>
                <li>Review inverter performance logs for errors</li>
                <li>Verify all panels are functioning correctly</li>
              </ul>
            </div>
          )}
          
          {systemHealth.status === 'fair' && (
            <div className="mt-3 bg-white rounded-lg p-3 border border-orange-200">
              <h4 className="font-semibold text-gray-800 text-sm mb-1">Suggested Actions:</h4>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>Schedule routine maintenance and panel cleaning</li>
                <li>Check for recent shading changes (tree growth, new construction)</li>
                <li>Review monitoring system for any warning messages</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemHealthAlert;
