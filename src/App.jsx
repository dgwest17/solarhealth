import React, { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase, apiFetch } from './lib/supabaseClient';
import LoginScreen from './components/LoginScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import ClientDashboard from './components/ClientDashboard';
import AdminSettings from './admin/AdminSettings';
import TheBeach from './beach/TheBeach';
import SolarCalculator from './SolarCalculator';
import SharedProposalView from './proposal/SharedProposalView';
import { ArrowLeft, RefreshCw, AlertCircle, FlaskConical, SlidersHorizontal } from 'lucide-react';
import { Beach as BeachIcon } from './surf/SurfIcons';

/**
 * Top-level router for the Monitoring side.
 *
 *   not authenticated  -> LoginScreen
 *   authenticated      -> ClientDashboard (role-scoped list)
 *   client selected    -> SolarCalculator prefilled from that client's Zoho data
 *
 * The plain audit tool (standalone calculator) is still available to admins
 * via the dashboard, but the default authenticated view is the client list.
 */
/**
 * A shared proposal link (?proposal=<token>) renders BEFORE any auth gate.
 *
 * The customer has no login and never will — the link is the credential. Read
 * once at module scope so a re-render cannot lose it, and so the rest of App
 * never has to think about it.
 */
const SHARE_TOKEN = (() => {
  try {
    const t = new URLSearchParams(window.location.search).get('proposal');
    return t && /^[a-f0-9]{64}$/i.test(t) ? t : null;
  } catch { return null; }
})();

export default function App() {
  const { user, loading, configured, passwordRecovery, clearPasswordRecovery } = useAuth();

  const [selectedId, setSelectedId] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState('');
  const [role, setRole] = useState('client');
  /**
   * 'clients' | 'audit' | 'sandbox' | 'beach' | 'admin'
   *
   * The open client's audit is a VIEW, not a mode that pre-empts the others.
   * It used to be the latter: `if (selectedId) return <audit>` sat above every
   * view check, so with a client open no other view could render. That is why
   * ProjectSteps was unreachable — its view existed, nothing navigated to it,
   * and navigating to it would not have worked anyway.
   *
   * Big Wave is a TAB inside the audit rather than a view here, because it is
   * about one client like every other tab in there, and a top-level tab that
   * only works when a client happens to be open reads as broken the first
   * time somebody clicks it from the dashboard.
   */
  const [view, setView] = useState('clients');

  const openClient = useCallback(async (id) => {
    setSelectedId(id);
    setView('audit');
    setLoadingClient(true);
    setClientError('');
    setClientData(null);
    try {
      const data = await apiFetch(`/api/client?id=${encodeURIComponent(id)}`);
      setClientData(data);
      setRole(data.role || 'client');
    } catch (e) {
      setClientError(e.message);
    } finally {
      setLoadingClient(false);
    }
  }, []);

  const backToDashboard = () => {
    setSelectedId(null);
    setClientData(null);
    setClientError('');
    setView('clients');
  };

  // A client owns exactly one record — open it directly instead of showing a
  // one-row list. Guarded so "Back" doesn't immediately re-open it (a client
  // can still land on their own dashboard row if they navigate back).
  const [autoOpened, setAutoOpened] = useState(false);
  const handleDashboardLoaded = useCallback((list, loadedRole) => {
    if (loadedRole === 'client' && !autoOpened && list && list.length === 1) {
      setAutoOpened(true);
      openClient(list[0].id);
    }
  }, [autoOpened, openClient]);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    backToDashboard();
  };

  // A shared proposal takes over the screen entirely, and comes before the
  // auth gates: the customer holding this link has no account. After the hooks,
  // for the same reason as password recovery below.
  if (SHARE_TOKEN) {
    return <SharedProposalView token={SHARE_TOKEN} />;
  }

  // Password-recovery link takes over the screen. Must come AFTER all hooks —
  // an early return above hooks changes hook order between renders (React #300).
  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={clearPasswordRecovery} />;
  }

  // ---- Auth gates ----
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6">
        <div className="max-w-md bg-slate-800/60 border border-amber-400/20 rounded-2xl p-8 text-center">
          <AlertCircle size={32} className="text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-amber-300 mb-2">Setup needed</h1>
          <p className="text-slate-300 text-sm">
            Add <code className="text-amber-200">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> to your environment,
            then redeploy to enable secure login.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // ---- Authenticated: client detail (audit) ----
  if (selectedId && view === 'audit') {
    if (loadingClient) {
      return (
        <div className="min-h-screen bg-[#0a1628] flex items-center justify-center text-slate-300">
          <RefreshCw size={24} className="animate-spin text-amber-400 mr-3" /> Loading client audit…
        </div>
      );
    }
    if (clientError) {
      return (
        <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6">
          <div className="max-w-md bg-red-900/20 border border-red-400/40 rounded-xl p-6 text-center">
            <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-200 text-sm mb-4">{clientError}</p>
            <button onClick={backToDashboard} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm">
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    if (clientData) {
      const label = clientData.contact?.fullName || clientData.contact?.email || '';
      const isClientView = role === 'client';
      return (
        <div>
          <div className="bg-[#0a1628] px-6 pt-4 flex items-center justify-between print:hidden">
            {isClientView ? (
              <>
                <span className="text-amber-300 font-bold text-sm tracking-wide">Your Energy Best</span>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 text-sm hover:text-amber-300"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={backToDashboard}
                className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200"
              >
                <ArrowLeft size={16} /> Back to all clients
              </button>
            )}
          </div>
          <SolarCalculator
            prefilledInputs={clientData.auditInputs}
            clientLabel={label}
            clientContext={clientData.contact ? {
              contactId: clientData.contact.id,
              projectId: clientData.project ? clientData.project.id : null,
              // Reps can write to clients they own; the server re-checks
              // ownership on every write, so this only controls what's shown.
              // The dashboard already scopes a rep's list to their own clients,
              // so anything they can open here is theirs to edit.
              canWrite: (role === 'admin' || role === 'rep') && !!clientData.project,
              viewerRole: role,
              name: clientData.contact.fullName || clientData.contact.email || '',
              contact: clientData.contact,
              address: [clientData.contact.street, clientData.contact.city, clientData.contact.state, clientData.contact.zip].filter(Boolean).join(', '),
              // Big Wave is a tab inside the audit now, so "Open proposal"
              // is handled by SolarCalculator switching its own tab. Nothing
              // to route at this level.
              project: clientData.project || null,
              repEmail: user.email
            } : null}
          />
        </div>
      );
    }
  }


  // ---- Authenticated: The Beach (rep centre) ----
  if (view === 'beach') {
    return (
      <div>
        <NavBar view={view} setView={setView} userEmail={user.email} onSignOut={signOut} role={role} hasClient={!!clientData} />
        <TheBeach role={role} userEmail={user.email} onOpenClient={openClient} />
      </div>
    );
  }

  // ---- Authenticated: admin defaults ----
  if (view === 'admin') {
    return (
      <div>
        <NavBar view={view} setView={setView} userEmail={user.email} onSignOut={signOut} role={role} hasClient={!!clientData} />
        <AdminSettings role={role} />
      </div>
    );
  }

  // ---- Authenticated: sandbox (no client attached) ----
  if (view === 'sandbox') {
    return (
      <div>
        <NavBar view={view} setView={setView} userEmail={user.email} onSignOut={signOut} role={role} hasClient={!!clientData} />
        <SolarCalculator onOpenClient={openClient} canSaveClient={role === 'admin' || role === 'rep'} />
      </div>
    );
  }

  // ---- Authenticated: dashboard ----
  return (
    <div>
      <NavBar view={view} setView={setView} userEmail={user.email} onSignOut={signOut} role={role} hasClient={!!clientData} />
      <ClientDashboard
        onOpen={openClient}
        userEmail={user.email}
        role={role}
        onSignOut={signOut}
        onRole={setRole}
        onLoaded={handleDashboardLoaded}
        hideHeader
      />
    </div>
  );
}

/**
 * Top navigation bar: switch between the Clients dashboard and the
 * standalone Sandbox (audit + battery tools with no client data).
 */
function NavBar({ view, setView, userEmail, onSignOut, role, hasClient = false }) {
  const isStaff = role === 'admin' || role === 'rep';
  return (
    <div className="bg-[#0a1628] border-b border-amber-400/20 px-6 py-3 flex items-center justify-between print:hidden">
      <div className="flex items-center gap-2">
        {isStaff ? (
          <>
            <button
              onClick={() => setView('clients')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                view === 'clients'
                  ? 'bg-amber-400 text-[#0a1628]'
                  : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
              }`}
            >
              Clients
            </button>
            <button
              onClick={() => setView('sandbox')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                view === 'sandbox'
                  ? 'bg-amber-400 text-[#0a1628]'
                  : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
              }`}
            >
              <FlaskConical size={15} /> Sandbox
            </button>
            {/* Back to the open client's audit. Big Wave is a tab in there
                rather than a top-level view: it is about one client, and a
                nav tab that only works when a client happens to be open reads
                as broken the first time it is clicked from the dashboard. */}
            {hasClient && (
              <button
                onClick={() => setView('audit')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  view === 'audit'
                    ? 'bg-amber-400 text-[#0a1628]'
                    : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
                }`}
              >
                Audit
              </button>
            )}
            <button
              onClick={() => setView('beach')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                view === 'beach'
                  ? 'bg-amber-400 text-[#0a1628]'
                  : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
              }`}
            >
              <BeachIcon size={15} /> The Beach
            </button>
            {role === 'admin' && (
              <button
                onClick={() => setView('admin')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  view === 'admin'
                    ? 'bg-amber-400 text-[#0a1628]'
                    : 'bg-slate-800/60 text-slate-300 hover:text-amber-300 border border-slate-600'
                }`}
              >
                <SlidersHorizontal size={15} /> Defaults
              </button>
            )}
          </>
        ) : (
          <span className="text-amber-300 font-bold text-sm tracking-wide">Your Energy Best</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500 hidden sm:inline" title="Your resolved access level">
          {role}
        </span>
        <span className="text-xs text-slate-400 hidden sm:block">{userEmail}</span>
        <button onClick={onSignOut} className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-300 text-sm hover:text-amber-300">
          Sign out
        </button>
      </div>
    </div>
  );
}
