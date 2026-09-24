/**
 * FILE: src/proposal/RepPicker.jsx
 *
 * WHO SET IT — picked from the roster, not typed.
 *
 * Typing a name was the first version and it was the wrong shape twice over: a
 * misspelling makes the person unfindable in a report, and a missing or mistyped
 * email means their half of the commission never reaches their Beach. Picking
 * from Recruits fixes both at once, because selecting a person carries their
 * email with them — the rep never has to know it.
 *
 * EMPTY IS A REAL CHOICE, not a missing one. No setter means self-gen, so the
 * blank option is labelled as that rather than left as an unexplained dash.
 *
 * A REP WITH NO EMAIL ON FILE is shown and disabled. Dropping them silently
 * would leave a manager hunting for somebody they know is on the roster; saying
 * "no email on file" tells them exactly what to go and fix.
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
 * @param {string}   value     Selected rep's email, or '' for self-gen.
 * @param {function} onChange  Called with ({ name, email }) — both, always, so
 *                             the caller never has to look one up from the other.
 * @param {string}   className Styling is the caller's; this component owns
 *                             behaviour, not appearance.
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

  const pick = (email) => {
    if (!onChange) return;
    if (!email) return onChange({ name: '', email: '' });
    const rep = reps.find((r) => r.email === email);
    onChange({ name: rep ? rep.name : '', email });
  };

  // The roster being unreachable must not block a save. Falling back to a text
  // box keeps the deal recordable — a wrong-but-present name beats a rep who
  // cannot finish the form because an unrelated endpoint is down.
  if (failed && !loading) {
    return (
      <input
        value={value}
        onChange={(e) => onChange && onChange({ name: '', email: e.target.value })}
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
        <option key={r.id} value={r.email || ''} disabled={!r.payable}>
          {r.name}{r.role ? ` · ${r.role}` : ''}{r.payable ? '' : ' · no email on file'}
        </option>
      ))}
    </select>
  );
};

export default RepPicker;
