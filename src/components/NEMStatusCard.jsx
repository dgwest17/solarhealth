import React from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';

const NEMStatusCard = ({ currentNEMImpact, nemVersion, cumulativeNEMCredits, cumulativeTrueUpCharges }) => {
  if (!currentNEMImpact) return null;

  const isCredit = currentNEMImpact.type === 'credit';
  
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
            Net Metering Credit (Overproducing)
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
            {isCredit ? 'Net Production' : 'Energy Shortage'}
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {isCredit 
              ? currentNEMImpact.netProduction.toLocaleString()
              : currentNEMImpact.shortage.toLocaleString()
            } kWh/yr
          </div>
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
            You are under-producing by {currentNEMImpact.shortage.toLocaleString()} kWh annually. 
            Your true-up bill will be approximately ${currentNEMImpact.amount.toLocaleString()} per year.
          </p>
        )}
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        Cumulative NEM Credits: ${parseFloat(cumulativeNEMCredits).toLocaleString()} | 
        Cumulative True-Up Charges: ${parseFloat(cumulativeTrueUpCharges).toLocaleString()}
      </div>
    </div>
  );
};

export default NEMStatusCard;
