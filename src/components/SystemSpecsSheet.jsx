import React from 'react';

/**
 * Print-only System Specifications sheet (PDF page 3).
 * Renders the audit's underlying values in a clean, client-facing layout —
 * NOT the input form (no API keys, system IDs, or admin controls).
 * Hidden on screen via `hidden print:block`.
 */
const SystemSpecsSheet = ({ inputs }) => {
  const utilityLabel = { PGE: 'PG&E', SCE: 'Southern California Edison', SDGE: 'SDG&E', SMUD: 'SMUD' }[inputs.utility] || inputs.utility;
  const nemLabel = { NEM1: 'NEM 1.0', NEM2: 'NEM 2.0', NEM3: 'NEM 3.0' }[inputs.nemVersion] || inputs.nemVersion;
  const programLabel = { PPA: 'PPA / Lease', Loan: 'Loan', Cash: 'Cash Purchase', Other: 'Other' }[inputs.program] || inputs.program;
  const monthName = (m) => ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m] || m;

  const Row = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );

  // Financing rows vary by program
  const financingRows = [];
  if (inputs.program === 'Loan') {
    financingRows.push(['Loan Principal', `$${Number(inputs.loanPrincipal).toLocaleString()}`]);
    financingRows.push(['Loan Term', `${inputs.loanTerm} years`]);
    if (inputs.loanInterestRate) financingRows.push(['Interest Rate', `${inputs.loanInterestRate}%`]);
    if (inputs.loanDownpayment > 0) financingRows.push(['Down Payment', `$${Number(inputs.loanDownpayment).toLocaleString()}`]);
    financingRows.push(['Loan Status', inputs.loanPaidOff ? `Paid off (${inputs.loanPaidOffYear})` : 'Active']);
  } else if (inputs.program === 'PPA') {
    financingRows.push(['Initial Rate', `$${inputs.ppaInitialRate}/kWh`]);
    financingRows.push(['Annual Escalator', `${inputs.escalator}%`]);
    if (inputs.ppaDownpayment > 0) financingRows.push(['Down Payment', `$${Number(inputs.ppaDownpayment).toLocaleString()}`]);
    financingRows.push(['PPA Status', inputs.ppaPaidOff ? `Bought out (${inputs.ppaPaidOffYear})` : 'Active']);
  } else if (inputs.program === 'Cash') {
    financingRows.push(['Net Cost (after credits)', `$${Number(inputs.cashNetCost).toLocaleString()}`]);
  }

  return (
    <div className="hidden print:block" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
      <div className="mb-4 pb-3 border-b-2 border-amber-500">
        <h1 className="text-2xl font-bold text-gray-900">System Specifications</h1>
        <p className="text-sm text-gray-500">The values this audit is based on</p>
      </div>

      <div className="grid grid-cols-2 gap-x-10 gap-y-1">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2 mt-2">System</h3>
          <Row label="System Size" value={`${inputs.systemSize} kW`} />
          <Row label="Installed" value={`${monthName(inputs.installedMonth)} ${inputs.installedYear}`} />
          <Row label="Annual Production" value={`${Number(inputs.annualProduction).toLocaleString()} kWh/yr`} />
          <Row label="Battery Storage" value={inputs.hasBattery ? `Yes — ${inputs.batteryCapacity} kWh` : 'None'} />
          {inputs.hasBattery && <Row label="Battery Efficiency" value={`${inputs.batteryEfficiency}%`} />}

          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2 mt-5">Energy Usage</h3>
          <Row label="Usage at Install" value={`${Number(inputs.annualUsageAtInstall).toLocaleString()} kWh/yr`} />
          <Row label="Current Usage" value={`${Number(inputs.currentAnnualUsage).toLocaleString()} kWh/yr`} />
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2 mt-2">Utility &amp; Net Metering</h3>
          <Row label="Utility Provider" value={utilityLabel} />
          <Row label="NEM Version" value={nemLabel} />
          {inputs.nemVersion === 'NEM2' && <Row label="Export Rate" value={`$${inputs.exportRate}/kWh`} />}
          <Row label="CARE Program" value={inputs.onCareProgram ? 'Yes (30% discount)' : 'No'} />
          <Row label="Time-of-Use Rates" value={inputs.useTOU ? 'Yes' : 'No'} />

          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2 mt-5">Financing</h3>
          <Row label="Program" value={programLabel} />
          {financingRows.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8 pt-3 border-t border-gray-200">
        Figures are estimates based on the data provided and published utility rates.
      </p>
    </div>
  );
};

export default SystemSpecsSheet;
