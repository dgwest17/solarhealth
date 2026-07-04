/**
 * Battery incentive programs, keyed by utility territory.
 *
 * Drives the report's "Battery Incentives Available Now" urgency section.
 *
 * ⚠ MAINTENANCE: incentive amounts, funding status, and eligibility change
 * often — sometimes monthly. Values below are typical/representative figures
 * marked with `approx: true`; VERIFY amounts before quoting them in a sale.
 * Edit this one file to add/remove programs or update numbers.
 *
 * Fields:
 *   name     — program name shown on the report
 *   value    — headline value ("30% of cost", "up to $X", "$/kWh")
 *   blurb    — one-line description
 *   urgency  — why acting now matters (funding steps down, waitlists, etc.)
 *   approx   — true = representative figure, verify before quoting
 */

const FEDERAL_ITC = {
  name: 'Federal Energy Investment Credit',
  value: '30-40% of battery cost',
  blurb: 'Standalone or paired battery storage (3 kWh+) qualifies for the federal energy credit.',
  urgency: 'Ranges from 30-40% for now until end of 2027. Installing while the full credit stands removes the risk it goes away.',
  approx: false
};

const SGIP = {
  name: 'SGIP (Self-Generation Incentive Program)',
  value: 'up to ~$150–$1,000/kWh by tier',
  blurb: 'California\u2019s statewide battery rebate; higher "equity resiliency" tiers pay dramatically more for qualifying households (medical baseline, fire zones, CARE).',
  urgency: 'Funded in steps — general-market budgets run out and reopen; equity tiers pay first-come, first-served.',
  approx: true
};

const VPP = {
  name: 'Virtual Power Plant (VPP) enrollment',
  value: '$hundreds/yr ongoing',
  blurb: 'Programs like Tesla VPP and utility demand-response pay batteries to discharge during grid events — recurring income on top of bill savings.',
  urgency: 'Enrollment windows and per-kWh event pricing vary each season; early enrollees lock current terms.',
  approx: true
};

export const INCENTIVES_BY_UTILITY = {
  SDGE: [
    FEDERAL_ITC,
    SGIP,
    {
      name: 'SDCP battery rebate (San Diego Community Power)',
      value: 'up to ~$5,000 (CARE-qualified more)',
      blurb: 'SDCP customers in SDG&E territory can stack a community-power battery rebate on top of SGIP and the federal credit.',
      urgency: 'Program budgets are annual and first-come, first-served.',
      approx: true
    },
    VPP
  ],
  SCE: [FEDERAL_ITC, SGIP, VPP],
  PGE: [FEDERAL_ITC, SGIP, VPP],
  SMUD: [
    FEDERAL_ITC,
    {
      name: 'SMUD battery storage incentive (My Energy Optimizer)',
      value: 'up to ~$10,000 upfront + ongoing',
      blurb: 'SMUD pays an upfront battery incentive plus annual participation payments for grid-support enrollment.',
      urgency: 'Capacity-limited program years — enrollment closes when the target is met.',
      approx: true
    },
    VPP
  ]
};

export function getBatteryIncentives(utility) {
  return INCENTIVES_BY_UTILITY[utility] || [FEDERAL_ITC, SGIP, VPP];
}
