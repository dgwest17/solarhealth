/**
 * FILE: src/beach/Pipeline.jsx
 *
 * PIPELINE — every deal in the book, as one sortable, filterable list.
 *
 * The three tides answer "how am I doing". This answers the other question a
 * rep asks, which is operational rather than motivational: WHICH ONE DO I
 * TOUCH TODAY. Those need different shapes. A tide is a headline; this is a
 * worklist, so it is a table, and it sorts by the column you are worried
 * about.
 *
 * WHAT IT SHOWS THAT THE TIDES DO NOT:
 *
 *   LAST CONTACT   the column that actually drives a day. A deal nobody has
 *                  touched in three weeks is the problem, whatever stage it
 *                  claims to be at, so it is highlighted rather than merely
 *                  sortable.
 *   SOLD / INSTALL the two dates a rep is asked about by everyone else.
 *   EQUIPMENT      battery make and model, and system size where there is
 *                  solar. "Which of my jobs are Powerwalls" is a real question
 *                  with no answer anywhere else in the tool.
 *
 * DATES ARE SHOWN AS AGE, NOT AS DATES. "17 days" answers the question;
 * "2026-09-06" makes a person do subtraction to get to the same place. The
 * real date is on hover for anyone who needs it.
 *
 * NO NEW FETCH. It reads the same `deals` The Beach already loaded. A second
 * request would be a second source of truth for the same rows, and the two
 * would disagree the first time one of them was cached.
 *
 * Rendered by: src/beach/TheBeach.jsx
 */
import React, { useMemo, useState } from 'react';
import { SURF } from '../surf/theme';
import { Swell as SwellIcon } from '../surf/SurfIcons';
import { SALES_STAGE } from '../proposal/proposalModel';
import { apiFetch } from '../lib/supabaseClient';
import RepPicker from '../proposal/RepPicker';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();

/** Whole days between a date and now; null for anything unparseable. */
const daysSince = (d) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
};

/** Days until a future date; negative once it has passed. */
const daysUntil = (d) => {
  const n = daysSince(d);
  return n === null ? null : -n;
};

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t.toLocaleDateString() : '';
};

/**
 * How stale is too stale.
 *
 * Deliberately blunt: a rep does not need a sixteen-colour heat map, they need
 * to know which rows to call. Two weeks is a nudge, a month is a problem.
 */
const staleness = (days) => {
  if (days === null) return { tone: SURF.textFaint, label: 'never' };
  if (days >= 30) return { tone: SURF.danger, label: `${days}d` };
  if (days >= 14) return { tone: SURF.caution, label: `${days}d` };
  return { tone: SURF.textMuted, label: `${days}d` };
};

const TIDE_LABEL = { met: 'Met', project: 'Project', installed: 'Installed' };

/**
 * Where a one-click advance sends a deal. Met -> Project -> Installed, which is
 * the only direction a deal travels on its own; anything else is a correction
 * and belongs in the editor where it has to be chosen deliberately.
 */
const NEXT_STAGE = {
  met:     { stage: SALES_STAGE.CONVERTED, tide: 'project',   label: 'Project' },
  project: { stage: SALES_STAGE.INSTALLED, tide: 'installed', label: 'Installed' }
};

const COLUMNS = [
  { id: 'name',        label: 'Client',       sort: (d) => (d.name || '').toLowerCase() },
  { id: 'tide',        label: 'Stage',        sort: (d) => ['met', 'project', 'installed'].indexOf(d.tide) },
  { id: 'battery',     label: 'Battery',      sort: (d) => (d.battery || '~').toLowerCase() },
  { id: 'solar',       label: 'Solar',        sort: (d) => Number(d.solarKw) || 0 },
  { id: 'value',       label: 'Value',        sort: (d) => Number(d.contractValue) || 0, align: 'right' },
  { id: 'lastContact', label: 'Last contact', sort: (d) => (daysSince(d.lastContact) ?? 1e9) },
  { id: 'sold',        label: 'Sold',         sort: (d) => (daysSince(d.soldDate) ?? 1e9) },
  { id: 'install',     label: 'Install',      sort: (d) => (daysUntil(d.installDate) ?? 1e9) }
];

const Pipeline = ({ deals = [], onOpenClient = null, role = 'rep' }) => {
  const isAdmin = role === 'admin';
  /** Which row is open for editing. One at a time — a table full of open forms
   *  is unreadable, and nobody edits two deals simultaneously. */
  const [editing, setEditing] = useState(null);
  /** Local overlay of saved edits, so a row updates without refetching the
   *  whole book. Keyed by deal id. */
  const [patches, setPatches] = useState({});
  const [advancing, setAdvancing] = useState(null);

  /**
   * Push a deal to the next stage in one click.
   *
   * Optimistic only after the server agrees. Showing a deal as Installed and
   * then discovering the write failed is worse than a half-second wait — a
   * manager would go and tell somebody.
   */
  const advance = async (d) => {
    const next = NEXT_STAGE[d.tide];
    if (!next) return;
    setAdvancing(d.id);
    try {
      await apiFetch('/api/update-deal', {
        method: 'POST',
        body: JSON.stringify({
          contactId: d.contactId,
          projectId: String(d.id).startsWith('prop_') ? null : d.id,
          stage: next.stage
        })
      });
      setPatches((p) => ({ ...p, [d.id]: { ...(p[d.id] || {}), tide: next.tide } }));
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Could not move that deal: ${e.message}`);
    } finally {
      setAdvancing(null);
    }
  };
  const [sortBy, setSortBy] = useState('lastContact');
  const [asc, setAsc] = useState(false);
  const [tideFilter, setTideFilter] = useState('all');
  const [staleOnly, setStaleOnly] = useState(false);
  const [hasSolar, setHasSolar] = useState(false);
  const [batteryFilter, setBatteryFilter] = useState('all');
  const [q, setQ] = useState('');

  /** Battery makes actually present, so the filter offers only real options. */
  const batteryOptions = useMemo(() => {
    const set = new Set();
    for (const d of deals) if (d.battery) set.add(d.battery);
    return Array.from(set).sort();
  }, [deals]);

  const rows = useMemo(() => {
    // Saved edits win over the fetched row until the next reload.
    let out = deals.map((d) => (patches[d.id] ? { ...d, ...patches[d.id] } : d));
    if (tideFilter !== 'all') out = out.filter((d) => d.tide === tideFilter);
    if (batteryFilter !== 'all') out = out.filter((d) => d.battery === batteryFilter);
    if (hasSolar) out = out.filter((d) => Number(d.solarKw) > 0 || Number(d.panels) > 0);
    if (staleOnly) out = out.filter((d) => (daysSince(d.lastContact) ?? 1e9) >= 14);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((d) =>
        (d.name || '').toLowerCase().includes(needle) ||
        (d.battery || '').toLowerCase().includes(needle) ||
        (d.summary || '').toLowerCase().includes(needle)
      );
    }
    const col = COLUMNS.find((c) => c.id === sortBy) || COLUMNS[0];
    out.sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      if (x < y) return asc ? -1 : 1;
      if (x > y) return asc ? 1 : -1;
      return 0;
    });
    return out;
  }, [deals, patches, tideFilter, batteryFilter, hasSolar, staleOnly, q, sortBy, asc]);

  const toggleSort = (id) => {
    if (sortBy === id) setAsc((v) => !v);
    else { setSortBy(id); setAsc(id === 'name' || id === 'battery'); }
  };

  const staleCount = useMemo(
    () => deals.filter((d) => (daysSince(d.lastContact) ?? 1e9) >= 14 && d.tide !== 'installed').length,
    [deals]
  );

  return (
    <div className="space-y-4">
      {/* --------------------------- the nudge --------------------------- */}
      {staleCount > 0 && (
        <button
          onClick={() => { setStaleOnly(true); setTideFilter('all'); }}
          className="w-full text-left rounded-xl px-4 py-3 text-[13px]"
          style={{ background: 'rgba(209,88,74,.12)', border: `1px solid ${SURF.danger}55`, color: SURF.textBright }}
        >
          <b>{staleCount}</b> open deal{staleCount === 1 ? '' : 's'} not touched in two weeks. Show just those →
        </button>
      )}

      {/* ---------------------------- filters ---------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, battery…"
          className="px-3 py-2 rounded-lg text-[13px] focus:outline-none"
          style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textBright, minWidth: 190 }}
        />
        <Select value={tideFilter} onChange={setTideFilter} options={[
          ['all', 'All stages'], ['met', 'Met'], ['project', 'Project'], ['installed', 'Installed']
        ]} />
        {batteryOptions.length > 0 && (
          <Select value={batteryFilter} onChange={setBatteryFilter} options={[
            ['all', 'Any battery'], ...batteryOptions.map((b) => [b, b])
          ]} />
        )}
        <Toggle on={hasSolar} onClick={() => setHasSolar((v) => !v)}>Has solar</Toggle>
        <Toggle on={staleOnly} onClick={() => setStaleOnly((v) => !v)}>Needs a call</Toggle>
        {(tideFilter !== 'all' || batteryFilter !== 'all' || hasSolar || staleOnly || q) && (
          <button
            onClick={() => { setTideFilter('all'); setBatteryFilter('all'); setHasSolar(false); setStaleOnly(false); setQ(''); }}
            className="text-[12px] underline"
            style={{ color: SURF.textFaint }}
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-[12px]" style={{ color: SURF.textMuted }}>
          {rows.length} of {deals.length}
        </span>
      </div>

      {/* ----------------------------- table ----------------------------- */}
      <div className="rounded-2xl overflow-x-auto" style={{ border: `1px solid ${SURF.line}` }}>
        <table className="w-full text-left" style={{ minWidth: 860 }}>
          <thead>
            <tr style={{ background: SURF.deep }}>
              {COLUMNS.map((c) => (
                <th
                  key={c.id}
                  onClick={() => toggleSort(c.id)}
                  className="px-3 py-2.5 text-[11px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                  style={{ color: sortBy === c.id ? SURF.sun : SURF.textMuted, textAlign: c.align || 'left' }}
                >
                  {c.label}{sortBy === c.id ? (asc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const contact = staleness(daysSince(d.lastContact));
              const install = daysUntil(d.installDate);
              return (
                <React.Fragment key={d.id}>
                <tr
                  onClick={() => setEditing(editing === d.id ? null : d.id)}
                  className="cursor-pointer"
                  style={{ borderTop: `1px solid ${SURF.line}`, background: SURF.surface }}
                >
                  <td className="px-3 py-2.5">
                    <div className="text-[13px] font-semibold" style={{ color: SURF.textBright }}>
                      {d.name || 'Unnamed'}
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: SURF.textFaint }}>{d.summary}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: SURF.textMuted }}>
                    {TIDE_LABEL[d.tide] || '—'}
                    {d.projectStatus && (
                      <div className="text-[10.5px]" style={{ color: SURF.textFaint }}>{d.projectStatus}</div>
                    )}
                    {/* ONE-CLICK ADVANCE, admin only.
                        The stage normally moves when the actionable steps
                        complete, computed server-side from the stored proposal
                        so a customer cannot promote their own deal. That is
                        right for the customer path and useless for a manager
                        who knows a job installed and needs the board to say so.
                        This is that override, and it is the reason it exists. */}
                    {isAdmin && NEXT_STAGE[d.tide] && (
                      <button
                        onClick={(e) => { e.stopPropagation(); advance(d); }}
                        disabled={advancing === d.id}
                        className="mt-1 px-2 py-0.5 rounded text-[10.5px] font-semibold"
                        style={{
                          background: 'transparent',
                          border: `1px solid ${SURF.sun}66`,
                          color: advancing === d.id ? SURF.textFaint : SURF.sun
                        }}
                      >
                        {advancing === d.id ? '…' : `→ ${NEXT_STAGE[d.tide].label}`}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px]" style={{ color: SURF.textBright }}>
                    {d.battery || <span style={{ color: SURF.textFaint }}>—</span>}
                    {d.batteryKwh > 0 && (
                      <div className="text-[10.5px] font-mono" style={{ color: SURF.textFaint }}>{d.batteryKwh} kWh</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px]" style={{ color: SURF.textBright }}>
                    {Number(d.solarKw) > 0
                      ? <>{d.solarKw} kW{d.panels ? <div className="text-[10.5px]" style={{ color: SURF.textFaint }}>{d.panels} panels</div> : null}</>
                      : d.panels
                        ? <>{d.panels} panels</>
                        : <span style={{ color: SURF.textFaint }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-mono text-right" style={{ color: SURF.textBright }}>
                    {d.contractValue ? money(d.contractValue) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] font-mono" title={fmtDate(d.lastContact)}
                      style={{ color: contact.tone }}>
                    {contact.label}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] font-mono" title={fmtDate(d.soldDate)}
                      style={{ color: SURF.textMuted }}>
                    {d.soldDate ? `${daysSince(d.soldDate)}d` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] font-mono" title={fmtDate(d.installDate)}
                      style={{ color: install !== null && install >= 0 ? SURF.seaBright : SURF.textMuted }}>
                    {install === null ? '—' : install >= 0 ? `in ${install}d` : `${-install}d ago`}
                  </td>
                </tr>
                {editing === d.id && (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ background: SURF.deep, padding: 0 }}>
                      <EditRow
                        deal={d}
                        isAdmin={isAdmin}
                        onOpenClient={onOpenClient}
                        onSaved={(patch) => {
                          setPatches((p) => ({ ...p, [d.id]: { ...(p[d.id] || {}), ...patch } }));
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px]" style={{ background: SURF.surface, color: SURF.textMuted }}>
            {deals.length === 0
              ? 'No deals in the book yet.'
              : 'Nothing matches those filters.'}
          </div>
        )}
      </div>

      <p className="text-[11px]" style={{ color: SURF.textFaint }}>
        Click a row to edit it. Ages, not dates — hover any for the date itself. Last contact is the CRM&rsquo;s last activity on the
        contact, so a call logged in Zoho counts and one that was not, does not.
      </p>
    </div>
  );
};

/**
 * Inline editor for one deal.
 *
 * Deliberately narrow: stage, install date, who set it, and — for an admin —
 * the commission. Nothing here changes the customer's PRICE. Changing a
 * contract value without re-deriving the payment, the rebate and the federal
 * deduction produces a record that contradicts the proposal the customer is
 * holding, and none of that machinery is on this screen. Re-pricing happens on
 * the pricing screen, where a new version is saved and `supersedes` leaves a
 * trail.
 *
 * The commission field is admin-only here AND on the server. This is the one
 * write with a direct financial motive for the person making it, so hiding the
 * input is a convenience and the server check is the control.
 */
const EditRow = ({ deal, isAdmin, onSaved, onCancel, onOpenClient }) => {
  const [stage, setStage] = useState(
    deal.tide === 'installed' ? SALES_STAGE.INSTALLED
      : deal.tide === 'project' ? SALES_STAGE.CONVERTED
      : SALES_STAGE.MET
  );
  const [installDate, setInstallDate] = useState(
    deal.installDate ? String(deal.installDate).slice(0, 10) : ''
  );
  const [commission, setCommission] = useState(
    deal.commissionTotal != null ? String(Math.round(deal.commissionTotal)) : ''
  );
  const [setByRep, setSetByRep] = useState(deal.builderName || '');
  const [setByRepEmail, setSetByRepEmail] = useState(deal.builderEmail || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = {
        contactId: deal.contactId,
        projectId: String(deal.id).startsWith('prop_') ? null : deal.id,
        stage,
        installDate: installDate || '',
        setByRep: setByRep || '',
        setByRepEmail: setByRepEmail || ''
      };
      if (isAdmin && commission !== '') body.commission = Number(commission) || 0;

      const r = await apiFetch('/api/update-deal', { method: 'POST', body: JSON.stringify(body) });
      if (r && r.warning) { setMsg({ ok: false, text: r.warning }); setBusy(false); return; }

      // Reflect it locally so the row is right before the next reload.
      onSaved({
        tide: stage === SALES_STAGE.INSTALLED ? 'installed'
          : stage === SALES_STAGE.CONVERTED ? 'project' : 'met',
        installDate: installDate || null,
        builderName: setByRep || null,
        builderEmail: setByRepEmail || null,
        ...(isAdmin && commission !== '' ? { commissionTotal: Number(commission) || 0 } : {})
      });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4" style={{ borderTop: `1px solid ${SURF.sun}55` }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Stage">
          <Select value={stage} onChange={setStage}
                  options={Object.values(SALES_STAGE).map((v) => [v, v])} />
        </Field>
        <Field label="Install date">
          <input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)}
                 className="w-full px-2.5 py-2 rounded-lg text-[13px] focus:outline-none"
                 style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textBright }} />
        </Field>
        <Field label="Set by">
          {/* One control, not two. Selecting the person carries their email, so
              a name and an email can never disagree about who gets paid. */}
          <RepPicker
            value={setByRepEmail}
            onChange={({ name, email }) => { setSetByRep(name); setSetByRepEmail(email); }}
            className="w-full px-2.5 py-2 rounded-lg text-[13px] focus:outline-none"
            style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textBright }}
          />
        </Field>
        {isAdmin && (
          <Field label="Total commission">
            <input type="number" step={50} value={commission}
                   onChange={(e) => setCommission(e.target.value)}
                   className="w-full px-2.5 py-2 rounded-lg font-mono text-[13px] focus:outline-none"
                   style={{ background: SURF.surface, border: `1px solid ${SURF.sun}66`, color: SURF.textBright }} />
          </Field>
        )}
      </div>

      {isAdmin && (
        <p className="text-[11px] mt-2" style={{ color: SURF.textFaint }}>
          Changing the total re-splits it using this deal&rsquo;s own stored percentages, not today&rsquo;s rate
          card — so a comp change cannot leak backwards into it.
        </p>
      )}
      {!isAdmin && (
        <p className="text-[11px] mt-2" style={{ color: SURF.textFaint }}>
          Commission is admin-only. Naming somebody here ends self-gen on this deal and moves half the rep
          share to them; clearing it gives it back.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={save} disabled={busy}
                className="px-4 py-2 rounded-lg text-[12.5px] font-bold"
                style={{ background: busy ? SURF.line : SURF.sun, color: busy ? SURF.textFaint : '#06202c' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-[12.5px] border"
                style={{ borderColor: SURF.line, color: SURF.textMuted }}>
          Cancel
        </button>
        {onOpenClient && deal.contactId && (
          <button onClick={() => onOpenClient(deal.contactId)}
                  className="px-3 py-2 rounded-lg text-[12.5px] border"
                  style={{ borderColor: SURF.line, color: SURF.seaBright }}>
            Open the full audit — re-price it there
          </button>
        )}
        {msg && (
          <span className="text-[12px]" style={{ color: msg.ok ? SURF.good : SURF.danger }}>{msg.text}</span>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-[10.5px] uppercase tracking-wider mb-1" style={{ color: SURF.textMuted }}>
      {label}
    </span>
    {children}
  </label>
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="px-3 py-2 rounded-lg text-[13px] focus:outline-none"
    style={{ background: SURF.surface, border: `1px solid ${SURF.line}`, color: SURF.textBright }}
  >
    {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
  </select>
);

const Toggle = ({ on, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3 py-2 rounded-lg text-[12.5px] font-semibold"
    style={{
      background: on ? SURF.sun : 'transparent',
      color: on ? '#06202c' : SURF.textMuted,
      border: `1px solid ${on ? SURF.sun : SURF.line}`
    }}
  >
    {children}
  </button>
);

export default Pipeline;
