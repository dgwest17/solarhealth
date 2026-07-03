import React from 'react';
import { Printer, FileDown, FileText } from 'lucide-react';
import { openConsultationReport } from '../report/ConsultationReport';

/**
 * Customer Report card.
 *  1. Consultation Report (primary) — the dedicated, sellable leave-behind:
 *     hero graphic, equipment/warranty schedule, savings history + projection,
 *     NEM expiration outlook, load-sim results, battery impact,
 *     recommendations, manufacturer contacts, contact banner, disclaimer.
 *  2. Dashboard print — saves the live dashboard exactly as shown.
 */
const PDFReportGenerator = ({ clientName, setClientName, branding, inputs, calculations, extraUsage, gbProfile }) => {
  const handleConsultationReport = () => {
    openConsultationReport({
      clientName, inputs, calculations, extraUsage, gbProfile,
      contact: branding ? { company: branding.company_name, phone: branding.phone, email: branding.email } : {}
    });
  };

  return (
    <div className="print:hidden bg-slate-800/60 backdrop-blur-md border border-amber-400/40 rounded-xl shadow-2xl p-6 md:p-8 mb-6">
      <h2 className="text-2xl font-bold text-amber-300 flex items-center gap-2 mb-2">
        <FileDown size={24} className="text-amber-400" />
        Customer Report
      </h2>
      <p className="text-slate-300 text-sm mb-5">
        The Consultation Report is the client leave-behind: equipment & warranty schedule, savings
        history and 10-year outlook, NEM expiration, battery impact, and recommendations — with the
        estimates disclaimer built in.
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
          onClick={handleConsultationReport}
          className="bg-amber-400 hover:bg-amber-300 text-[#0a1628] font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <FileText size={18} />
          Consultation Report
        </button>
        <button
          onClick={() => window.print()}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-600"
          title="Print the live dashboard as-is"
        >
          <Printer size={18} />
          Print dashboard
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Opens in a new tab — use "Save as PDF". Equipment details come from the manufacturer dropdowns
        in System & Site; measured Green Button data and load-simulator results are included automatically.
      </p>
    </div>
  );
};

export default PDFReportGenerator;
