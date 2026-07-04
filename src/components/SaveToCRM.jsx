import React, { useState, useRef, useEffect } from 'react';
import { Save, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/supabaseClient';

/**
 * Save-to-CRM bar. Rendered only when an admin has a real client open
 * (clientContext = { contactId, projectId }). Tracks whether the audit
 * inputs have changed since load/last save and pushes edits to
 * /api/save-project (whitelisted fields; server enforces role + ownership).
 */
const WRITABLE_KEYS = [
  'systemSize', 'annualProduction', 'annualUsageAtInstall', 'currentAnnualUsage',
  'utility', 'nemVersion', 'exportRate', 'onCareProgram', 'hasBattery', 'batteryCapacity'
];

const snapshot = (inputs) => JSON.stringify(WRITABLE_KEYS.map((k) => inputs[k]));

const SaveToCRM = ({ inputs, clientContext, clientLabel }) => {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // {ok, message}
  const savedRef = useRef(snapshot(inputs));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(snapshot(inputs) !== savedRef.current);
  }, [inputs]);

  if (!clientContext || !clientContext.projectId) return null;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const payload = {};
      for (const k of WRITABLE_KEYS) payload[k] = inputs[k];
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
        {status && (
          <span className={`ml-2 text-xs inline-flex items-center gap-1 ${status.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {status.ok ? <Check size={12} /> : <AlertCircle size={12} />} {status.message}
          </span>
        )}
      </div>
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
  );
};

export default SaveToCRM;
