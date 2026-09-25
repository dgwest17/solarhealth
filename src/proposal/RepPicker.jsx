/**
 * FILE: src/proposal/RepPicker.jsx
 *
 * WHO SET IT — picked from the roster, not typed.
 *
 * Typing a name was the first version and it was the wrong shape twice over: a
 * misspelling makes the person unfindable in a report, and a missing or mistyped
 * email means their half of the commission never reaches their Beach. Picking
 * from Recruits fixes both at once.
 *
 * ---------------------------------------------------------------------------
 * ONE VALUE, KEYED BY RECRUIT ID
 *
 * This component hands back a whole rep — `{ id, name, email }` — or null for
 * self-gen. It used to hand back `{ name, email }` and be keyed on the email,
 * which spread one fact ("who set this deal") into two values that every layer
 * above then carried separately: two useStates in Deep Seas, two in the
 * Pipeline editor, two fields on the proposal, two parameters on the update
 * endpoint, two columns in the CRM. Eight places for one answer, any pair of
 * which could disagree.
 *
 * Keyed on ID rather than email because the id is the one thing every roster
 * entry has. Two people can share an email in a badly-kept CRM and somebody can
 * have none at all; nobody has no id. It is also what a Zoho lookup field needs
 * in order to point at the actual Recruit record.
 *
 * EMPTY IS A REAL CHOICE, not a missing one. No setter means self-gen, so the
 * blank option is labelled as that. This is why there is no separate "a builder
 * set this deal" checkbox any more: the checkbox and the picker were two
 * controls for one question, and a picker whose blank option says "self-gen"
 * answers it on its own.
 *
 * A REP WITH NO EMAIL ON FILE is shown and disabled. Dropping them silently
 * would leave a manager hunting for somebody they know is on the roster; saying
 * "no email on file" tells them exactly what to go and fix. They are disabled
 * rather than selectable because their split has nowhere to be routed — the
 * money would vanish quietly, which is worse than not being able to pick them.
 *
 * The roster is fetched once per mount and cached across instances for the
 * session, because Deep Seas and every Pipeline row want the same list and
 * refetching it per row would be a request per click.
 *
 * Used by: src/battery/BatteryStabilization.jsx, src/beach/Pipeline.jsx
 */
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/supabaseClient';

/** Session-lifetime cache. The roster does not change during an appointment. */
let ROSTER = null;
let ROSTER_PROMISE = null;

const loadRoster = () => {
  if (ROSTER) return Promise.resolve(ROSTER);
  if (!ROSTER_PROMISE) {
    ROSTER_PROMISE = apiFetch('/api/reps')
      .then((r) => { ROSTER = (r && r.reps) || []; return ROSTER; })
      .catch(() => { ROSTER_PROMISE = null; return []; });
  }
  return ROSTER_PROMISE;
};

/**
 * @param {string}   value     Selected rep's Recruit id, or '' for self-gen.
 * @param {function} onChange  Called with { id, name, email } or null.
 * @param {boolean}  allowNone Offer the self-gen option. Off only where a
 *                             builder is already known to exist.
 */
const RepPicker = ({ value = '', onChange, className = '', style = null, allowNone = true }) => {
  const [reps, setReps] = useState(ROSTER || []);
  const [loading, setLoading] = useState(!ROSTER);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRoster().then((list) => {
      if (cancelled) return;
      setReps(list);
      setLoading(false);
      setFailed(list.length === 0);
    });
    return () => { cancelled = true; };
  }, []);

  const pick = (id) => {
    if (!onChange) return;
    if (!id) return onChange(null);
    const rep = reps.find((r) => String(r.id) === String(id));
    if (!rep) return onChange(null);
    onChange({ id: rep.id, name: rep.name || '', email: rep.email || '' });
  };

  /**
   * The roster being unreachable must not block a save. Falling back to a text
   * box keeps the deal recordable — a rep who cannot finish the form because an
   * unrelated endpoint is down is worse than a record with no CRM link.
   *
   * There is no id to give, so the CRM lookup cannot be written for this one.
   * The email still routes the money, because that is what the split reads.
   */
  if (failed && !loading) {
    return (
      <input
        value={value}
        onChange={(e) => {
          const email = e.target.value.trim();
          onChange && onChange(email ? { id: null, name: '', email } : null);
        }}
        placeholder="their email — roster unavailable"
        className={className}
        style={style}
      />
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => pick(e.target.value)}
      disabled={loading}
      className={className}
      style={style}
    >
      {allowNone && <option value="">No setter — self-gen</option>}
      {loading && <option value="">Loading the roster…</option>}
      {reps.map((r) => (
        <option key={r.id} value={r.id} disabled={!r.payable}>
          {r.name}{r.role ? ` · ${r.role}` : ''}{r.payable ? '' : ' · no email on file'}
        </option>
      ))}
    </select>
  );
};

export default RepPicker;
