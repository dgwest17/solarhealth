import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { UTILITY_RATES } from '../utils/rateData';

const ChartsSection = ({ yearlyData, inputs, showHistoricalRates, setShowHistoricalRates }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Cumulative Savings Over Time */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Cumulative Savings Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={yearlyData}>
            <defs>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value) => `$${parseFloat(value).toLocaleString()}`} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="cumulativeSavings" 
              stroke="#10b981" 
              fillOpacity={1} 
              fill="url(#colorSavings)" 
              name="Cumulative Savings ($)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Annual Cost Comparison */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Annual Cost Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value) => `$${parseFloat(value).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="utilityCost" fill="#ef4444" name="Utility Cost ($)" />
            <Bar dataKey="solarCost" fill="#10b981" name="Solar Cost ($)" />
            {inputs.hasBattery && <Bar dataKey="batteryCost" fill="#8b5cf6" name="Battery Cost ($)" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Utility Rate History */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Utility Rate History</h3>
          <button
            onClick={() => setShowHistoricalRates(!showHistoricalRates)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showHistoricalRates ? 'Hide' : 'Show'} All Years
          </button>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={yearlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(3)}/kWh`} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="utilityRate" 
              stroke="#3b82f6" 
              strokeWidth={3} 
              name="Rate ($/kWh)" 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Historical Rates Table */}
      {showHistoricalRates && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Historical Rates (2014-2026)</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {Object.keys(UTILITY_RATES[inputs.utility]).map(year => (
              <div key={year} className="flex justify-between items-center border-b pb-1">
                <span className="text-gray-600">{year}</span>
                <span className="font-semibold">
                  ${UTILITY_RATES[inputs.utility][year].toFixed(3)}/kWh
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Growth */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Usage Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={yearlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value) => `${parseFloat(value).toLocaleString()} kWh`} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="projectedUsage" 
              stroke="#f59e0b" 
              strokeWidth={2} 
              name="Usage (kWh)" 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartsSection;
