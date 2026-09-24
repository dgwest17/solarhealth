/**
 * FILE: src/proposal/BigWave.jsx
 *
 * BIG WAVE — the deal itself, on its own tab.
 *
 * Everything that is true about a customer AFTER the pricing is settled: what
 * they were quoted, who they are, and what happens next. The audit and the
 * battery analysis are the argument; this is what the argument produced.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AS A TAB RATHER THAN A PANEL IN BATTERY ANALYSIS
 *
 * The proposal was reachable only from inside Stabilize Your Bill, which is
 * most of a page deep inside one section of the audit. Two problems with that,
 * and the second is the real one:
 *
 *   It made Battery Analysis carry the proposal's state as well as its own.
 *   Battery Analysis is already the most complex screen in the tool.
 *
 *   It scoped every edit to that screen. A rep who fixed a phone number in the
 *   pricing section had fixed it in one component's local state; nothing else
 *   in the tool knew. Lifting it to a tab means the client record is edited in
 *   one place and everything reads the same thing.
 *
 * TWO DEAD COMPONENTS LIVE HERE NOW. CustomerProposal and ProjectSteps were
 * both written, both complete, and both imported by nothing — CustomerProposal
 * by no file at all, ProjectSteps by a view nothing ever navigated to. Neither
 * had ever rendered in the app. They are the two halves of this tab.
 *
 * NEEDS AN OPEN CLIENT. A proposal with no customer is not a thing, so the
 * empty state says so rather than rendering a shell of one.
 *
 * Rendered by: src/App.jsx (view === 'bigwave')
 */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { SURF } from '../surf/theme';
import { Swell, Shell, Heading, Treasure } from '../surf/SurfIcons';
import CustomerProposal from './CustomerProposal';
import DropIn from './DropIn';
import ProjectSteps from '../project/ProjectSteps';
import { proposalSummaryLine } from './proposalModel';
import { apiFetch } from '../lib/supabaseClient';

const TABS = [
  { id: 'proposal', label: 'The proposal', icon: Shell },
  { id: 'dropin',   label: 'Drop In', icon: Treasure },
  { id: 'steps',    label: 'What happens next', icon: Heading },
  { id: 'details',  label: 'Client details', icon: Swell }
];

const BigWave = ({ clientData = null, role = 'client', userEmail = '', onBackToClients = null }) => {
  const [tab, setTab] = useState('proposal');
  const [proposal, setProposal] = useState((clientData && clientData.proposal) || null);
  const [loading, setLoading] = useState(false);

  const contact = (clientData && clientData.contact) || null;
  const contactId = contact && contact.id;
  const projectId = clientData && clientData.project ? clientData.project.id : null;
  const canEdit = role === 'admin' || role === 'rep';

  /**
   * Re-read the saved proposal on open.
   *
   * clientData was fetched when the client was opened, which may have been
   * before the rep priced and saved. Reading again here means the tab shows
   * what is actually stored rather than a snapshot from whenever the client
   * record happened to load.
   */
  const reload = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const r = await apiFetch(`/api/save-proposal?contactId=${encodeURIComponent(contactId)}`);
      if (r && r.proposal) setProposal(r.proposal);
    } catch {
      // No saved proposal is the ordinary case for a new client, not an error.
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { reload(); }, [reload]);

  if (!clientData || !contact) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Swell size={40} style={{ color: SURF.sun }} className="mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2" style={{ color: SURF.textBright }}>
            No client open
          </h2>
          <p className="text-[13.5px] mb-5" style={{ color: SURF.textMuted }}>
            Big Wave shows what a customer was quoted and what happens next. Open a client first.
          </p>
          {onBackToClients && (
            <button
              onClick={onBackToClients}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold"
              style={{ background: SURF.sun, color: '#06202c' }}
            >
              Go to clients
            </button>
          )}
        </div>
      </div>
    );
  }

  const name = contact.fullName || contact.email || 'This client';

  return (
    <div className="max-w-6xl mx-auto px-5 py-6">
      {/* ------------------------------- header ------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] flex items-center gap-1.5"
               style={{ color: SURF.sun }}>
            <Swell size={15} /> Big Wave
          </div>
          <h1 className="text-2xl font-extrabold mt-1 truncate" style={{ color: SURF.textBright }}>
            {name}
          </h1>
          {proposal ? (
            <p className="text-[12.5px] font-mono mt-1" style={{ color: SURF.textMuted }}>
              {proposalSummaryLine(proposal)}
              {proposal.stage ? ` · ${proposal.stage}` : ''}
            </p>
          ) : (
            <p className="text-[12.5px] mt-1" style={{ color: SURF.textFaint }}>
              Nothing saved yet — price this client in Battery Analysis and save the proposal.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-[12.5px] border flex items-center gap-1.5"
            style={{ borderColor: SURF.line, color: SURF.textMuted }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {onBackToClients && (
            <button
              onClick={onBackToClients}
              className="px-3 py-2 rounded-lg text-[12.5px] border flex items-center gap-1.5"
              style={{ borderColor: SURF.line, color: SURF.textMuted }}
            >
              <ArrowLeft size={13} /> Clients
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------- tabs ------------------------------- */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: SURF.line }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-4 py-2.5 text-[13px] font-semibold flex items-center gap-1.5 border-b-2 -mb-px"
            style={{
              borderColor: tab === id ? SURF.sun : 'transparent',
              color: tab === id ? SURF.sun : SURF.textMuted
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ------------------------------- panels ------------------------------ */}
      {tab === 'proposal' && (
        proposal ? (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${SURF.line}` }}>
            <div className="flex items-center justify-between px-4 py-2.5 print:hidden"
                 style={{ background: SURF.deep, borderBottom: `1px solid ${SURF.line}` }}>
              <span className="text-[11px] uppercase tracking-widest" style={{ color: SURF.textMuted }}>
                What the customer sees
              </span>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg border text-[12px]"
                style={{ borderColor: SURF.line, color: SURF.textMuted }}
              >
                Print / PDF
              </button>
            </div>
            <CustomerProposal proposal={proposal} />
          </div>
        ) : (
          <Empty text="No proposal saved for this client yet." />
        )
      )}

      {tab === 'dropin' && (
        proposal
          ? <DropIn proposal={proposal} />
          : <Empty text="Drop In needs a saved proposal — it compares paying cash against financing and keeping the cash invested." />
      )}

      {tab === 'steps' && (
        proposal ? (
          <ProjectSteps
            proposal={proposal}
            contact={contact}
            contactId={contactId}
            projectId={projectId}
            repName={userEmail}
            canEdit={canEdit}
            onProposalChange={setProposal}
          />
        ) : (
          <Empty text="The steps open once a proposal is saved — they depend on how the deal is financed." />
        )
      )}

      {tab === 'details' && (
        <ClientDetails
          contact={contact}
          project={clientData.project || null}
          contactId={contactId}
          canEdit={canEdit}
        />
      )}
    </div>
  );
};

const Empty = ({ text }) => (
  <div className="rounded-2xl p-10 text-center text-[13px]"
       style={{ background: SURF.deep, border: `1px solid ${SURF.line}`, color: SURF.textMuted }}>
    {text}
  </div>
);

/**
 * Client details, edited once and read everywhere.
 *
 * The contact half writes to Zoho through /api/save-contact, which re-checks
 * ownership server-side — a rep reaches only their own clients whatever this
 * form sends.
 *
 * The project half is READ ONLY here, deliberately. System size, utility and
 * NEM version are audit inputs: change them and every figure in the audit
 * moves, including the ones already on a saved proposal. That is an edit that
 * belongs on the audit screen where the consequences are visible, not on a
 * details tab where it looks like correcting a typo.
 */
const ClientDetails = ({ contact, project, contactId, canEdit }) => {
  const [form, setForm] = useState({
    firstName: contact.firstName || '',
    lastName:  contact.lastName || '',
    email:     contact.email || '',
    phone:     contact.phone || '',
    street:    contact.street || '',
    city:      contact.city || '',
    state:     contact.state || '',
    zip:       contact.zip || ''
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.lastName.trim()) {
      setMsg({ ok: false, text: 'A last name is required — Zoho will not store a contact without one.' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await apiFetch('/api/save-contact', {
        method: 'POST',
        body: JSON.stringify({ contactId, contact: form })
      });
      setMsg({ ok: true, text: 'Saved to the CRM.' });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <h3 className="text-[13px] font-bold mb-4" style={{ color: SURF.textBright }}>Contact</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={form.firstName} onChange={set('firstName')} disabled={!canEdit} />
          <Input label="Last name"  value={form.lastName}  onChange={set('lastName')}  disabled={!canEdit} />
          <Input label="Email"      value={form.email}     onChange={set('email')}     disabled={!canEdit} />
          <Input label="Phone"      value={form.phone}     onChange={set('phone')}     disabled={!canEdit} />
          <div className="col-span-2">
            <Input label="Street" value={form.street} onChange={set('street')} disabled={!canEdit} />
          </div>
          <Input label="City" value={form.city} onChange={set('city')} disabled={!canEdit} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="State" value={form.state} onChange={set('state')} disabled={!canEdit} />
            <Input label="ZIP"   value={form.zip}   onChange={set('zip')}   disabled={!canEdit} />
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-[12.5px] font-bold"
              style={{ background: busy ? SURF.line : SURF.sun, color: busy ? SURF.textFaint : '#06202c' }}
            >
              {busy ? 'Saving…' : 'Save details'}
            </button>
            {msg && (
              <span className="text-[12px]" style={{ color: msg.ok ? SURF.good : SURF.danger }}>
                {msg.text}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl p-5" style={{ background: SURF.deep, border: `1px solid ${SURF.line}` }}>
        <h3 className="text-[13px] font-bold mb-1" style={{ color: SURF.textBright }}>System on file</h3>
        <p className="text-[11.5px] mb-4" style={{ color: SURF.textFaint }}>
          These are audit inputs. Changing one moves every figure in the audit, so they are edited on the
          audit screen where you can see what moves — not here.
        </p>
        {project ? (
          <dl className="space-y-2">
            <Row label="System size"    value={project.System_Size_kW ? `${project.System_Size_kW} kW` : '—'} />
            <Row label="Utility"        value={project.Utility_Provider || '—'} />
            <Row label="NEM version"    value={project.NEM_Version || '—'} />
            <Row label="Panels"         value={project.Number_of_Modules || '—'} />
            <Row label="Battery"        value={project.Battery_Capacity_kWh ? `${project.Battery_Capacity_kWh} kWh` : 'None'} />
            <Row label="Install date"   value={project.Install_Date || '—'} />
            <Row label="PTO date"       value={project.PTO_Date || '—'} />
            <Row label="Project status" value={project.Project_Status || '—'} />
          </dl>
        ) : (
          <p className="text-[13px]" style={{ color: SURF.textMuted }}>
            No Solar_Project linked to this contact yet.
          </p>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 border-b"
       style={{ borderColor: 'rgba(255,255,255,.05)' }}>
    <dt className="text-[12px]" style={{ color: SURF.textMuted }}>{label}</dt>
    <dd className="text-[13px] font-mono" style={{ color: SURF.textBright }}>{value}</dd>
  </div>
);

const Input = ({ label, value, onChange, disabled }) => (
  <label className="block">
    <span className="block text-[10.5px] uppercase tracking-wider mb-1" style={{ color: SURF.textFaint }}>
      {label}
    </span>
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full px-2.5 py-2 rounded-lg text-[13px] focus:outline-none disabled:opacity-60"
      style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textBright }}
    />
  </label>
);

export default BigWave;
