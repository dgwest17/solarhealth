/**
 * FILE: src/admin/AdminSettings.jsx
 *
 * ADMIN — PLATFORM DEFAULTS.
 *
 * Everything the tool assumes about the market, editable without a deploy:
 * battery catalog, lenders and their rate cards, financing terms, adder
 * pricing, solar panel options and per-panel pricing, incentive programs,
 * utility rate tables, and the modelling assumptions behind every projection.
 *
 * Two rules the UI enforces:
 *
 *   1. Nothing saves until "Save changes" is pressed. Editing is local, so a
 *      half-finished rate card never reaches a rep mid-appointment.
 *   2. Every field shows what it was shipped with. An admin needs to see when
 *      they have moved off the default and be able to put it back — a settings
 *      page you cannot reverse is one people stop trusting.
 *
 * Admin-only. The gate is enforced server-side in api/settings.js; this page
 * just refuses to render the save controls for anyone else.
 *
 * Rendered by: src/App.jsx (view === 'admin')
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings, Plus, Trash2, RotateCcw, Save, AlertTriangle, Check, ChevronDown, Lock
} from 'lucide-react';
import { useSettings } from './SettingsContext';
import { buildDefaultSettings, ASSUMPTION_FIELDS } from './settingsSchema';

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();

const SECTIONS = [
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'parties',     label: 'Your companies' },
  { id: 'quiver',      label: 'Quiver' },
  { id: 'batteries',   label: 'Batteries' },
  { id: 'lenders',     label: 'Lenders & terms' },
  { id: 'adders',      label: 'Adders' },
  { id: 'panels',      label: 'Solar panels' },
  { id: 'programs',    label: 'Incentive programs' },
  { id: 'rates',       label: 'Utility rates' }
];

const AdminSettings = ({ role = 'client' }) => {
  const { settings, save, status, canEdit } = useSettings();
  const isAdmin = canEdit || role === 'admin';

  const [draft, setDraft] = useState(settings);
  const [section, setSection] = useState('assumptions');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  // Adopt settings from the server once they land, but never clobber an edit
  // in progress — a background load landing mid-typing would be maddening.
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setDraft(settings); }, [settings, touched]);

  const defaults = useMemo(() => buildDefaultSettings(), []);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  );

  const edit = (fn) => {
    setTouched(true); setSaved(false); setErr('');
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true); setErr('');
    try {
      await save(draft);
      setTouched(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const revertAll = () => { setDraft(defaults); setTouched(true); setSaved(false); };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-20 rounded-2xl border border-slate-700 bg-slate-900/60 p-8 text-center">
        <Lock size={28} className="text-slate-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-200">Admin only</h2>
        <p className="text-sm text-slate-400 mt-2">
          Platform defaults can only be changed by an administrator. Ask Dave if something here needs updating.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-500 flex items-center gap-2">
            <Settings size={28} className="text-cyan-400" /> Platform Defaults
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            What every new audit starts with. Changing a value here changes it everywhere, for everyone.
          </p>
          <p className="text-slate-500 text-[11.5px] mt-1">
            Rate increase? <b className="text-slate-400">Utility rates</b> for the tariff tiers,
            <b className="text-slate-400"> Assumptions</b> for escalation and the storage rebate,
            <b className="text-slate-400"> Lenders &amp; terms</b> for rate cards and commission floors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[12px] text-amber-300">Unsaved changes</span>}
          {saved && (
            <span className="text-[12px] text-emerald-300 flex items-center gap-1">
              <Check size={13} /> Saved
            </span>
          )}
          <button
            onClick={revertAll}
            className="px-3 py-2 rounded-lg text-[13px] font-semibold bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset all
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className={`px-5 py-2 rounded-lg text-[13px] font-bold flex items-center gap-1.5 ${
              dirty && !saving
                ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-400/40 bg-red-900/20 p-4 text-[13px] text-red-200 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{err}</span>
        </div>
      )}
      {status === 'offline' && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-900/15 p-4 text-[13px] text-amber-200">
          Couldn&rsquo;t reach the settings store, so these are the shipped defaults. Edits made now can&rsquo;t be saved
          until the connection is back.
        </div>
      )}

      {/* ---- section tabs ---- */}
      <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-px">
        {SECTIONS.map((sct) => (
          <button
            key={sct.id}
            onClick={() => setSection(sct.id)}
            className={`px-4 py-2 rounded-t-lg text-[13px] font-semibold transition-colors ${
              section === sct.id
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 border-b-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >{sct.label}</button>
        ))}
      </div>

      {section === 'assumptions' && <Assumptions draft={draft} defaults={defaults} edit={edit} />}
      {section === 'parties'     && <Parties     draft={draft} edit={edit} />}
      {section === 'quiver'      && <Quiver      draft={draft} edit={edit} />}
      {section === 'batteries'   && <Batteries   draft={draft} edit={edit} />}
      {section === 'lenders'     && <Lenders     draft={draft} edit={edit} />}
      {section === 'adders'      && <Adders      draft={draft} edit={edit} />}
      {section === 'panels'      && <Panels      draft={draft} edit={edit} />}
      {section === 'programs'    && <Programs    draft={draft} edit={edit} />}
      {section === 'rates'       && <Rates       draft={draft} edit={edit} />}
    </div>
  );
};

/* =========================================================== ASSUMPTIONS */

const Assumptions = ({ draft, defaults, edit }) => {
  const groups = useMemo(() => {
    const g = {};
    for (const f of ASSUMPTION_FIELDS) (g[f.group] = g[f.group] || []).push(f);
    return g;
  }, []);

  const display = (f, v) => (f.type === 'pct' && v <= 1 && f.key.includes('fedPct') ? v * 100 : v);
  const parse = (f, raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return f.type === 'pct' && f.key.includes('fedPct') ? n / 100 : n;
  };

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([group, fields]) => (
        <Panel key={group} title={group}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => {
              const val = draft.assumptions[f.key];
              const def = defaults.assumptions[f.key];
              const changed = JSON.stringify(val) !== JSON.stringify(def);
              return (
                <div key={f.key}>
                  <label className="block text-[12.5px] text-slate-300 mb-1">{f.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step={f.step || 1}
                      value={display(f, val)}
                      onChange={(e) => edit((d) => { d.assumptions[f.key] = parse(f, e.target.value); })}
                      className={`flex-1 px-3 py-2 rounded-lg bg-slate-900/70 border text-slate-100 font-mono text-sm ${
                        changed ? 'border-amber-500/60' : 'border-slate-600'
                      }`}
                    />
                    <span className="text-[11px] text-slate-500 w-8">
                      {f.suffix || (f.type === 'pct' ? '%' : f.type === 'money' ? '$' : '')}
                    </span>
                  </div>
                  <p className="text-[10.5px] mt-1">
                    {changed ? (
                      <button
                        onClick={() => edit((d) => { d.assumptions[f.key] = def; })}
                        className="text-amber-400 hover:underline"
                      >Changed — reset to {String(display(f, def))}</button>
                    ) : (
                      <span className="text-slate-500">{f.help || `Default: ${String(display(f, def))}`}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
};

/* =============================================================== PARTIES */

const PARTY_FIELDS = [
  { key: 'name',    label: 'Company name',  placeholder: 'Shown as the proposal header' },
  { key: 'tagline', label: 'Tagline',       placeholder: 'One short line under the name' },
  { key: 'logoUrl', label: 'Logo URL',      placeholder: 'https://… — PNG or SVG, transparent' },
  { key: 'license', label: 'Licence number', placeholder: 'CSLB #' },
  { key: 'phone',   label: 'Phone' },
  { key: 'email',   label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'submitTo', label: 'Submission emails', contractorOnly: true,
    placeholder: 'chelsie@…, gabe@…, pete@… — comma separated' }
];

const PARTY_ROLES = [
  { id: 'seller', title: 'Seller — you',
    note: 'The company whose name leads the proposal and whose relationship the customer thinks they have. Leave the name blank and the proposal shows a neutral placeholder rather than anyone else\u2019s brand.' },
  { id: 'contractor', title: 'Contractor — who installs',
    note: 'The licence holder who actually does the work. Appears in the proposal header and is stored ON each proposal, so an old one still reads correctly after you change installers.' }
];

const Parties = ({ draft, edit }) => (
  <div className="space-y-4">
    {PARTY_ROLES.map(({ id, title, note }) => {
      const party = (draft.parties && draft.parties[id]) || {};
      return (
        <Panel key={id} title={title} note={note}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PARTY_FIELDS.filter((f) => !f.contractorOnly || id === 'contractor').map((f) => (
              <Labeled key={f.key} label={f.label}>
                <Inp
                  value={party[f.key] || ''} placeholder={f.placeholder}
                  onChange={(v) => edit((d) => {
                    d.parties = d.parties || {};
                    d.parties[id] = { ...(d.parties[id] || {}), [f.key]: v };
                  })}
                />
              </Labeled>
            ))}
          </div>
          {party.logoUrl ? (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <img src={party.logoUrl} alt="" className="h-9 w-auto"
                   onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="text-[11.5px] text-slate-500">
                Preview. If nothing shows, the URL isn&rsquo;t publicly reachable.
              </span>
            </div>
          ) : (
            <p className="text-[11.5px] text-slate-500 mt-3">
              No logo yet — the proposal falls back to a plain mark.
            </p>
          )}
        </Panel>
      );
    })}
  </div>
);

/* ================================================================ QUIVER */

const QUIVER_SECTION_IDS = ['fundamentals', 'objections', 'product', 'process', 'tools'];

const Quiver = ({ draft, edit }) => (
  <Panel
    title="Quiver — the training rack"
    note="What every rep sees under The Beach → Quiver. Progress is tracked per rep. Add a resource and it appears for everyone immediately; nothing here is per-person."
    onAdd={() => edit((d) => {
      d.quiver = d.quiver || [];
      d.quiver.push({
        id: 'q_' + Date.now(), title: 'New resource', section: 'fundamentals',
        url: '', blurb: '', duration: '', required: false
      });
    })}
  >
    {(!draft.quiver || draft.quiver.length === 0) ? (
      <p className="text-[13px] text-slate-500 py-6 text-center">
        Empty rack. Add your first training and it shows up for every rep.
      </p>
    ) : (
      <div className="space-y-3">
        {draft.quiver.map((q, i) => (
          <div key={q.id || i} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_120px_auto] gap-3 items-end">
              <Labeled label="Title">
                <Inp value={q.title} onChange={(v) => edit((d) => { d.quiver[i].title = v; })} />
              </Labeled>
              <Labeled label="Section">
                <select
                  value={q.section || 'fundamentals'}
                  onChange={(e) => edit((d) => { d.quiver[i].section = e.target.value; })}
                  className="w-full px-2 py-1.5 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px]"
                >
                  {QUIVER_SECTION_IDS.map((sid) => (
                    <option key={sid} value={sid}>{sid.charAt(0).toUpperCase() + sid.slice(1)}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Duration">
                <Inp value={q.duration || ''} placeholder="12 min"
                     onChange={(v) => edit((d) => { d.quiver[i].duration = v; })} />
              </Labeled>
              <Del onClick={() => edit((d) => d.quiver.splice(i, 1))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Labeled label="Link">
                <Inp value={q.url || ''} placeholder="https://yourenergybest.com/become/…"
                     onChange={(v) => edit((d) => { d.quiver[i].url = v; })} />
              </Labeled>
              <Labeled label="One-line description">
                <Inp value={q.blurb || ''} onChange={(v) => edit((d) => { d.quiver[i].blurb = v; })} />
              </Labeled>
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input type="checkbox" checked={!!q.required}
                     onChange={(e) => edit((d) => { d.quiver[i].required = e.target.checked; })}
                     className="w-4 h-4 accent-amber-400" />
              <span className="text-[12.5px] text-slate-300">Required for every rep</span>
            </label>
          </div>
        ))}
      </div>
    )}
  </Panel>
);

/* ============================================================= BATTERIES */

const Batteries = ({ draft, edit }) => (
  <Panel
    title="Battery catalog"
    note="Usable kWh drives the rebate and the sizing test, so it is the number that matters most. Warranty make links a pack to the shared warranty table."
    onAdd={() => edit((d) => d.batteries.push({
      id: 'custom_' + Date.now(), make: '', model: '', usableKwh: 0, warrantyMake: 'other_battery'
    }))}
  >
    <Table head={['Make', 'Model', 'Usable kWh', 'Warranty make', '']}>
      {draft.batteries.map((b, i) => (
        <tr key={b.id || i} className="border-b border-slate-800">
          <Td><Inp value={b.make} onChange={(v) => edit((d) => { d.batteries[i].make = v; })} /></Td>
          <Td><Inp value={b.model} onChange={(v) => edit((d) => { d.batteries[i].model = v; })} /></Td>
          <Td><Inp type="number" step={0.1} value={b.usableKwh}
                   onChange={(v) => edit((d) => { d.batteries[i].usableKwh = Number(v) || 0; })} /></Td>
          <Td><Inp value={b.warrantyMake || ''} placeholder="other_battery"
                   onChange={(v) => edit((d) => { d.batteries[i].warrantyMake = v; })} /></Td>
          <Td><Del onClick={() => edit((d) => d.batteries.splice(i, 1))} /></Td>
        </tr>
      ))}
    </Table>
  </Panel>
);

/* =============================================================== LENDERS */

const Lenders = ({ draft, edit }) => (
  <div className="space-y-4">
    <Panel
      title="Lenders"
      note="Each lender carries its own rate card. Rates are never shown to the customer — they only size the payment."
      onAdd={() => edit((d) => d.lenders.push({
        id: 'lender_' + Date.now(), name: 'New lender', dealerFee: 0.10,
        terms: [{ years: 20, apr: 0.0549 }], defaultTermYears: 20, prepaymentPenalty: false, notes: ''
      }))}
    >
      <div className="space-y-4">
        {draft.lenders.map((l, i) => (
          <div key={l.id || i} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_auto] gap-3 items-end mb-3">
              <Labeled label="Lender name">
                <Inp value={l.name} onChange={(v) => edit((d) => { d.lenders[i].name = v; })} />
              </Labeled>
              <Labeled label="Dealer fee %">
                <Inp type="number" step={0.5} value={(l.dealerFee * 100).toFixed(1)}
                     onChange={(v) => edit((d) => { d.lenders[i].dealerFee = (Number(v) || 0) / 100; })} />
              </Labeled>
              <Labeled label="Default term">
                <Inp type="number" value={l.defaultTermYears}
                     onChange={(v) => edit((d) => { d.lenders[i].defaultTermYears = Number(v) || 0; })} />
              </Labeled>
              <Del onClick={() => edit((d) => d.lenders.splice(i, 1))} />
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-300">Terms</span>
              <button
                onClick={() => edit((d) => d.lenders[i].terms.push({ years: 10, apr: 0.0549, minContractValue: 16500 }))}
                className="text-[12px] text-cyan-300 hover:underline flex items-center gap-1"
              ><Plus size={12} /> Add term</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(l.terms || []).map((t, ti) => (
                <div key={ti} className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-600 rounded-lg px-2 py-1.5">
                  <input type="number" value={t.years}
                    onChange={(e) => edit((d) => { d.lenders[i].terms[ti].years = Number(e.target.value) || 0; })}
                    className="w-[46px] bg-transparent text-slate-100 font-mono text-[12.5px] focus:outline-none" />
                  <span className="text-[11px] text-slate-500">yr @</span>
                  <input type="number" step={0.01} value={(t.apr * 100).toFixed(2)}
                    onChange={(e) => edit((d) => { d.lenders[i].terms[ti].apr = (Number(e.target.value) || 0) / 100; })}
                    className="w-[58px] bg-transparent text-slate-100 font-mono text-[12.5px] focus:outline-none" />
                  <span className="text-[11px] text-slate-500">% · floor</span>
                  <input type="number" step={250} value={t.minContractValue ?? ''}
                    placeholder="—"
                    onChange={(e) => edit((d) => {
                      const v = e.target.value;
                      d.lenders[i].terms[ti].minContractValue = v === '' ? undefined : Number(v) || 0;
                    })}
                    className="w-[70px] bg-transparent text-slate-100 font-mono text-[12.5px] focus:outline-none" />
                  <button onClick={() => edit((d) => d.lenders[i].terms.splice(ti, 1))}
                    className="text-slate-500 hover:text-red-400 ml-1"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input type="checkbox" checked={!!l.prepaymentPenalty}
                onChange={(e) => edit((d) => { d.lenders[i].prepaymentPenalty = e.target.checked; })}
                className="w-4 h-4 accent-cyan-400" />
              <span className="text-[12.5px] text-slate-300">Has a prepayment penalty</span>
            </label>
            <Inp className="mt-2" value={l.notes || ''} placeholder="Notes (internal)"
                 onChange={(v) => edit((d) => { d.lenders[i].notes = v; })} />
          </div>
        ))}
      </div>
    </Panel>
  </div>
);

/* ================================================================ ADDERS */

const Adders = ({ draft, edit }) => (
  <Panel
    title="Adder pricing"
    note="Flat adders are on or off. Per-unit adders bill by quantity, with the first `free` units included in the base contract. Solar-panel adders price at Amount per panel plus a Baseline that applies from Min units up to Baseline ≤, then drops away. Anything marked as blocking the rebate zeroes it everywhere downstream."
    onAdd={() => edit((d) => d.adders.push({
      id: 'adder_' + Date.now(), label: 'New adder', kind: 'flat', amount: 0
    }))}
  >
    <Table head={['Label', 'Kind', 'Amount', 'Unit', 'Free units', 'Min units', 'Baseline $', 'Baseline ≤', 'Blocks rebate', '']}>
      {draft.adders.map((a, i) => (
        <tr key={a.id || i} className="border-b border-slate-800">
          <Td><Inp value={a.label} onChange={(v) => edit((d) => { d.adders[i].label = v; })} /></Td>
          <Td>
            <select value={a.kind}
              onChange={(e) => edit((d) => { d.adders[i].kind = e.target.value; })}
              className="w-full px-2 py-1.5 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px]">
              <option value="flat">Flat</option>
              <option value="perUnit">Per unit</option>
              <option value="solarPanels">Solar panels</option>
            </select>
          </Td>
          <Td><Inp type="number" step={50} value={a.amount}
                   onChange={(v) => edit((d) => { d.adders[i].amount = Number(v) || 0; })} /></Td>
          <Td>{a.kind !== 'flat'
            ? <Inp value={a.unit || ''} placeholder="ft"
                   onChange={(v) => edit((d) => { d.adders[i].unit = v; })} />
            : <Dash />}</Td>
          <Td>{a.kind === 'perUnit'
            ? <Inp type="number" value={a.freeUnits ?? 0}
                   onChange={(v) => edit((d) => { d.adders[i].freeUnits = Number(v) || 0; })} />
            : <Dash />}</Td>
          <Td>{a.kind !== 'flat'
            ? <Inp type="number" value={a.minUnits ?? 0}
                   onChange={(v) => edit((d) => { d.adders[i].minUnits = Number(v) || 0; })} />
            : <Dash />}</Td>
          <Td>{a.kind === 'solarPanels'
            ? <Inp type="number" step={100} value={a.baselineAmount ?? 0}
                   onChange={(v) => edit((d) => { d.adders[i].baselineAmount = Number(v) || 0; })} />
            : <Dash />}</Td>
          <Td>{a.kind === 'solarPanels'
            ? <Inp type="number" value={a.baselineMaxUnits ?? 0}
                   onChange={(v) => edit((d) => { d.adders[i].baselineMaxUnits = Number(v) || 0; })} />
            : <Dash />}</Td>
          <Td>
            <input type="checkbox" checked={!!a.blocksRebate}
              onChange={(e) => edit((d) => { d.adders[i].blocksRebate = e.target.checked; })}
              className="w-4 h-4 accent-red-400" />
          </Td>
          <Td><Del onClick={() => edit((d) => d.adders.splice(i, 1))} /></Td>
        </tr>
      ))}
    </Table>
  </Panel>
);

/* ================================================================ PANELS */

const Panels = ({ draft, edit }) => (
  <Panel
    title="Solar panel options & pricing"
    note="Used by the per-panel solar add-on. Price is per panel, installed. Until a panel is added here the add-on reports its price as not set rather than guessing one."
    onAdd={() => edit((d) => d.panels.push({
      id: 'panel_' + Date.now(), make: '', model: '', watts: 0, pricePerPanel: 0, minPanels: 4, active: true
    }))}
  >
    {draft.panels.length === 0 ? (
      <p className="text-[13px] text-slate-500 py-6 text-center">
        No panel options yet. Add one and the solar add-on starts pricing.
      </p>
    ) : (
      <Table head={['Make', 'Model', 'Watts', '$ / panel', 'Min panels', 'Active', '']}>
        {draft.panels.map((p, i) => (
          <tr key={p.id || i} className="border-b border-slate-800">
            <Td><Inp value={p.make} onChange={(v) => edit((d) => { d.panels[i].make = v; })} /></Td>
            <Td><Inp value={p.model} onChange={(v) => edit((d) => { d.panels[i].model = v; })} /></Td>
            <Td><Inp type="number" value={p.watts}
                     onChange={(v) => edit((d) => { d.panels[i].watts = Number(v) || 0; })} /></Td>
            <Td><Inp type="number" step={25} value={p.pricePerPanel}
                     onChange={(v) => edit((d) => { d.panels[i].pricePerPanel = Number(v) || 0; })} /></Td>
            <Td><Inp type="number" value={p.minPanels ?? 4}
                     onChange={(v) => edit((d) => { d.panels[i].minPanels = Number(v) || 0; })} /></Td>
            <Td>
              <input type="checkbox" checked={p.active !== false}
                onChange={(e) => edit((d) => { d.panels[i].active = e.target.checked; })}
                className="w-4 h-4 accent-emerald-400" />
            </Td>
            <Td><Del onClick={() => edit((d) => d.panels.splice(i, 1))} /></Td>
          </tr>
        ))}
      </Table>
    )}
  </Panel>
);

/* ============================================================== PROGRAMS */

const Programs = ({ draft, edit }) => (
  <div className="space-y-4">
    {Object.entries(draft.programs).map(([key, p]) => (
      <Panel key={key} title={`${p.utilityLabel || key} — ${p.name || ''}`}>
        {!p.verified && (
          <p className="text-[11.5px] text-amber-400/90 mb-3">
            Marked unverified — these figures are placeholders until someone confirms them against program materials.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Labeled label="Rebate, CARE ($/kWh)">
            <Inp type="number" step={25} value={p.rebateCare}
                 onChange={(v) => edit((d) => { d.programs[key].rebateCare = Number(v) || 0; })} />
          </Labeled>
          <Labeled label="Rebate, standard ($/kWh)">
            <Inp type="number" step={25} value={p.rebateStandard}
                 onChange={(v) => edit((d) => { d.programs[key].rebateStandard = Number(v) || 0; })} />
          </Labeled>
          <Labeled label="Rebate cap ($)">
            <Inp type="number" step={500} value={p.rebateCap}
                 onChange={(v) => edit((d) => { d.programs[key].rebateCap = Number(v) || 0; })} />
          </Labeled>
          <Labeled label="Performance ($/kWh)">
            <Inp type="number" step={0.01} value={p.perfPerKwh}
                 onChange={(v) => edit((d) => { d.programs[key].perfPerKwh = Number(v) || 0; })} />
          </Labeled>
          <Labeled label="Payments run (yr)">
            <Inp type="number" value={p.perfYears}
                 onChange={(v) => edit((d) => { d.programs[key].perfYears = Number(v) || 0; })} />
          </Labeled>
          <Labeled label="Enrollment (yr)">
            <Inp type="number" value={p.enrollmentYears}
                 onChange={(v) => edit((d) => { d.programs[key].enrollmentYears = Number(v) || 0; })} />
          </Labeled>
          <div className="col-span-2 flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!p.weekdayOnly}
                onChange={(e) => edit((d) => { d.programs[key].weekdayOnly = e.target.checked; })}
                className="w-4 h-4 accent-cyan-400" />
              <span className="text-[12.5px] text-slate-300">Weekdays only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!p.verified}
                onChange={(e) => edit((d) => { d.programs[key].verified = e.target.checked; })}
                className="w-4 h-4 accent-emerald-400" />
              <span className="text-[12.5px] text-slate-300">Verified</span>
            </label>
          </div>
        </div>
      </Panel>
    ))}
  </div>
);

/* ================================================================= RATES */

const TIERS = [
  ['speak', 'Summer on-peak'], ['soff', 'Summer off-peak'], ['ssop', 'Summer super off-peak'],
  ['wpeak', 'Winter on-peak'], ['woff', 'Winter off-peak'], ['wsop', 'Winter super off-peak']
];

const Rates = ({ draft, edit }) => (
  <div className="space-y-4">
    <p className="text-[12.5px] text-slate-400">
      SDG&amp;E&rsquo;s tiers are derived from the dispatch engine&rsquo;s rate plans. Editing them here overrides that
      for the Tide model only — change the plan itself in <code className="text-slate-300">BatteryDispatch.js</code> if
      the tariff has moved.
    </p>
    {Object.entries(draft.rates).map(([util, r]) => (
      <Panel key={util} title={util}>
        {r.estimated && (
          <p className="text-[11.5px] text-amber-400/90 mb-3">
            Seasonal split is estimated for this territory. Replace with real tariff figures before quoting here.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TIERS.map(([k, label]) => (
            <Labeled key={k} label={label}>
              <Inp type="number" step={0.001} value={r[k] ?? 0}
                   onChange={(v) => edit((d) => { d.rates[util][k] = Number(v) || 0; })} />
            </Labeled>
          ))}
        </div>
        <p className="text-[11.5px] text-slate-500 mt-3">
          Arbitrage spread: {money((r.speak - r.ssop) * 100)}&cent;/kWh summer,{' '}
          {money((r.wpeak - r.wsop) * 100)}&cent;/kWh winter.
        </p>
      </Panel>
    ))}
  </div>
);

/* =============================================================== helpers */

const Panel = ({ title, note, onAdd, children }) => (
  <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
    <div className="flex items-start justify-between gap-4 mb-3">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-100">{title}</h3>
        {note && <p className="text-[11.5px] text-slate-500 mt-1 max-w-3xl">{note}</p>}
      </div>
      {onAdd && (
        <button onClick={onAdd}
          className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-slate-800 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/10 flex items-center gap-1.5 shrink-0">
          <Plus size={13} /> Add
        </button>
      )}
    </div>
    {children}
  </div>
);

const Table = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="text-slate-400 border-b border-slate-700">
          {head.map((h, i) => (
            <th key={i} className="text-left font-medium text-[11.5px] pb-2 pr-2">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const Td = ({ children }) => <td className="py-1.5 pr-2 align-middle">{children}</td>;

const Inp = ({ value, onChange, type = 'text', step, placeholder, className = '' }) => (
  <input
    type={type} step={step} value={value ?? ''} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full px-2 py-1.5 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px] ${
      type === 'number' ? 'font-mono' : ''
    } ${className}`}
  />
);

const Labeled = ({ label, children }) => (
  <div>
    <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
    {children}
  </div>
);

const Dash = () => <span className="text-slate-600 text-[12px]">—</span>;

const Del = ({ onClick }) => (
  <button onClick={onClick} className="text-slate-500 hover:text-red-400 p-1.5" title="Remove">
    <Trash2 size={14} />
  </button>
);

export default AdminSettings;
