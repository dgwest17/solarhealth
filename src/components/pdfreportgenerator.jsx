import React, { useRef } from 'react';

const PDFReportGenerator = ({ calculations, inputs }) => {
  const reportRef = useRef(null);

  const today = new Date();
  const reportDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const generatePDF = () => {
    const printWindow = window.open('', '_blank');
    const reportHTML = reportRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Solar System Financial Audit Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              color: #1a1a2e;
              background: white;
              font-size: 11pt;
              line-height: 1.5;
            }
            @page {
              size: letter;
              margin: 0.6in 0.7in;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
            }

            /* Header */
            .report-header {
              background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
              color: white;
              padding: 32px 36px;
              margin: -0.6in -0.7in 28px -0.7in;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-left h1 {
              font-size: 22pt;
              font-weight: 700;
              letter-spacing: -0.5px;
              margin-bottom: 4px;
            }
            .header-left h1 span { color: #38bdf8; }
            .header-left p { font-size: 10pt; color: #94a3b8; margin-top: 2px; }
            .header-right { text-align: right; }
            .header-right .report-date { font-size: 9pt; color: #94a3b8; margin-bottom: 4px; }
            .header-right .badge {
              display: inline-block;
              background: rgba(56,189,248,0.2);
              border: 1px solid rgba(56,189,248,0.4);
              color: #38bdf8;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 8.5pt;
              font-weight: 600;
              letter-spacing: 0.5px;
            }

            /* Section headers */
            .section-title {
              font-size: 13pt;
              font-weight: 700;
              color: #1e3a5f;
              border-bottom: 2.5px solid #38bdf8;
              padding-bottom: 6px;
              margin: 22px 0 14px 0;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .section-title .icon { font-size: 14pt; }

            /* KPI cards */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .kpi-card {
              border-radius: 10px;
              padding: 14px 12px;
              text-align: center;
            }
            .kpi-card.green { background: linear-gradient(135deg, #d1fae5, #a7f3d0); border: 1px solid #6ee7b7; }
            .kpi-card.blue  { background: linear-gradient(135deg, #dbeafe, #bfdbfe); border: 1px solid #93c5fd; }
            .kpi-card.purple{ background: linear-gradient(135deg, #ede9fe, #ddd6fe); border: 1px solid #c4b5fd; }
            .kpi-card.orange{ background: linear-gradient(135deg, #ffedd5, #fed7aa); border: 1px solid #fdba74; }
            .kpi-card .value { font-size: 18pt; font-weight: 800; line-height: 1.1; }
            .kpi-card.green .value  { color: #065f46; }
            .kpi-card.blue .value   { color: #1e40af; }
            .kpi-card.purple .value { color: #4c1d95; }
            .kpi-card.orange .value { color: #7c2d12; }
            .kpi-card .label { font-size: 7.5pt; font-weight: 600; color: #374151; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
            .kpi-card .sub { font-size: 8pt; color: #6b7280; margin-top: 2px; }

            /* Tables */
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5pt; }
            .data-table th {
              background: #1e3a5f;
              color: white;
              padding: 8px 10px;
              text-align: left;
              font-size: 8.5pt;
              font-weight: 600;
              letter-spacing: 0.3px;
            }
            .data-table th:last-child { text-align: right; }
            .data-table td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
            .data-table td:last-child { text-align: right; font-weight: 600; }
            .data-table tr:nth-child(even) td { background: #f8fafc; }
            .data-table tr:last-child td { border-bottom: none; }

            /* Two column layout */
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

            /* Highlight boxes */
            .highlight-box {
              border-radius: 10px;
              padding: 14px 16px;
              margin-bottom: 12px;
            }
            .highlight-box.success {
              background: #f0fdf4;
              border: 1.5px solid #86efac;
            }
            .highlight-box.warning {
              background: #fffbeb;
              border: 1.5px solid #fcd34d;
            }
            .highlight-box.info {
              background: #eff6ff;
              border: 1.5px solid #93c5fd;
            }
            .highlight-box.danger {
              background: #fff1f2;
              border: 1.5px solid #fca5a5;
            }
            .highlight-box h4 {
              font-size: 10pt;
              font-weight: 700;
              margin-bottom: 6px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .highlight-box.success h4 { color: #065f46; }
            .highlight-box.warning h4 { color: #92400e; }
            .highlight-box.info h4    { color: #1e40af; }
            .highlight-box.danger h4  { color: #991b1b; }
            .highlight-box p, .highlight-box li { font-size: 9pt; color: #374151; line-height: 1.6; }
            .highlight-box ul { padding-left: 16px; }

            /* Recommendation items */
            .rec-item {
              display: flex;
              gap: 12px;
              padding: 12px 14px;
              border-radius: 8px;
              margin-bottom: 10px;
              border: 1px solid #e5e7eb;
              background: #f9fafb;
            }
            .rec-item .rec-num {
              width: 26px;
              height: 26px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 11pt;
              flex-shrink: 0;
            }
            .rec-item.priority-high .rec-num { background: #fee2e2; color: #dc2626; }
            .rec-item.priority-med .rec-num  { background: #fef3c7; color: #d97706; }
            .rec-item.priority-low .rec-num  { background: #dcfce7; color: #16a34a; }
            .rec-item .rec-content h5 { font-size: 10pt; font-weight: 700; color: #111827; margin-bottom: 3px; }
            .rec-item .rec-content p  { font-size: 8.5pt; color: #4b5563; line-height: 1.5; }
            .rec-item .rec-tag { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 10px; display: inline-block; margin-bottom: 4px; }
            .tag-high { background: #fee2e2; color: #dc2626; }
            .tag-med  { background: #fef3c7; color: #d97706; }
            .tag-low  { background: #dcfce7; color: #16a34a; }

            /* Progress bar */
            .progress-wrap { margin: 6px 0 12px; }
            .progress-label { display: flex; justify-content: space-between; font-size: 8.5pt; color: #374151; margin-bottom: 3px; }
            .progress-bar { height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; }
            .progress-fill { height: 100%; border-radius: 5px; }
            .fill-green  { background: linear-gradient(90deg, #10b981, #059669); }
            .fill-yellow { background: linear-gradient(90deg, #f59e0b, #d97706); }
            .fill-red    { background: linear-gradient(90deg, #ef4444, #dc2626); }
            .fill-blue   { background: linear-gradient(90deg, #3b82f6, #2563eb); }

            /* Yearly breakdown table */
            .yearly-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
            .yearly-table th { background: #1e3a5f; color: white; padding: 7px 8px; text-align: center; }
            .yearly-table td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; }
            .yearly-table tr:nth-child(even) td { background: #f8fafc; }
            .yearly-table .positive { color: #059669; font-weight: 700; }
            .yearly-table .negative { color: #dc2626; font-weight: 700; }

            /* Footer */
            .report-footer {
              margin-top: 28px;
              padding-top: 14px;
              border-top: 1.5px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 8pt;
              color: #9ca3af;
            }
            .report-footer .disclaimer { max-width: 75%; line-height: 1.5; }
            .report-footer .page-num { color: #6b7280; font-weight: 600; }

            /* Metric row */
            .metric-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 9.5pt; }
            .metric-row:last-child { border-bottom: none; }
            .metric-row .metric-label { color: #6b7280; }
            .metric-row .metric-value { font-weight: 700; color: #111827; }
            .metric-row .metric-value.green { color: #059669; }
            .metric-row .metric-value.red { color: #dc2626; }
            .metric-row .metric-value.blue { color: #2563eb; }

            .card { background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }

            /* NEM badge */
            .nem-badge {
              display: inline-block;
              padding: 3px 10px;
              border-radius: 4px;
              font-size: 8.5pt;
              font-weight: 700;
            }
            .nem-1 { background: #d1fae5; color: #065f46; }
            .nem-2 { background: #dbeafe; color: #1e40af; }
            .nem-3 { background: #fee2e2; color: #991b1b; }

            .utility-badge {
              display: inline-block;
              padding: 3px 10px;
              border-radius: 4px;
              font-size: 8.5pt;
              font-weight: 700;
              background: #f3f4f6;
              color: #374151;
            }
          </style>
        </head>
        <body>${reportHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Helper calculations
  const utilityLabel = inputs.utility === 'PGE' ? 'Pacific Gas & Electric' : inputs.utility === 'SCE' ? 'Southern California Edison' : 'San Diego Gas & Electric';
  const systemAgeYears = parseFloat(calculations.yearsSinceInstall);
  const offsetPct = parseFloat(calculations.offsetPercentage);
  const performanceRatio = calculations.systemHealth.performanceRatio;
  const savings = parseFloat(calculations.cumulativeSavings);
  const roi = parseFloat(calculations.roi);
  const paybackYears = (parseFloat(calculations.paybackMonths) / 12).toFixed(1);
  const rateIncrease = parseFloat(calculations.rateIncrease);
  const currentRate = parseFloat(calculations.currentUtilityRate);
  const initialRate = parseFloat(calculations.initialUtilityRate);
  const nemVersion = inputs.nemVersion === 'NEM1' ? 'NEM 1.0' : inputs.nemVersion === 'NEM2' ? 'NEM 2.0' : 'NEM 3.0';
  const nemClass = inputs.nemVersion === 'NEM1' ? 'nem-1' : inputs.nemVersion === 'NEM2' ? 'nem-2' : 'nem-3';

  // Build recommendations
  const recommendations = [];

  // Performance-based recs
  if (performanceRatio < 70) {
    recommendations.push({
      priority: 'high',
      title: 'Immediate System Inspection Required',
      detail: `Your system is producing at only ${performanceRatio.toFixed(0)}% of expected capacity. This significant shortfall (${Math.round(calculations.systemHealth.expectedProduction - inputs.annualProduction).toLocaleString()} kWh/yr below expected) warrants immediate professional evaluation to identify inverter failures, panel degradation, or shading issues.`
    });
  } else if (performanceRatio < 85) {
    recommendations.push({
      priority: 'med',
      title: 'Schedule Maintenance & Panel Cleaning',
      detail: `Performance ratio of ${performanceRatio.toFixed(0)}% suggests potential issues. Scheduled cleaning and inspection could recover an estimated ${Math.round((calculations.systemHealth.expectedProduction - inputs.annualProduction) * currentRate).toLocaleString()} in annual production value.`
    });
  }

  // NEM-based recs
  if (inputs.nemVersion === 'NEM3') {
    recommendations.push({
      priority: 'high',
      title: 'NEM 3.0 Export Rate Impact',
      detail: 'Under NEM 3.0, exported energy is compensated at significantly reduced rates (~$0.05/kWh). A battery storage system would allow you to consume more of your own solar energy during peak rate periods instead of exporting at low value, potentially increasing your effective savings by 25-40%.'
    });
  }

  if (inputs.nemVersion === 'NEM2' && !inputs.hasBattery && offsetPct > 100) {
    recommendations.push({
      priority: 'med',
      title: 'Excess Production — Consider Adding Battery Storage',
      detail: `You're overproducing by approximately ${(offsetPct - 100).toFixed(0)}% of your usage. Adding a battery (e.g., Tesla Powerwall or Enphase IQ) would allow you to store excess daytime energy for evening use, maximizing self-consumption and reducing future true-up charges as NEM policies evolve.`
    });
  }

  // Usage growth rec
  const growthRate = parseFloat(calculations.usageGrowthRate);
  if (growthRate > 3) {
    recommendations.push({
      priority: 'med',
      title: 'Rising Energy Consumption Detected',
      detail: `Your usage has grown ${growthRate}% annually since installation. At this rate, your system offset will decline over time. Consider an energy audit to identify efficiency improvements (LED upgrades, smart thermostats, appliance upgrades) or discuss a system expansion.`
    });
  }

  // ROI rec
  if (roi < 0 && inputs.program === 'PPA') {
    recommendations.push({
      priority: 'high',
      title: 'Review PPA Contract Terms',
      detail: `Current calculations show negative net savings under your PPA. This warrants a careful review of your contract buyout options, rate escalator terms, and whether a buyout or transfer at point of home sale would be advantageous.`
    });
  }

  // Battery TOU rec
  if (inputs.hasBattery && !inputs.useTOU) {
    recommendations.push({
      priority: 'low',
      title: 'Enable Time-of-Use Rate Plan',
      detail: 'You have battery storage but may not be on a TOU rate plan. Switching to TOU (e.g., SCE TOU-D-PRIME) combined with your battery allows you to charge during cheap off-peak hours and discharge during expensive peak hours, adding significant arbitrage value.'
    });
  }

  // Rate lock rec
  recommendations.push({
    priority: 'low',
    title: `Lock In Protection Against ${utilityLabel} Rate Increases`,
    detail: `${utilityLabel} rates have risen ${rateIncrease}% since your installation — from $${initialRate.toFixed(3)} to $${currentRate.toFixed(3)}/kWh. Your solar system is effectively your hedge against further increases. Continued rate escalation will only increase the value of your system over time.`
  });

  // Tax credit rec for loan
  if (inputs.program === 'Loan' && !inputs.appliedToLoan && inputs.taxCredit > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Apply Federal Tax Credit to Loan Principal',
      detail: `Your $${inputs.taxCredit.toLocaleString()} federal ITC has not been applied to your loan principal. Applying this credit within the 18-month window will reduce your loan balance and lower your monthly payment from $${inputs.loanInitialPayment}/month after month 18.`
    });
  }

  const healthColor = performanceRatio >= 95 ? '#059669' : performanceRatio >= 85 ? '#d97706' : performanceRatio >= 70 ? '#f59e0b' : '#dc2626';
  const healthLabel = performanceRatio >= 95 ? 'Excellent' : performanceRatio >= 85 ? 'Good' : performanceRatio >= 70 ? 'Fair' : 'Needs Attention';

  const offsetFill = offsetPct >= 100 ? 'fill-green' : offsetPct >= 75 ? 'fill-yellow' : 'fill-red';
  const perfFill = performanceRatio >= 95 ? 'fill-green' : performanceRatio >= 85 ? 'fill-yellow' : 'fill-red';

  const programLabel = inputs.program === 'PPA' ? 'PPA / Lease' : inputs.program;

  return (
    <div>
      {/* Trigger button */}
      <button
        onClick={generatePDF}
        className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg transition-all text-lg flex items-center justify-center gap-3"
      >
        <span>📄</span>
        Generate Customer PDF Report
      </button>

      {/* Hidden report template */}
      <div ref={reportRef} style={{ display: 'none' }}>

        {/* ── PAGE 1 ── */}
        <div className="report-header">
          <div className="header-left">
            <h1>⚡ California Solar <span>Financial Audit</span></h1>
            <p>Comprehensive System Analysis &amp; Customer Report</p>
            <p style={{marginTop:'8px', fontSize:'9pt', color:'#cbd5e1'}}>Prepared for: {utilityLabel} Customer — {inputs.systemSize} kW System</p>
          </div>
          <div className="header-right">
            <div className="report-date">Report Date: {reportDate}</div>
            <div className="badge">CONFIDENTIAL</div>
            <div style={{marginTop:'8px', fontSize:'8.5pt', color:'#94a3b8'}}>System installed: {inputs.installedMonth}/{inputs.installedYear}</div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="kpi-grid">
          <div className="kpi-card green">
            <div className="value">${savings >= 0 ? '' : '-'}${Math.abs(savings).toLocaleString(undefined, {maximumFractionDigits:0})}</div>
            <div className="label">Total Net Savings</div>
            <div className="sub">Since installation</div>
          </div>
          <div className="kpi-card blue">
            <div className="value">${calculations.avgMonthlySavings}</div>
            <div className="label">Avg Monthly Savings</div>
            <div className="sub">vs. utility bills</div>
          </div>
          <div className="kpi-card purple">
            <div className="value">+{rateIncrease}%</div>
            <div className="label">Utility Rate Increase</div>
            <div className="sub">Since install</div>
          </div>
          <div className="kpi-card orange">
            <div className="value">{paybackYears} yrs</div>
            <div className="label">Payback Period</div>
            <div className="sub">ROI: {roi}%</div>
          </div>
        </div>

        {/* System Overview */}
        <div className="section-title"><span className="icon">🔆</span> System Overview</div>
        <div className="two-col">
          <div className="card">
            <div className="metric-row"><span className="metric-label">Utility Provider</span><span className="metric-value">{utilityLabel}</span></div>
            <div className="metric-row"><span className="metric-label">System Size</span><span className="metric-value">{inputs.systemSize} kW</span></div>
            <div className="metric-row"><span className="metric-label">Installation Date</span><span className="metric-value">{inputs.installedMonth}/{inputs.installedYear}</span></div>
            <div className="metric-row"><span className="metric-label">System Age</span><span className="metric-value">{systemAgeYears.toFixed(1)} years</span></div>
            <div className="metric-row"><span className="metric-label">Financing Program</span><span className="metric-value">{programLabel}</span></div>
            <div className="metric-row"><span className="metric-label">NEM Version</span><span className="metric-value"><span className={`nem-badge ${nemClass}`}>{nemVersion}</span></span></div>
            <div className="metric-row"><span className="metric-label">CARE Program</span><span className="metric-value">{inputs.onCareProgram ? '✅ Enrolled (30% discount)' : 'Not enrolled'}</span></div>
            <div className="metric-row"><span className="metric-label">Battery Storage</span><span className="metric-value">{inputs.hasBattery ? `✅ ${inputs.batteryCapacity} kWh` : 'None'}</span></div>
          </div>
          <div className="card">
            <div className="metric-row"><span className="metric-label">Annual Production</span><span className="metric-value blue">{inputs.annualProduction.toLocaleString()} kWh/yr</span></div>
            <div className="metric-row"><span className="metric-label">Annual Usage</span><span className="metric-value">{inputs.currentAnnualUsage.toLocaleString()} kWh/yr</span></div>
            <div className="metric-row"><span className="metric-label">Usage at Install</span><span className="metric-value">{inputs.annualUsageAtInstall.toLocaleString()} kWh/yr</span></div>
            <div className="metric-row"><span className="metric-label">Usage Growth Rate</span><span className="metric-value red">+{calculations.usageGrowthRate}%/yr</span></div>
            <div className="metric-row"><span className="metric-label">Rate at Install</span><span className="metric-value">${initialRate.toFixed(3)}/kWh</span></div>
            <div className="metric-row"><span className="metric-label">Current Rate</span><span className="metric-value red">${currentRate.toFixed(3)}/kWh</span></div>
            <div className="metric-row"><span className="metric-label">Rate Increase</span><span className="metric-value red">+{rateIncrease}%</span></div>
            <div className="metric-row"><span className="metric-label">Total Investment</span><span className="metric-value">${parseFloat(calculations.totalInvestment).toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="section-title"><span className="icon">📊</span> Performance Metrics</div>
        <div className="card" style={{marginBottom:'12px'}}>
          <div className="progress-wrap">
            <div className="progress-label">
              <span>Energy Offset (Solar Production vs. Usage)</span>
              <span style={{fontWeight:'700', color: offsetPct >= 100 ? '#059669' : '#d97706'}}>{offsetPct.toFixed(0)}%</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${offsetFill}`} style={{width:`${Math.min(offsetPct,100)}%`}}></div>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-label">
              <span>System Performance Ratio (vs. Expected California Average)</span>
              <span style={{fontWeight:'700', color: healthColor}}>{performanceRatio.toFixed(1)}% — {healthLabel}</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${perfFill}`} style={{width:`${Math.min(performanceRatio,100)}%`}}></div>
            </div>
          </div>
          <div style={{display:'flex', gap:'20px', marginTop:'8px', flexWrap:'wrap'}}>
            <div style={{fontSize:'8.5pt', color:'#6b7280'}}>Expected Production: <strong>{calculations.systemHealth.expectedProduction.toLocaleString()} kWh/yr</strong></div>
            <div style={{fontSize:'8.5pt', color:'#6b7280'}}>Actual Production: <strong>{inputs.annualProduction.toLocaleString()} kWh/yr</strong></div>
            <div style={{fontSize:'8.5pt', color:'#6b7280'}}>Delta: <strong style={{color: inputs.annualProduction >= calculations.systemHealth.expectedProduction ? '#059669' : '#dc2626'}}>{(inputs.annualProduction - calculations.systemHealth.expectedProduction).toLocaleString()} kWh/yr</strong></div>
          </div>
        </div>

        {/* NEM Status */}
        {calculations.currentNEMImpact && (
          <div className={`highlight-box ${calculations.currentNEMImpact.type === 'credit' ? 'success' : 'warning'}`}>
            <h4>
              {calculations.currentNEMImpact.type === 'credit' ? '✅ Net Metering Credit — Overproducing' : '⚠️ Annual True-Up Balance — Under-Producing'}
            </h4>
            {calculations.currentNEMImpact.type === 'credit' ? (
              <p>Your system produces <strong>{calculations.currentNEMImpact.netProduction.toLocaleString()} kWh/yr</strong> more than you consume. Under {nemVersion}, this earns you <strong>${calculations.currentNEMImpact.rate.toFixed(3)}/kWh</strong>, generating an estimated annual credit of <strong>${calculations.currentNEMImpact.amount.toLocaleString(undefined,{maximumFractionDigits:0})}</strong>.</p>
            ) : (
              <p>Your system falls <strong>{calculations.currentNEMImpact.shortage.toLocaleString()} kWh/yr</strong> short of covering your usage. Your estimated annual true-up bill is <strong>${calculations.currentNEMImpact.amount.toLocaleString(undefined,{maximumFractionDigits:0})}</strong> at the current utility rate of ${currentRate.toFixed(3)}/kWh.</p>
            )}
          </div>
        )}

        {/* ── PAGE 2 ── */}
        <div className="page-break"></div>

        <div className="report-header">
          <div className="header-left">
            <h1>⚡ California Solar <span>Financial Audit</span></h1>
            <p>Financial Detail &amp; Recommendations</p>
          </div>
          <div className="header-right">
            <div className="report-date">{reportDate}</div>
            <div className="badge">PAGE 2 OF 2</div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="section-title"><span className="icon">💰</span> Financial Summary</div>
        <div className="two-col" style={{marginBottom:'14px'}}>
          <table className="data-table">
            <thead>
              <tr><th>Financial Item</th><th>Amount</th></tr>
            </thead>
            <tbody>
              <tr><td>Total Investment</td><td>${parseFloat(calculations.totalInvestment).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>
              <tr><td>Solar Payments Made</td><td>${parseFloat(calculations.cumulativeCost).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>
              {inputs.hasBattery && <tr><td>Battery Payments Made</td><td>${parseFloat(calculations.cumulativeBatteryCost).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>}
              <tr><td style={{color:'#059669'}}>NEM Credits Received</td><td style={{color:'#059669'}}>${parseFloat(calculations.cumulativeNEMCredits).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>
              <tr><td style={{color:'#d97706'}}>True-Up Charges</td><td style={{color:'#d97706'}}>${parseFloat(calculations.cumulativeTrueUpCharges).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>
              {inputs.hasBattery && <tr><td style={{color:'#7c3aed'}}>Battery Arbitrage Savings</td><td style={{color:'#7c3aed'}}>${parseFloat(calculations.cumulativeArbitrageSavings).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>}
              {(inputs.program === 'Loan' || inputs.program === 'Cash') && inputs.taxCredit > 0 && (
                <tr><td style={{color:'#059669'}}>Federal Tax Credit (ITC)</td><td style={{color:'#059669'}}>${inputs.taxCredit.toLocaleString()}</td></tr>
              )}
            </tbody>
          </table>
          <table className="data-table">
            <thead>
              <tr><th>Key Metric</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>System Age</td><td>{calculations.yearsSinceInstall} years</td></tr>
              <tr><td>Payback Period</td><td>{paybackYears} years</td></tr>
              <tr><td>Return on Investment</td><td style={{color: roi > 0 ? '#059669' : '#dc2626'}}>{roi}%</td></tr>
              <tr><td>Avg Monthly Savings</td><td>${calculations.avgMonthlySavings}</td></tr>
              <tr><td>Utility Rate Increase</td><td style={{color:'#dc2626'}}>+{rateIncrease}%</td></tr>
              <tr><td>Usage Growth Rate</td><td style={{color:'#d97706'}}>+{calculations.usageGrowthRate}%/yr</td></tr>
              <tr><td style={{fontWeight:'800'}}>Net Benefit to Date</td><td style={{fontWeight:'800', color: savings >= 0 ? '#059669' : '#dc2626'}}>${savings.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Yearly Breakdown */}
        <div className="section-title"><span className="icon">📅</span> Year-by-Year Breakdown</div>
        <table className="yearly-table" style={{marginBottom:'16px'}}>
          <thead>
            <tr>
              <th>Year</th>
              <th>Util. Rate</th>
              <th>Projected Usage</th>
              <th>Utility Cost</th>
              <th>Solar Cost</th>
              <th>Annual Savings</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {calculations.yearlyData.map((row) => (
              <tr key={row.year}>
                <td style={{fontWeight:'700'}}>{row.year}</td>
                <td>${parseFloat(row.utilityRate).toFixed(3)}</td>
                <td>{parseInt(row.projectedUsage).toLocaleString()}</td>
                <td>${parseInt(row.utilityCost).toLocaleString()}</td>
                <td>${parseInt(row.solarCost).toLocaleString()}</td>
                <td className={row.annualSavings >= 0 ? 'positive' : 'negative'}>
                  {row.annualSavings >= 0 ? '+' : ''}${parseInt(row.annualSavings).toLocaleString()}
                </td>
                <td className={row.cumulativeSavings >= 0 ? 'positive' : 'negative'}>
                  ${parseInt(row.cumulativeSavings).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Recommendations */}
        <div className="section-title"><span className="icon">💡</span> Analyst Recommendations</div>
        {recommendations.map((rec, i) => (
          <div key={i} className={`rec-item priority-${rec.priority === 'high' ? 'high' : rec.priority === 'med' ? 'med' : 'low'}`}>
            <div className="rec-num">{i + 1}</div>
            <div className="rec-content">
              <span className={`rec-tag ${rec.priority === 'high' ? 'tag-high' : rec.priority === 'med' ? 'tag-med' : 'tag-low'}`}>
                {rec.priority === 'high' ? '🔴 HIGH PRIORITY' : rec.priority === 'med' ? '🟡 MEDIUM PRIORITY' : '🟢 CONSIDER'}
              </span>
              <h5>{rec.title}</h5>
              <p>{rec.detail}</p>
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="report-footer">
          <div className="disclaimer">
            This report is generated based on customer-provided inputs and publicly available California utility rate data. Savings figures are estimates and may vary based on actual consumption, rate changes, and system performance. This report is for informational purposes only and does not constitute financial or legal advice.
          </div>
          <div className="page-num">Generated {reportDate}</div>
        </div>

      </div>
    </div>
  );
};

export default PDFReportGenerator;
