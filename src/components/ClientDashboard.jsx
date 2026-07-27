import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, MapPin, Mail, ChevronRight, Users, RefreshCw, AlertCircle,
  ArrowUp, ArrowDown, Calendar, DollarSign, Zap, MoreVertical
} from 'lucide-react';
import { apiFetch } from '../lib/supabaseClient';
import ContactFormModal from './ContactFormModal';

/**
 * Client Dashboard — pulls the caller's clients from /api/clients (role-scoped
 * server-side), then sorts/filters client-side. Clicking a client calls onOpen.
 */
const ClientDashboard = ({ onOpen, userEmail, role, onSignOut, hideHeader = false, onRole, onLoaded }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projStatusFilter, setProjStatusFilter] = useState('all');
  const [oppFilter, setOppFilter] = useState('all');
  const [batteryOnly, setBatteryOnly] = useState(false);
  const [bucket, setBucket] = useState('all'); // all | notsigned | signed
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [trueUpOnly, setTrueUpOnly] = useState(false);
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

  // How many owe a true-up — drives the upsell-target badge.
  const trueUpCount = useMemo(
    () => clients.filter((c) => c.nemType === 'trueup').length,
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = clients.filter((c) => {
      if (trueUpOnly && c.nemType !== 'trueup') return false;
      if (bucket === 'notsigned' && (c.lifecycleStage || '') !== 'Prospect') return false;
      if (bucket === 'signed' && (c.projectStatus || '') !== 'Pre-PTO') return false;
      if (statusFilter !== 'all' && (c.lifecycleStage || '').toLowerCase() !== statusFilter) return false;
      if (projStatusFilter !== 'all' && (c.projectStatus || '') !== projStatusFilter) return false;
      if (oppFilter !== 'all') {
        const opp = c.opportunityType || 'Solar Owner – Audit / Review';
        if (opp !== oppFilter) return false;
      }
      if (batteryOnly && !(c.nemType === 'trueup' && (c.nemAmount || 0) >= 300)) return false;
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
  }, [clients, search, statusFilter, projStatusFilter, oppFilter, batteryOnly, bucket, sortBy, sortDir, trueUpOnly]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1e36] to-[#0a1628] p-6">
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

        {/* Search + filter + sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex gap-1 mb-3">
          {[['all', 'All Clients'], ['notsigned', 'Not Signed'], ['signed', 'Signed · Pre-PTO']].map(([k, label]) => (
            <button key={k} onClick={() => setBucket(k)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold border-b-2 ${bucket === k
                ? 'text-amber-300 border-amber-400 bg-slate-800/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or city…"
              className="w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100 focus:border-amber-400/60 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100"
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
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800/80 border border-slate-600 text-purple-300 cursor-pointer" title="Only clients owing $300+/yr — battery prospects">
            <input type="checkbox" checked={batteryOnly} onChange={(e) => setBatteryOnly(e.target.checked)} className="w-3.5 h-3.5 accent-purple-400" />
            🔋 Battery targets
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-100"
            title="Sort by"
          >
            <option value="name">Sort: Name</option>
            <option value="installDate">Sort: Install Date</option>
            <option value="lastReportSent">Sort: Last Report Sent</option>
            <option value="annualSavings">Sort: Annual Savings</option>
            <option value="creditOwe">Sort: Annual Credit / Owe</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="px-3 py-2.5 border border-slate-600 rounded-lg bg-slate-900/70 text-slate-300 hover:text-amber-300 flex items-center gap-1"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
        </div>

        {/* True-up upsell-target filter */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              const next = !trueUpOnly;
              setTrueUpOnly(next);
              if (next) { setSortBy('creditOwe'); setSortDir('asc'); }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all border ${
              trueUpOnly
                ? 'bg-red-500/20 border-red-400/60 text-red-200'
                : 'bg-slate-800/60 border-slate-600 text-slate-300 hover:text-red-200 hover:border-red-400/40'
            }`}
            title="Show only clients who owe an annual true-up — your battery upsell targets"
          >
            <Zap size={15} className={trueUpOnly ? 'text-red-300' : 'text-amber-400'} />
            {trueUpOnly ? 'Showing true-up clients' : 'Battery targets (true-up only)'}
          </button>
          <span className="text-xs text-slate-500">
            {trueUpCount} of {clients.length} owe a true-up
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
            ) : trueUpOnly ? (
              'No clients currently owe a true-up.'
            ) : (
              'No clients match your search.'
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl overflow-x-auto">
            <table className="w-full text-[12.5px] leading-tight">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700/80 select-none">
                  {[
                    ['name', 'Name'],
                    [null, 'Street Address'],
                    ['zip', 'Zip'],
                    ['installDate', 'PTO Date'],
                    ['creditOwe', 'Est. True-Up'],
                    [null, 'Battery Target'],
                    [null, 'Status'],
                    [null, 'Opportunity'],
                    [null, '⭐'],
                    ['annualSavings', 'Savings/yr'],
                    [null, 'Finance'],
                    ['systemSizeKw', 'kW'],
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
                  const batteryTarget = c.nemType === 'trueup' && (c.nemAmount || 0) >= 300;
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
                      <td className={`px-3 py-1.5 whitespace-nowrap font-semibold ${c.nemAmount == null ? 'text-slate-600' : c.nemType === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                        {c.nemAmount == null ? '—' : c.nemType === 'credit' ? `+$${c.nemAmount.toLocaleString()}` : `−$${c.nemAmount.toLocaleString()}`}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {batteryTarget
                          ? <span className="text-purple-300 font-semibold">🔋 Yes</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300">{c.projectStatus || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-400 max-w-[150px] truncate">{(c.opportunityType || 'Audit / Review').replace('Solar Owner – ', '')}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-center">{c.leftReview ? <span title="Left a 5-star review">⭐</span> : <span className="text-slate-600" title="No review yet — ask!">☆</span>}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-green-300/90">
                        {c.annualSavings != null ? `$${c.annualSavings.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-400 max-w-[130px] truncate">{c.financeProvider || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{c.systemSizeKw != null ? c.systemSizeKw : '—'}</td>
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
