import React, { useState } from 'react';
import { Battery } from 'lucide-react';
import BatteryConsumptionProduction from './BatteryConsumptionProduction';

/**
 * Battery Analysis tab.
 * Section 1 (Production/Consumption overlay) is live.
 * Sections 2–4 (Energy Loss, Export Inefficiencies, Battery Recovery)
 * will be added next.
 */
const BatteryAnalysis = ({ inputs }) => {
  const [profileKey, setProfileKey] = useState('evening_heavy');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 flex items-center gap-2">
          <Battery size={30} className="text-amber-400" />
          Battery Analysis
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          See how your system behaves over a day — and what a battery would recover.
        </p>
      </div>

      {/* Section 1 */}
      <BatteryConsumptionProduction
        inputs={inputs}
        profileKey={profileKey}
        setProfileKey={setProfileKey}
      />

      {/* Sections 2–4 coming next */}
    </div>
  );
};

export default BatteryAnalysis;
