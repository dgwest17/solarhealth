import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Mail, ChevronRight, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/supabaseClient';

/**
 * Client Dashboard — pulls the caller's clients from /api/clients (role-scoped
 * server-side) and renders a searchable grid. Clicking a client calls onOpen.
 */
const ClientDashboard = ({ onOpen, userEmail, role, onSignOut, hideHeader = false }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/clients');
      setClients(data.clients || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && (c.lifecycleStage || '').toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter]);

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
                  {role === 'admin' ? 'All clients' : 'Your clients'} · {clients.length} total
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

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                  <ChevronRight size={18} className="text-slate-600 group-hover:text-amber-400 shrink-0" />
                </div>
                {c.lifecycleStage && (
                  <span className="inline-block mt-3 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-700/60 text-amber-200/80">
                    {c.lifecycleStage}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
