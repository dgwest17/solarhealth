import React from 'react';
import { Printer, FileDown } from 'lucide-react';

/**
 * Customer Report — prints the live dashboard exactly as shown on screen
 * (report card, KPIs, NEM status, narrative, charts, summary tables).
 * Browser print-to-PDF; no separate report document.
 *
 * The on-screen card hides itself in print (print:hidden). The branded
 * client header lives in SolarCalculator and only appears in print.
 */
const PDFReportGenerator = ({ clientName, setClientName, branding }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print:hidden bg-slate-800/60 backdrop-blur-md border border-amber-400/40 rounded-xl shadow-2xl p-8 mb-6">
      <h2 className="text-2xl font-bold text-amber-300 flex items-center gap-2 mb-2">
        <FileDown size={24} className="text-amber-400" />
        Customer Report
      </h2>
      <p className="text-slate-300 text-sm mb-5">
        Saves this dashboard — score, results, narrative, charts, and tables — as a PDF,
        exactly as it appears here. Input and admin sections are left out automatically.
      </p>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
        <div className="flex-1">
          <label className="block text-sm text-amber-200/80 mb-1">Client name (shown on the report header)</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. The Martinez Family"
            className="w-full px-3 py-2 border border-amber-400/30 rounded-lg bg-slate-900/60 text-slate-200"
          />
        </div>
        <button
          onClick={handlePrint}
          className="bg-amber-400 hover:bg-amber-300 text-[#0a1628] font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Printer size={18} />
          Generate PDF report
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        In the print dialog, choose "Save as PDF" as the destination.
        {branding?.company_name ? ` Your ${branding.company_name} branding appears in the header.` : ''}
      </p>
    </div>
  );
};

export default PDFReportGenerator;
