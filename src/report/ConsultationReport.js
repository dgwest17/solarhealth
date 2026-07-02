/**
 * Consultation Report generator.
 *
 * Builds a dedicated, print-clean HTML document (opened in a new window with
 * the print dialog ready) that mirrors the consultation flow:
 *   1. System snapshot          — their equipment & site data
 *   2. Financial position       — current true-up/credit, savings, rates
 *   3. Measured data            — Green Button figures, when uploaded
 *   4. Load simulation          — extra usage they explored, when any
 *   5. Battery impact           — export losses & recoverable value
 *   6. Recommendations          — auto-generated from the numbers above
 *
 * This is intentionally independent of the on-screen dashboard so the
 * leave-behind is a controlled, consistent document.
 */
import { TOU_RATES, UTILITY_OPTIONS, NEM_OPTIONS } from '../utils/rateData';
import {
  buildDailyOverlay,
  calculateExportEconomics,
  calculateCreditsRecovered
} from '../battery/BatteryModel';

const DISCLAIMER =
  'This report is provided for informational and educational purposes only. All figures are estimates ' +
  'based on information provided by the customer and publicly available utility rate data, and do not ' +
  'represent actual money received, saved, or owed. Actual utility charges, credits, savings, and ' +
  'true-up amounts are determined solely by your utility provider and will vary with rates, weather, ' +
  'usage patterns, equipment performance, and program rules. Nothing in this report constitutes a ' +
  'guarantee of savings or financial performance, nor financial, tax, or legal advice. Consult your ' +
  'utility and a qualified professional before making financial decisions.';

const money = (v) => '$' + Math.round(Math.abs(Number(v) || 0)).toLocaleString();
const kwh = (v) => (Number(v) || 0).toLocaleString() + ' kWh';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function labelFor(list, value) {
  const o = list.find((x) => x.value === value);
  return o ? o.label : value;
}

export function openConsultationReport({ clientName, inputs, calculations, extraUsage, gbProfile }) {
  const utilLabel = labelFor(UTILITY_OPTIONS, inputs.utility);
  const utilShort = (/\(([^)]+)\)/.exec(utilLabel) || [null, utilLabel])[1];
  const nemLabel = labelFor(NEM_OPTIONS, inputs.nemVersion);
  const nem = calculations.currentNEMImpact;
  const isCredit = nem && nem.type === 'credit';
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;

  // Battery figures: measured grid flows when available, modeled otherwise.
  const measured = gbProfile && gbProfile.ok ? gbProfile : null;
  const overlay = buildDailyOverlay('evening_heavy', inputs.currentAnnualUsage, inputs.annualProduction);
  const expKwh = measured ? measured.annualExportKwh : overlay.annualDaytimeOverproduction;
  const impKwh = measured ? measured.annualImportKwh : overlay.annualNighttimeImport;
  const econ = calculateExportEconomics(touRates, expKwh, impKwh, inputs.utility);
  // Value lost to the sell-low/buy-high spread: the energy that round-trips
  // through the grid (min of exports/imports) times the rate gap.
  const roundTripKwh = Math.min(expKwh, impKwh);
  const spreadLoss = Math.max(0, roundTripKwh * (econ.nightBuyRate - econ.daytimeSellRate));
  const batteryCap = inputs.batteryCapacity || 13.5;
  const recovery = calculateCreditsRecovered(touRates, expKwh, impKwh, batteryCap, inputs.batteryEfficiency || 90, inputs.utility);

  const hasSim = extraUsage && extraUsage.addedKwh > 0;
  const extraCost = hasSim ? extraUsage.cost : 0;

  // ---- Recommendations, from the same tiers the tools use ----
  const recs = [];
  const owedNow = !isCredit && nem ? nem.amount : 0;
  const totalExposure = owedNow + extraCost;
  if (calculations.systemHealth && calculations.systemHealth.status === 'poor') {
    recs.push({ title: 'Schedule a system inspection', body: `Production is at ${calculations.systemHealth.performanceRatio.toFixed(0)}% of expected for a ${inputs.systemSize} kW system. An inspection can identify shading, soiling, or equipment faults.` });
  }
  if (totalExposure > 1000) {
    recs.push({ title: 'Battery + additional solar recommended', body: `Projected annual exposure of ${money(totalExposure)} (${owedNow > 0 ? `current true-up ${money(owedNow)}` : 'no current true-up'}${hasSim ? ` + ${money(extraCost)} from planned added usage` : ''}) exceeds what storage alone typically recovers. Pairing a battery with added panels closes the gap.` });
  } else if (totalExposure > 0) {
    recs.push({ title: 'Battery recommended', body: `A battery that shifts evening usage onto stored solar could recover most of the projected ${money(totalExposure)} annual cost by avoiding peak-rate purchases.` });
  } else if (isCredit) {
    recs.push({ title: 'System is performing well', body: `The system currently over-produces, generating an estimated ${money(nem.amount)} annual credit. A battery would still capture the ${money(spreadLoss)} lost annually to the export/import rate spread.` });
  }
  if (hasSim) {
    recs.push({ title: 'Plan for the added load', body: `The usage changes explored (${kwh(extraUsage.addedKwh)} added, ~${extraUsage.daytimePct}% daytime) would introduce an estimated ${money(extraCost)}/yr in new time-of-use charges. Sizing storage or additional panels for this now avoids surprise true-ups later.` });
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const row = (label, value) => `<tr><td>${esc(label)}</td><td>${value}</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Solar System Analysis${clientName ? ' — ' + esc(clientName) : ''}</title>
<style>
  :root { --navy:#0f1e36; --gold:#c9982a; --ink:#1a2433; --line:#dfe5ee; --soft:#f5f7fb; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; color:var(--ink); font-size:12.5px; line-height:1.55; padding:36px 44px; }
  .band { height:6px; background:linear-gradient(90deg, var(--navy), var(--gold)); border-radius:3px; margin-bottom:18px; }
  header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:6px; }
  h1 { font-size:22px; color:var(--navy); letter-spacing:.3px; }
  .brand { font-size:11px; color:var(--gold); font-weight:700; text-transform:uppercase; letter-spacing:2px; }
  .meta { text-align:right; font-size:11px; color:#5b6779; }
  h2 { font-size:13px; color:var(--navy); text-transform:uppercase; letter-spacing:1.2px; border-bottom:2px solid var(--gold); padding-bottom:4px; margin:22px 0 10px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  td:first-child { color:#5b6779; width:46%; }
  td:last-child { font-weight:600; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 28px; }
  .hero { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:10px 0 4px; }
  .cell { background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:10px 12px; text-align:center; }
  .cell .v { font-size:19px; font-weight:800; color:var(--navy); }
  .cell .green { color:#177a4b; } .cell .red { color:#b3261e; }
  .cell .l { font-size:9.5px; color:#5b6779; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
  .rec { border:1px solid var(--line); border-left:4px solid var(--gold); border-radius:6px; padding:9px 12px; margin-bottom:8px; background:var(--soft); }
  .rec b { color:var(--navy); display:block; margin-bottom:2px; }
  .note { font-size:10.5px; color:#5b6779; }
  .disclaimer { margin-top:26px; padding:11px 13px; border:1px solid var(--line); border-radius:6px; background:var(--soft); font-size:9.5px; color:#5b6779; }
  footer { margin-top:14px; font-size:10px; color:#8a93a3; display:flex; justify-content:space-between; }
  @media print { body { padding:14mm 16mm; } .noprint { display:none; } }
  .printbar { position:fixed; top:10px; right:10px; }
  .printbar button { background:var(--navy); color:#fff; border:none; border-radius:6px; padding:9px 16px; font-weight:700; cursor:pointer; }
</style></head><body>
<div class="noprint printbar"><button onclick="window.print()">Save as PDF</button></div>
<div class="band"></div>
<header>
  <div>
    <div class="brand">SolarHealth</div>
    <h1>Solar System Analysis</h1>
  </div>
  <div class="meta">
    ${clientName ? `Prepared for <strong>${esc(clientName)}</strong><br>` : ''}
    ${today}<br>${esc(utilShort)} · ${esc(nemLabel)}
  </div>
</header>

<div class="hero">
  <div class="cell"><div class="v ${isCredit ? 'green' : 'red'}">${isCredit ? '+' : '\u2212'}${money(nem ? nem.amount : 0)}/yr</div><div class="l">Current ${isCredit ? 'annual credit' : 'annual true-up'}</div></div>
  <div class="cell"><div class="v">${calculations.offsetPercentage}%</div><div class="l">Solar offset of usage</div></div>
  <div class="cell"><div class="v green">${money(calculations.cumulativeSavings)}</div><div class="l">Est. savings to date</div></div>
</div>

<h2>1 · System Snapshot</h2>
<div class="grid">
<table>
${row('System size', inputs.systemSize + ' kW')}
${row('Installed', inputs.installedMonth + '/' + inputs.installedYear)}
${row('Utility', esc(utilShort))}
${row('NEM program', esc(nemLabel))}
${row('Financing', esc(inputs.program))}
</table>
<table>
${row('Annual production', kwh(inputs.annualProduction))}
${row('Annual consumption', kwh(inputs.currentAnnualUsage))}
${row('Performance', calculations.systemHealth ? calculations.systemHealth.performanceRatio.toFixed(0) + '% of expected' : '—')}
${row('Current utility rate', '$' + calculations.currentUtilityRate + '/kWh')}
${row('Rate increase since install', '+' + calculations.rateIncrease + '%')}
</table>
</div>

<h2>2 · Financial Position</h2>
<table>
${row(isCredit ? 'Net over-production' : 'Net shortfall', kwh(isCredit ? nem.netProduction : (nem ? nem.shortage : 0)))}
${row(isCredit ? 'Estimated annual credit' : 'Estimated annual true-up', (isCredit ? '+' : '\u2212') + money(nem ? nem.amount : 0) + '/yr')}
${row('Estimated avg monthly savings vs. utility', '$' + calculations.avgMonthlySavings)}
${row('Estimated cumulative savings (' + calculations.yearsSinceInstall + ' yrs)', money(calculations.cumulativeSavings))}
</table>

${measured ? `
<h2>3 · Measured Usage Data (Green Button)</h2>
<table>
${row('Data range', esc(measured.meta.readingStart) + ' \u2192 ' + esc(measured.meta.readingEnd) + ' (' + measured.days + ' days)')}
${row('Grid purchases (annualized)', kwh(measured.annualImportKwh))}
${row('Solar exports (annualized)', measured.hasGeneration ? kwh(measured.annualExportKwh) : 'No generation channel in file')}
${row('Net grid usage', kwh(measured.annualNetKwh))}
${row('Share of purchases at peak rates', Math.round(measured.touImportShare.peak * 100) + '%')}
</table>
<p class="note">Figures measured by the utility meter at 15-minute intervals; the analysis above uses this data in place of modeled estimates.</p>
` : ''}

${hasSim ? `
<h2>${measured ? 4 : 3} · Planned Usage Changes (Load Simulation)</h2>
<table>
${row('Added annual usage explored', kwh(extraUsage.addedKwh))}
${row('Portion above current production', kwh(extraUsage.billableKwh))}
${row('Estimated daytime share', extraUsage.daytimePct + '%')}
${row('Estimated added annual cost', '\u2212' + money(extraCost) + '/yr at time-of-use rates')}
</table>
<p class="note">Added-usage costs apply only to consumption beyond current production and are priced by when the power would be used (daytime off-peak vs. evening peak).</p>
` : ''}

<h2>${(measured ? 4 : 3) + (hasSim ? 1 : 0)} · Battery Impact</h2>
<table>
${row('Energy sold to the grid' + (measured ? ' (measured)' : ' (modeled)'), kwh(expKwh) + '/yr')}
${row('Energy bought back' + (measured ? ' (measured)' : ' (modeled)'), kwh(impKwh) + '/yr')}
${row('Est. value lost to sell-low / buy-high spread', money(spreadLoss) + '/yr')}
${row('Est. recoverable with a ' + batteryCap + ' kWh battery', money(recovery.creditsRecovered) + '/yr')}
</table>
<p class="note">Under time-of-use billing, solar is exported at low daytime rates and repurchased at high evening rates. A battery stores the export and serves it back in the evening, capturing that spread.</p>

<h2>${(measured ? 5 : 4) + (hasSim ? 1 : 0)} · Recommendations</h2>
${recs.map((r) => `<div class="rec"><b>${esc(r.title)}</b>${esc(r.body)}</div>`).join('')}

<div class="disclaimer"><strong>Important — estimates only.</strong> ${DISCLAIMER}</div>
<footer><span>SolarHealth · System Analysis</span><span>${today}</span></footer>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked — please allow pop-ups to generate the report.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
