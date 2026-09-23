/**
 * FILE: src/proposal/ProposalBar.jsx
 *
 * THE PROPOSAL, REACHABLE FROM WHEREVER THE REP ALREADY IS.
 *
 * Three things a rep needs on a live call, in one strip:
 *
 *   SAVE          capture what was quoted, before the customer's attention
 *                 moves on.
 *   OPEN          show them the sendable proposal, right now, on this screen.
 *   EDIT DETAILS  fix the phone number or the spelling of the street without
 *                 leaving the pricing screen and losing the configuration.
 *
 * WHY THIS IS A COMPONENT AND NOT A SECOND COPY OF THE BUTTON. The save block
 * used to live in one place: buried inside the rep-only commission section,
 * most of a page below the pricing a rep is actually looking at. Putting a
 * second save button at the top would have meant two blocks of save UI with
 * two copies of the result handling, and they drift — one shows the Zoho
 * warning, the other silently doesn't, and which one you get depends on where
 * you clicked. So there is one component, rendered twice.
 *
 * OPENING THE PROPOSAL IS WHY THIS EXISTS AT ALL. CustomerProposal.jsx was
 * written, reviewed, and then imported by nothing — there was no way to open
 * the sendable proposal from anywhere in the app. This is the door.
 *
 * WHAT IT SHOWS THE CUSTOMER: the SAVED proposal when one exists, otherwise
 * the live one built from the screen. Those differ after a rep changes the
 * configuration without re-saving, and the saved one is what the customer was
 * promised — so it wins, and the strip says plainly when the two have parted.
 *
 * Rendered by: src/battery/BatteryStabilization.jsx (top and bottom).
 */
import React, { useState } from 'react';
import { Shell, Heading } from '../surf/SurfIcons';
import { proposalSummaryLine } from './proposalModel';
import CustomerProposal from './CustomerProposal';
import { apiFetch } from '../lib/supabaseClient';

const ProposalBar = ({
  /** The proposal built from what is on screen right now. May be null. */
  liveProposal = null,
  /** The last proposal saved against this client, if any. */
  savedProposal = null,
  saving = false,
  saveResult = null,
  onSave = null,
  clientContext = null,
  /** Called with the updated contact after a successful details edit. */
  onContactSaved = null,
  /** `compact` is the top-of-page strip; the full version carries the result
   *  detail and the sandbox note. */
  compact = false
}) => {
  const [showProposal, setShowProposal] = useState(false);
  const [editing, setEditing] = useState(false);

  const canSave = !!(clientContext && clientContext.contactId);
  const canEdit = !!(clientContext && clientContext.canWrite);
  const shown = savedProposal || liveProposal;

  // A saved proposal and a live one that no longer match means the rep has
  // changed the pricing since saving. Worth saying out loud before they send
  // the old one to a customer.
  const stale = !!(savedProposal && liveProposal
    && proposalSummaryLine(savedProposal) !== proposalSummaryLine(liveProposal));

  return (
    <>
      <div className={`rounded-xl border border-cyan-400/30 bg-cyan-500/5 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <Shell size={13} /> Proposal
            </div>
            {savedProposal ? (
              <>
                <div className="text-[13px] text-slate-200 mt-1 font-mono truncate">
                  {proposalSummaryLine(savedProposal)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Saved {new Date(savedProposal.createdAt).toLocaleString()}
                  {savedProposal.stage ? ` · stage ${savedProposal.stage}` : ''}
                </div>
              </>
            ) : (
              <div className="text-[12.5px] text-slate-400 mt-1 max-w-[44ch]">
                Save what you quoted so you — and they — can come back to it.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={() => setEditing((v) => !v)}
                className="px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-slate-600 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/50"
              >
                {editing ? 'Close details' : 'Edit details'}
              </button>
            )}
            {/* Prefer handing off to the Big Wave tab when the app offers one:
                edits there are made against the client record and every screen
                sees them, where an overlay's are scoped to this component. The
                overlay remains for anywhere without that tab — the sandbox,
                and any future embed. */}
            <button
              onClick={() => {
                if (clientContext && clientContext.onOpenProposal) clientContext.onOpenProposal();
                else setShowProposal(true);
              }}
              disabled={!shown}
              className={`px-3 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 border ${
                shown
                  ? 'border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/10'
                  : 'border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Heading size={14} /> Open proposal
            </button>
            <button
              onClick={onSave}
              disabled={saving || !onSave}
              className={`px-4 py-2 rounded-lg text-[12.5px] font-bold flex items-center gap-1.5 ${
                saving ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                       : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
              }`}
            >
              <Shell size={14} />
              {saving ? 'Saving…' : savedProposal ? 'Save new version' : 'Save Proposal'}
            </button>
          </div>
        </div>

        {stale && (
          <p className="mt-2 text-[11.5px] text-amber-300">
            The pricing on screen has changed since this was saved. &ldquo;Open proposal&rdquo; still shows
            the saved version — save a new one to send what you are looking at now.
          </p>
        )}

        {editing && (
          <ContactDetails
            clientContext={clientContext}
            onSaved={(c) => { setEditing(false); if (onContactSaved) onContactSaved(c); }}
          />
        )}

        {saveResult && !compact && (
          <div className="mt-3 text-[12px]">
            {saveResult.ok ? (
              <div className="text-emerald-300">
                Saved{saveResult.zoho && saveResult.zoho.ok ? ' · moved to Met in the CRM' : ''}.
                {saveResult.missingZohoFields && saveResult.missingZohoFields.length > 0 && (
                  <div className="text-amber-300 mt-1">
                    These Zoho fields don&rsquo;t exist yet, so they weren&rsquo;t written:{' '}
                    <span className="font-mono">{saveResult.missingZohoFields.join(', ')}</span>.
                    The full proposal is saved either way.
                  </div>
                )}
                {saveResult.supabaseError && (
                  <div className="text-amber-300 mt-1">{saveResult.supabaseError}</div>
                )}
              </div>
            ) : (
              <div className="text-red-300">{saveResult.error || 'Could not save.'}</div>
            )}
          </div>
        )}

        {/* The compact strip still has to report a failure — a save that
            silently did nothing is worse than no button at all. */}
        {saveResult && compact && !saveResult.ok && (
          <div className="mt-2 text-[12px] text-red-300">{saveResult.error || 'Could not save.'}</div>
        )}

        {!canSave && !compact && (
          <p className="text-[11px] text-slate-500 mt-2">
            Sandbox mode — open a client to save a proposal against their record.
          </p>
        )}
      </div>

      {showProposal && shown && (
        <ProposalOverlay onClose={() => setShowProposal(false)} proposal={shown} />
      )}
    </>
  );
};

/**
 * The sendable proposal, over the top of everything.
 *
 * An overlay rather than a route: a rep opens this mid-conversation and closes
 * it again, and losing the pricing configuration behind it — every slider,
 * every adder — to a navigation would be its own small disaster.
 *
 * `print:hidden` on the chrome so a browser print gives the customer the
 * proposal and not the close button.
 */
const ProposalOverlay = ({ proposal, onClose }) => {
  // Escape closes. Anything that covers the whole screen needs a way out that
  // does not involve hunting for a button.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#061a25]">
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-[#061a25]/95 backdrop-blur border-b border-slate-700/60 print:hidden">
        <span className="text-[12px] uppercase tracking-widest text-cyan-300">Customer proposal</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-[12.5px] hover:text-cyan-300"
          >
            Print / PDF
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-[12.5px] hover:text-cyan-300"
          >
            Close
          </button>
        </div>
      </div>
      <CustomerProposal proposal={proposal} />
    </div>
  );
};

/**
 * Inline contact and address editing.
 *
 * Deliberately narrow: the fields that stop a job, which are the ones a rep
 * discovers are wrong while sitting at the kitchen table. A misspelt street or
 * a dead phone number is what a site inspection fails on, and it should not
 * cost a trip back to the CRM to fix.
 *
 * Writes through /api/save-contact, which re-checks ownership server-side —
 * a rep may edit only their own clients, and this form cannot widen that.
 */
const ContactDetails = ({ clientContext, onSaved }) => {
  const c = (clientContext && clientContext.contact) || {};
  const [form, setForm] = useState({
    firstName: c.firstName || '',
    lastName:  c.lastName || '',
    email:     c.email || '',
    phone:     c.phone || '',
    street:    c.street || '',
    city:      c.city || '',
    state:     c.state || '',
    zip:       c.zip || ''
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    // Zoho requires a last name, and rejecting here beats a 400 from the CRM
    // with a message written for an API consumer rather than a person.
    if (!form.lastName.trim()) {
      setMsg({ ok: false, text: 'A last name is required — Zoho will not store a contact without one.' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await apiFetch('/api/save-contact', {
        method: 'POST',
        body: JSON.stringify({ contactId: clientContext.contactId, contact: form })
      });
      setMsg({ ok: true, text: 'Saved to the CRM.' });
      if (onSaved) onSaved(form);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/60">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Input label="First name" value={form.firstName} onChange={set('firstName')} />
        <Input label="Last name"  value={form.lastName}  onChange={set('lastName')} />
        <Input label="Email"      value={form.email}     onChange={set('email')} />
        <Input label="Phone"      value={form.phone}     onChange={set('phone')} />
        <div className="col-span-2">
          <Input label="Street" value={form.street} onChange={set('street')} />
        </div>
        <Input label="City"  value={form.city}  onChange={set('city')} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="State" value={form.state} onChange={set('state')} />
          <Input label="ZIP"   value={form.zip}   onChange={set('zip')} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={save}
          disabled={busy}
          className={`px-4 py-2 rounded-lg text-[12.5px] font-bold ${
            busy ? 'bg-slate-800 text-slate-500' : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
          }`}
        >
          {busy ? 'Saving…' : 'Save details'}
        </button>
        {msg && (
          <span className={`text-[12px] ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange }) => (
  <label className="block">
    <span className="block text-[10.5px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
    <input
      value={value}
      onChange={onChange}
      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-[12.5px] focus:border-cyan-400/60 focus:outline-none"
    />
  </label>
);

export default ProposalBar;
