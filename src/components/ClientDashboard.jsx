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
const ClientDashboard = ({ onOpen, userEmail, role, onSignOut, hideHeader = false, onRole }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      if (statusFilter !== 'all' && (c.lifecycleStage || '').toLowerCase() !== statusFilter) return false;
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
        case 'installDate': return c.installDate || '';
        case 'lastReportSent': return c.lastReportSent || '';
        case 'annualSavings': return c.annualSavings;
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
  }, [clients, search, statusFilter, sortBy, sortDir, trueUpOnly]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1e36] to-[#0a1628] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        {!hideHeader ? (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users size={28} className="text-amber-400" />
              <div>
                <h1 className="text-2xl font-bold text-amber-300">Client Monitoring</h1>
                <p className="text-slate-400 text-sm">
                  {role === 'admin' ? 'All clients' : role === 'rep' ? 'Your test client (more coming soon)' : 'Your clients'} · {clients.length} total
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
                <p className="text-slate-300 mb-1">No clients found in Zoho yet.</p>
                <p className="text-sm">Once you add Contacts in Zoho, they'll appear here. Use the Sandbox tab to explore the tools meanwhile.</p>
              </>
            ) : trueUpOnly ? (
              'No clients currently owe a true-up.'
            ) : (
              'No clients match your search.'
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="text-left bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 hover:border-amber-400/50 hover:bg-slate-800/80 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {c.fullName || '(no name)'}
                    </div>
                    {c.email && (
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-1 truncate">
                        <Mail size={11} className="shrink-0" /> <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.city && (
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {c.city} {c.zip}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(c); } }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-slate-700/60"
                      title="Edit contact info"
                    >
                      <MoreVertical size={16} />
                    </span>
                    <ChevronRight size={18} className="text-slate-600 group-hover:text-amber-400 shrink-0" />
                  </div>
                </div>

                {/* Sort-relevant data footer */}
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {c.installDate && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Calendar size={10} /> Installed {c.installDate}
                    </div>
                  )}
                  {c.lastReportSent ? (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Mail size={10} /> Report {c.lastReportSent}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Mail size={10} /> No report sent
                    </div>
                  )}
                  {c.annualSavings != null && (
                    <div className="flex items-center gap-1 text-green-300/80">
                      <DollarSign size={10} /> ${c.annualSavings.toLocaleString()}/yr saved
                    </div>
                  )}
                  {c.nemAmount != null && (
                    <div className={`flex items-center gap-1 ${c.nemType === 'credit' ? 'text-green-300/80' : 'text-red-300/80'}`}>
                      <DollarSign size={10} />
                      {c.nemType === 'credit'
                        ? `+$${c.nemAmount.toLocaleString()} credit`
                        : `−$${c.nemAmount.toLocaleString()} owed`}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {c.lifecycleStage && (
                    <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-700/60 text-amber-200/80">
                      {c.lifecycleStage}
                    </span>
                  )}
                  {c.nemType === 'trueup' && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/20 text-red-200 border border-red-400/40">
                      <Zap size={9} /> Battery target
                    </span>
                  )}
                </div>
              </button>
            ))}
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
