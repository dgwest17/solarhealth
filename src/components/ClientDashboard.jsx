import React, { useState } from 'react';
import { X, Save, RefreshCw, AlertCircle, Check, UserPlus, UserCog } from 'lucide-react';
import { apiFetch } from '../lib/supabaseClient';

/**
 * One modal, two modes:
 *   mode="edit"   — update an existing Contact's basic info (needs contact.id)
 *   mode="create" — "Save Client" from the sandbox: creates Contact + linked
 *                   Solar_Project from the current audit inputs.
 *
 * Address auto-complete: the street field uses the browser's native address
 * autofill (autoComplete attributes). True as-you-type suggestions need a
 * Google Places API key — the input is ready for that upgrade.
 */
// Stable field component (defined OUTSIDE the modal so inputs keep focus).
const Field = ({ label, value, onChange, type = 'text', span = 1, ac }) => (
  <div className={span === 2 ? 'col-span-2' : ''}>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input type={type} value={value} onChange={onChange} autoComplete={ac}
      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 text-sm focus:border-amber-400/60 focus:outline-none" />
  </div>
);

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', street: '', city: '', state: 'CA', zip: '', sendAnnualReport: false };

const ContactFormModal = ({ mode = 'edit', initial = null, auditInputs = null, onClose, onSaved }) => {
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async () => {
    if (!form.lastName.trim()) { setError('Last name is required.'); return; }
    setSaving(true); setError('');
    try {
      let result;
      if (mode === 'create') {
        result = await apiFetch('/api/create-client', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact: form, inputs: auditInputs || {} })
        });
      } else {
        result = await apiFetch('/api/save-contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: initial.id, contact: form })
        });
      }
      onSaved && onSaved(result, form);
      onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[#0f1e36] border border-amber-400/40 rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
            {mode === 'create' ? <UserPlus size={19} /> : <UserCog size={19} />}
            {mode === 'create' ? 'Save New Client' : 'Edit Contact Info'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-amber-300"><X size={18} /></button>
        </div>
        {mode === 'create' && (
          <p className="text-xs text-slate-400 mb-4">Creates the contact in your CRM and attaches the current sandbox audit as their system.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={form.firstName} onChange={set('firstName')} ac="given-name" />
          <Field label="Last name *" value={form.lastName} onChange={set('lastName')} ac="family-name" />
          <Field label="Email" value={form.email} onChange={set('email')} type="email" span={2} ac="email" />
          <Field label="Phone" value={form.phone} onChange={set('phone')} type="tel" span={2} ac="tel" />
          <Field label="Street address" value={form.street} onChange={set('street')} span={2} ac="street-address" />
          <Field label="City" value={form.city} onChange={set('city')} ac="address-level2" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="State" value={form.state} onChange={set('state')} ac="address-level1" />
            <Field label="Zip" value={form.zip} onChange={set('zip')} ac="postal-code" />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input type="checkbox" checked={form.sendAnnualReport} onChange={set('sendAnnualReport')} className="w-4 h-4 accent-amber-400" />
          <span className="text-sm text-slate-300">Enroll in newsletter / annual report</span>
        </label>
        {error && (
          <div className="mt-3 bg-red-900/30 border border-red-400/40 rounded-lg p-2.5 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 border border-slate-600 hover:text-amber-300">Cancel</button>
          <button onClick={save} disabled={saving}
            className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${saving ? 'bg-slate-700 text-slate-400' : 'bg-amber-400 hover:bg-amber-300 text-[#0a1628]'}`}>
            {saving ? <RefreshCw size={15} className="animate-spin" /> : mode === 'create' ? <UserPlus size={15} /> : <Save size={15} />}
            {saving ? 'Saving…' : mode === 'create' ? 'Save Client' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactFormModal;
