import React, { useState } from 'react';
import { FileDown, Printer } from 'lucide-react';

/**
 * Customer Report card — generates a client-ready PDF via browser print-to-PDF.
 * No server-side dependencies. Includes the AI narrative when one has been generated.
 *
 * Print-friendly design: white pages with navy + gold accents (dark page
 * backgrounds print badly and burn through ink).
 */
const PDFReportGenerator = ({ inputs, calculations, narrative }) => {
  const [clientName, setClientName] = useState('');
  const [preparedBy, setPreparedBy] = useState('');

  const nem = calculations.currentNEMImpact;
  const nemLabel = { NEM1: 'NEM 1.0', NEM2: 'NEM 2.0', NEM3: 'NEM 3.0' }[inputs.nemVersion] || inputs.nemVersion;
  const utilityLabel = { PGE: 'PG&E', SCE: 'SCE', SDGE: 'SDG&E' }[inputs.utility] || inputs.utility;
  const fmt = (v) => parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const buildReportHTML = () => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const narrativeBlock = narrative
      ? `
      <div class="headline">"${narrative.headline}"</div>
      <div class="grid2">
        <div class="card"><h4>System Performance</h4><p>${narrative.performance}</p></div>
        <div class="card"><h4>Financial Health</h4><p>${narrative.financial}</p></div>
        <div class="card"><h4>Your Net Metering Situation</h4><p>${narrative.nem}</p></div>
        <div class="card"><h4>Energy Usage Outlook</h4><p>${narrative.usage}</p></div>
      </div>`
      : `<p class="muted">Generate the AI narrative before printing to include a personalized written summary in this report.</p>`;

    const actionsBlock = narrative
      ? narrative.actionItems
          .map(
            (item) => `
        <div class="action">
          <div class="action-num">${item.priority}</div>
          <div><strong>${item.title}</strong><p>${item.detail}</p></div>
        </div>`
          )
          .join('')
      : '';

    const yearRows = calculations.yearlyData
      .map(
        (y) => `
      <tr>
        <td>${y.year}</td>
        <td>$${y.utilityRate}</td>
        <td>${fmt(y.projectedUsage)} kWh</td>
        <td>$${fmt(y.utilityCost)}</td>
        <td>$${fmt(y.solarCost)}</td>
        <td>$${fmt(y.annualSavings)}</td>
        <td><strong>$${fmt(y.cumulativeSavings)}</strong></td>
      </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Solar Financial Audit — ${clientName || 'Client Report'}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #14213d; font-size: 11pt; line-height: 1.5; }
  .sans { font-family: Helvetica, Arial, sans-serif; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  header { border-bottom: 3px solid #d4a017; padding-bottom: 14px; margin-bottom: 24px;
           display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-family: Helvetica, Arial, sans-serif; font-size: 20pt; font-weight: bold; color: #14213d; }
  .brand span { color: #d4a017; }
  .meta { text-align: right; font-size: 9pt; color: #555; font-family: Helvetica, Arial, sans-serif; }

  h2 { font-family: Helvetica, Arial, sans-serif; font-size: 13pt; color: #14213d;
       border-left: 4px solid #d4a017; padding-left: 10px; margin: 22px 0 12px; }
  h4 { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; text-transform: uppercase;
       letter-spacing: 1px; color: #d4a017; margin-bottom: 5px; }
  p { margin-bottom: 6px; }
  .muted { color: #777; font-style: italic; font-size: 10pt; }

  .headline { font-size: 14pt; font-style: italic; color: #14213d; margin: 14px 0 18px;
              padding: 12px 16px; background: #faf6ec; border-left: 4px solid #d4a017; }

  .kpis { display: flex; gap: 12px; margin: 14px 0; }
  .kpi { flex: 1; border: 1px solid #d4a017; border-radius: 6px; padding: 12px; text-align: center; }
  .kpi .num { font-family: Helvetica, Arial, sans-serif; font-size: 17pt; font-weight: bold; color: #14213d; }
  .kpi .lbl { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #777;
              font-family: Helvetica, Arial, sans-serif; margin-top: 3px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { border: 1px solid #e2dccb; border-radius: 6px; padding: 12px; background: #fdfcf8; font-size: 10pt; }

  table { width: 100%; border-collapse: collapse; font-size: 9pt; font-family: Helvetica, Arial, sans-serif; }
  th { background: #14213d; color: #fff; padding: 7px 8px; text-align: left; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; }
  tr:nth-child(even) td { background: #f7f6f2; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0;
                 border-bottom: 1px solid #eee; font-size: 10pt; }
  .summary-row strong { color: #14213d; }
  .gold { color: #b8860b; font-weight: bold; }

  .action { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
  .action-num { width: 22px; height: 22px; border-radius: 50%; background: #d4a017; color: #fff;
                font-family: Helvetica, Arial, sans-serif; font-weight: bold; font-size: 10pt;
                display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .action p { font-size: 10pt; color: #444; }

  .cta { margin-top: 24px; background: #14213d; color: #fff; border-radius: 8px; padding: 16px 20px; }
  .cta h3 { font-family: Helvetica, Arial, sans-serif; color: #d4a017; font-size: 12pt; margin-bottom: 6px; }
  .cta p { font-size: 10pt; }

  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd;
           font-size: 8pt; color: #999; font-family: Helvetica, Arial, sans-serif; }
</style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">
  <header>
    <div class="brand">Solar Financial <span>Audit</span></div>
    <div class="meta">
      ${clientName ? `Prepared for: <strong>${clientName}</strong><br/>` : ''}
      ${preparedBy ? `Prepared by: ${preparedBy}<br/>` : ''}
      ${today}
    </div>
  </header>

  <h2>Executive Summary</h2>
  ${narrativeBlock}

  <h2>Key Results</h2>
  <div class="kpis">
    <div class="kpi"><div class="num">$${fmt(calculations.cumulativeSavings)}</div><div class="lbl">Total Savings</div></div>
    <div class="kpi"><div class="num">$${calculations.avgMonthlySavings}</div><div class="lbl">Avg Monthly Savings</div></div>
    <div class="kpi"><div class="num">${calculations.roi}%</div><div class="lbl">ROI to Date</div></div>
    <div class="kpi"><div class="num">${(calculations.paybackMonths / 12).toFixed(1)} yrs</div><div class="lbl">Payback Period</div></div>
  </div>

  <h2>System Overview</h2>
  <div class="two-col">
    <div>
      <div class="summary-row"><span>System Size</span><strong>${inputs.systemSize} kW</strong></div>
      <div class="summary-row"><span>Installed</span><strong>${inputs.installedMonth}/${inputs.installedYear} (${calculations.yearsSinceInstall} yrs)</strong></div>
      <div class="summary-row"><span>Annual Production</span><strong>${fmt(inputs.annualProduction)} kWh</strong></div>
      <div class="summary-row"><span>Performance Ratio</span><strong>${calculations.systemHealth.performanceRatio.toFixed(1)}%</strong></div>
      <div class="summary-row"><span>Energy Offset</span><strong>${calculations.offsetPercentage}%</strong></div>
    </div>
    <div>
      <div class="summary-row"><span>Utility</span><strong>${utilityLabel}${inputs.onCareProgram ? ' (CARE)' : ''}</strong></div>
      <div class="summary-row"><span>NEM Version</span><strong>${nemLabel}</strong></div>
      <div class="summary-row"><span>Rate at Install</span><strong>$${calculations.initialUtilityRate}/kWh</strong></div>
      <div class="summary-row"><span>Current Rate</span><strong>$${calculations.currentUtilityRate}/kWh (+${calculations.rateIncrease}%)</strong></div>
      <div class="summary-row"><span>NEM Status</span><strong class="gold">${
        nem.type === 'credit'
          ? `Credit: $${fmt(nem.amount)}/yr`
          : `True-up: $${fmt(nem.amount)}/yr`
      }</strong></div>
    </div>
  </div>

  <footer>Generated by Solar Financial Audit • Rates sourced from CPUC reports • This report is an estimate based on data provided.</footer>
</div>

<!-- PAGE 2 -->
<div class="page">
  <header>
    <div class="brand">Financial <span>Detail</span></div>
    <div class="meta">${clientName ? `${clientName} • ` : ''}${today}</div>
  </header>

  <h2>Financial Summary</h2>
  <div class="two-col">
    <div>
      <div class="summary-row"><span>Total Investment</span><strong>$${fmt(calculations.totalInvestment)}</strong></div>
      <div class="summary-row"><span>Solar Cost Paid to Date</span><strong>$${fmt(calculations.cumulativeCost)}</strong></div>
      <div class="summary-row"><span>NEM Credits Received</span><strong class="gold">$${fmt(calculations.cumulativeNEMCredits)}</strong></div>
    </div>
    <div>
      <div class="summary-row"><span>True-Up Charges</span><strong>$${fmt(calculations.cumulativeTrueUpCharges)}</strong></div>
      <div class="summary-row"><span>Usage Growth</span><strong>+${calculations.usageGrowthRate}%/yr</strong></div>
      <div class="summary-row"><span>Net Benefit</span><strong class="gold">$${fmt(calculations.cumulativeSavings)}</strong></div>
    </div>
  </div>

  <h2>Year-by-Year Breakdown</h2>
  <table>
    <thead>
      <tr><th>Year</th><th>Rate</th><th>Usage</th><th>Utility Cost</th><th>Solar Cost</th><th>Savings</th><th>Cumulative</th></tr>
    </thead>
    <tbody>${yearRows}</tbody>
  </table>

  ${narrative ? `<h2>Recommended Next Steps</h2>${actionsBlock}
  <div class="cta">
    <h3>Our Recommendation</h3>
    <p>${narrative.recommendation}</p>
  </div>` : ''}

  <footer>Generated by Solar Financial Audit • Questions? Contact your solar advisor to review these results.</footer>
</div>

</body>
</html>`;
  };

  const handleGeneratePDF = () => {
    const reportWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!reportWindow) {
      alert('Please allow pop-ups to generate the PDF report.');
      return;
    }
    reportWindow.document.write(buildReportHTML());
    reportWindow.document.close();
    reportWindow.focus();
    // Give the browser a beat to render before opening the print dialog
    setTimeout(() => reportWindow.print(), 400);
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur-md border border-amber-400/40 rounded-xl shadow-2xl p-8 mb-6">
      <h2 className="text-2xl font-bold text-amber-300 flex items-center gap-2 mb-2">
        <FileDown size={24} className="text-amber-400" />
        Customer Report
      </h2>
      <p className="text-slate-300 text-sm mb-5">
        Generate a polished two-page PDF to send or hand to your client.
        {!narrative && ' Tip: generate the AI narrative first so it\u2019s included in the report.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm text-amber-200/80 mb-1">Client name (shown on report)</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. The Martinez Family"
            className="w-full px-3 py-2 border border-amber-400/30 rounded-lg bg-slate-900/60 text-slate-200"
          />
        </div>
        <div>
          <label className="block text-sm text-amber-200/80 mb-1">Prepared by (your company)</label>
          <input
            type="text"
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            placeholder="e.g. SunCoast Solar"
            className="w-full px-3 py-2 border border-amber-400/30 rounded-lg bg-slate-900/60 text-slate-200"
          />
        </div>
      </div>

      <button
        onClick={handleGeneratePDF}
        className="bg-amber-400 hover:bg-amber-300 text-[#0a1628] font-semibold px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
      >
        <Printer size={18} />
        Generate PDF report
      </button>
      <p className="text-xs text-slate-400 mt-3">
        Opens your browser's print dialog — choose "Save as PDF" as the destination.
      </p>
    </div>
  );
};

export default PDFReportGenerator;
