/**
 * System score (S/A/B/C/D/F) — single source of truth shared by the in-app
 * SystemScore card and the Consultation Report, so grades can never drift.
 */
export function calculateSystemScore(calculations, inputs) {
  const cumulativeSavings = parseFloat(calculations.cumulativeSavings);
  const savingsTrend = parseFloat(calculations.avgMonthlySavings) > 0;
  const currentNEMImpact = calculations.currentNEMImpact;
  const annualTrueUp = currentNEMImpact?.type === 'trueup' ? currentNEMImpact.amount : 0;
  const annualCredit = currentNEMImpact?.type === 'credit' ? currentNEMImpact.amount : 0;
  const onlyConnectionFees = inputs.nemVersion === 'NEM2' && annualTrueUp === 0;

  // HARD RULE: an annual true-up over $2,000 is a failing system no matter
  // what it saved historically — something needs to be done NOW.
  if (annualTrueUp > 2000) {
    return {
      grade: 'F', label: 'Critical', icon: '🚨', hex: '#ef4444', critical: true,
      color: 'from-red-600 to-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-400', textColor: 'text-red-600',
      recommendation: `Your annual true-up is over $${Math.round(annualTrueUp).toLocaleString()} — this system is not doing its job. Something needs to be done now: a system inspection, added panels, and/or a battery to stop the bleeding.`
    };
  }

  if (onlyConnectionFees && cumulativeSavings > 0 && savingsTrend && annualCredit > 250) {
    return {
      grade: 'S', label: 'SuperSolar', icon: '🌟', hex: '#c084fc',
      color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', textColor: 'text-purple-600',
      recommendation: inputs.hasBattery
        ? 'No changes needed. Your system is performing amazingly and you have saved boatloads of money! You are earning money and there is room to grow usage!'
        : 'No changes needed. Your system is performing amazingly and you have saved boatloads of money! You are earning money and there is room to grow usage! Battery will add backup capabilities.'
    };
  }
  if (onlyConnectionFees && cumulativeSavings > 0 && savingsTrend && annualCredit >= 0 && annualCredit <= 250) {
    return {
      grade: 'A', label: 'Excellent', icon: '⭐', hex: '#3ddc84',
      color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-50', borderColor: 'border-green-300', textColor: 'text-green-600',
      recommendation: 'No changes needed to system, you are earning money and your system has saved you thousands! Battery may improve system savings and add backup capabilities.'
    };
  }
  if (cumulativeSavings > 0 && savingsTrend && annualTrueUp >= 0 && annualTrueUp <= 500) {
    return {
      grade: 'B', label: 'Good', icon: '✓', hex: '#22d3ee',
      color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-600',
      recommendation: "Your system is doing well and you've saved a lot. However, you may want to consider adding extra solar and a battery may improve system savings while adding backup capabilities."
    };
  }
  if (cumulativeSavings > 0 && savingsTrend && annualTrueUp > 500 && annualTrueUp <= 2000) {
    return {
      grade: 'C', label: 'Fair', icon: '⚠', hex: '#e8b93e',
      color: 'from-yellow-500 to-orange-500', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300', textColor: 'text-yellow-700',
      recommendation: "You've saved money with solar, it's better than having no solar! However, your system may need an update. Consider adding more panels and/or a battery to reduce your annual true-up."
    };
  }
  if (cumulativeSavings > 100 && annualTrueUp >= 1000) {
    return {
      grade: 'D', label: 'Needs Attention', icon: '⚠️', hex: '#ff8c42',
      color: 'from-orange-600 to-red-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-400', textColor: 'text-orange-700',
      recommendation: "You've saved money with solar, it's better than having no solar! However, your system may need an update or repair. It is highly recommended you consult a repair firm or add more panels and a battery to reduce your annual true-up."
    };
  }
  if (cumulativeSavings <= 100 && annualTrueUp >= 1000) {
    let recommendation = 'Shoot! We believe in solar and what it can do for people. However there are many variables that can lead to a poor experience for a few systems. You may need a system repair or whole new system. Consult with a repair company or installation company.';
    if (inputs.program === 'PPA') {
      recommendation += ' Since you have a PPA/Lease, reach out to the company who owns the system for repairs or pursue other actions.';
    }
    return {
      grade: 'F', label: 'Critical', icon: '❌', hex: '#ff6b5e',
      color: 'from-red-600 to-red-800', bgColor: 'bg-red-50', borderColor: 'border-red-400', textColor: 'text-red-700',
      recommendation
    };
  }
  return {
    grade: 'B', label: 'Good', icon: '✓', hex: '#22d3ee',
    color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-600',
    recommendation: "Your system is doing well and you've saved a lot. However, you may want to consider adding extra solar and a battery may improve system savings while adding backup capabilities."
  };
}
