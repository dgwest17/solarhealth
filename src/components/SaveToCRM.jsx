import React, { useState, useRef, useEffect } from 'react';
import { Save, Check, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { apiFetch } from '../lib/supabaseClient';

/**
 * Save-to-CRM bar. Rendered only when an admin has a real client open
 * (clientContext = { contactId, projectId }). Tracks whether the audit
 * inputs have changed since load/last save and pushes edits to
 * /api/save-project (whitelisted fields; server enforces role + ownership).
 */
const WRITABLE_KEYS = [
  'systemSize', 'annualProduction', 'annualUsageAtInstall', 'currentAnnualUsage',
  'utility', 'nemVersion', 'exportRate', 'onCareProgram', 'hasBattery', 'batteryCapacity',
  // install/turn-on date
  'installedYear', 'installedMonth', 'batteryInstallDate',
  'potentialExtraUsageKwh', 'potentialExtraUsageNote',
  // equipment
  'installCompany', 'panelModel', 'batteryManufacturer', 'inverterType', 'numberOfModules',
  // financial product
  'program', 'loanPrincipal', 'loanTerm', 'loanInterestRate', 'escalator', 'cashGrossCost',
  'projectStatus', 'opportunityType', 'financeProvider', 'connectionFeeMonthly'
];

const snapshot = (inputs) => JSON.stringify(WRITABLE_KEYS.map((k) => inputs[k]));

const SaveToCRM = ({ inputs, clientContext, clientLabel, onSendAudit, plannedLoad = null }) => {
  const [newsletter, setNewsletter] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // {ok, message}
  const savedRef = useRef(snapshot(inputs));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(snapshot(inputs) !== savedRef.current);
  }, [inputs]);

  if (!clientContext || !clientContext.projectId || clientContext.canWrite === false) return null;

  const sendAudit = async () => {
    setSending(true); setSendStatus(null);
    try {
      // Build the report (also opens a preview tab) and email it to the client.
      const payload = onSendAudit ? onSendAudit() : null;
      if (payload && payload.reportHtml) {
        try {
          const r = await apiFetch('/api/send-audit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId: clientContext.contactId,
              reportHtml: payload.reportHtml,
              summary: payload.summary,
              newsletter
            })
          });
          setSendStatus({ ok: true, message: `Emailed to ${r.emailedTo}${newsletter ? ' · enrolled in newsletter' : ''}` });
          return;
        } catch (e) {
          // Email not configured or failed — fall back to stamping only.
          await apiFetch('/api/mark-report-sent', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId: clientContext.contactId, newsletter })
          });
          setSendStatus({ ok: false, message: `Email failed (${e.message}) — report opened for manual delivery; marked sent in CRM.` });
          return;
        }
      }
      // No report payload — legacy stamp
      await apiFetch('/api/mark-report-sent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: clientContext.contactId, newsletter })
      });
      setSendStatus({ ok: true, message: 'Report marked sent' });
    } catch (e) {
      setSendStatus({ ok: false, message: e.message });
    } finally { setSending(false); }
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const payload = {};
      for (const k of WRITABLE_KEYS) payload[k] = inputs[k];
      // Load Simulator rollup — written ONLY here, on an explicit save, so the
      // Zoho audit trail isn't flooded by every slider move.
      if (plannedLoad && plannedLoad.addedKwh > 0) {
        payload.potentialExtraUsageKwh = Math.round(plannedLoad.addedKwh);
        if (!payload.potentialExtraUsageNote) {
          const when = new Date().toISOString().slice(0, 10);
          payload.potentialExtraUsageNote =
            `${Math.round(plannedLoad.addedKwh).toLocaleString()} kWh modelled ${when}` +
            (plannedLoad.billableKwh > 0 ? ` · ${Math.round(plannedLoad.billableKwh).toLocaleString()} kWh billable` : ' · absorbed by surplus');
        }
      }
      const result = await apiFetch('/api/save-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: clientContext.contactId,
          projectId: clientContext.projectId,
          inputs: payload
        })
      });
      savedRef.current = snapshot(inputs);
      setDirty(false);
      setStatus({ ok: true, message: result.message || 'Saved to Zoho.' });
    } catch (e) {
      setStatus({ ok: false, message: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`print:hidden mb-4 rounded-xl border p-3 flex items-center justify-between gap-3 ${
      dirty ? 'bg-amber-500/10 border-amber-400/50' : 'bg-slate-800/50 border-slate-700/60'
    }`}>
      <div className="text-sm">
        <span className={dirty ? 'text-amber-200 font-semibold' : 'text-slate-400'}>
          {dirty ? 'Unsaved audit changes' : 'Audit synced with CRM'}
        </span>
        <span className="text-slate-500 text-xs ml-2">
          {clientLabel ? `${clientLabel} · ` : ''}writes system data to this client's Solar Project in Zoho
        </span>
        {sendStatus && (
          <span className={`ml-2 text-xs inline-flex items-center gap-1 ${sendStatus.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {sendStatus.ok ? <Check size={12} /> : <AlertCircle size={12} />} {sendStatus.message}
          </span>
        )}
        {status && (
          <span className={`ml-2 text-xs inline-flex items-center gap-1 ${status.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {status.ok ? <Check size={12} /> : <AlertCircle size={12} />} {status.message}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="w-3.5 h-3.5 accent-emerald-400" />
        Newsletter
      </label>
      <button
        onClick={sendAudit}
        disabled={sending}
        className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
          sending ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-[#0a1628]'
        }`}
        title="Opens the Consultation Report for delivery and stamps Last Report Sent in Zoho"
      >
        {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
        Send Audit
      </button>
      <button
        onClick={save}
        disabled={saving || !dirty}
        className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
          saving || !dirty
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-amber-400 hover:bg-amber-300 text-[#0a1628]'
        }`}
      >
        {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Saving…' : 'Save to CRM'}
      </button>
      </div>
    </div>
  );
};

export default SaveToCRM;
