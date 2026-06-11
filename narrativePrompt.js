/**
 * Builds the AI prompt from real audit data.
 * The model is instructed to return strict JSON so the UI and the PDF
 * can render the narrative as structured sections.
 */

const NEM_LABELS = {
  NEM1: 'NEM 1.0 (retail-rate export credits)',
  NEM2: 'NEM 2.0 (wholesale-rate export credits)',
  NEM3: 'NEM 3.0 (significantly reduced export rates)'
};

const PROGRAM_LABELS = {
  PPA: 'PPA / Lease',
  Loan: 'Loan',
  Cash: 'Cash purchase',
  Other: 'Other financing'
};

export const NARRATIVE_SYSTEM_PROMPT = `You are a senior solar energy advisor writing a personalized audit summary for a California homeowner. Write in warm, plain English — no jargon, no hedging, no markdown. Be specific to their numbers. Be honest: if something is underperforming or costing them money, say so clearly, then explain what to do about it.

Respond ONLY with valid JSON, no preamble, no code fences, matching exactly this shape:
{
  "headline": "One-sentence overall verdict on their solar investment",
  "performance": "2-4 sentences assessing system performance in plain English",
  "financial": "2-4 sentences on savings, ROI, and payback progress",
  "nem": "2-3 sentences explaining what their NEM version means for them specifically",
  "usage": "2-3 sentences on their usage growth and what it means going forward",
  "actionItems": [
    { "priority": 1, "title": "Short action title", "detail": "1-2 sentence explanation" }
  ],
  "recommendation": "2-3 sentences with the single most valuable next-step recommendation (battery storage if they have none, warranty/monitoring if the system is aging, etc.)"
}

Include 2-3 actionItems, ordered by priority. Ground every claim in the data provided.`;

export const buildNarrativePrompt = (inputs, calculations) => {
  const nemImpact = calculations.currentNEMImpact;
  const nemSummary =
    nemImpact.type === 'credit'
      ? `Overproducing by ${Math.round(nemImpact.netProduction).toLocaleString()} kWh/yr, earning ~$${Math.round(nemImpact.amount).toLocaleString()}/yr in credits at $${nemImpact.rate.toFixed(3)}/kWh`
      : `Under-producing by ${Math.round(nemImpact.shortage).toLocaleString()} kWh/yr, owing ~$${Math.round(nemImpact.amount).toLocaleString()}/yr at true-up at $${nemImpact.rate.toFixed(3)}/kWh`;

  return `Here is this client's actual solar audit data:

SYSTEM
- Installed: ${inputs.installedMonth}/${inputs.installedYear} (${calculations.yearsSinceInstall} years ago)
- Size: ${inputs.systemSize} kW
- Annual production: ${inputs.annualProduction.toLocaleString()} kWh/yr
- Performance ratio: ${calculations.systemHealth.performanceRatio.toFixed(1)}% of expected (${calculations.systemHealth.expectedProduction.toLocaleString()} kWh/yr expected) — status: ${calculations.systemHealth.status}
- Battery installed: ${inputs.hasBattery ? `Yes (${inputs.batteryCapacity} kWh)` : 'No'}

UTILITY & NEM
- Utility: ${inputs.utility}${inputs.onCareProgram ? ' (CARE program, 30% discount)' : ''}
- Rate at install: $${calculations.initialUtilityRate}/kWh → current: $${calculations.currentUtilityRate}/kWh (+${calculations.rateIncrease}%)
- NEM version: ${NEM_LABELS[inputs.nemVersion] || inputs.nemVersion}
- Current NEM status: ${nemSummary}
- Cumulative NEM credits: $${parseFloat(calculations.cumulativeNEMCredits).toLocaleString()} | cumulative true-up charges: $${parseFloat(calculations.cumulativeTrueUpCharges).toLocaleString()}

USAGE
- Usage at install: ${inputs.annualUsageAtInstall.toLocaleString()} kWh/yr → current: ${inputs.currentAnnualUsage.toLocaleString()} kWh/yr
- Usage growth rate: ${calculations.usageGrowthRate}%/yr
- Current energy offset: ${calculations.offsetPercentage}%

FINANCIAL
- Financing: ${PROGRAM_LABELS[inputs.program] || inputs.program}
- Total investment: $${parseFloat(calculations.totalInvestment).toLocaleString()}
- Cumulative savings to date: $${parseFloat(calculations.cumulativeSavings).toLocaleString()}
- Average monthly savings: $${calculations.avgMonthlySavings}
- ROI to date: ${calculations.roi}%
- Payback period: ${(calculations.paybackMonths / 12).toFixed(1)} years

Write the personalized audit narrative as JSON.`;
};

/**
 * Parses the model's JSON response defensively (strips stray code fences).
 */
export const parseNarrativeResponse = (text) => {
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  if (!parsed.headline || !Array.isArray(parsed.actionItems)) {
    throw new Error('Narrative response missing required fields');
  }
  return parsed;
};
