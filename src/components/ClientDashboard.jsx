import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, MapPin, Mail, ChevronRight, Users, RefreshCw, AlertCircle,
  ArrowUp, ArrowDown, Calendar, DollarSign, Zap, MoreVertical
} from 'lucide-react';
import { checkReportEligibility } from '../tech/reportEligibility';
import { apiFetch } from '../lib/supabaseClient';
import ContactFormModal from './ContactFormModal';

/**
 * FILE: src/components/ClientDashboard.jsx
 *
 * CLIENT DASHBOARD — the book of records, not the book of deals.
 *
 * Pulls the caller's clients from /api/clients (role-scoped server-side), then
 * sorts and filters client-side. Clicking a client opens their audit.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN IS FOR, NOW THAT THE PIPELINE EXISTS
 *
 * It used to open with three tabs — All Clients / Not Signed / Signed · Pre-PTO
 * — which made it a deal board. The Pipeline is the deal board, and two screens
 * answering "where is this deal" is how they end up disagreeing. So the tabs are
 * gone and this screen answers the question only it can: who is on the books,
 * what do they already have, and who is worth a call.
 *
 * Which is why the columns are what they are: identity (name, address, zip),
 * their existing system (PTO date), the number that makes them a prospect
 * (estimated true-up), what kind of opportunity they are, and the follow-up
 * facts (review, last contacted, whose client this is).
 *
 * HIDDEN IS NOT GONE. Savings, finance provider and system size are still
 * sortable and searchable while switched off — the column menu controls what is
 * rendered, not what the screen knows.
 */
const ClientDashboard = ({
  onOpen, userEmail, role, onSignOut, hideHeader = false, onRole, onLoaded,
  /**
   * Rows to start with, instead of an empty table awaiting the fetch.
   *
   * The fetch runs in an effect, and effects do not run during a server render —
   * so without this the only reachable state of this screen in a render check is
   * the spinner, and the table, its column alignment and every cell in it go
   * untested. Nothing in the app passes it; scripts/render-check.mjs does.
   */
  initialClients = null,
  /** Which optional columns start switched on. The same test seam as above. */
  initialShowCols = null
}) => {
  const [clients, setClients] = useState(initialClients || []);
  const [loading, setLoading] = useState(!initialClients);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projStatusFilter, setProjStatusFilter] = useState('all');
  const [oppFilter, setOppFilter] = useState('all');
  /**
   * BATTERY TARGETS — one control, not two.
   *
   * There were two, both called battery targets: a checkbox for "owes a true-up
   * of $300+" and a button for "owes a true-up at all". Two filters with the
   * same name and different rules, so which one a rep had on changed the answer
   * with nothing on screen explaining why.
   *
   * The $300 rule is the one that means anything — a $40 true-up is not a
   * battery prospect — so that is the one that survived.
   */
  const [batteryOnly, setBatteryOnly] = useState(false);
  const [createdByFilter, setCreatedByFilter] = useState('all');
  // Default view: whatever you touched most recently, first. A rep's working
  // set is almost always "what I was just in", not an alphabetical list.
  const [sortBy, setSortBy] = useState('lastModified');
  const [sortDir, setSortDir] = useState('desc');
  const [notReportReady, setNotReportReady] = useState(false);
  // Columns off by default to keep the table scannable. Everything is still
  // sortable and searchable — this only controls what's rendered.
  const [showCols, setShowCols] = useState(
    { savings: false, finance: false, kw: false, status: false, ...(initialShowCols || {}) }
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // client for the edit modal

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/clients');
      setClients(data.clients || []);
      if (onRole && data.role) onRole(data.role);
      if (onLoaded) onLoaded(data.clients || [], data.role);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /** The battery-target rule, defined once and used by the filter and the count. */
  const isBatteryTarget = (c) => c.nemType === 'trueup' && (c.nemAmount || 0) >= 300;

  const targetCount = useMemo(() => clients.filter(isBatteryTarget).length, [clients]);

  /**
   * Who created these records, for the Created By filter.
   *
   * Derived from the loaded rows rather than fetched, so it offers only creators
   * who actually appear — and it self-hides for a rep, whose book is all their
   * own and would show a one-option dropdown.
   */
  const creators = useMemo(() => {
    const set = new Set();
    for (const c of clients) if (c.createdBy) set.add(c.createdBy);
    return [...set].sort();
  }, [clients]);

  // Report readiness — same gate the automated send uses, so what a rep sees
  // here is exactly who would (and wouldn't) receive mail.
  const readiness = useMemo(() => {
    const m = new Map();
    for (const c of clients) {
      m.set(c.id, checkReportEligibility({
        name: c.fullName, email: c.email,
        annualProduction: c.annualProduction, currentAnnualUsage: c.currentAnnualUsage,
        nemVersion: c.nemVersion, installDate: c.installDate, ptoDate: c.ptoDate,
        systemSize: c.systemSizeKw
      }));
    }
    return m;
  }, [clients]);

  const notReadyCount = useMemo(
    () => clients.filter((c) => readiness.get(c.id) && !readiness.get(c.id).eligible).length,
    [clients, readiness]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = clients.filter((c) => {
      if (notReportReady) { const r = readiness.get(c.id); if (!r || r.eligible) return false; }
      if (createdByFilter !== 'all' && (c.createdBy || '') !== createdByFilter) return false;
      if (statusFilter !== 'all' && (c.lifecycleStage || '').toLowerCase() !== statusFilter) return false;
      if (projStatusFilter !== 'all' && (c.projectStatus || '') !== projStatusFilter) return false;
      if (oppFilter !== 'all') {
        const opp = c.opportunityType || 'Solar Owner – Audit / Review';
        if (opp !== oppFilter) return false;
      }
      if (batteryOnly && !isBatteryTarget(c)) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (c) => {
      switch (sortBy) {
        case 'installDate': return c.ptoDate || c.installDate || '';
        case 'lastReportSent': return c.lastReportSent || '';
        case 'lastModified': return c.lastModified || '';
        case 'projectStatus': return (c.projectStatus || '').toLowerCase();
        case 'annualSavings': return c.annualSavings;
        case 'zip': return c.zip || '';
        case 'systemSizeKw': return c.systemSizeKw;
        case 'creditOwe':
          if (c.nemAmount == null) return null;
          return c.nemType === 'trueup' ? -c.nemAmount : c.nemAmount;
        case 'name':
        default: return (c.lastName || c.fullName || '').toLowerCase();
      }
    };
    return [...list].sort((a, b) => {
      const av = val(a), bv = val(b);
      const aNull = av == null || av === '';
      const bNull = bv == null || bv === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [clients, search, statusFilter, projStatusFilter, oppFilter, batteryOnly,
      createdByFilter, sortBy, sortDir, notReportReady, readiness]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        {!hideHeader ? (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users size={28} className="text-amber-400" />
              <div>
                <h1 className="text-2xl font-bold text-amber-300">Client Monitoring</h1>
                <p className="text-slate-400 text-sm">
                  {role === 'admin' ? 'All clients' : role === 'rep' ? 'Your clients' : 'Your clients'} · {clients.length} total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 hidden sm:block">{userEmail}</span>
              <button onClick={load} className="p-2 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 hover:text-amber-300" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button onClick={onSignOut} className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 text-sm hover:text-amber-300">
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users size={24} className="text-amber-400" />
              <h1 className="text-xl font-bold text-amber-300">
                {role === 'admin' ? 'All clients' : 'Your clients'} · {clients.length}
              </h1>
            </div>
            <button onClick={load} className="p-2 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 hover:text-amber-300" title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {/* ------------------------- search, then filters -------------------------
            Search sits above the filters on its own full-width row. It is the
            control reached for most often and the one whose content is longest,
            so burying it in a wrapping row of dropdowns cost a rep a scan of the
            whole bar every time they wanted it. */}
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or city…"
              className="w-full pl-11 pr-3 py-3 text-[15px] border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 focus:border-amber-400/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-3 text-sm border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100"
              title="Sort by"
            >
              <option value="lastModified">Sort: Last Edited</option>
              <option value="name">Sort: Name</option>
              <option value="zip">Sort: Zip</option>
              <option value="installDate">Sort: PTO Date</option>
              <option value="annualSavings">Sort: Annual Savings</option>
              <option value="creditOwe">Sort: Est. True-Up</option>
              <option value="lastReportSent">Sort: Last Contacted</option>
              <option value="projectStatus">Sort: Status</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-3 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-300 hover:text-amber-300"
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>
            <div className="relative">
              <button
                onClick={() => setColMenuOpen((v) => !v)}
                className="px-3 py-3 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-300 hover:text-amber-300 text-sm whitespace-nowrap"
                title="Show or hide optional columns"
              >
                Columns
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 mt-1 z-20 w-52 rounded-lg border border-slate-600 bg-abyss-2 shadow-xl p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 pb-1">Optional columns</div>
                  {[['savings', 'Savings / yr'], ['finance', 'Finance provider'], ['kw', 'System size (kW)'], ['status', 'Project status']].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 px-1 py-1.5 text-sm text-slate-200 cursor-pointer hover:text-amber-300">
                      <input
                        type="checkbox"
                        checked={!!showCols[k]}
                        onChange={(e) => setShowCols((p) => ({ ...p, [k]: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-amber-400"
                      />
                      {label}
                    </label>
                  ))}
                  <p className="text-[10px] text-slate-500 px-1 pt-1.5 leading-snug">
                    Hidden columns are still sortable and searchable.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200"
          >
            <option value="all">All stages</option>
            <option value="client">Client</option>
            <option value="prospect">Prospect</option>
            <option value="past client">Past Client</option>
          </select>
          <select
            value={projStatusFilter}
            onChange={(e) => setProjStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200"
            title="Filter by project status"
          >
            <option value="all">Status: all</option>
            {['Pre-PTO', 'PTO-Approved', 'Service Client', 'Battery Installed', 'HVAC Installed', 'Abandoned', 'Cancelled/Lost'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            value={oppFilter}
            onChange={(e) => setOppFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200"
            title="Filter by opportunity type (blank records count as Audit / Review)"
          >
            <option value="all">Opportunity: all</option>
            {['New Solar Install','Solar Owner – Add Battery','Solar Owner – Audit / Review','Solar Owner – Service / Repair','Solar Owner – Under Service Plan','HVAC Only (future-proofing)','Other'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {/* CREATED BY. Only offered when there is more than one creator in the
              book — a rep whose every client is their own gets a dropdown with a
              single option, which is a control that cannot do anything. */}
          {creators.length > 1 && (
            <select
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200"
              title="Filter by who created the record"
            >
              <option value="all">Created by: anyone</option>
              {creators.map((v) => (
                <option key={v} value={v}>{v.split('@')[0]}</option>
              ))}
            </select>
          )}
          <label
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border cursor-pointer ${
              batteryOnly
                ? 'bg-purple-500/20 border-purple-400/60 text-purple-200'
                : 'bg-slate-800/80 border-slate-600 text-purple-300'
            }`}
            title="Only clients owing $300+/yr on their true-up — the battery prospects"
          >
            <input
              type="checkbox"
              checked={batteryOnly}
              onChange={(e) => {
                const next = e.target.checked;
                setBatteryOnly(next);
                // Biggest true-up first — the order a rep would call them in.
                if (next) { setSortBy('creditOwe'); setSortDir('asc'); }
              }}
              className="w-3.5 h-3.5 accent-purple-400"
            />
            🔋 Battery targets
          </label>
          <button
            onClick={() => setNotReportReady((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 border transition-all ${
              notReportReady
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:text-amber-200 hover:border-amber-400/40'
            }`}
            title="Clients whose CRM record is too incomplete to send an automated report"
          >
            <AlertCircle size={15} className={notReportReady ? 'text-amber-300' : 'text-slate-400'} />
            Not report-ready
          </button>
          {(statusFilter !== 'all' || projStatusFilter !== 'all' || oppFilter !== 'all'
            || createdByFilter !== 'all' || batteryOnly || notReportReady || search) && (
            <button
              onClick={() => {
                setStatusFilter('all'); setProjStatusFilter('all'); setOppFilter('all');
                setCreatedByFilter('all'); setBatteryOnly(false); setNotReportReady(false); setSearch('');
              }}
              className="text-xs underline text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {filtered.length} of {clients.length} · {targetCount} battery target{targetCount === 1 ? '' : 's'}
            {notReadyCount > 0 && <span className="text-amber-400/80"> · {notReadyCount} not report-ready</span>}
          </span>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-400/40 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm text-red-200">
              {error}
              <div className="text-xs text-red-300/70 mt-1">
                If this mentions configuration, the Zoho or Supabase env vars may not be set in Vercel yet.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-amber-400" />
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            {clients.length === 0 ? (
              <>
                <p className="text-slate-300 mb-1">
                  {role === 'client'
                    ? "We couldn't find your system yet."
                    : role === 'rep'
                      ? "You haven't created any clients yet."
                      : 'No clients found in Zoho yet.'}
                </p>
                <p className="text-sm">
                  {role === 'client'
                    ? 'If you recently went solar with us, your records may still be syncing. Reach out to your rep and we’ll get it connected.'
                    : role === 'rep'
                      ? 'Use “Create Client” to add your first one — it’ll show up here under your name. Try the Sandbox tab to explore the tools meanwhile.'
                      : "Once you add Contacts in Zoho, they'll appear here. Use the Sandbox tab to explore the tools meanwhile."}
                </p>
              </>
            ) : batteryOnly ? (
              'No clients owe $300 or more a year — no battery targets in this book.'
            ) : (
              'No clients match your search.'
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl overflow-x-auto">
            <table className="w-full text-[12.5px] leading-tight">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700/80 select-none">
                  {/* THE COLUMN SET.
                      Identity, then the existing system, then the number that
                      makes someone a prospect, then the follow-up facts. Battery
                      Target came out because it restated the true-up column
                      beside it — a Yes in one cell and the figure it was derived
                      from in the next. Project status came out of the default view
                      and is available in the column menu: it is the Pipeline's
                      subject, and this screen is not the deal board. */}
                  {[
                    ['name', 'Name'],
                    [null, 'Address'],
                    ['zip', 'Zip'],
                    // Labelled as the EXISTING system's date, because a screen
                    // that also shows deals being sold makes a bare "PTO Date"
                    // ambiguous about which system it belongs to.
                    ['installDate', 'Existing PTO'],
                    ['creditOwe', 'Est. True-Up'],
                    [null, 'Opportunity'],
                    [null, '⭐'],
                    ...(showCols.status  ? [['projectStatus', 'Status']] : []),
                    ...(showCols.savings ? [['annualSavings', 'Savings/yr']] : []),
                    ...(showCols.finance ? [[null, 'Finance']] : []),
                    ...(showCols.kw      ? [['systemSizeKw', 'kW']] : []),
                    ['lastReportSent', 'Last Contacted'],
                    [null, 'Created By'],
                    [null, '']
                  ].map(([key, label], i) => (
                    <th
                      key={i}
                      onClick={() => {
                        if (!key) return;
                        if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        else { setSortBy(key); setSortDir(key === 'name' || key === 'zip' ? 'asc' : 'desc'); }
                      }}
                      className={`px-3 py-2 font-semibold whitespace-nowrap ${key ? 'cursor-pointer hover:text-amber-300' : ''}`}
                    >
                      {label}{key && sortBy === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const batteryTarget = isBatteryTarget(c);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onOpen(c.id)}
                      className="border-b border-slate-800/70 hover:bg-slate-800/60 cursor-pointer group"
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap font-medium text-slate-100">
                        {c.fullName || '(no name)'}
                        {c.lifecycleStage === 'Prospect' && <span className="ml-1.5 text-[10px] text-sky-400">prospect</span>}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300 max-w-[220px] truncate">{c.street || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{c.zip || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300">{c.ptoDate || c.installDate || '—'}</td>
                      {/* The true-up, with the battery-target mark on it rather
                          than in a column of its own. A target IS a true-up over
                          $300, so the flag belongs on the figure it comes from. */}
                      <td className={`px-3 py-1.5 whitespace-nowrap font-semibold ${c.nemAmount == null ? 'text-slate-600' : c.nemType === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                        {c.nemAmount == null ? '—' : c.nemType === 'credit' ? `+$${c.nemAmount.toLocaleString()}` : `−$${c.nemAmount.toLocaleString()}`}
                        {batteryTarget && <span className="ml-1" title="Battery target — owes $300+ a year">🔋</span>}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-400 max-w-[150px] truncate">{(c.opportunityType || 'Audit / Review').replace('Solar Owner – ', '')}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-center">{c.leftReview ? <span title="Left a 5-star review">⭐</span> : <span className="text-slate-600" title="No review yet — ask!">☆</span>}</td>
                      {showCols.status && (
                        <td className="px-3 py-1.5 whitespace-nowrap text-slate-300">{c.projectStatus || '—'}</td>
                      )}
                      {showCols.savings && (
                        <td className="px-3 py-1.5 whitespace-nowrap text-green-300/90">
                          {c.annualSavings != null ? `$${c.annualSavings.toLocaleString()}` : '—'}
                        </td>
                      )}
                      {showCols.finance && (
                        <td className="px-3 py-1.5 whitespace-nowrap text-slate-400 max-w-[130px] truncate">{c.financeProvider || '—'}</td>
                      )}
                      {showCols.kw && (
                        <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{c.systemSizeKw != null ? c.systemSizeKw : '—'}</td>
                      )}
                      <td className={`px-3 py-1.5 whitespace-nowrap ${c.lastReportSent ? 'text-slate-300' : 'text-amber-500/80'}`}>
                        {c.lastReportSent || 'never'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 max-w-[120px] truncate" title={c.createdBy || 'Imported / owner'}>
                        {c.createdBy ? c.createdBy.split('@')[0] : '—'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(c); } }}
                          className="inline-flex p-1 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-slate-700/60"
                          title="Edit contact info"
                        >
                          <MoreVertical size={15} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ContactFormModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
};

export default ClientDashboard;
