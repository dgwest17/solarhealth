import React from 'react';
import { Award, TrendingUp, AlertTriangle } from 'lucide-react';

const SystemScore = ({ calculations, inputs }) => {
  const calculateScore = () => {
    const cumulativeSavings = parseFloat(calculations.cumulativeSavings);
    const savingsTrend = parseFloat(calculations.avgMonthlySavings) > 0;
    const currentNEMImpact = calculations.currentNEMImpact;
    const annualTrueUp = currentNEMImpact?.type === 'trueup' ? currentNEMImpact.amount : 0;
    const annualCredit = currentNEMImpact?.type === 'credit' ? currentNEMImpact.amount : 0;
    
    // Check if annual utility costs are only connection fees
    const onlyConnectionFees = inputs.nemVersion === 'NEM2' && annualTrueUp === 0;
    
    // Score S - SuperSolar
    if (onlyConnectionFees && cumulativeSavings > 0 && savingsTrend && annualCredit > 250) {
      return {
        grade: 'S',
        label: 'SuperSolar',
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-300',
        textColor: 'text-purple-600',
        icon: '🌟',
        recommendation: inputs.hasBattery 
          ? "No changes needed. Your system is performing amazingly and you have saved boatloads of money! You are earning money and there is room to grow usage!"
          : "No changes needed. Your system is performing amazingly and you have saved boatloads of money! You are earning money and there is room to grow usage! Battery will add backup capabilities."
      };
    }
    
    // Score A
    if (onlyConnectionFees && cumulativeSavings > 0 && savingsTrend && annualCredit >= 0 && annualCredit <= 250) {
      return {
        grade: 'A',
        label: 'Excellent',
        color: 'from-green-500 to-emerald-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        textColor: 'text-green-600',
        icon: '⭐',
        recommendation: "No changes needed to system, you are earning money and your system has saved you thousands! Battery may improve system savings and add backup capabilities."
      };
    }
    
    // Score B
    if (cumulativeSavings > 0 && savingsTrend && annualTrueUp >= 0 && annualTrueUp <= 500) {
      return {
        grade: 'B',
        label: 'Good',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        textColor: 'text-blue-600',
        icon: '✓',
        recommendation: "Your system is doing well and you've saved a lot. However, you may want to consider adding extra solar and a battery may improve system savings while adding backup capabilities."
      };
    }
    
    // Score C
    if (cumulativeSavings > 0 && savingsTrend && annualTrueUp > 500 && annualTrueUp <= 2000) {
      return {
        grade: 'C',
        label: 'Fair',
        color: 'from-yellow-500 to-orange-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        textColor: 'text-yellow-700',
        icon: '⚠',
        recommendation: "You've saved money with solar, it's better than having no solar! However, your system may need an update. Consider adding more panels and/or a battery to reduce your annual true-up."
      };
    }
    
    // Score D
    if (cumulativeSavings > 100 && annualTrueUp >= 1000) {
      return {
        grade: 'D',
        label: 'Needs Attention',
        color: 'from-orange-600 to-red-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-400',
        textColor: 'text-orange-700',
        icon: '⚠️',
        recommendation: "You've saved money with solar, it's better than having no solar! However, your system may need an update or repair. It is highly recommended you consult a repair firm or add more panels and a battery to reduce your annual true-up."
      };
    }
    
    // Score F
    if (cumulativeSavings <= 100 && annualTrueUp >= 1000) {
      let recommendation = "Shoot! We believe in solar and what it can do for people. However there are many variables that can lead to a poor experience for a few systems. You may need a system repair or whole new system. Consult with a repair company or installation company.";
      
      if (inputs.program === 'PPA') {
        recommendation += " Since you have a PPA/Lease, reach out to the company who owns the system for repairs or pursue other actions.";
      }
      
      return {
        grade: 'F',
        label: 'Critical',
        color: 'from-red-600 to-red-800',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-400',
        textColor: 'text-red-700',
        icon: '❌',
        recommendation
      };
    }
    
    // Default to B if nothing else matches
    return {
      grade: 'B',
      label: 'Good',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      textColor: 'text-blue-600',
      icon: '✓',
      recommendation: "Your system is doing well and you've saved a lot. However, you may want to consider adding extra solar and a battery may improve system savings while adding backup capabilities."
    };
  };

  const score = calculateScore();

  return (
    <div className={`${score.bgColor} border-2 ${score.borderColor} rounded-xl shadow-xl p-8 mb-6`}>
      <div className="flex items-center gap-6 mb-6">
        <div className={`w-32 h-32 rounded-2xl bg-gradient-to-br ${score.color} flex items-center justify-center shadow-2xl`}>
          <div className="text-center">
            <div className="text-7xl font-black text-white">{score.grade}</div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-5xl">{score.icon}</span>
            <h2 className={`text-4xl font-bold ${score.textColor}`}>
              System Score: {score.label}
            </h2>
          </div>
          
          <div className={`mt-4 p-4 bg-white rounded-lg border ${score.borderColor} shadow-sm`}>
            <h3 className="font-semibold text-gray-800 mb-2 text-lg">💡 Recommendation:</h3>
            <p className="text-gray-700 leading-relaxed">
              {score.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemScore;
