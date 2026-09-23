/**
 * FILE: src/project/IntakeForm.jsx
 *
 * NEW PROJECT INTAKE — the rep's handoff to the installer.
 *
 * Rewritten against the contractor's actual workbook. The previous version
 * asked homeowners about roof age and gate codes; the document the contractor
 * needs is a trade submission carrying services, costs and commission. Those
 * are different forms for different people, and only this one gets a deal
 * built.
 *
 * PRE-FILLED, NOT BLANK. The rep already priced this deal, so panels, battery,
 * adders, financing, commission and the customer's details all come from the
 * saved proposal. Asking a rep to retype what the platform knows is how you
 * get transcription errors on a document that becomes a build order.
 *
 * COSTS ARE COMPUTED IN ONE PLACE. Every figure here comes from
 * intakeSchema.computeIntakeCosts, the same function the generated spreadsheet
 * uses, so the screen and the file cannot disagree.
 *
 * Rendered by: src/project/ProjectSteps.jsx
 */
import React, { useState, useMemo, useEffect } from 'react';
import { SURF, GRADIENTS } from '../surf/theme';
import { Buoy } from '../surf/SurfIcons';
import { apiFetch } from '../lib/supabaseClient';
import { useSettings } from '../admin/SettingsContext';
import {
  SERVICE_LINES, REQUIRED_DOCUMENTS, PAYMENT_TYPES,
  computeIntakeCosts, prefillIntake, validateIntake
} from './intakeSchema';

const money = (v) => '$' + (Number(v) || 0).toLocaleString('en-US',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 12 MB, matching the server. Checked here so a phone photo fails fast. */
const MAX_BYTES = 12 * 1024 * 1024;

const IntakeForm = ({ proposal, contact = null, contactId, projectId, repName = '', onClose, onSubmitted }) => {
  const { settings } = useSettings();
  const parties = (settings && settings.parties) || {};

  const [intake, setIntake] = useState(() =>
    prefillIntake({ proposal, contact, repName, settings }));
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showCosts, setShowCosts] = useState(true);

  const costs = useMemo(() => computeIntakeCosts(intake), [intake]);
  const problems = useMemo(() => validateIntake(intake, costs), [intake, costs]);

  const set = (k, v) => setIntake((p) => ({ ...p, [k]: v }));
  const setService = (id, field, v) => setIntake((p) => ({
    ...p,
    services: { ...p.services, [id]: { ...(p.services[id] || {}), [field]: v } }
  }));

  /** Read a File into base64 without loading it twice. */
  const upload = async (docId, label, file) => {
    if (!file) return;
    setError('');
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 12 MB — try your phone's smaller photo size.`);
      return;
    }
    setUploading(docId);
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(new Error('Could not read that file.'));
        r.readAsDataURL(file);
      });
      const res = await apiFetch('/api/upload-doc', {
        method: 'POST',
        body: JSON.stringify({
          contactId, docId, filename: file.name,
          contentType: file.type || 'application/octet-stream',
          contentB64: b64
        })
      });
      if (!res.ok) throw new Error(res.error || 'Upload failed.');
      setIntake((p) => ({
        ...p,
        documents: { ...p.documents, [docId]: { ...res.doc, label } }
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  };

  const removeDoc = (docId) => setIntake((p) => {
    const next = { ...p.documents };
    delete next[docId];
    return { ...p, documents: next };
  });

  const submit = async () => {
    setSending(true); setError(''); setResult(null);
    try {
      const submitTo = String((parties.contractor && parties.contractor.submitTo) || '')
        .split(',').map((x) => x.trim()).filter(Boolean);
      const r = await apiFetch('/api/intake', {
        method: 'POST',
        body: JSON.stringify({ contactId, projectId, intake, parties, submitTo })
      });
      setResult(r);
      if (r.ok) setTimeout(() => onSubmitted && onSubmitted(), 1600);
      else if (r.error) setError(r.error + (r.missing ? `: ${r.missing.join(', ')}` : ''));
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    background: SURF.deep, border: `1px solid ${SURF.line}`, color: SURF.textBright
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(3,18,27,.88)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose && onClose(); }}
    >
      <div className="w-full max-w-4xl my-8 rounded-3xl overflow-hidden"
           style={{ background: SURF.abyss, border: `1px solid ${SURF.lineStrong}` }}>

        <div className="p-6" style={{ background: GRADIENTS.barrelSoft }}>
          <h2 className="text-2xl font-bold" style={{ color: '#fff' }}>New Project Intake</h2>
          <p className="text-[13px] mt-1.5 max-w-[62ch]" style={{ color: 'rgba(255,255,255,.85)' }}>
            Pre-filled from what you priced. Confirm the numbers, add the service costs your installer
            needs, attach the documents, and it goes
            {parties.contractor && parties.contractor.name ? ` to ${parties.contractor.name}` : ''} as their
            own form.
          </p>
        </div>

        {result && result.ok ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">✓</div>
            <div className="text-xl font-bold" style={{ color: SURF.good }}>Submitted.</div>
            <p className="text-[13.5px] mt-2" style={{ color: SURF.textMuted }}>
              {result.attachmentCount} file{result.attachmentCount === 1 ? '' : 's'} sent to{' '}
              {(result.recipients || []).join(', ')}.
            </p>
            {result.skipped && result.skipped.length > 0 && (
              <p className="text-[12.5px] mt-3" style={{ color: SURF.caution }}>
                Too large to attach: {result.skipped.join(', ')}. Send those separately.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="p-6 space-y-7 max-h-[68vh] overflow-y-auto">

              {/* ---------------- customer + rep ---------------- */}
              <Section title="Customer & rep">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Customer name" value={intake.customerName}
                         onChange={(v) => set('customerName', v)} style={inputStyle} />
                  <Field label="Phone" value={intake.customerPhone}
                         onChange={(v) => set('customerPhone', v)} style={inputStyle} />
                  <Field label="Email" value={intake.customerEmail}
                         onChange={(v) => set('customerEmail', v)} style={inputStyle} />
                  <Field label="Sales rep" value={intake.repName}
                         onChange={(v) => set('repName', v)} style={inputStyle} />
                  <div className="sm:col-span-2">
                    <Field label="Home address" value={intake.homeAddress}
                           onChange={(v) => set('homeAddress', v)} style={inputStyle} />
                  </div>
                </div>
              </Section>

              {/* ---------------- payment ---------------- */}
              <Section title="Payment">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Payment type</Label>
                    <select value={intake.paymentType} onChange={(e) => set('paymentType', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-[14px]" style={inputStyle}>
                      {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <Field label="Finance company" value={intake.financeCompany}
                         onChange={(v) => set('financeCompany', v)} style={inputStyle} />
                  <Field label="Interest rate" type="number" step="0.0001"
                         value={intake.interestRate}
                         onChange={(v) => set('interestRate', v)} style={inputStyle}
                         hint={intake.interestRate ? `${(Number(intake.interestRate) * 100).toFixed(2)}%` : 'As a decimal — 0.0549'} />
                </div>
              </Section>

              {/* ---------------- services ---------------- */}
              <Section title="Project details"
                       note="Costs are the installer's numbers, not the customer's price. Leave a line blank if it doesn't apply.">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr style={{ color: SURF.textMuted }}>
                        {['Service', 'Type', 'Qty', 'Cost', 'Notes'].map((h) => (
                          <th key={h} className="text-left font-medium pb-2 pr-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SERVICE_LINES.map((line) => {
                        const e = intake.services[line.id] || {};
                        const filled = e.cost || e.type || e.quantity;
                        return (
                          <tr key={line.id} style={{ borderTop: `1px solid ${SURF.line}` }}>
                            <td className="py-1.5 pr-2 whitespace-nowrap"
                                style={{ color: filled ? SURF.textBright : SURF.textMuted }}>
                              {line.label}
                            </td>
                            <td className="py-1.5 pr-2">
                              <input value={e.type || ''} onChange={(ev) => setService(line.id, 'type', ev.target.value)}
                                     className="w-full px-2 py-1 rounded" style={inputStyle} />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input type="number" value={e.quantity ?? ''}
                                     onChange={(ev) => setService(line.id, 'quantity', ev.target.value)}
                                     className="w-[62px] px-2 py-1 rounded font-mono" style={inputStyle} />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input type="number" step="0.01" value={e.cost ?? ''}
                                     onChange={(ev) => setService(line.id, 'cost', ev.target.value)}
                                     className="w-[104px] px-2 py-1 rounded font-mono" style={inputStyle} />
                            </td>
                            <td className="py-1.5">
                              <input value={e.notes || ''} onChange={(ev) => setService(line.id, 'notes', ev.target.value)}
                                     className="w-full px-2 py-1 rounded" style={inputStyle} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* ---------------- cost ---------------- */}
              <Section title="Project cost">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Commission" type="number" step="0.01" value={intake.commission}
                         onChange={(v) => set('commission', v)} style={inputStyle} />
                  <Field label="SDCP / SGIP amount" type="number" step="0.01" value={intake.rebateAmount}
                         onChange={(v) => set('rebateAmount', v)} style={inputStyle} />
                  <div>
                    <Label>PE prepaid lease?</Label>
                    <select value={intake.prepaidLease ? 'Y' : 'N'}
                            onChange={(e) => set('prepaidLease', e.target.value === 'Y')}
                            className="w-full px-3 py-2 rounded-lg text-[14px]" style={inputStyle}>
                      <option value="N">N</option><option value="Y">Y</option>
                    </select>
                  </div>
                  {intake.prepaidLease && (
                    <>
                      <Field label="PE prepaid amount" type="number" step="0.01" value={intake.prepaidAmount}
                             onChange={(v) => set('prepaidAmount', v)} style={inputStyle} />
                      <div className="sm:col-span-2">
                        <Field label="Gateway note" value={intake.gatewayNote}
                               onChange={(v) => set('gatewayNote', v)} style={inputStyle}
                               hint="e.g. project may need a gateway" />
                      </div>
                    </>
                  )}
                </div>

                <button onClick={() => setShowCosts((v) => !v)}
                        className="mt-4 text-[12px] underline" style={{ color: SURF.seaBright }}>
                  {showCosts ? 'Hide' : 'Show'} the build-up
                </button>

                {showCosts && (
                  <div className="mt-3 rounded-xl p-4" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
                    <Row label="Services" value={money(costs.servicesTotal)} />
                    {costs.feeApplies && (
                      <Row label={`Loan fees (${(costs.loanFeeRate * 100).toFixed(2)}% of ${money(costs.loanFeeBase)})`}
                           value={money(costs.loanFees)} />
                    )}
                    <Row label="Commission" value={money(costs.commission)} />
                    <Row label="Total project cost" value={money(costs.totalProjectCost)} strong />
                    {costs.prepaid > 0 && <Row label="Less PE prepaid" value={'− ' + money(costs.prepaid)} />}
                    {costs.rebate > 0 && <Row label="Less SDCP / SGIP" value={'− ' + money(costs.rebate)} />}
                    <Row label="Net total" value={money(costs.netTotal)} strong tone={SURF.sun} />

                    {costs.feeApplies && (
                      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${SURF.line}` }}>
                        <Field label="Loan fee base — override to match their sheet exactly"
                               type="number" step="0.01" value={intake.loanFeeBase}
                               onChange={(v) => set('loanFeeBase', v)} style={inputStyle}
                               hint="Blank uses the converged solve. Their workbook goal-seeks this and lands about a dollar higher." />
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* ---------------- documents ---------------- */}
              <Section title="Required documents"
                       note="All four go with the form. The electrical bill is the one that holds jobs up most often.">
                <div className="space-y-2">
                  {REQUIRED_DOCUMENTS.map((doc) => {
                    const up = intake.documents[doc.id];
                    const busy = uploading === doc.id;
                    return (
                      <div key={doc.id} className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
                           style={{
                             background: up ? 'rgba(79,191,155,.10)' : SURF.deep,
                             border: `1px solid ${up ? 'rgba(79,191,155,.38)' : SURF.line}`
                           }}>
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 font-bold text-[13px]"
                             style={{ background: up ? SURF.good : SURF.surface, color: up ? SURF.abyss : SURF.textMuted }}>
                          {up ? '✓' : '—'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13.5px]" style={{ color: SURF.textBright }}>
                            {doc.label}
                          </div>
                          {up ? (
                            <div className="text-[11.5px] font-mono truncate" style={{ color: SURF.textMuted }}>
                              {up.filename} · {(up.bytes / 1024).toFixed(0)} KB
                            </div>
                          ) : doc.hint ? (
                            <div className="text-[11.5px]" style={{ color: SURF.textFaint }}>{doc.hint}</div>
                          ) : null}
                        </div>
                        {up ? (
                          <button onClick={() => removeDoc(doc.id)} className="text-[12px] underline"
                                  style={{ color: SURF.textFaint }}>Replace</button>
                        ) : (
                          <label className="px-4 py-2 rounded-lg text-[12.5px] font-bold cursor-pointer"
                                 style={{ background: busy ? SURF.surface : SURF.sun, color: busy ? SURF.textMuted : SURF.abyss }}>
                            {busy ? 'Uploading…' : 'Upload'}
                            <input type="file" className="hidden" disabled={busy}
                                   accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.xlsx"
                                   onChange={(e) => upload(doc.id, doc.label, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>

              {error && (
                <div className="rounded-lg p-3 text-[12.5px]"
                     style={{ background: 'rgba(209,88,74,.15)', color: '#f6c9c3' }}>{error}</div>
              )}
              {result && !result.ok && result.warning && (
                <div className="rounded-lg p-3 text-[12.5px]"
                     style={{ background: 'rgba(232,163,61,.14)', color: '#f7dcae' }}>{result.warning}</div>
              )}
            </div>

            <div className="p-6 pt-4 flex items-center justify-between gap-4 flex-wrap"
                 style={{ borderTop: `1px solid ${SURF.line}` }}>
              <div className="text-[12px]" style={{ color: problems.length ? SURF.caution : SURF.good }}>
                {problems.length
                  ? `Still needed: ${problems.join(', ')}`
                  : `Ready — net total ${money(costs.netTotal)}`}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} disabled={sending} className="text-[13px]" style={{ color: SURF.textMuted }}>
                  Finish later
                </button>
                <button
                  onClick={submit} disabled={sending || problems.length > 0}
                  className="px-6 py-3 rounded-xl text-[14px] font-bold flex items-center gap-2"
                  style={{
                    background: sending || problems.length ? SURF.surface : SURF.sun,
                    color: sending || problems.length ? SURF.textMuted : SURF.abyss
                  }}
                >
                  <Buoy size={15} />
                  {sending ? 'Submitting…' : 'Submit to installer'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- pieces */

const Section = ({ title, note, children }) => (
  <div>
    <h3 className="text-[12px] uppercase tracking-[0.18em] font-semibold mb-1 pb-2"
        style={{ color: SURF.seaBright, borderBottom: `1px solid ${SURF.line}` }}>
      {title}
    </h3>
    {note && <p className="text-[11.5px] mb-3 mt-2" style={{ color: SURF.textFaint }}>{note}</p>}
    <div className={note ? '' : 'mt-3'}>{children}</div>
  </div>
);

const Label = ({ children }) => (
  <label className="block text-[12.5px] mb-1.5" style={{ color: SURF.text }}>{children}</label>
);

const Field = ({ label, value, onChange, type = 'text', step, style, hint }) => (
  <div>
    <Label>{label}</Label>
    <input type={type} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
           className="w-full px-3 py-2 rounded-lg text-[14px]" style={style} />
    {hint && <p className="text-[10.5px] mt-1" style={{ color: SURF.textFaint }}>{hint}</p>}
  </div>
);

const Row = ({ label, value, strong, tone }) => (
  <div className="flex justify-between py-1" style={strong ? { borderTop: `1px solid ${SURF.line}`, marginTop: 4, paddingTop: 8 } : {}}>
    <span className="text-[13px]" style={{ color: strong ? SURF.textBright : SURF.textMuted }}>{label}</span>
    <span className="font-mono text-[13.5px]" style={{ color: tone || (strong ? SURF.textBright : SURF.text), fontWeight: strong ? 700 : 400 }}>
      {value}
    </span>
  </div>
);

export default IntakeForm;
