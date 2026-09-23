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

const Pipeline = ({ deals = [], onOpenClient = null }) => {
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
    let out = deals.slice();
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
  }, [deals, tideFilter, batteryFilter, hasSolar, staleOnly, q, sortBy, asc]);

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
                <tr
                  key={d.id}
                  onClick={() => onOpenClient && d.contactId && onOpenClient(d.contactId)}
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
        Ages, not dates — hover any for the date itself. Last contact is the CRM&rsquo;s last activity on the
        contact, so a call logged in Zoho counts and one that was not, does not.
      </p>
    </div>
  );
};

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
